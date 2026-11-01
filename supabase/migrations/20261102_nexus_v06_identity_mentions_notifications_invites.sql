-- Nexus v0.6
-- Identity decorations, Quick-Alt message identity, mention validation,
-- SMTP-independent in-app notifications, and reliable community invites.
-- Run once after v0.5. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Quick-Alt: messages retain the real account sender_id while optionally
-- carrying an alt_profile_id owned by the same authenticated account.
-- ---------------------------------------------------------------------------
alter table public.messages
  add column if not exists alt_profile_id uuid references public.alt_profiles(id) on delete set null;
create index if not exists messages_alt_profile_idx
  on public.messages(alt_profile_id) where alt_profile_id is not null;

create or replace function public.guard_nexus_v06_message_identity()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  alt_owner uuid;
  mention jsonb;
  mention_type text;
  mention_id uuid;
  channel_community uuid;
begin
  if new.sender_id <> auth.uid() then
    raise exception 'El remitente del mensaje no coincide con la sesión.';
  end if;

  if new.alt_profile_id is not null then
    select owner_id into alt_owner
      from public.alt_profiles
     where id = new.alt_profile_id;
    if alt_owner is null or alt_owner <> auth.uid() then
      raise exception 'Esta cuenta alternativa no te pertenece.';
    end if;
  end if;

  if new.formatting is null or jsonb_typeof(new.formatting) <> 'object' then
    new.formatting := '{}'::jsonb;
  end if;
  if new.formatting ? 'mentions' and jsonb_typeof(new.formatting -> 'mentions') not in ('array','null') then
    raise exception 'La lista de menciones debe ser una lista.';
  end if;
  if jsonb_typeof(new.formatting -> 'mentions') = 'array'
     and jsonb_array_length(new.formatting -> 'mentions') > 30 then
    raise exception 'La lista de menciones no puede superar 30 elementos.';
  end if;

  if jsonb_typeof(new.formatting -> 'mentions') = 'array'
     and jsonb_array_length(new.formatting -> 'mentions') > 0 then
    if new.channel_id is not null then
      select community_id into channel_community
        from public.channels where id = new.channel_id;
      if channel_community is null or not public.is_community_member(channel_community) then
        raise exception 'No perteneces al megagrupo de este canal.';
      end if;
    end if;

    for mention in select value from jsonb_array_elements(new.formatting -> 'mentions') loop
      mention_type := mention ->> 'type';
      begin
        mention_id := (mention ->> 'id')::uuid;
      exception when invalid_text_representation or null_value_not_allowed then
        raise exception 'Una mención contiene un identificador no válido.';
      end;

      if mention_type = 'user' then
        if new.conversation_id is not null then
          if not public.is_conversation_member(new.conversation_id)
             or not exists (select 1 from public.conversation_members cm
                            where cm.conversation_id=new.conversation_id and cm.user_id=mention_id) then
            raise exception 'Solo puedes mencionar a participantes de esta conversación.';
          end if;
        elsif not exists (select 1 from public.community_members cm
                          where cm.community_id=channel_community and cm.user_id=mention_id) then
          raise exception 'Solo puedes mencionar a miembros de este megagrupo.';
        end if;
      elsif mention_type = 'role' then
        if new.channel_id is null or not exists (
          select 1 from public.community_roles cr
           where cr.id=mention_id and cr.community_id=channel_community
        ) then
          raise exception 'El rol mencionado no pertenece a este megagrupo.';
        end if;
      else
        raise exception 'Tipo de mención no válido.';
      end if;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists nexus_v06_message_identity_guard on public.messages;
create trigger nexus_v06_message_identity_guard
before insert or update of sender_id, alt_profile_id, formatting on public.messages
for each row execute function public.guard_nexus_v06_message_identity();
-- Trigger functions are not callable as regular RPCs. Keep execution available
-- to PostgreSQL's trigger executor to avoid permission failures on message writes.


-- Editing a message and its mention metadata is one transaction. The trigger
-- above validates that the mentioned IDs belong to this exact chat/channel.
create or replace function public.edit_message_with_mentions(
  p_message_id uuid,
  p_body text,
  p_mentions jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  owner_id uuid;
  kind text;
  room_conversation uuid;
  room_channel uuid;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if public.is_user_banned() then raise exception 'Tu cuenta está suspendida.'; end if;
  if p_body is null or length(trim(p_body)) = 0 or length(p_body) > 12000 then
    raise exception 'El mensaje debe tener entre 1 y 12000 caracteres.';
  end if;
  if p_mentions is null or jsonb_typeof(p_mentions) <> 'array' or jsonb_array_length(p_mentions) > 30 then
    raise exception 'La lista de menciones no es válida.';
  end if;

  select sender_id, message_type, conversation_id, channel_id
    into owner_id, kind, room_conversation, room_channel
    from public.messages where id=p_message_id for update;
  if not found then raise exception 'El mensaje ya no existe.'; end if;
  if owner_id <> auth.uid() then raise exception 'Solo puedes editar tus propios mensajes.'; end if;
  if room_conversation is not null and not public.is_conversation_member(room_conversation) then
    raise exception 'Ya no perteneces a esta conversación.';
  end if;
  if room_channel is not null and not exists (
    select 1 from public.channels ch where ch.id=room_channel and public.is_community_member(ch.community_id)
  ) then raise exception 'Ya no perteneces a este megagrupo.'; end if;
  if kind <> 'text' then raise exception 'Solo se pueden editar mensajes de texto.'; end if;

  update public.messages
     set body=trim(p_body),
         edited_at=now(),
         formatting=jsonb_set(coalesce(formatting,'{}'::jsonb),'{mentions}',p_mentions,true)
   where id=p_message_id and sender_id=auth.uid();
end;
$$;
revoke all on function public.edit_message_with_mentions(uuid,text,jsonb) from public, anon;
grant execute on function public.edit_message_with_mentions(uuid,text,jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Profile font upload support. profile-media remains public because fonts,
-- avatar overlays and profile decorations must be renderable by other users.
-- Writes remain restricted to the owner's UUID folder by existing policies.
-- ---------------------------------------------------------------------------
update storage.buckets
   set file_size_limit = 8388608,
       allowed_mime_types = array[
         'image/png','image/jpeg','image/webp','image/gif',
         'font/woff','font/woff2','application/font-woff','application/font-woff2',
         'application/x-font-ttf','font/ttf'
       ]
 where id = 'profile-media';

-- ---------------------------------------------------------------------------
-- Invites: explicit grants and a defensive implementation. The v0.5 UI asked
-- another modal for a duration while the settings dialog was already open;
-- v0.6 creates a default 7-day link directly and displays it in the dialog.
-- ---------------------------------------------------------------------------
create or replace function public.create_community_invite(
  p_community_id uuid,
  p_expires_hours integer default 168,
  p_max_uses integer default 0
)
returns text
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  invite_code text;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if public.is_user_banned() then raise exception 'Tu cuenta está suspendida.'; end if;
  if not exists (select 1 from public.communities where id=p_community_id) then
    raise exception 'No se ha encontrado el megagrupo.';
  end if;
  if not public.has_community_permission(p_community_id, 'create_invites') then
    raise exception 'No tienes permiso para crear invitaciones. El propietario puede conceder «Crear invitaciones» en los permisos de rol.';
  end if;
  if coalesce(p_expires_hours,168) < 1 or coalesce(p_expires_hours,168) > 720 then
    raise exception 'La invitación debe durar entre 1 y 720 horas.';
  end if;
  if coalesce(p_max_uses,0) < 0 or coalesce(p_max_uses,0) > 500 then
    raise exception 'El límite debe estar entre 0 y 500 usos. Usa 0 para ilimitado.';
  end if;

  invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  insert into public.community_invites(community_id, code, created_by, expires_at, max_uses)
  values(p_community_id, invite_code, auth.uid(), now() + make_interval(hours => coalesce(p_expires_hours,168)), coalesce(p_max_uses,0));
  return invite_code;
end;
$$;

create or replace function public.join_community_by_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  invite_row public.community_invites%rowtype;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if public.is_user_banned() then raise exception 'Tu cuenta está suspendida.'; end if;
  if p_code is null or length(trim(p_code)) <> 12 or upper(trim(p_code)) !~ '^[A-F0-9]{12}$' then
    raise exception 'Código de invitación no válido.';
  end if;

  select * into invite_row
    from public.community_invites
   where code = upper(trim(p_code))
   for update;
  if not found then raise exception 'La invitación no existe o ha sido revocada.'; end if;
  if invite_row.expires_at is not null and invite_row.expires_at <= now() then
    raise exception 'Esta invitación ha caducado.';
  end if;
  if invite_row.max_uses > 0 and invite_row.uses >= invite_row.max_uses
     and not public.is_community_member(invite_row.community_id) then
    raise exception 'Esta invitación ha alcanzado su límite de usos.';
  end if;

  if not public.is_community_member(invite_row.community_id) then
    insert into public.community_members(community_id, user_id)
    values(invite_row.community_id, auth.uid())
    on conflict do nothing;
    update public.community_invites set uses = uses + 1 where id = invite_row.id;
  end if;
  return invite_row.community_id;
end;
$$;

revoke all on function public.create_community_invite(uuid,integer,integer) from public, anon;
revoke all on function public.join_community_by_invite(text) from public, anon;
grant execute on function public.create_community_invite(uuid,integer,integer) to authenticated;
grant execute on function public.join_community_by_invite(text) to authenticated;

-- Keep invite table private: users can only create/use links through the RPCs.
alter table public.community_invites enable row level security;
revoke all on public.community_invites from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ensure v0.6 message notifications can listen through Supabase Realtime.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
     and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
