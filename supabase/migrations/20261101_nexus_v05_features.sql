-- Nexus v0.5 migration
-- Adds per-user conversation hiding/leaving, atomic polls, profile widgets,
-- community nicknames/invites, pinned messages and conversation read receipts.
-- Additive and safe to run once after the v0.4 migration.

-- ---------------------------------------------------------------------------
-- Per-user conversation visibility and leaving
-- ---------------------------------------------------------------------------
alter table public.conversation_members
  add column if not exists hidden_at timestamptz;

create index if not exists conversation_members_visible_idx
  on public.conversation_members(user_id, hidden_at, conversation_id);

-- A member may only update their own display/hidden fields. Column privileges
-- prevent changing role, ownership, or joined_at through PostgREST.
-- The base schema grants UPDATE on every table, so revoke that broad grant
-- before granting only the display fields Nexus needs to edit.
revoke update on public.conversation_members from authenticated;
grant update(hidden_at, personal_name, personal_icon_url)
  on public.conversation_members to authenticated;

drop policy if exists conversation_members_update_self_display on public.conversation_members;
create policy conversation_members_update_self_display
  on public.conversation_members
  for update to authenticated
  using (user_id = auth.uid() and public.is_conversation_member(conversation_id))
  with check (user_id = auth.uid() and public.is_conversation_member(conversation_id));

create or replace function public.leave_conversation(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  leaving_role text;
  conversation_kind text;
  successor_id uuid;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  select cm.role, c.kind into leaving_role, conversation_kind
    from public.conversation_members cm
    join public.conversations c on c.id = cm.conversation_id
   where cm.conversation_id = p_conversation_id and cm.user_id = auth.uid()
   for update of cm;
  if not found then raise exception 'Ya no perteneces a esta conversación.'; end if;

  -- Closing a DM removes it from this user's inbox without stranding the
  -- other person. A new incoming message will reopen it automatically.
  if conversation_kind = 'direct' then
    update public.conversation_members set hidden_at = now()
     where conversation_id = p_conversation_id and user_id = auth.uid();
    return;
  end if;

  -- Group conversations are actually left; the remaining members keep history.
  delete from public.conversation_members
   where conversation_id = p_conversation_id and user_id = auth.uid();

  if leaving_role = 'owner' then
    select user_id into successor_id
      from public.conversation_members
     where conversation_id = p_conversation_id
     order by joined_at asc
     limit 1;
    if successor_id is not null then
      update public.conversation_members
         set role = 'owner'
       where conversation_id = p_conversation_id and user_id = successor_id;
    end if;
  end if;

  if not exists (select 1 from public.conversation_members where conversation_id = p_conversation_id) then
    delete from public.conversations where id = p_conversation_id;
  end if;
end;
$$;
revoke all on function public.leave_conversation(uuid) from public, anon;
grant execute on function public.leave_conversation(uuid) to authenticated;

-- Incoming messages automatically bring an archived conversation back into
-- the recipient's inbox, while leaving the sender's own archive preference.
create or replace function public.bump_conversation_activity()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.conversation_id is not null then
    update public.conversations set updated_at=now() where id=new.conversation_id;
    update public.conversation_members
       set hidden_at=null
     where conversation_id=new.conversation_id
       and user_id<>new.sender_id
       and hidden_at is not null;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic poll creation fixes the insert-message / insert-poll realtime race.
-- The old client inserted these two rows separately, so the INSERT event could
-- render a plain message before the poll row existed, then render it again.
-- ---------------------------------------------------------------------------
create or replace function public.create_poll(
  p_context_type text,
  p_context_id uuid,
  p_question text,
  p_options jsonb,
  p_reply_to uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_message_id uuid;
  channel_community_id uuid;
  channel_kind text;
  cleaned_options jsonb;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if public.is_user_banned() then raise exception 'Tu cuenta está suspendida.'; end if;
  if p_question is null or length(trim(p_question)) < 1 or length(trim(p_question)) > 200 then
    raise exception 'La pregunta debe tener entre 1 y 200 caracteres.';
  end if;
  if p_options is null or jsonb_typeof(p_options) <> 'array' then
    raise exception 'Las opciones de la encuesta deben enviarse como una lista.';
  end if;
  if jsonb_array_length(p_options) < 2 or jsonb_array_length(p_options) > 10 then
    raise exception 'Una encuesta necesita entre 2 y 10 opciones.';
  end if;
  if exists (
    select 1
      from jsonb_array_elements(p_options) as item(value)
     where jsonb_typeof(item.value) <> 'string'
        or length(trim(item.value #>> '{}')) < 1
        or length(trim(item.value #>> '{}')) > 100
  ) then
    raise exception 'Cada opción debe tener entre 1 y 100 caracteres.';
  end if;
  select jsonb_agg(to_jsonb(trim(value #>> '{}')) order by ordinal)
    into cleaned_options
    from jsonb_array_elements(p_options) with ordinality as item(value, ordinal);

  if p_context_type = 'conversation' then
    if not public.is_conversation_member(p_context_id) then
      raise exception 'No perteneces a esta conversación.';
    end if;
    if p_reply_to is not null and not exists (
      select 1 from public.messages
       where id = p_reply_to and conversation_id = p_context_id
    ) then
      raise exception 'El mensaje citado no pertenece a esta conversación.';
    end if;
    insert into public.messages(sender_id, conversation_id, body, message_type, reply_to)
    values(auth.uid(), p_context_id, '📊 ' || trim(p_question), 'poll', p_reply_to)
    returning id into new_message_id;
  elsif p_context_type = 'channel' then
    select community_id, type into channel_community_id, channel_kind
      from public.channels where id = p_context_id;
    if not found or not public.is_community_member(channel_community_id) then
      raise exception 'No perteneces a este megagrupo.';
    end if;
    if channel_kind in ('media','voice') then
      raise exception 'Este tipo de canal no admite encuestas.';
    end if;
    if not public.has_community_permission(channel_community_id, 'send_messages') then
      raise exception 'No tienes permiso para enviar mensajes en este canal.';
    end if;
    if channel_kind = 'announcements'
       and not public.has_community_permission(channel_community_id, 'post_announcements') then
      raise exception 'Necesitas el permiso para publicar anuncios.';
    end if;
    if p_reply_to is not null and not exists (
      select 1 from public.messages
       where id = p_reply_to and channel_id = p_context_id
    ) then
      raise exception 'El mensaje citado no pertenece a este canal.';
    end if;
    insert into public.messages(sender_id, channel_id, body, message_type, reply_to)
    values(auth.uid(), p_context_id, '📊 ' || trim(p_question), 'poll', p_reply_to)
    returning id into new_message_id;
  else
    raise exception 'Tipo de conversación no válido.';
  end if;

  insert into public.polls(message_id, question, options, ends_at)
  values(new_message_id, trim(p_question), cleaned_options, null);

  return new_message_id;
end;
$$;
revoke all on function public.create_poll(text, uuid, text, jsonb, uuid) from public, anon;
grant execute on function public.create_poll(text, uuid, text, jsonb, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Profile widgets and community-specific nicknames
-- ---------------------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_widgets_limit;
alter table public.profiles
  add constraint profiles_widgets_limit
  check (case when jsonb_typeof(widgets) = 'array' then jsonb_array_length(widgets) <= 10 else false end);

-- The base schema grants UPDATE on every table; restrict this table to the
-- self-service nickname field so members cannot alter membership metadata.
revoke update on public.community_members from authenticated;
grant update(nickname) on public.community_members to authenticated;
drop policy if exists community_members_update_own_nickname on public.community_members;
create policy community_members_update_own_nickname
  on public.community_members
  for update to authenticated
  using (user_id = auth.uid() and public.is_community_member(community_id))
  with check (user_id = auth.uid() and public.is_community_member(community_id));

-- ---------------------------------------------------------------------------
-- Shareable community invite links
-- ---------------------------------------------------------------------------
create table if not exists public.community_invites (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  code text not null unique check (code ~ '^[A-F0-9]{12}$'),
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz,
  max_uses integer not null default 0 check (max_uses between 0 and 500),
  uses integer not null default 0 check (uses >= 0),
  created_at timestamptz not null default now()
);
create index if not exists community_invites_community_idx
  on public.community_invites(community_id, created_at desc);
alter table public.community_invites enable row level security;
revoke all on public.community_invites from anon, authenticated;

create or replace function public.create_community_invite(
  p_community_id uuid,
  p_expires_hours integer default 168,
  p_max_uses integer default 0
)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  invite_code text;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if public.is_user_banned() then raise exception 'Tu cuenta está suspendida.'; end if;
  if not public.has_community_permission(p_community_id, 'create_invites') then
    raise exception 'No tienes permiso para crear invitaciones.';
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
set search_path = public, auth
as $$
declare
  invite_row public.community_invites%rowtype;
  was_member boolean;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if public.is_user_banned() then raise exception 'Tu cuenta está suspendida.'; end if;
  if p_code is null or length(trim(p_code)) <> 12 then raise exception 'Código de invitación no válido.'; end if;

  select * into invite_row
    from public.community_invites
   where code = upper(trim(p_code))
   for update;
  if not found then raise exception 'La invitación no existe o ha sido revocada.'; end if;
  if invite_row.expires_at is not null and invite_row.expires_at <= now() then
    raise exception 'Esta invitación ha caducado.';
  end if;
  if invite_row.max_uses > 0 and invite_row.uses >= invite_row.max_uses then
    raise exception 'Esta invitación ha alcanzado su límite de usos.';
  end if;

  was_member := public.is_community_member(invite_row.community_id);
  if not was_member then
    insert into public.community_members(community_id, user_id)
    values(invite_row.community_id, auth.uid())
    on conflict do nothing;
    update public.community_invites set uses = uses + 1 where id = invite_row.id;
  end if;
  return invite_row.community_id;
end;
$$;
revoke all on function public.create_community_invite(uuid, integer, integer) from public, anon;

-- Resolve alliance requests by ID even when the target community is private.
-- The function checks the ID server-side instead of requiring a public SELECT.
create or replace function public.request_community_alliance(
  p_source_community_id uuid,
  p_target_community_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  request_id uuid;
  target_exists boolean;
  source_key text;
  target_key text;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if public.is_user_banned() then raise exception 'Tu cuenta está suspendida.'; end if;
  if not public.is_community_owner(p_source_community_id) then
    raise exception 'Solo el propietario puede solicitar alianzas.';
  end if;
  if p_source_community_id is null or p_target_community_id is null
     or p_source_community_id = p_target_community_id then
    raise exception 'Elige otro megagrupo para crear la alianza.';
  end if;
  select exists(select 1 from public.communities where id=p_target_community_id) into target_exists;
  if not target_exists then raise exception 'No existe un megagrupo con ese ID.'; end if;

  source_key := least(p_source_community_id::text,p_target_community_id::text);
  target_key := greatest(p_source_community_id::text,p_target_community_id::text);
  perform pg_advisory_xact_lock(hashtextextended(source_key || ':' || target_key,0));

  if exists (
    select 1 from public.alliance_requests ar
     where ar.status = 'accepted'
       and ((ar.source_community_id=p_source_community_id and ar.target_community_id=p_target_community_id)
         or (ar.source_community_id=p_target_community_id and ar.target_community_id=p_source_community_id))
  ) then raise exception 'Estos megagrupos ya están aliados.'; end if;
  if exists (
    select 1 from public.alliance_requests ar
     where ar.status = 'pending'
       and ((ar.source_community_id=p_source_community_id and ar.target_community_id=p_target_community_id)
         or (ar.source_community_id=p_target_community_id and ar.target_community_id=p_source_community_id))
  ) then raise exception 'Ya existe una solicitud de alianza pendiente.'; end if;

  delete from public.alliance_requests ar
   where ar.status='declined'
     and ((ar.source_community_id=p_source_community_id and ar.target_community_id=p_target_community_id)
       or (ar.source_community_id=p_target_community_id and ar.target_community_id=p_source_community_id));

  insert into public.alliance_requests(source_community_id,target_community_id,status)
  values(p_source_community_id,p_target_community_id,'pending')
  returning id into request_id;
  return request_id;
end;
$$;

create or replace function public.join_allied_community(p_source_community_id uuid, p_target_community_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if public.is_user_banned() then raise exception 'Tu cuenta está suspendida.'; end if;
  if not public.is_community_member(p_source_community_id) then
    raise exception 'Debes pertenecer al megagrupo de origen.';
  end if;
  if not exists (
    select 1 from public.alliance_requests ar
     where ar.status = 'accepted'
       and ((ar.source_community_id = p_source_community_id and ar.target_community_id = p_target_community_id)
         or (ar.source_community_id = p_target_community_id and ar.target_community_id = p_source_community_id))
  ) then
    raise exception 'No existe una alianza aceptada entre estos megagrupos.';
  end if;
  insert into public.community_members(community_id, user_id)
  values(p_target_community_id, auth.uid())
  on conflict do nothing;
  return p_target_community_id;
end;
$$;

revoke all on function public.join_community_by_invite(text) from public, anon;
create or replace function public.get_community_alliances(p_community_id uuid)
returns table(
  partner_id uuid,
  partner_name text,
  partner_icon_url text,
  request_id uuid,
  status text,
  direction text
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if not public.is_community_member(p_community_id) and not public.is_community_owner(p_community_id) then
    raise exception 'No perteneces a este megagrupo.';
  end if;
  return query
    select
      case when ar.source_community_id=p_community_id then ar.target_community_id else ar.source_community_id end,
      partner.name,
      partner.icon_url,
      ar.id,
      ar.status,
      case when ar.source_community_id=p_community_id then 'outgoing' else 'incoming' end
    from public.alliance_requests ar
    join public.communities partner
      on partner.id = case when ar.source_community_id=p_community_id then ar.target_community_id else ar.source_community_id end
    where ar.source_community_id=p_community_id or ar.target_community_id=p_community_id
    order by ar.created_at desc;
end;
$$;

revoke all on function public.request_community_alliance(uuid, uuid) from public, anon;
revoke all on function public.join_allied_community(uuid, uuid) from public, anon;
revoke all on function public.get_community_alliances(uuid) from public, anon;
grant execute on function public.create_community_invite(uuid, integer, integer) to authenticated;
grant execute on function public.join_community_by_invite(text) to authenticated;
grant execute on function public.request_community_alliance(uuid, uuid) to authenticated;
grant execute on function public.join_allied_community(uuid, uuid) to authenticated;
grant execute on function public.get_community_alliances(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Pin messages in DMs/groups and community channels
-- ---------------------------------------------------------------------------
create table if not exists public.pinned_messages (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references public.messages(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete cascade,
  pinned_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls(conversation_id, channel_id) = 1)
);
create index if not exists pinned_messages_conversation_idx
  on public.pinned_messages(conversation_id, created_at desc);
create index if not exists pinned_messages_channel_idx
  on public.pinned_messages(channel_id, created_at desc);
alter table public.pinned_messages enable row level security;
alter table public.pinned_messages replica identity full;
grant select, insert, delete on public.pinned_messages to authenticated;

drop policy if exists pinned_messages_read_members on public.pinned_messages;
create policy pinned_messages_read_members on public.pinned_messages
  for select to authenticated
  using (
    (conversation_id is not null and public.is_conversation_member(conversation_id))
    or (channel_id is not null and exists (
      select 1 from public.channels ch
       where ch.id = channel_id and public.is_community_member(ch.community_id)
    ))
  );

drop policy if exists pinned_messages_insert_members on public.pinned_messages;
create policy pinned_messages_insert_members on public.pinned_messages
  for insert to authenticated
  with check (
    pinned_by = auth.uid()
    and not public.is_user_banned()
    and exists (
      select 1 from public.messages m
       where m.id = message_id
         and m.conversation_id is not distinct from pinned_messages.conversation_id
         and m.channel_id is not distinct from pinned_messages.channel_id
         and (
           (pinned_messages.conversation_id is not null and public.is_conversation_member(pinned_messages.conversation_id))
           or (pinned_messages.channel_id is not null and exists (
             select 1 from public.channels ch
              where ch.id = pinned_messages.channel_id
                and public.has_community_permission(ch.community_id, 'manage_messages')
           ))
         )
    )
  );

drop policy if exists pinned_messages_delete_owner_or_moderator on public.pinned_messages;
create policy pinned_messages_delete_owner_or_moderator on public.pinned_messages
  for delete to authenticated
  using (
    (pinned_by = auth.uid() and (
      (conversation_id is not null and public.is_conversation_member(conversation_id))
      or (channel_id is not null and exists (
        select 1 from public.channels ch
         where ch.id = pinned_messages.channel_id and public.is_community_member(ch.community_id)
      ))
    ))
    or (channel_id is not null and exists (
      select 1 from public.channels ch
       where ch.id = pinned_messages.channel_id and public.has_community_permission(ch.community_id, 'manage_messages')
    ))
  );

-- ---------------------------------------------------------------------------
-- Read receipts for private/group conversations
-- ---------------------------------------------------------------------------
create table if not exists public.conversation_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_message_id uuid references public.messages(id) on delete set null,
  read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table public.conversation_reads enable row level security;
revoke all on public.conversation_reads from anon, authenticated;
grant select on public.conversation_reads to authenticated;

drop policy if exists conversation_reads_select_members on public.conversation_reads;
create policy conversation_reads_select_members on public.conversation_reads
  for select to authenticated
  using (
    public.is_conversation_member(conversation_id)
    and exists (
      select 1 from public.conversation_members cm
       where cm.conversation_id = conversation_reads.conversation_id
         and cm.user_id = conversation_reads.user_id
    )
  );

create or replace function public.mark_conversation_read(
  p_conversation_id uuid,
  p_message_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if not public.is_conversation_member(p_conversation_id) then
    raise exception 'No perteneces a esta conversación.';
  end if;
  if p_message_id is not null and not exists (
    select 1 from public.messages
     where id = p_message_id and conversation_id = p_conversation_id
  ) then
    raise exception 'El mensaje no pertenece a esta conversación.';
  end if;
  insert into public.conversation_reads(conversation_id, user_id, last_read_message_id, read_at)
  values(p_conversation_id, auth.uid(), p_message_id, now())
  on conflict (conversation_id, user_id)
  do update set last_read_message_id = excluded.last_read_message_id, read_at = excluded.read_at;
end;
$$;
revoke all on function public.mark_conversation_read(uuid, uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid, uuid) to authenticated;

-- Publish realtime tables. These checks keep this migration repeatable.
do $$
declare table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    for table_name in select unnest(array['poll_votes','pinned_messages','conversation_reads']) loop
      if not exists (
        select 1 from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;

comment on function public.create_poll(text, uuid, text, jsonb, uuid)
  is 'Creates a poll message and poll record atomically to avoid a realtime rendering race.';
comment on function public.leave_conversation(uuid)
  is 'Closes a direct chat for the current user or leaves a group, promoting a successor owner if needed.';

comment on function public.get_community_alliances(uuid)
  is 'Lists only alliance-linked communities for a current member, including private partner metadata.';
