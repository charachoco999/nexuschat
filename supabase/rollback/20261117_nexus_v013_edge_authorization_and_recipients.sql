-- Rollback for the additive Nexus v0.13.0-alpha1 Edge bridge functions.
-- This does not affect objects already copied to R2 or the messages publication.
revoke all on function public.nexus_edge_authorize_media(text,text[],text) from public, anon, authenticated;
revoke all on function public.nexus_edge_message_recipients(uuid,uuid,uuid) from public, anon, authenticated, service_role;
revoke all on function public.nexus_edge_media_owner_lookup(text,text[]) from public, anon, authenticated, service_role;
revoke all on function public.nexus_edge_can_view_channel_for_user(uuid,uuid) from public, anon, authenticated, service_role;
drop function if exists public.nexus_edge_authorize_media(text,text[],text);
drop function if exists public.nexus_edge_message_recipients(uuid,uuid,uuid);
drop function if exists public.nexus_edge_media_owner_lookup(text,text[]);
drop function if exists public.nexus_edge_can_view_channel_for_user(uuid,uuid);

-- Restore the original chat-media Storage helpers from the v0.11.1 schema.
create or replace function public.can_upload_chat_media(p_object_name text)
returns boolean
language plpgsql stable security definer
set search_path = public, auth, storage, pg_temp
as $$
declare
  folders text[];
  target_id uuid;
  target_community uuid;
begin
  if auth.uid() is null or public.is_user_banned() then return false; end if;
  folders := storage.foldername(coalesce(p_object_name,''));
  if coalesce(array_length(folders,1),0) <> 2 then return false; end if;
  begin target_id := folders[2]::uuid; exception when invalid_text_representation then return false; end;
  if folders[1] = 'dm' then
    return exists (select 1 from public.conversation_members cm where cm.conversation_id=target_id and cm.user_id=auth.uid());
  elsif folders[1] = 'community' then
    select ch.community_id into target_community from public.channels ch where ch.id=target_id;
    return target_community is not null and public.is_community_member(target_community)
      and public.has_community_permission(target_community,'send_messages');
  end if;
  return false;
end;
$$;

create or replace function public.can_read_chat_media(p_object_name text)
returns boolean
language plpgsql stable security definer
set search_path = public, auth, storage, pg_temp
as $$
declare
  folders text[];
  target_id uuid;
  target_community uuid;
begin
  if auth.uid() is null then return false; end if;
  folders := storage.foldername(coalesce(p_object_name,''));
  if coalesce(array_length(folders,1),0) <> 2 then return false; end if;
  begin target_id := folders[2]::uuid; exception when invalid_text_representation then return false; end;
  if folders[1] = 'dm' then
    return exists (select 1 from public.conversation_members cm where cm.conversation_id=target_id and cm.user_id=auth.uid());
  elsif folders[1] = 'community' then
    select ch.community_id into target_community from public.channels ch where ch.id=target_id;
    return target_community is not null and public.is_community_member(target_community);
  end if;
  return false;
end;
$$;
revoke all on function public.can_upload_chat_media(text) from public, anon;
revoke all on function public.can_read_chat_media(text) from public, anon;
grant execute on function public.can_upload_chat_media(text) to authenticated;
grant execute on function public.can_read_chat_media(text) to authenticated;

-- Restore the pre-Edge helpers that this migration extended to understand the
-- `edge/` marker. These definitions match the original Nexus v0.11.1 schema.
create or replace function public.can_read_nexus_asset(p_object_name text)
returns boolean
language plpgsql stable security definer
set search_path = public, auth, storage, pg_temp
as $$
declare
  folders text[];
  scope_id uuid;
begin
  if auth.uid() is null then return false; end if;
  folders := storage.foldername(coalesce(p_object_name,''));

  if coalesce(array_length(folders,1),0)=2 and folders[1]='personal' then
    if folders[2]=auth.uid()::text then return true; end if;
    return exists (
      select 1
        from public.custom_assets a
        join public.messages m on (
          m.attachment->>'custom_asset_id'=a.id::text
          or coalesce(m.formatting->'custom_emojis','[]'::jsonb) @> jsonb_build_array(a.id::text)
          or exists (
            select 1 from public.message_reactions r
             where r.message_id=m.id
               and r.emoji='custom:' || a.id::text
          )
        )
       where a.asset_url=p_object_name
         and a.scope='personal'
         and (
           (m.conversation_id is not null and public.is_conversation_member(m.conversation_id))
           or (m.channel_id is not null and exists (
             select 1 from public.channels ch
              where ch.id=m.channel_id and public.is_community_member(ch.community_id)
           ))
         )
    );
  end if;
  if coalesce(array_length(folders,1),0)=3 and folders[1]='conversation' then
    begin scope_id := folders[2]::uuid; exception when others then return false; end;
    return public.is_conversation_member(scope_id);
  end if;
  if coalesce(array_length(folders,1),0)=3 and folders[1]='community' then
    begin scope_id := folders[2]::uuid; exception when others then return false; end;
    return public.is_community_member(scope_id);
  end if;
  return false;
end;
$$;
revoke all on function public.can_read_nexus_asset(text) from public, anon;
grant execute on function public.can_read_nexus_asset(text) to authenticated;

create or replace function public.guard_nexus_custom_asset()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare expected_prefix text;
begin
  if auth.uid() is null or new.owner_id<>auth.uid() then
    raise exception 'Solo puedes registrar recursos que hayas subido tú.';
  end if;
  if new.name is null or new.name !~ '^[a-z0-9_-]{2,32}$' then
    raise exception 'El nombre debe usar 2-32 letras minúsculas, números, guiones o guiones bajos.';
  end if;
  if new.asset_type not in ('sticker','emoji') then raise exception 'Tipo de recurso no válido.'; end if;
  if new.scope='personal' then
    if new.scope_id is not null then raise exception 'Un recurso personal no debe tener scope_id.'; end if;
    expected_prefix := 'personal/'||auth.uid()::text||'/';
  elsif new.scope='conversation' then
    if new.scope_id is null or not public.is_conversation_member(new.scope_id) then
      raise exception 'No perteneces a esta conversación.';
    end if;
    expected_prefix := 'conversation/'||new.scope_id::text||'/'||auth.uid()::text||'/';
  elsif new.scope='community' then
    if new.scope_id is null or not public.is_community_member(new.scope_id) then
      raise exception 'No perteneces a este megagrupo.';
    end if;
    expected_prefix := 'community/'||new.scope_id::text||'/'||auth.uid()::text||'/';
  else
    raise exception 'Ámbito del recurso no válido.';
  end if;
  if new.asset_url not like expected_prefix||'%' then
    raise exception 'La ruta del archivo no corresponde a tu ámbito y cuenta.';
  end if;
  return new;
end;
$$;
