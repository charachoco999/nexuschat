begin;

-- ---------------------------------------------------------------------------
-- Channels+: channel-specific overrides for members and community roles.
-- A member override wins over role overrides. If several assigned roles differ,
-- an explicit deny wins; otherwise any explicit allow wins. Missing values
-- inherit the existing community permission system.
-- ---------------------------------------------------------------------------
alter table public.channels
  add column if not exists important_announcements_enabled boolean not null default false;

-- Platform admins can choose any megagroup when publishing important notices.
drop policy if exists nexus_platform_admin_read_communities on public.communities;
create policy nexus_platform_admin_read_communities on public.communities
  for select to authenticated using(public.is_platform_admin());

create table if not exists public.channel_permission_overrides (
  channel_id uuid not null references public.channels(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  subject_type text not null check (subject_type in ('member','role')),
  subject_id uuid not null,
  permissions jsonb not null default '{}'::jsonb check (jsonb_typeof(permissions)='object'),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key(channel_id,subject_type,subject_id)
);
create index if not exists channel_permission_overrides_community_idx
  on public.channel_permission_overrides(community_id,subject_type,subject_id);
alter table public.channel_permission_overrides enable row level security;
drop policy if exists channel_permission_overrides_read on public.channel_permission_overrides;
create policy channel_permission_overrides_read on public.channel_permission_overrides
  for select to authenticated using(public.is_community_member(community_id));
drop policy if exists channel_permission_overrides_manage on public.channel_permission_overrides;
create policy channel_permission_overrides_manage on public.channel_permission_overrides
  for all to authenticated
  using(
    (public.has_community_permission(channel_permission_overrides.community_id,'manage_roles')
      or public.has_community_permission(channel_permission_overrides.community_id,'manage_channels'))
    and exists(select 1 from public.channels ch where ch.id=channel_permission_overrides.channel_id and ch.community_id=channel_permission_overrides.community_id)
  )
  with check(
    (public.has_community_permission(channel_permission_overrides.community_id,'manage_roles')
      or public.has_community_permission(channel_permission_overrides.community_id,'manage_channels'))
    and exists(select 1 from public.channels ch where ch.id=channel_permission_overrides.channel_id and ch.community_id=channel_permission_overrides.community_id)
    and channel_permission_overrides.updated_by=auth.uid()
    and ((channel_permission_overrides.subject_type='member' and exists(select 1 from public.community_members cm where cm.community_id=channel_permission_overrides.community_id and cm.user_id=channel_permission_overrides.subject_id))
      or (channel_permission_overrides.subject_type='role' and exists(select 1 from public.community_roles cr where cr.community_id=channel_permission_overrides.community_id and cr.id=channel_permission_overrides.subject_id)))
  );
grant select,insert,update,delete on public.channel_permission_overrides to authenticated;

create or replace function public.can_access_community_channel(p_channel_id uuid,p_permission text)
returns boolean language plpgsql stable security definer set search_path=public,auth,pg_temp
as $$
declare v_community uuid; v_channel_type text; v_member_value boolean; v_role_deny boolean; v_role_allow boolean; v_fallback boolean;
begin
  if auth.uid() is null then return false; end if;
  select community_id,type into v_community,v_channel_type from public.channels where id=p_channel_id;
  if v_community is null or not public.is_community_member(v_community) then return false; end if;
  if public.is_community_owner(v_community) then return true; end if;
  if public.has_community_permission(v_community,'manage_channels') then return true; end if;
  select (o.permissions->>p_permission)::boolean into v_member_value
    from public.channel_permission_overrides o
   where o.channel_id=p_channel_id and o.subject_type='member' and o.subject_id=auth.uid()
     and o.permissions ? p_permission;
  if found then return coalesce(v_member_value,false); end if;
  select coalesce(bool_or((o.permissions->>p_permission)::boolean=false),false),
         coalesce(bool_or((o.permissions->>p_permission)::boolean=true),false)
    into v_role_deny,v_role_allow
    from public.channel_permission_overrides o
    join public.member_roles mr on mr.role_id=o.subject_id and mr.community_id=o.community_id and mr.user_id=auth.uid()
   where o.channel_id=p_channel_id and o.subject_type='role' and o.permissions ? p_permission;
  if v_role_deny then return false; end if;
  if v_role_allow then return true; end if;
  v_fallback:=case p_permission
    when 'view_channel' then true
    when 'send_messages' then case when v_channel_type='announcements' then public.has_community_permission(v_community,'post_announcements') else public.has_community_permission(v_community,'send_messages') end
    when 'manage_messages' then public.has_community_permission(v_community,'manage_messages')
    when 'post_announcements' then public.has_community_permission(v_community,'post_announcements')
    when 'attach_files' then public.has_community_permission(v_community,'send_messages')
    when 'add_reactions' then true
    else false end;
  return coalesce(v_fallback,false);
end;
$$;
revoke all on function public.can_access_community_channel(uuid,text) from public,anon;
grant execute on function public.can_access_community_channel(uuid,text) to authenticated;

-- Replace the original channel/message policies so explicit channel denies are
-- enforced for both channel discovery and message visibility/writes.
drop policy if exists channels_read_members on public.channels;
create policy channels_read_members on public.channels for select to authenticated
  using(public.is_community_member(community_id) and public.can_access_community_channel(id,'view_channel'));
drop policy if exists messages_read_member on public.messages;
create policy messages_read_member on public.messages for select to authenticated using (
  (conversation_id is not null and public.is_conversation_member(messages.conversation_id))
  or (channel_id is not null and public.can_access_community_channel(messages.channel_id,'view_channel'))
);
drop policy if exists messages_insert_member on public.messages;
create policy messages_insert_member on public.messages for insert to authenticated with check (
  sender_id=auth.uid() and not public.is_user_banned() and not public.is_user_muted() and (
    (conversation_id is not null and public.is_conversation_member(messages.conversation_id))
    or (channel_id is not null
      and public.can_access_community_channel(messages.channel_id,'send_messages')
      and (messages.attachment is null or public.can_access_community_channel(messages.channel_id,'attach_files'))
      and (not exists(select 1 from public.channels ch where ch.id=messages.channel_id and ch.type='announcements')
        or public.can_access_community_channel(messages.channel_id,'post_announcements'))
      and (coalesce(messages.message_type,'text')<>'announcement'
        or public.can_access_community_channel(messages.channel_id,'post_announcements')))
  )
);

drop policy if exists messages_delete_own_or_moderator on public.messages;
create policy messages_delete_own_or_moderator on public.messages for delete to authenticated using (
  sender_id=auth.uid()
  or (channel_id is not null and public.can_access_community_channel(messages.channel_id,'manage_messages'))
);

drop policy if exists message_reactions_insert_self on public.message_reactions;
create policy message_reactions_insert_self on public.message_reactions for insert to authenticated with check (
  user_id=auth.uid() and not public.is_user_banned() and exists(
    select 1 from public.messages m
    where m.id=message_reactions.message_id
      and ((m.conversation_id is not null and public.is_conversation_member(m.conversation_id))
        or (m.channel_id is not null and public.can_access_community_channel(m.channel_id,'add_reactions')))
  )
);

-- ---------------------------------------------------------------------------
-- Forums. A forum is a category-like container; each board receives an ordinary
-- text channel so existing messages, mentions and realtime continue to work.
-- ---------------------------------------------------------------------------
create table if not exists public.community_forums (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null check(length(name) between 2 and 40),
  description text not null default '' check(length(description)<=240),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(community_id,name)
);
create table if not exists public.forum_boards (
  id uuid primary key default gen_random_uuid(),
  forum_id uuid not null references public.community_forums(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  channel_id uuid not null unique references public.channels(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(forum_id,channel_id)
);
create index if not exists community_forums_community_idx on public.community_forums(community_id,created_at);
create index if not exists forum_boards_forum_idx on public.forum_boards(forum_id,created_at);
alter table public.community_forums enable row level security;
alter table public.forum_boards enable row level security;
drop policy if exists community_forums_read_members on public.community_forums;
create policy community_forums_read_members on public.community_forums for select to authenticated using(public.is_community_member(community_id));
drop policy if exists community_forums_manage on public.community_forums;
create policy community_forums_manage on public.community_forums for all to authenticated
  using(public.has_community_permission(community_id,'manage_channels'))
  with check(public.has_community_permission(community_id,'manage_channels') and created_by=auth.uid());
drop policy if exists forum_boards_read_members on public.forum_boards;
create policy forum_boards_read_members on public.forum_boards for select to authenticated using(public.is_community_member(community_id));
drop policy if exists forum_boards_manage on public.forum_boards;
create policy forum_boards_manage on public.forum_boards for delete to authenticated using(created_by=auth.uid() or public.has_community_permission(community_id,'manage_channels'));
grant select,insert,update,delete on public.community_forums to authenticated;
grant select,delete on public.forum_boards to authenticated;

create or replace function public.create_community_forum(p_community_id uuid,p_name text,p_description text default '')
returns uuid language plpgsql security definer set search_path=public,auth,pg_temp
as $$
declare new_id uuid; clean_name text;
begin
  if auth.uid() is null or not public.has_community_permission(p_community_id,'manage_channels') then raise exception 'No tienes permiso para crear foros.'; end if;
  if public.is_user_banned() then raise exception 'Tu cuenta está suspendida.'; end if;
  clean_name:=trim(coalesce(p_name,''));
  if length(clean_name)<2 or length(clean_name)>40 then raise exception 'El nombre del foro debe tener entre 2 y 40 caracteres.'; end if;
  insert into public.community_forums(community_id,name,description,created_by)
  values(p_community_id,clean_name,left(coalesce(p_description,''),240),auth.uid()) returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.create_forum_board(p_forum_id uuid,p_name text,p_description text default '')
returns uuid language plpgsql security definer set search_path=public,auth,pg_temp
as $$
declare forum_row public.community_forums%rowtype; channel_new uuid; clean_name text;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if public.is_user_banned() then raise exception 'Tu cuenta está suspendida.'; end if;
  select * into forum_row from public.community_forums where id=p_forum_id;
  if not found or not public.is_community_member(forum_row.community_id) then raise exception 'No puedes crear un tablero en este foro.'; end if;
  clean_name:=lower(regexp_replace(trim(coalesce(p_name,'')),'\s+','-','g'));
  if length(clean_name)<1 or length(clean_name)>70 then raise exception 'El nombre del tablero debe tener entre 1 y 70 caracteres.'; end if;
  insert into public.channels(community_id,name,type,description,category,position)
  values(forum_row.community_id,clean_name,'text',left(coalesce(p_description,''),240),forum_row.name,coalesce((select max(position)+1 from public.channels where community_id=forum_row.community_id),0))
  returning id into channel_new;
  insert into public.forum_boards(forum_id,community_id,channel_id,created_by)
  values(p_forum_id,forum_row.community_id,channel_new,auth.uid());
  return channel_new;
end;
$$;
revoke all on function public.create_community_forum(uuid,text,text) from public,anon;
revoke all on function public.create_forum_board(uuid,text,text) from public,anon;
grant execute on function public.create_community_forum(uuid,text,text) to authenticated;
grant execute on function public.create_forum_board(uuid,text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- Important announcements. Global notices are visible to all accounts;
-- community notices are visible only inside channels that opted in.
-- ---------------------------------------------------------------------------
create table if not exists public.nexus_important_announcements (
  id uuid primary key default gen_random_uuid(),
  scope text not null check(scope in ('global','community')),
  community_id uuid references public.communities(id) on delete cascade,
  title text not null check(length(title) between 3 and 100),
  body text not null check(length(body) between 5 and 3000),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check((scope='global' and community_id is null) or (scope='community' and community_id is not null))
);
create index if not exists nexus_important_announcements_scope_idx on public.nexus_important_announcements(scope,community_id,created_at desc);
alter table public.nexus_important_announcements enable row level security;
drop policy if exists nexus_important_announcements_read on public.nexus_important_announcements;
create policy nexus_important_announcements_read on public.nexus_important_announcements for select to authenticated using(
  scope='global' or (scope='community' and public.is_community_member(community_id))
);
drop policy if exists nexus_important_announcements_admin_insert on public.nexus_important_announcements;
create policy nexus_important_announcements_admin_insert on public.nexus_important_announcements for insert to authenticated
  with check(created_by=auth.uid() and public.is_platform_admin());
grant select,insert on public.nexus_important_announcements to authenticated;

create or replace function public.create_nexus_important_announcement(p_scope text,p_community_id uuid,p_title text,p_body text)
returns uuid language plpgsql security definer set search_path=public,auth,pg_temp
as $$
declare new_id uuid;
begin
  if not public.is_platform_admin() then raise exception 'Solo los administradores de plataforma pueden publicar avisos importantes.'; end if;
  if p_scope not in ('global','community') then raise exception 'Alcance de aviso no válido.'; end if;
  if p_scope='community' and (p_community_id is null or not exists(select 1 from public.communities where id=p_community_id)) then raise exception 'Selecciona un megagrupo válido.'; end if;
  if p_scope='global' then p_community_id:=null; end if;
  insert into public.nexus_important_announcements(scope,community_id,title,body,created_by)
  values(p_scope,p_community_id,left(trim(p_title),100),left(trim(p_body),3000),auth.uid()) returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.create_nexus_important_announcement(text,uuid,text,text) from public,anon;
grant execute on function public.create_nexus_important_announcement(text,uuid,text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- Badge request workflow and moderation history used by reputation settings.
-- ---------------------------------------------------------------------------
create table if not exists public.nexus_badge_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  proposed_name text not null check(length(proposed_name) between 2 and 40),
  reason text not null check(length(reason) between 10 and 1500),
  status text not null default 'submitted' check(status in ('submitted','reviewing','accepted','rejected')),
  admin_note text not null default '' check(length(admin_note)<=1000),
  approved_badge_id uuid references public.global_badges(id) on delete set null,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists nexus_badge_requests_status_idx on public.nexus_badge_requests(status,created_at desc);
alter table public.nexus_badge_requests enable row level security;
drop policy if exists nexus_badge_requests_read on public.nexus_badge_requests;
create policy nexus_badge_requests_read on public.nexus_badge_requests for select to authenticated using(user_id=auth.uid() or public.is_platform_admin());
drop policy if exists nexus_badge_requests_submit on public.nexus_badge_requests;
create policy nexus_badge_requests_submit on public.nexus_badge_requests for insert to authenticated with check(user_id=auth.uid() and not public.is_user_banned());
drop policy if exists nexus_badge_requests_admin_update on public.nexus_badge_requests;
create policy nexus_badge_requests_admin_update on public.nexus_badge_requests for update to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
grant select,insert,update on public.nexus_badge_requests to authenticated;

create or replace function public.notify_nexus_badge_request_change()
returns trigger language plpgsql security definer set search_path=public,auth,pg_temp
as $$
begin
  if TG_OP='INSERT' then
    insert into public.nexus_system_messages(user_id,title,body,message_type)
    values(new.user_id,'Nexus (App)','Hemos recibido tu solicitud de insignia «'||new.proposed_name||'».','notice');
    new.updated_at:=now();
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.nexus_system_messages(user_id,title,body,message_type)
    values(new.user_id,'Nexus (App)',case new.status
      when 'reviewing' then 'Tu solicitud de insignia «'||new.proposed_name||'» está en revisión.'
      when 'accepted' then 'Tu solicitud de insignia «'||new.proposed_name||'» ha sido aceptada. Recibirás la insignia próximamente.'
      when 'rejected' then 'Tu solicitud de insignia «'||new.proposed_name||'» ha sido rechazada.'
      else 'El estado de tu solicitud de insignia ha cambiado.' end
      ||case when coalesce(new.admin_note,'')<>'' then ' Nota: '||left(new.admin_note,700) else '' end,'notice');
  end if;

  if new.status='accepted' and new.approved_badge_id is not null
     and (new.status is distinct from old.status or new.approved_badge_id is distinct from old.approved_badge_id) then
    insert into public.global_badge_assignments(badge_id,user_id,assigned_by)
    values(new.approved_badge_id,new.user_id,coalesce(new.reviewed_by,auth.uid())) on conflict do nothing;
  end if;

  new.updated_at:=now();
  return new;
end;
$$;
drop trigger if exists nexus_badge_request_notify on public.nexus_badge_requests;
create trigger nexus_badge_request_notify before insert or update on public.nexus_badge_requests
for each row execute function public.notify_nexus_badge_request_change();

create table if not exists public.nexus_moderation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null check(action_type in ('warning','ban','mute','unban','unmute')),
  duration_seconds bigint not null default 0 check(duration_seconds>=0),
  created_at timestamptz not null default now()
);
create index if not exists nexus_moderation_history_user_idx on public.nexus_moderation_history(user_id,action_type,created_at desc);
alter table public.nexus_moderation_history enable row level security;
drop policy if exists nexus_moderation_history_read on public.nexus_moderation_history;
create policy nexus_moderation_history_read on public.nexus_moderation_history for select to authenticated using(user_id=auth.uid() or public.is_platform_admin());
grant select on public.nexus_moderation_history to authenticated;

create or replace function public.log_nexus_system_warning()
returns trigger language plpgsql security definer set search_path=public,auth,pg_temp
as $$
begin
  if new.message_type='warning' then
    insert into public.nexus_moderation_history(user_id,action_type) values(new.user_id,'warning');
  end if;
  return new;
end;
$$;
drop trigger if exists nexus_moderation_warning_history on public.nexus_system_messages;
create trigger nexus_moderation_warning_history after insert on public.nexus_system_messages
for each row execute function public.log_nexus_system_warning();

create or replace function public.log_nexus_ban_history()
returns trigger language plpgsql security definer set search_path=public,auth,pg_temp
as $$
declare seconds_value bigint;
begin
  if TG_OP in ('UPDATE','DELETE') then
    update public.nexus_moderation_history h
       set duration_seconds=case when old.banned_until is null
         then greatest(0,extract(epoch from (now()-old.created_at))::bigint)
         else least(h.duration_seconds,greatest(0,extract(epoch from (now()-old.created_at))::bigint)) end
     where h.id=(select h2.id from public.nexus_moderation_history h2
                 where h2.user_id=old.user_id and h2.action_type='ban' and h2.created_at>=old.created_at
                 order by h2.created_at desc limit 1);
  end if;
  if TG_OP='DELETE' then
    insert into public.nexus_moderation_history(user_id,action_type) values(old.user_id,'unban');
    return old;
  end if;
  seconds_value:=case when new.banned_until is null then 0 else greatest(0,extract(epoch from (new.banned_until-now()))::bigint) end;
  insert into public.nexus_moderation_history(user_id,action_type,duration_seconds) values(new.user_id,'ban',seconds_value);
  return new;
end;
$$;
drop trigger if exists nexus_moderation_ban_history on public.user_bans;
create trigger nexus_moderation_ban_history after insert or update or delete on public.user_bans
for each row execute function public.log_nexus_ban_history();

create or replace function public.log_nexus_mute_history()
returns trigger language plpgsql security definer set search_path=public,auth,pg_temp
as $$
declare seconds_value bigint;
begin
  if TG_OP in ('UPDATE','DELETE') then
    update public.nexus_moderation_history h
       set duration_seconds=least(h.duration_seconds,greatest(0,extract(epoch from (now()-old.created_at))::bigint))
     where h.id=(select h2.id from public.nexus_moderation_history h2
                 where h2.user_id=old.user_id and h2.action_type='mute' and h2.created_at>=old.created_at
                 order by h2.created_at desc limit 1);
  end if;
  if TG_OP='DELETE' then
    insert into public.nexus_moderation_history(user_id,action_type) values(old.user_id,'unmute');
    return old;
  end if;
  seconds_value:=greatest(0,extract(epoch from (new.muted_until-now()))::bigint);
  insert into public.nexus_moderation_history(user_id,action_type,duration_seconds) values(new.user_id,'mute',seconds_value);
  return new;
end;
$$;
drop trigger if exists nexus_moderation_mute_history on public.nexus_user_mutes;
create trigger nexus_moderation_mute_history after insert or update or delete on public.nexus_user_mutes
for each row execute function public.log_nexus_mute_history();

-- Keep channel-specific permission checks in realtime topic authorization.
create or replace function public.can_join_nexus_app_topic(p_topic text)
returns boolean language plpgsql stable security definer set search_path=public,auth,pg_temp
as $$
declare target_id uuid;
begin
  if auth.uid() is null or public.is_user_banned() then return false; end if;
  if p_topic in ('nexus-friends-'||auth.uid()::text,'nexus-inbox-'||auth.uid()::text,'nexus-notifications-'||auth.uid()::text) then return true; end if;
  if p_topic ~ '^nexus-(conversation|channel)-[0-9a-fA-F-]{36}$' then
    begin target_id:=regexp_replace(p_topic,'^nexus-(conversation|channel)-','')::uuid; exception when others then return false; end;
    if split_part(p_topic,'-',2)='conversation' then return public.is_conversation_member(target_id); end if;
    return public.can_access_community_channel(target_id,'view_channel');
  end if;
  return false;
end;
$$;
revoke all on function public.can_join_nexus_app_topic(text) from public,anon;
grant execute on function public.can_join_nexus_app_topic(text) to authenticated;

commit;
