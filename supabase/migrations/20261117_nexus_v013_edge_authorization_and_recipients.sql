-- Nexus v0.13.0-alpha1: Cloudflare Edge bridge.
-- Keeps Supabase Auth, PostgreSQL, RLS and existing Storage buckets in place.
-- This migration does not export/delete user data or alter messages.

-- Tighten the existing Storage helpers to honor Channels+ per-channel overrides.
-- The v0.11.x helpers checked only community membership for channel files.
create or replace function public.can_upload_chat_media(p_object_name text)
returns boolean
language plpgsql stable security definer
set search_path = public, auth, storage, pg_temp
as $$
declare
  folders text[];
  target_id uuid;
begin
  if auth.uid() is null or public.is_user_banned() then return false; end if;
  folders := storage.foldername(coalesce(p_object_name,''));
  if coalesce(array_length(folders,1),0) <> 2 then return false; end if;
  begin target_id := folders[2]::uuid; exception when invalid_text_representation then return false; end;
  if folders[1] = 'dm' then
    return exists (select 1 from public.conversation_members cm where cm.conversation_id=target_id and cm.user_id=auth.uid());
  elsif folders[1] = 'community' then
    return public.can_access_community_channel(target_id,'send_messages')
      and public.can_access_community_channel(target_id,'attach_files');
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
begin
  if auth.uid() is null then return false; end if;
  folders := storage.foldername(coalesce(p_object_name,''));
  if coalesce(array_length(folders,1),0) <> 2 then return false; end if;
  begin target_id := folders[2]::uuid; exception when invalid_text_representation then return false; end;
  if folders[1] = 'dm' then
    return exists (select 1 from public.conversation_members cm where cm.conversation_id=target_id and cm.user_id=auth.uid());
  elsif folders[1] = 'community' then
    return public.can_access_community_channel(target_id,'view_channel');
  end if;
  return false;
end;
$$;
revoke all on function public.can_upload_chat_media(text) from public, anon;
revoke all on function public.can_read_chat_media(text) from public, anon;
grant execute on function public.can_upload_chat_media(text) to authenticated;
grant execute on function public.can_read_chat_media(text) to authenticated;

create or replace function public.nexus_edge_authorize_media(
  p_bucket text,
  p_object_names text[],
  p_action text default 'read'
)
returns table(object_name text, allowed boolean)
language plpgsql
stable
security definer
set search_path = public, auth, storage, pg_temp
as $$
declare
  v_name text;
  v_original_name text;
  v_is_edge boolean;
  v_uid uuid := auth.uid();
  v_allowed boolean;
begin
  if v_uid is null
     or p_bucket not in ('chat-media','profile-media','nexus-assets')
     or p_action not in ('read','upload','delete') then
    return query
      select t.item, false
      from unnest(coalesce(p_object_names, array[]::text[])) as t(item);
    return;
  end if;

  for v_original_name in
    select distinct t.item
    from unnest(coalesce(p_object_names, array[]::text[])) as t(item)
    where t.item is not null and length(t.item) between 1 and 900
  loop
    v_is_edge := left(v_original_name, 5) = 'edge/';
    v_name := case when v_is_edge then substr(v_original_name, 6) else v_original_name end;
    v_allowed := false;

    if p_bucket = 'chat-media' then
      if p_action = 'read' then
        v_allowed := public.can_read_chat_media(v_name);
      elsif p_action = 'upload' then
        v_allowed := public.can_upload_chat_media(v_name);
      elsif p_action = 'delete' then
        if v_is_edge then
          -- New R2 objects carry ownerId metadata; the Worker checks it.
          v_allowed := public.can_read_chat_media(v_name);
        else
          -- Legacy files retain their original Storage owner record in Supabase.
          select exists (
            select 1 from storage.objects o
             where o.bucket_id = 'chat-media'
               and o.name = v_name
               and o.owner_id::text = v_uid::text
          ) into v_allowed;
        end if;
      end if;

    elsif p_bucket = 'profile-media' then
      if p_action = 'read' then
        v_allowed := true; -- Matches the existing public-read profile-media bucket.
      elsif p_action = 'upload' then
        v_allowed := split_part(v_name, '/', 1) = v_uid::text
          and not public.is_user_banned();
      elsif p_action = 'delete' then
        v_allowed := split_part(v_name, '/', 1) = v_uid::text;
      end if;

    elsif p_bucket = 'nexus-assets' then
      if p_action = 'read' then
        v_allowed := public.can_read_nexus_asset(v_name);
      elsif p_action = 'upload' then
        v_allowed := public.can_upload_nexus_asset(v_name);
      elsif p_action = 'delete' then
        v_allowed := public.can_delete_nexus_asset(v_name);
      end if;
    end if;

    return query select v_original_name, coalesce(v_allowed, false);
  end loop;
end;
$$;

revoke all on function public.nexus_edge_authorize_media(text,text[],text) from public, anon;
grant execute on function public.nexus_edge_authorize_media(text,text[],text) to authenticated;
comment on function public.nexus_edge_authorize_media(text,text[],text) is
  'Nexus Cloudflare Edge authorization bridge. Reuses existing Storage permission helpers for authenticated R2 operations.';

-- Edge-marked asset paths must preserve the old sharing rule for personal
-- stickers/emojis while comparing the canonical path stored in the metadata row.
create or replace function public.can_read_nexus_asset(p_object_name text)
returns boolean
language plpgsql stable security definer
set search_path = public, auth, storage, pg_temp
as $$
declare
  folders text[];
  scope_id uuid;
  canonical_name text;
begin
  if auth.uid() is null then return false; end if;
  canonical_name := case when left(coalesce(p_object_name,''),5)='edge/' then substr(p_object_name,6) else coalesce(p_object_name,'') end;
  folders := storage.foldername(canonical_name);

  if coalesce(array_length(folders,1),0)=2 and folders[1]='personal' then
    if folders[2]=auth.uid()::text then return true; end if;
    return exists (
      select 1
        from public.custom_assets a
        join public.messages m on (
          m.attachment->>'custom_asset_id'=a.id::text
          or coalesce(m.formatting->'custom_emojis','[]'::jsonb) @> jsonb_build_array(a.id::text)
          or exists (select 1 from public.message_reactions r where r.message_id=m.id and r.emoji='custom:' || a.id::text)
        )
       where (case when left(a.asset_url,5)='edge/' then substr(a.asset_url,6) else a.asset_url end)=canonical_name
         and a.scope='personal'
         and (
           (m.conversation_id is not null and public.is_conversation_member(m.conversation_id))
           or (m.channel_id is not null and public.can_access_community_channel(m.channel_id,'view_channel'))
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

-- Accept the R2 marker in the asset row while validating the same ownership/scope.
create or replace function public.guard_nexus_custom_asset()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  expected_prefix text;
  canonical_path text;
begin
  if auth.uid() is null or new.owner_id<>auth.uid() then
    raise exception 'Solo puedes registrar recursos que hayas subido tú.';
  end if;
  if new.name is null or new.name !~ '^[a-z0-9_-]{2,32}$' then
    raise exception 'El nombre debe usar 2-32 letras minúsculas, números, guiones o guiones bajos.';
  end if;
  if new.asset_type not in ('sticker','emoji') then raise exception 'Tipo de recurso no válido.'; end if;
  canonical_path := case when left(coalesce(new.asset_url,''),5)='edge/' then substr(new.asset_url,6) else new.asset_url end;
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
  if canonical_path not like expected_prefix||'%' then
    raise exception 'La ruta del archivo no corresponde a tu ámbito y cuenta.';
  end if;
  return new;
end;
$$;

-- Evaluate the existing Channels+ view permission for an explicit recipient.
-- This server-only helper prevents notification fan-out from exposing previews
-- to community members who are denied access to a restricted channel.
create or replace function public.nexus_edge_can_view_channel_for_user(
  p_channel_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_community uuid;
  v_owner uuid;
  v_member_value boolean;
  v_role_deny boolean;
  v_role_allow boolean;
begin
  if p_channel_id is null or p_user_id is null then return false; end if;
  select ch.community_id, c.owner_id
    into v_community, v_owner
    from public.channels ch
    join public.communities c on c.id = ch.community_id
   where ch.id = p_channel_id;
  if v_community is null then return false; end if;
  if v_owner = p_user_id then return true; end if;
  if not exists (
    select 1 from public.community_members cm
     where cm.community_id = v_community and cm.user_id = p_user_id
  ) then return false; end if;
  if exists (
    select 1 from public.member_roles mr
    join public.community_roles cr on cr.id = mr.role_id and cr.community_id = mr.community_id
    where mr.community_id = v_community and mr.user_id = p_user_id
      and coalesce((cr.permissions -> 'manage_channels') = 'true'::jsonb, false)
  ) then return true; end if;

  select (o.permissions->>'view_channel')::boolean
    into v_member_value
    from public.channel_permission_overrides o
   where o.channel_id = p_channel_id and o.subject_type = 'member'
     and o.subject_id = p_user_id and o.permissions ? 'view_channel';
  if found then return coalesce(v_member_value, false); end if;

  select coalesce(bool_or((o.permissions->>'view_channel')::boolean = false), false),
         coalesce(bool_or((o.permissions->>'view_channel')::boolean = true), false)
    into v_role_deny, v_role_allow
    from public.channel_permission_overrides o
    join public.member_roles mr on mr.role_id = o.subject_id and mr.community_id = o.community_id
   where o.channel_id = p_channel_id and o.subject_type = 'role'
     and mr.user_id = p_user_id and o.permissions ? 'view_channel';
  if v_role_deny then return false; end if;
  if v_role_allow then return true; end if;
  return true; -- Channels+ inherits view_channel=true absent an explicit override.
end;
$$;
revoke all on function public.nexus_edge_can_view_channel_for_user(uuid,uuid) from public, anon, authenticated;
grant execute on function public.nexus_edge_can_view_channel_for_user(uuid,uuid) to service_role;

-- Compact, single-call notification recipient lookup. It returns only user IDs,
-- rather than asking the Worker to download conversation/community member rows
-- page by page for every new message. Only the server-side service_role may call it.
create or replace function public.nexus_edge_message_recipients(
  p_conversation_id uuid default null,
  p_channel_id uuid default null,
  p_sender_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_recipients jsonb;
begin
  if p_conversation_id is not null then
    select coalesce(jsonb_agg(cm.user_id::text), '[]'::jsonb)
      into v_recipients
      from public.conversation_members cm
     where cm.conversation_id = p_conversation_id
       and cm.user_id is distinct from p_sender_id;
  elsif p_channel_id is not null then
    select coalesce(jsonb_agg(distinct cm.user_id::text), '[]'::jsonb)
      into v_recipients
      from public.community_members cm
      join public.channels ch on ch.community_id = cm.community_id
     where ch.id = p_channel_id
       and cm.user_id is distinct from p_sender_id
       and public.nexus_edge_can_view_channel_for_user(p_channel_id, cm.user_id);
  else
    v_recipients := '[]'::jsonb;
  end if;
  return coalesce(v_recipients, '[]'::jsonb);
end;
$$;

revoke all on function public.nexus_edge_message_recipients(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.nexus_edge_message_recipients(uuid,uuid,uuid) to service_role;
comment on function public.nexus_edge_message_recipients(uuid,uuid,uuid) is
  'Nexus Edge server-only recipient lookup for new-message notification fan-out. Filters channel recipients through Channels+ view access.';

-- Used by the optional backfill utility to preserve legacy chat-media ownership
-- in R2 metadata. The raw Storage owner table is never exposed to browser users.
create or replace function public.nexus_edge_media_owner_lookup(
  p_bucket text,
  p_object_names text[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, storage, pg_temp
as $$
declare
  v_owners jsonb;
begin
  if p_bucket <> 'chat-media' then return '{}'::jsonb; end if;
  select coalesce(
    jsonb_object_agg(o.name, o.owner_id::text) filter (where o.owner_id is not null),
    '{}'::jsonb
  ) into v_owners
  from storage.objects o
  where o.bucket_id = 'chat-media'
    and o.name = any(coalesce(p_object_names, array[]::text[]));
  return coalesce(v_owners, '{}'::jsonb);
end;
$$;
revoke all on function public.nexus_edge_media_owner_lookup(text,text[]) from public, anon, authenticated;
grant execute on function public.nexus_edge_media_owner_lookup(text,text[]) to service_role;
comment on function public.nexus_edge_media_owner_lookup(text,text[]) is
  'Server-only helper for preserving legacy chat-media uploader ownership in Cloudflare R2 object metadata.';

