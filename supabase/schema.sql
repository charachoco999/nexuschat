-- NEXUS: initial Supabase schema
-- Run this file once in Supabase SQL Editor, using the project owner role.
-- The first administrator is granted manually at the end of this file.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Profiles and private moderation metadata
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username = lower(username) and username ~ '^[a-z0-9_]{3,24}$'),
  nickname text not null default '',
  avatar_url text,
  banner_url text,
  bio text not null default '' check (length(bio) <= 300),
  pronouns text not null default '' check (length(pronouns) <= 30),
  aliases text[] not null default '{}',
  default_name_color text not null default '#a99bff' check (default_name_color ~ '^#[0-9A-Fa-f]{6}$'),
  name_font_url text,
  name_effect_url text,
  profile_effect_url text,
  profile_plate_url text,
  profile_frame_url text,
  widgets jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','moderator')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists public.user_bans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  banned_until timestamptz,
  reason text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, auth
as $$ select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin','moderator')); $$;

create or replace function public.is_user_banned()
returns boolean language sql stable security definer set search_path = public, auth
as $$ select exists (select 1 from public.user_bans where user_id = auth.uid() and (banned_until is null or banned_until > now())); $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, auth
as $$
declare candidate text;
begin
  candidate := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', 'user_' || substr(new.id::text,1,8)), '[^a-z0-9_]', '', 'g'));
  if length(candidate) < 3 then candidate := 'user_' || substr(new.id::text,1,8); end if;
  if exists (select 1 from public.profiles where username=candidate) then
    candidate := left(candidate,15) || '_' || substr(new.id::text,1,8);
  end if;
  insert into public.profiles (id, username, nickname)
  values (new.id, candidate, coalesce(new.raw_user_meta_data ->> 'nickname',''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql security definer set search_path = public, auth
as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
for each row execute procedure public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Friends and private/group conversations
-- -----------------------------------------------------------------------------
create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references auth.users(id) on delete cascade,
  addressee uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','blocked')),
  created_at timestamptz not null default now(),
  unique (requester, addressee),
  check (requester <> addressee)
);
create unique index if not exists friends_pair_unique_idx on public.friends(least(requester,addressee),greatest(requester,addressee));
create index if not exists friends_addressee_status_idx on public.friends(addressee,status);
create index if not exists friends_requester_status_idx on public.friends(requester,status);

create or replace function public.guard_friend_request_update()
returns trigger language plpgsql security definer set search_path = public, auth
as $$
begin
  if row(new.id,new.requester,new.addressee,new.created_at) is distinct from row(old.id,old.requester,old.addressee,old.created_at) then
    raise exception 'Los datos de una solicitud no se pueden cambiar.';
  end if;
  if old.status not in ('pending','accepted') or new.status not in ('accepted','declined','blocked') then
    raise exception 'Transición de solicitud no válida.';
  end if;
  return new;
end;
$$;
drop trigger if exists friends_guard_update on public.friends;
create trigger friends_guard_update before update on public.friends
for each row execute procedure public.guard_friend_request_update();


create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct','group')),
  title text,
  icon_url text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  personal_name text,
  personal_icon_url text,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists conversation_members_user_idx on public.conversation_members(user_id,conversation_id);

create or replace function public.is_conversation_member(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public, auth
as $$ select exists (select 1 from public.conversation_members where conversation_id=p_conversation_id and user_id=auth.uid()); $$;

create or replace function public.create_conversation(p_kind text, p_title text default null, p_member_ids uuid[] default '{}')
returns uuid language plpgsql security definer set search_path = public, auth
as $$
declare new_id uuid; other_id uuid;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if public.is_user_banned() then raise exception 'Tu cuenta está suspendida.'; end if;
  if p_kind not in ('direct','group') then raise exception 'Tipo de conversación no válido.'; end if;
  if coalesce(array_length(p_member_ids,1),0) < 1 or array_length(p_member_ids,1) > 99 then raise exception 'Selecciona entre 1 y 99 participantes.'; end if;
  if p_kind = 'direct' and array_length(p_member_ids,1) <> 1 then raise exception 'Un MD debe tener dos participantes.'; end if;
  if auth.uid() = any(p_member_ids) then raise exception 'No puedes añadirte dos veces.'; end if;
  if exists (select 1 from unnest(p_member_ids) as members(member_id) where not exists(select 1 from public.profiles p where p.id=members.member_id)) then raise exception 'Hay participantes que no existen.'; end if;
  if exists (
    select 1 from unnest(p_member_ids) as members(member_id)
    where not exists (
      select 1 from public.friends f
      where f.status='accepted'
        and ((f.requester=auth.uid() and f.addressee=members.member_id) or (f.addressee=auth.uid() and f.requester=members.member_id))
    )
  ) then raise exception 'Solo puedes crear conversaciones con amigos aceptados.'; end if;

  insert into public.conversations(kind,title,created_by) values(p_kind,nullif(trim(p_title),''),auth.uid()) returning id into new_id;
  insert into public.conversation_members(conversation_id,user_id,role) values(new_id,auth.uid(),'owner');
  foreach other_id in array p_member_ids loop
    insert into public.conversation_members(conversation_id,user_id,role) values(new_id,other_id,'member');
  end loop;
  return new_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Megagroups, channels, roles, badges and alliances
-- -----------------------------------------------------------------------------
create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  name text not null check (length(name) between 2 and 60),
  description text not null default '' check (length(description) <= 500),
  icon_url text,
  banner_url text,
  background_url text,
  name_color text not null default '#a99bff' check (name_color ~ '^#[0-9A-Fa-f]{6}$'),
  custom_css text not null default '',
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text,
  joined_at timestamptz not null default now(),
  primary key (community_id,user_id)
);
create index if not exists community_members_user_idx on public.community_members(user_id,community_id);

create table if not exists public.community_roles (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null,
  color text not null default '#a99bff' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  permissions jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  unique (community_id,name),
  unique (id,community_id)
);

create table if not exists public.member_roles (
  community_id uuid not null,
  user_id uuid not null,
  role_id uuid not null,
  primary key (community_id,user_id,role_id),
  foreign key (community_id,user_id) references public.community_members(community_id,user_id) on delete cascade,
  foreign key (role_id,community_id) references public.community_roles(id,community_id) on delete cascade
);


create or replace function public.assign_default_community_role()
returns trigger language plpgsql security definer set search_path = public, auth
as $$
declare default_role uuid;
begin
  select id into default_role from public.community_roles
  where community_id=new.community_id and name='Miembro'
  order by position asc limit 1;
  if default_role is not null then
    insert into public.member_roles(community_id,user_id,role_id)
    values(new.community_id,new.user_id,default_role)
    on conflict do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists community_member_default_role on public.community_members;
create trigger community_member_default_role after insert on public.community_members
for each row execute procedure public.assign_default_community_role();


create or replace function public.is_community_member(p_community_id uuid)
returns boolean language sql stable security definer set search_path = public, auth
as $$ select exists (select 1 from public.community_members where community_id = p_community_id and user_id = auth.uid()); $$;

create or replace function public.is_community_owner(p_community_id uuid)
returns boolean language sql stable security definer set search_path = public, auth
as $$ select exists (select 1 from public.communities where id = p_community_id and owner_id = auth.uid()); $$;

create or replace function public.has_community_permission(p_community_id uuid, p_permission text)
returns boolean language sql stable security definer set search_path = public, auth
as $$
  select public.is_community_owner(p_community_id)
  or exists (
    select 1
    from public.member_roles mr
    join public.community_roles cr on cr.id = mr.role_id and cr.community_id = mr.community_id
    where mr.community_id = p_community_id
      and mr.user_id = auth.uid()
      and coalesce((cr.permissions -> p_permission) = 'true'::jsonb, false)
  );
$$;


create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null check (length(name) between 1 and 70),
  type text not null default 'text' check (type in ('text','announcements','voice','media')),
  description text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create or replace function public.create_community(p_name text, p_description text default '')
returns uuid language plpgsql security definer set search_path = public, auth
as $$
declare new_id uuid; member_role_id uuid;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if public.is_user_banned() then raise exception 'Tu cuenta está suspendida.'; end if;
  if length(trim(coalesce(p_name,''))) < 2 or length(trim(p_name)) > 60 then raise exception 'El nombre debe tener entre 2 y 60 caracteres.'; end if;
  insert into public.communities(owner_id,name,description) values(auth.uid(),trim(p_name),coalesce(p_description,'')) returning id into new_id;
  insert into public.community_members(community_id,user_id) values(new_id,auth.uid());
  insert into public.community_roles(community_id,name,color,permissions,position)
  values(new_id,'Miembro','#a99bff','{"send_messages":true,"create_invites":true,"post_announcements":false}'::jsonb,0)
  returning id into member_role_id;
  insert into public.member_roles(community_id,user_id,role_id) values(new_id,auth.uid(),member_role_id);
  insert into public.channels(community_id,name,type,position) values(new_id,'general','text',0);
  return new_id;
end;
$$;

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  name text not null,
  icon_url text not null,
  animated boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.member_badges (
  badge_id uuid not null references public.badges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  primary key (badge_id,user_id)
);

create table if not exists public.alliance_requests (
  id uuid primary key default gen_random_uuid(),
  source_community_id uuid not null references public.communities(id) on delete cascade,
  target_community_id uuid not null references public.communities(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  unique (source_community_id,target_community_id),
  check (source_community_id <> target_community_id)
);
create index if not exists alliance_requests_target_status_idx on public.alliance_requests(target_community_id,status);
create or replace function public.guard_alliance_update()
returns trigger language plpgsql security definer set search_path = public, auth
as $$
begin
  if row(new.id,new.source_community_id,new.target_community_id,new.created_at) is distinct from row(old.id,old.source_community_id,old.target_community_id,old.created_at) then
    raise exception 'Los datos de una alianza no se pueden cambiar.';
  end if;
  if old.status <> 'pending' or new.status not in ('accepted','declined') then
    raise exception 'Transición de alianza no válida.';
  end if;
  return new;
end;
$$;
drop trigger if exists alliance_guard_update on public.alliance_requests;
create trigger alliance_guard_update before update on public.alliance_requests
for each row execute procedure public.guard_alliance_update();


-- -----------------------------------------------------------------------------
-- Messages, polls, reusable stickers/emoji and presets
-- -----------------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '' check (length(body) <= 12000),
  message_type text not null default 'text' check (message_type in ('text','poll','system','media')),
  attachment jsonb,
  formatting jsonb not null default '{}'::jsonb,
  reply_to uuid references public.messages(id) on delete set null,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  check (((conversation_id is not null)::integer + (channel_id is not null)::integer) = 1)
);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id,created_at);
create index if not exists messages_channel_created_idx on public.messages(channel_id,created_at);
create index if not exists messages_conversation_created_desc_idx on public.messages(conversation_id,created_at desc,id desc);
create index if not exists messages_channel_created_desc_idx on public.messages(channel_id,created_at desc,id desc);
create index if not exists messages_reply_to_idx on public.messages(reply_to) where reply_to is not null;

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id,user_id,emoji)
);
create index if not exists message_reactions_message_idx on public.message_reactions(message_id);


create or replace function public.guard_message_reply()
returns trigger language plpgsql set search_path = public, auth
as $$
declare target_conversation uuid; target_channel uuid;
begin
  if new.reply_to is null then return new; end if;
  select conversation_id,channel_id into target_conversation,target_channel from public.messages where id=new.reply_to;
  if not found then raise exception 'El mensaje al que respondes ya no existe o no es accesible.'; end if;
  if target_conversation is distinct from new.conversation_id or target_channel is distinct from new.channel_id then
    raise exception 'Solo puedes responder a mensajes del mismo chat.';
  end if;
  return new;
end;
$$;
drop trigger if exists messages_guard_reply on public.messages;
create trigger messages_guard_reply before insert or update of reply_to on public.messages
for each row execute function public.guard_message_reply();

create or replace function public.edit_message(p_message_id uuid,p_body text)
returns void language plpgsql security definer set search_path = public, auth
as $$
declare owner_id uuid; kind text; room_conversation uuid; room_channel uuid;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if public.is_user_banned() then raise exception 'Tu cuenta está suspendida.'; end if;
  if p_body is null or length(trim(p_body))=0 or length(p_body)>12000 then raise exception 'El mensaje debe tener entre 1 y 12000 caracteres.'; end if;
  select sender_id,message_type,conversation_id,channel_id into owner_id,kind,room_conversation,room_channel from public.messages where id=p_message_id;
  if not found then raise exception 'El mensaje ya no existe.'; end if;
  if owner_id<>auth.uid() then raise exception 'Solo puedes editar tus propios mensajes.'; end if;
  if room_conversation is not null and not public.is_conversation_member(room_conversation) then raise exception 'Ya no perteneces a esta conversación.'; end if;
  if room_channel is not null and not exists(select 1 from public.channels ch where ch.id=room_channel and public.is_community_member(ch.community_id)) then raise exception 'Ya no perteneces a este megagrupo.'; end if;
  if kind<>'text' then raise exception 'Solo se pueden editar mensajes de texto.'; end if;
  update public.messages set body=trim(p_body),edited_at=now() where id=p_message_id and sender_id=auth.uid();
end;
$$;
revoke all on function public.edit_message(uuid,text) from public;
grant execute on function public.edit_message(uuid,text) to authenticated;

create or replace function public.bump_conversation_activity()
returns trigger language plpgsql security definer set search_path = public, auth
as $$
begin
  if new.conversation_id is not null then update public.conversations set updated_at=now() where id=new.conversation_id; end if;
  return new;
end;
$$;
drop trigger if exists messages_bump_conversation_activity on public.messages;
create trigger messages_bump_conversation_activity after insert on public.messages
for each row execute function public.bump_conversation_activity();

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references public.messages(id) on delete cascade,
  question text not null,
  options jsonb not null check (jsonb_typeof(options)='array' and jsonb_array_length(options) between 2 and 10),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.poll_votes (
  poll_id uuid not null references public.polls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  option_index integer not null check (option_index >= 0),
  created_at timestamptz not null default now(),
  primary key (poll_id,user_id)
);

create table if not exists public.custom_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  asset_type text not null check (asset_type in ('sticker','emoji')),
  scope text not null check (scope in ('personal','conversation','community')),
  scope_id uuid,
  name text not null,
  asset_url text not null,
  animated boolean not null default false,
  created_at timestamptz not null default now(),
  check ((scope='personal' and scope_id is null) or (scope<>'personal' and scope_id is not null))
);

create table if not exists public.alt_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  nickname text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  unique(owner_id,username)
);

create table if not exists public.presets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 2 and 60),
  description text not null default '' check (length(description) <= 300),
  preset_type text not null check (preset_type in ('client','profile','community')),
  config jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Moderation RPCs. Only admins/moderators can run these functions.
-- A null duration is a permanent ban.
-- -----------------------------------------------------------------------------
create or replace function public.admin_ban_user(p_target uuid, p_reason text default '', p_hours integer default null)
returns void language plpgsql security definer set search_path = public, auth
as $$
begin
  if not public.is_admin() then raise exception 'No tienes permisos de administración.'; end if;
  if p_target = auth.uid() then raise exception 'No puedes banear tu propia cuenta.'; end if;
  if p_hours is not null and (p_hours < 1 or p_hours > 87600) then raise exception 'Duración no válida.'; end if;
  insert into public.user_bans(user_id,banned_until,reason,created_by)
  values(p_target,case when p_hours is null then null else now() + make_interval(hours => p_hours) end,coalesce(p_reason,''),auth.uid())
  on conflict(user_id) do update set banned_until=excluded.banned_until,reason=excluded.reason,created_by=excluded.created_by,created_at=now();
end;
$$;

create or replace function public.admin_unban_user(p_target uuid)
returns void language plpgsql security definer set search_path = public, auth
as $$
begin
  if not public.is_admin() then raise exception 'No tienes permisos de administración.'; end if;
  delete from public.user_bans where user_id=p_target;
end;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_bans enable row level security;
alter table public.friends enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_roles enable row level security;
alter table public.member_roles enable row level security;
alter table public.channels enable row level security;
alter table public.badges enable row level security;
alter table public.member_badges enable row level security;
alter table public.alliance_requests enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
grant select, insert, delete on public.message_reactions to authenticated;
alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;
alter table public.custom_assets enable row level security;
alter table public.alt_profiles enable row level security;
alter table public.presets enable row level security;

-- Profiles are public to signed-in users; users can edit only their own profile.
drop policy if exists profiles_read_authenticated on public.profiles;
create policy profiles_read_authenticated on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (id=auth.uid() and not public.is_user_banned()) with check (id=auth.uid() and not public.is_user_banned());

-- Role and ban tables are deliberately not directly readable by ordinary users.
drop policy if exists user_roles_admin_read on public.user_roles;
create policy user_roles_admin_read on public.user_roles for select to authenticated using (public.is_admin());
drop policy if exists user_bans_admin_read on public.user_bans;
create policy user_bans_admin_read on public.user_bans for select to authenticated using (public.is_admin());

-- Friend requests.
drop policy if exists friends_read_participant on public.friends;
create policy friends_read_participant on public.friends for select to authenticated using (requester=auth.uid() or addressee=auth.uid());
drop policy if exists friends_create_request on public.friends;
create policy friends_create_request on public.friends for insert to authenticated with check (requester=auth.uid() and status='pending' and not public.is_user_banned());
drop policy if exists friends_accept_request on public.friends;
create policy friends_accept_request on public.friends for update to authenticated using (addressee=auth.uid() and status in ('pending','accepted')) with check (addressee=auth.uid() and status in ('accepted','declined','blocked'));
drop policy if exists friends_cancel_request on public.friends;
create policy friends_cancel_request on public.friends for delete to authenticated using (requester=auth.uid() or addressee=auth.uid());

-- Conversation visibility is membership-based. Creation is performed through the checked RPC above.
drop policy if exists conversations_read_members on public.conversations;
create policy conversations_read_members on public.conversations for select to authenticated using (public.is_conversation_member(id));
drop policy if exists conversation_members_read_self on public.conversation_members;
create policy conversation_members_read_self on public.conversation_members for select to authenticated using (public.is_conversation_member(conversation_id));

-- Communities are discoverable; channels and members require membership where appropriate.
drop policy if exists communities_read_signed_in on public.communities;
create policy communities_read_signed_in on public.communities for select to authenticated using (is_public=true or public.is_community_member(id));
drop policy if exists communities_update_owner on public.communities;
create policy communities_update_owner on public.communities for update to authenticated using (owner_id::text=auth.uid()::text) with check (owner_id::text=auth.uid()::text);
drop policy if exists community_members_read on public.community_members;
create policy community_members_read on public.community_members for select to authenticated using (public.is_community_member(community_id) or user_id=auth.uid());
drop policy if exists community_members_join_public on public.community_members;
create policy community_members_join_public on public.community_members for insert to authenticated with check (user_id=auth.uid() and not public.is_user_banned() and exists(select 1 from public.communities c where c.id=community_id and c.is_public=true));
drop policy if exists community_members_leave_self on public.community_members;
create policy community_members_leave_self on public.community_members for delete to authenticated using (user_id=auth.uid() or public.is_community_owner(community_id));
drop policy if exists community_roles_read_members on public.community_roles;
create policy community_roles_read_members on public.community_roles for select to authenticated using (public.is_community_member(community_id));
drop policy if exists community_roles_manage on public.community_roles;
create policy community_roles_manage on public.community_roles for all to authenticated using (public.has_community_permission(community_id,'manage_roles')) with check (public.has_community_permission(community_id,'manage_roles'));
drop policy if exists member_roles_read_members on public.member_roles;
create policy member_roles_read_members on public.member_roles for select to authenticated using (public.is_community_member(community_id));
drop policy if exists member_roles_manage on public.member_roles;
create policy member_roles_manage on public.member_roles for all to authenticated using (public.has_community_permission(community_id,'manage_roles')) with check (public.has_community_permission(community_id,'manage_roles'));
drop policy if exists channels_read_members on public.channels;
create policy channels_read_members on public.channels for select to authenticated using (public.is_community_member(community_id));
drop policy if exists channels_manage on public.channels;
create policy channels_manage on public.channels for all to authenticated using (public.has_community_permission(community_id,'manage_channels')) with check (public.has_community_permission(community_id,'manage_channels'));

-- Messages: only members can read or write. Banned users cannot send messages.
drop policy if exists messages_read_member on public.messages;
create policy messages_read_member on public.messages for select to authenticated using (
  (conversation_id is not null and public.is_conversation_member(messages.conversation_id))
  or (channel_id is not null and exists(select 1 from public.channels ch where ch.id=messages.channel_id and public.is_community_member(ch.community_id)))
);
drop policy if exists messages_insert_member on public.messages;
create policy messages_insert_member on public.messages for insert to authenticated with check (
  sender_id=auth.uid() and not public.is_user_banned() and (
    (conversation_id is not null and public.is_conversation_member(messages.conversation_id))
    or (channel_id is not null and exists(select 1 from public.channels ch where ch.id=messages.channel_id and public.is_community_member(ch.community_id) and public.has_community_permission(ch.community_id,'send_messages')))
  )
);
drop policy if exists messages_delete_own_or_moderator on public.messages;
create policy messages_delete_own_or_moderator on public.messages for delete to authenticated using (
  sender_id=auth.uid() or (channel_id is not null and exists(select 1 from public.channels ch where ch.id=messages.channel_id and public.has_community_permission(ch.community_id,'manage_messages')))
);

drop policy if exists message_reactions_read_member on public.message_reactions;
create policy message_reactions_read_member on public.message_reactions for select to authenticated using (exists(select 1 from public.messages m where m.id=message_id));
drop policy if exists message_reactions_insert_self on public.message_reactions;
create policy message_reactions_insert_self on public.message_reactions for insert to authenticated with check (user_id=auth.uid() and not public.is_user_banned() and exists(select 1 from public.messages m where m.id=message_id));
drop policy if exists message_reactions_delete_self on public.message_reactions;
create policy message_reactions_delete_self on public.message_reactions for delete to authenticated using (user_id=auth.uid());

-- Polls and votes inherit message visibility.
drop policy if exists polls_read_message_members on public.polls;
create policy polls_read_message_members on public.polls for select to authenticated using (exists(select 1 from public.messages m where m.id=message_id));
drop policy if exists polls_create_message_author on public.polls;
create policy polls_create_message_author on public.polls for insert to authenticated with check (exists(select 1 from public.messages m where m.id=message_id and m.sender_id=auth.uid() and m.message_type='poll'));
drop policy if exists poll_votes_read on public.poll_votes;
create policy poll_votes_read on public.poll_votes for select to authenticated using (exists(select 1 from public.polls p join public.messages m on m.id=p.message_id where p.id=poll_id));
drop policy if exists poll_votes_insert_self on public.poll_votes;
create policy poll_votes_insert_self on public.poll_votes for insert to authenticated with check (
  user_id=auth.uid() and exists(select 1 from public.polls p join public.messages m on m.id=p.message_id where p.id=poll_id and option_index < jsonb_array_length(p.options) and (p.ends_at is null or p.ends_at > now()))
);
drop policy if exists poll_votes_update_self on public.poll_votes;
create policy poll_votes_update_self on public.poll_votes for update to authenticated using (user_id=auth.uid()) with check (
  user_id=auth.uid() and exists(select 1 from public.polls p where p.id=poll_id and option_index < jsonb_array_length(p.options) and (p.ends_at is null or p.ends_at > now()))
);

-- Community-created and personal badges/assets.
drop policy if exists badges_read_signed_in on public.badges;
create policy badges_read_signed_in on public.badges for select to authenticated using (community_id is null or public.is_community_member(community_id));
drop policy if exists badges_create_owner on public.badges;
create policy badges_create_owner on public.badges for insert to authenticated with check (owner_id::text=auth.uid()::text and not public.is_user_banned() and (community_id is null or public.has_community_permission(community_id,'manage_badges')));
drop policy if exists member_badges_read_signed_in on public.member_badges;
create policy member_badges_read_signed_in on public.member_badges for select to authenticated using (true);
drop policy if exists member_badges_assign_admin on public.member_badges;
create policy member_badges_assign_admin on public.member_badges for all to authenticated
using (
  exists (
    select 1 from public.badges b
    where b.id=member_badges.badge_id and (
      (b.community_id is null and member_badges.community_id is null and b.owner_id=auth.uid() and member_badges.user_id=auth.uid())
      or (b.community_id is not null and b.community_id=member_badges.community_id
          and public.has_community_permission(b.community_id,'manage_badges')
          and exists(select 1 from public.community_members cm where cm.community_id=b.community_id and cm.user_id=member_badges.user_id))
    )
  )
)
with check (
  exists (
    select 1 from public.badges b
    where b.id=member_badges.badge_id and (
      (b.community_id is null and member_badges.community_id is null and b.owner_id=auth.uid() and member_badges.user_id=auth.uid())
      or (b.community_id is not null and b.community_id=member_badges.community_id
          and public.has_community_permission(b.community_id,'manage_badges')
          and exists(select 1 from public.community_members cm where cm.community_id=b.community_id and cm.user_id=member_badges.user_id))
    )
  )
);

-- Alliances are visible only to people in either community. Target owner accepts/declines.
drop policy if exists alliances_read_members on public.alliance_requests;
create policy alliances_read_members on public.alliance_requests for select to authenticated using (public.is_community_member(source_community_id) or public.is_community_member(target_community_id));
drop policy if exists alliances_request_source_owner on public.alliance_requests;
create policy alliances_request_source_owner on public.alliance_requests for insert to authenticated with check (public.is_community_owner(source_community_id) and status='pending' and not public.is_user_banned());
drop policy if exists alliances_target_owner_respond on public.alliance_requests;
create policy alliances_target_owner_respond on public.alliance_requests for update to authenticated using (public.is_community_owner(target_community_id) and status='pending') with check (public.is_community_owner(target_community_id) and status in ('accepted','declined'));

-- Personal alt profiles, custom assets and presets.
drop policy if exists alt_profiles_read_signed_in on public.alt_profiles;
create policy alt_profiles_read_signed_in on public.alt_profiles for select to authenticated using (true);
drop policy if exists alt_profiles_manage_owner on public.alt_profiles;
create policy alt_profiles_manage_owner on public.alt_profiles for all to authenticated using (owner_id::text=auth.uid()::text) with check (owner_id::text=auth.uid()::text and not public.is_user_banned());
drop policy if exists custom_assets_read_scope on public.custom_assets;
create policy custom_assets_read_scope on public.custom_assets for select to authenticated using (
  (scope='personal' and owner_id::text=auth.uid()::text)
  or (scope='conversation' and exists(select 1 from public.conversation_members cm where cm.conversation_id=scope_id and cm.user_id=auth.uid()))
  or (scope='community' and public.is_community_member(scope_id))
);
drop policy if exists custom_assets_create_owner on public.custom_assets;
create policy custom_assets_create_owner on public.custom_assets for insert to authenticated with check (
  owner_id::text=auth.uid()::text and not public.is_user_banned() and (
    (scope='personal' and scope_id is null)
    or (scope='conversation' and exists(select 1 from public.conversation_members cm where cm.conversation_id=scope_id and cm.user_id=auth.uid()))
    or (scope='community' and public.is_community_member(scope_id))
  )
);
drop policy if exists presets_read_public on public.presets;
create policy presets_read_public on public.presets for select to authenticated using (is_public=true or owner_id::text=auth.uid()::text);
drop policy if exists presets_create_owner on public.presets;
create policy presets_create_owner on public.presets for insert to authenticated with check (owner_id::text=auth.uid()::text and not public.is_user_banned());
drop policy if exists presets_update_owner on public.presets;
create policy presets_update_owner on public.presets for update to authenticated using (owner_id::text=auth.uid()::text) with check (owner_id::text=auth.uid()::text);
drop policy if exists presets_delete_owner on public.presets;
create policy presets_delete_owner on public.presets for delete to authenticated using (owner_id::text=auth.uid()::text);

-- Grant access to PostgREST roles; RLS above remains the access-control layer.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_user_banned() from public, anon;
revoke all on function public.is_conversation_member(uuid) from public, anon;
revoke all on function public.is_community_member(uuid) from public, anon;
revoke all on function public.is_community_owner(uuid) from public, anon;
revoke all on function public.has_community_permission(uuid,text) from public, anon;
revoke all on function public.create_conversation(text,text,uuid[]) from public, anon;
revoke all on function public.create_community(text,text) from public, anon;
revoke all on function public.admin_ban_user(uuid,text,integer) from public, anon;
revoke all on function public.admin_unban_user(uuid) from public, anon;
revoke all on function public.guard_friend_request_update() from public, anon;
revoke all on function public.guard_alliance_update() from public, anon;
revoke all on function public.handle_new_user() from public, anon;
revoke all on function public.touch_updated_at() from public, anon;
revoke all on function public.assign_default_community_role() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_user_banned() to authenticated;
grant execute on function public.is_community_member(uuid) to authenticated;
grant execute on function public.is_conversation_member(uuid) to authenticated;
grant execute on function public.is_community_owner(uuid) to authenticated;
grant execute on function public.has_community_permission(uuid,text) to authenticated;
grant execute on function public.create_conversation(text,text,uuid[]) to authenticated;
grant execute on function public.create_community(text,text) to authenticated;
grant execute on function public.admin_ban_user(uuid,text,integer) to authenticated;
grant execute on function public.admin_unban_user(uuid) to authenticated;

-- Storage buckets. Profile media is public; chat files remain private and membership-gated.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
 ('profile-media','profile-media',true,8388608,array['image/png','image/jpeg','image/webp','image/gif']),
 ('chat-media','chat-media',false,52428800,array['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm','application/pdf','text/plain','application/zip'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- Storage policies call narrow SECURITY DEFINER helpers rather than querying
-- RLS-protected application tables inline from storage.objects policies.
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
  begin
    target_id := folders[2]::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  if folders[1] = 'dm' then
    return exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id=target_id and cm.user_id=auth.uid()
    );
  elsif folders[1] = 'community' then
    select ch.community_id into target_community
    from public.channels ch where ch.id=target_id;
    return target_community is not null
      and public.is_community_member(target_community)
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
  begin
    target_id := folders[2]::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  if folders[1] = 'dm' then
    return exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id=target_id and cm.user_id=auth.uid()
    );
  elsif folders[1] = 'community' then
    select ch.community_id into target_community
    from public.channels ch where ch.id=target_id;
    return target_community is not null and public.is_community_member(target_community);
  end if;
  return false;
end;
$$;

revoke all on function public.can_upload_chat_media(text) from public, anon;
revoke all on function public.can_read_chat_media(text) from public, anon;
grant execute on function public.can_upload_chat_media(text) to authenticated;
grant execute on function public.can_read_chat_media(text) to authenticated;

-- Profile images: anyone can view; users may write only inside their own folder.
drop policy if exists profile_media_public_read on storage.objects;
create policy profile_media_public_read on storage.objects for select to public using (bucket_id='profile-media');
drop policy if exists profile_media_insert_own on storage.objects;
create policy profile_media_insert_own on storage.objects for insert to authenticated with check (bucket_id='profile-media' and (storage.foldername(name))[1]=auth.uid()::text and not public.is_user_banned());
drop policy if exists profile_media_update_own on storage.objects;
create policy profile_media_update_own on storage.objects for update to authenticated using (bucket_id='profile-media' and (storage.foldername(name))[1]=auth.uid()::text) with check (bucket_id='profile-media' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists profile_media_delete_own on storage.objects;
create policy profile_media_delete_own on storage.objects for delete to authenticated using (bucket_id='profile-media' and (storage.foldername(name))[1]=auth.uid()::text);

-- Chat uploads must use dm/<conversation-uuid>/<file> or community/<channel-uuid>/<file>.
drop policy if exists chat_media_read_member on storage.objects;
create policy chat_media_read_member on storage.objects for select to authenticated
using (bucket_id='chat-media' and public.can_read_chat_media(name));
drop policy if exists chat_media_insert_member on storage.objects;
create policy chat_media_insert_member on storage.objects for insert to authenticated
with check (bucket_id='chat-media' and public.can_upload_chat_media(name));
drop policy if exists chat_media_delete_own on storage.objects;
create policy chat_media_delete_own on storage.objects for delete to authenticated
using (bucket_id='chat-media' and owner_id::text=auth.uid()::text);
-- Realtime for messaging, reactions, friend requests and live inbox ordering.
do $$
declare table_name text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    for table_name in select unnest(array['messages','friends','conversation_members','conversations','message_reactions']) loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=table_name) then
        execute format('alter publication supabase_realtime add table public.%I',table_name);
      end if;
    end loop;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- BOOTSTRAP: after creating your own account, replace the UUID below and run:
-- insert into public.user_roles(user_id,role) values ('YOUR-AUTH-USER-UUID','admin');
-- Find the UUID in Supabase > Authentication > Users.
-- Do not make an admin-creation form available to ordinary users.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- Nexus v0.5 additive features (also available as a standalone migration).
-- Fresh installations receive these objects automatically.

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

-- Nexus v0.6 additions are appended here so a fresh install has the same schema as an upgraded v0.5 project.

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

-- The following v0.7 additions keep fresh installs equivalent to upgrading v0.6.
-- Nexus v0.7
-- Custom emoji/stickers, Workshop reviews, private WebRTC voice topics,
-- durable browser push subscriptions, and message notification outbox.
-- Apply once after v0.6. Re-runnable where practical.

begin;

-- ---------------------------------------------------------------------------
-- Custom assets: keep files private, scoped to the owner/chat/community.
-- The existing custom_assets table stores the Storage object path in asset_url.
-- ---------------------------------------------------------------------------
alter table public.custom_assets add column if not exists archived_at timestamptz;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'nexus-assets','nexus-assets',false,5242880,
  array['image/png','image/jpeg','image/webp','image/gif']
)
on conflict (id) do update set
  public=false,
  file_size_limit=5242880,
  allowed_mime_types=excluded.allowed_mime_types;

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

create or replace function public.can_upload_nexus_asset(p_object_name text)
returns boolean
language plpgsql stable security definer
set search_path = public, auth, storage, pg_temp
as $$
declare folders text[]; scope_id uuid;
begin
  if auth.uid() is null or public.is_user_banned() then return false; end if;
  folders := storage.foldername(coalesce(p_object_name,''));
  if coalesce(array_length(folders,1),0)=2 and folders[1]='personal' then
    return folders[2]=auth.uid()::text;
  end if;
  if coalesce(array_length(folders,1),0)=3 and folders[1] in ('conversation','community') then
    if folders[3]<>auth.uid()::text then return false; end if;
    begin scope_id := folders[2]::uuid; exception when others then return false; end;
    if folders[1]='conversation' then return public.is_conversation_member(scope_id); end if;
    return public.is_community_member(scope_id);
  end if;
  return false;
end;
$$;

create or replace function public.can_delete_nexus_asset(p_object_name text)
returns boolean
language plpgsql stable security definer
set search_path = public, auth, storage, pg_temp
as $$
declare folders text[];
begin
  if auth.uid() is null then return false; end if;
  folders := storage.foldername(coalesce(p_object_name,''));
  if coalesce(array_length(folders,1),0)=2 and folders[1]='personal' then
    return folders[2]=auth.uid()::text;
  end if;
  if coalesce(array_length(folders,1),0)=3 and folders[1] in ('conversation','community') then
    return folders[3]=auth.uid()::text and public.can_read_nexus_asset(p_object_name);
  end if;
  return false;
end;
$$;

revoke all on function public.can_read_nexus_asset(text) from public,anon;
revoke all on function public.can_upload_nexus_asset(text) from public,anon;
revoke all on function public.can_delete_nexus_asset(text) from public,anon;
grant execute on function public.can_read_nexus_asset(text) to authenticated;
grant execute on function public.can_upload_nexus_asset(text) to authenticated;
grant execute on function public.can_delete_nexus_asset(text) to authenticated;

drop policy if exists nexus_assets_read_scoped on storage.objects;
create policy nexus_assets_read_scoped on storage.objects
for select to authenticated
using (bucket_id='nexus-assets' and public.can_read_nexus_asset(name));
drop policy if exists nexus_assets_insert_owner on storage.objects;
create policy nexus_assets_insert_owner on storage.objects
for insert to authenticated
with check (bucket_id='nexus-assets' and public.can_upload_nexus_asset(name));
drop policy if exists nexus_assets_delete_owner on storage.objects;
create policy nexus_assets_delete_owner on storage.objects
for delete to authenticated
using (bucket_id='nexus-assets' and public.can_delete_nexus_asset(name));

-- Ensure custom asset rows cannot point to another user's folder or escape scope.
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
drop trigger if exists nexus_custom_asset_guard on public.custom_assets;
create trigger nexus_custom_asset_guard
before insert or update of owner_id,asset_type,scope,scope_id,name,asset_url
on public.custom_assets for each row execute function public.guard_nexus_custom_asset();

-- Existing SELECT policy is expanded so a personal emoji/sticker can be read
-- by members of a chat only after its owner has actually used it in a message.
drop policy if exists custom_assets_read_scope on public.custom_assets;
create policy custom_assets_read_scope on public.custom_assets for select to authenticated using (
  (scope='personal' and (
    owner_id=auth.uid()
    or exists (
      select 1 from public.messages m
       where (m.attachment->>'custom_asset_id'=custom_assets.id::text
          or coalesce(m.formatting->'custom_emojis','[]'::jsonb) @> jsonb_build_array(custom_assets.id::text))
         and (
           (m.conversation_id is not null and public.is_conversation_member(m.conversation_id))
           or (m.channel_id is not null and exists(select 1 from public.channels ch where ch.id=m.channel_id and public.is_community_member(ch.community_id)))
         )
    )
  ))
  or (scope='conversation' and exists(select 1 from public.conversation_members cm where cm.conversation_id=scope_id and cm.user_id=auth.uid()))
  or (scope='community' and public.is_community_member(scope_id))
);
drop policy if exists custom_assets_update_owner on public.custom_assets;
create policy custom_assets_update_owner on public.custom_assets for update to authenticated
using (owner_id=auth.uid()) with check (owner_id=auth.uid() and not public.is_user_banned());
revoke update on public.custom_assets from authenticated;
grant update (archived_at) on public.custom_assets to authenticated;
drop policy if exists custom_assets_delete_owner on public.custom_assets;
create policy custom_assets_delete_owner on public.custom_assets for delete to authenticated
using (owner_id=auth.uid());

create unique index if not exists custom_assets_personal_name_unique
  on public.custom_assets(owner_id,lower(name),asset_type) where scope='personal' and archived_at is null;
create unique index if not exists custom_assets_conversation_name_unique
  on public.custom_assets(owner_id,scope_id,lower(name),asset_type) where scope='conversation' and archived_at is null;
create unique index if not exists custom_assets_community_name_unique
  on public.custom_assets(owner_id,scope_id,lower(name),asset_type) where scope='community' and archived_at is null;

-- Validate sticker and custom-emoji references on the server, not just in UI.
create or replace function public.guard_nexus_v07_message_assets()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  asset_row public.custom_assets%rowtype;
  asset_id uuid;
  asset_value jsonb;
  target_community uuid;
  is_allowed boolean;
begin
  if new.formatting is null or jsonb_typeof(new.formatting)<>'object' then
    new.formatting := '{}'::jsonb;
  end if;
  if new.formatting ? 'custom_emojis' then
    if jsonb_typeof(new.formatting->'custom_emojis')<>'array' or jsonb_array_length(new.formatting->'custom_emojis')>30 then
      raise exception 'La lista de emojis personalizados no es válida.';
    end if;
    for asset_value in select value from jsonb_array_elements(new.formatting->'custom_emojis') loop
      begin asset_id := (asset_value #>> '{}')::uuid; exception when others then raise exception 'Referencia de emoji no válida.'; end;
      select * into asset_row from public.custom_assets where id=asset_id and asset_type='emoji' and archived_at is null;
      if not found then raise exception 'Uno de los emojis ya no existe.'; end if;
      is_allowed := false;
      if asset_row.scope='personal' then
        is_allowed := asset_row.owner_id=new.sender_id;
      elsif asset_row.scope='conversation' then
        is_allowed := new.conversation_id=asset_row.scope_id;
      elsif asset_row.scope='community' and new.channel_id is not null then
        select community_id into target_community from public.channels where id=new.channel_id;
        is_allowed := target_community=asset_row.scope_id;
      end if;
      if not is_allowed then raise exception 'Un emoji no pertenece a este chat o no es tuyo.'; end if;
    end loop;
  end if;

  if coalesce(new.attachment,'{}'::jsonb) ? 'kind' and new.attachment->>'kind'='sticker' then
    if new.message_type<>'media' then raise exception 'Un sticker debe enviarse como mensaje multimedia.'; end if;
    begin asset_id := (new.attachment->>'custom_asset_id')::uuid; exception when others then raise exception 'Sticker no válido.'; end;
    select * into asset_row from public.custom_assets where id=asset_id and asset_type='sticker' and archived_at is null;
    if not found then raise exception 'El sticker ya no existe.'; end if;
    is_allowed := false;
    if asset_row.scope='personal' then
      is_allowed := asset_row.owner_id=new.sender_id;
    elsif asset_row.scope='conversation' then
      is_allowed := new.conversation_id=asset_row.scope_id;
    elsif asset_row.scope='community' and new.channel_id is not null then
      select community_id into target_community from public.channels where id=new.channel_id;
      is_allowed := target_community=asset_row.scope_id;
    end if;
    if not is_allowed then raise exception 'El sticker no está disponible en este chat.'; end if;
  end if;

  if coalesce(new.attachment,'{}'::jsonb) ? 'kind' and new.attachment->>'kind'='gif' then
    if new.message_type<>'media'
       or coalesce(new.attachment->>'provider','')<>'giphy'
       or coalesce(new.attachment->>'url','') !~ '^https://([a-z0-9-]+\.)*giphy\.com/'
       or coalesce(new.attachment->>'preview_url','') !~ '^https://([a-z0-9-]+\.)*giphy\.com/' then
      raise exception 'El GIF debe proceder del catálogo de GIPHY.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists nexus_v07_message_assets_guard on public.messages;
create trigger nexus_v07_message_assets_guard
before insert or update of attachment,formatting,message_type on public.messages
for each row execute function public.guard_nexus_v07_message_assets();

-- ---------------------------------------------------------------------------
-- Workshop ratings. One rating per user and preset; authors cannot rate their
-- own preset. Reviews are text-only and are not required to leave a rating.
-- ---------------------------------------------------------------------------
create table if not exists public.preset_reviews (
  id uuid primary key default gen_random_uuid(),
  preset_id uuid not null references public.presets(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review text not null default '' check (length(review)<=500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(preset_id,reviewer_id)
);
create index if not exists preset_reviews_preset_idx on public.preset_reviews(preset_id);
alter table public.preset_reviews enable row level security;
drop policy if exists preset_reviews_read_public on public.preset_reviews;
create policy preset_reviews_read_public on public.preset_reviews for select to authenticated using (
  exists(select 1 from public.presets p where p.id=preset_reviews.preset_id and (p.is_public or p.owner_id=auth.uid()))
);
drop policy if exists preset_reviews_insert_own on public.preset_reviews;
create policy preset_reviews_insert_own on public.preset_reviews for insert to authenticated with check (
  reviewer_id=auth.uid() and not public.is_user_banned()
  and exists(select 1 from public.presets p where p.id=preset_reviews.preset_id and p.is_public and p.owner_id<>auth.uid())
);
drop policy if exists preset_reviews_update_own on public.preset_reviews;
create policy preset_reviews_update_own on public.preset_reviews for update to authenticated
using (reviewer_id=auth.uid()) with check (
  reviewer_id=auth.uid() and not public.is_user_banned()
  and exists(select 1 from public.presets p where p.id=preset_reviews.preset_id and p.is_public and p.owner_id<>auth.uid())
);
drop policy if exists preset_reviews_delete_own on public.preset_reviews;
create policy preset_reviews_delete_own on public.preset_reviews for delete to authenticated using (reviewer_id=auth.uid());
grant select,insert,update,delete on public.preset_reviews to authenticated;

-- ---------------------------------------------------------------------------
-- Private voice topics. Realtime's RLS is already enabled by Supabase; do not
-- alter realtime.messages or attempt to create objects in the realtime schema.
-- Client topic format: nexus-voice:<channel-uuid> with private:true.
-- ---------------------------------------------------------------------------
create or replace function public.can_join_nexus_voice_topic(p_topic text)
returns boolean
language plpgsql stable security definer
set search_path = public, auth, pg_temp
as $$
declare target_id uuid;
begin
  if auth.uid() is null or public.is_user_banned() then return false; end if;
  if p_topic !~ '^nexus-voice:[0-9a-fA-F-]{36}$' then return false; end if;
  begin target_id := split_part(p_topic,':',2)::uuid; exception when others then return false; end;
  return exists(
    select 1 from public.channels ch
    join public.community_members cm on cm.community_id=ch.community_id
    where ch.id=target_id and ch.type='voice' and cm.user_id=auth.uid()
  );
end;
$$;
revoke all on function public.can_join_nexus_voice_topic(text) from public,anon;
grant execute on function public.can_join_nexus_voice_topic(text) to authenticated;
drop policy if exists nexus_voice_private_receive on realtime.messages;
create policy nexus_voice_private_receive on realtime.messages
for select to authenticated using (
  extension in ('broadcast','presence') and public.can_join_nexus_voice_topic(realtime.topic())
);
drop policy if exists nexus_voice_private_send on realtime.messages;
create policy nexus_voice_private_send on realtime.messages
for insert to authenticated with check (
  extension in ('broadcast','presence') and public.can_join_nexus_voice_topic(realtime.topic())
);


-- Private channel authorization for the regular Nexus Realtime topics. The app
-- uses Postgres Changes on these channels; private:true plus this membership
-- check lets the project disable public-channel access without breaking chat.
create or replace function public.can_join_nexus_app_topic(p_topic text)
returns boolean language plpgsql stable security definer set search_path = public, auth, pg_temp
as $$
declare target_id uuid;
begin
  if auth.uid() is null or public.is_user_banned() then return false; end if;
  if p_topic='nexus-online' then return true; end if;
  if p_topic in ('nexus-friends-'||auth.uid()::text,'nexus-inbox-'||auth.uid()::text,'nexus-notifications-'||auth.uid()::text) then return true; end if;
  if p_topic ~ '^nexus-(conversation|channel)-[0-9a-fA-F-]{36}$' then
    begin target_id := regexp_replace(p_topic,'^nexus-(conversation|channel)-','')::uuid; exception when others then return false; end;
    if left(p_topic,18)='nexus-conversation' then return public.is_conversation_member(target_id); end if;
    return exists(select 1 from public.channels ch where ch.id=target_id and public.is_community_member(ch.community_id));
  end if;
  return false;
end;
$$;
revoke all on function public.can_join_nexus_app_topic(text) from public,anon;
grant execute on function public.can_join_nexus_app_topic(text) to authenticated;
drop policy if exists nexus_app_private_topics_read on realtime.messages;
create policy nexus_app_private_topics_read on realtime.messages
for select to authenticated using (
  public.can_join_nexus_app_topic(realtime.topic())
);
drop policy if exists nexus_app_private_topics_write on realtime.messages;
create policy nexus_app_private_topics_write on realtime.messages
for insert to authenticated with check (
  extension in ('broadcast','presence') and public.can_join_nexus_app_topic(realtime.topic())
);

-- ---------------------------------------------------------------------------
-- Web Push. The database creates one outbox row per recipient/message. A
-- Database Webhook invokes send-web-push; clients cannot forge recipient rows.
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions for select to authenticated using (user_id=auth.uid());
drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own on public.push_subscriptions for insert to authenticated with check (user_id=auth.uid() and not public.is_user_banned());
drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
create policy push_subscriptions_update_own on public.push_subscriptions for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid() and not public.is_user_banned());
drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own on public.push_subscriptions for delete to authenticated using (user_id=auth.uid());
grant select,insert,update,delete on public.push_subscriptions to authenticated;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  title text not null,
  body text not null default '',
  target_path text not null default '/',
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique(user_id,message_id)
);
create index if not exists notifications_user_created_idx on public.notifications(user_id,created_at desc);
alter table public.notifications enable row level security;
drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications for select to authenticated using (user_id=auth.uid());
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications for delete to authenticated using (user_id=auth.uid());
grant select,update,delete on public.notifications to authenticated;

create or replace function public.enqueue_message_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  notice_title text;
  notice_body text;
  notice_path text;
  sender_name text;
  community_id_value uuid;
begin
  select coalesce(nullif(nickname,''),username,'Alguien') into sender_name
    from public.profiles where id=new.sender_id;
  notice_body := left(coalesce(nullif(trim(new.body),''),
    case when new.attachment->>'kind'='sticker' then 'Ha enviado un sticker'
         when new.attachment->>'kind'='gif' then 'Ha enviado un GIF'
         when new.attachment is not null then 'Ha enviado un archivo'
         else 'Te ha enviado un mensaje' end),120);

  if new.conversation_id is not null then
    select case when c.kind='direct' then coalesce(sender_name,'Nuevo mensaje') else coalesce(nullif(c.title,''),'Grupo') end
      into notice_title from public.conversations c where c.id=new.conversation_id;
    notice_path := '?openConversation='||new.conversation_id::text;
    insert into public.notifications(user_id,message_id,title,body,target_path)
    select cm.user_id,new.id,coalesce(notice_title,'Nexus'),notice_body,notice_path
      from public.conversation_members cm
     where cm.conversation_id=new.conversation_id and cm.user_id<>new.sender_id
    on conflict(user_id,message_id) do nothing;
  elsif new.channel_id is not null then
    select ch.community_id into community_id_value from public.channels ch where ch.id=new.channel_id;
    select coalesce(c.name,'Megagrupo')||' · #'||coalesce(ch.name,'canal')
      into notice_title from public.channels ch join public.communities c on c.id=ch.community_id where ch.id=new.channel_id;
    notice_path := '?openChannel='||new.channel_id::text;
    insert into public.notifications(user_id,message_id,title,body,target_path)
    select cm.user_id,new.id,coalesce(notice_title,'Nexus'),notice_body,notice_path
      from public.community_members cm
     where cm.community_id=community_id_value and cm.user_id<>new.sender_id
    on conflict(user_id,message_id) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists nexus_enqueue_message_notifications on public.messages;
create trigger nexus_enqueue_message_notifications
after insert on public.messages for each row execute function public.enqueue_message_notifications();
revoke all on function public.enqueue_message_notifications() from public,anon;


-- Message edits also validate custom emoji IDs using the same scope rules as inserts.
drop function if exists public.edit_message_with_mentions(uuid,text,jsonb);
create or replace function public.edit_message_with_mentions(
  p_message_id uuid,
  p_body text,
  p_mentions jsonb default '[]'::jsonb,
  p_custom_emojis jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  owner_id uuid; kind text; room_conversation uuid; room_channel uuid;
  emoji_value jsonb; emoji_id uuid; asset_row public.custom_assets%rowtype; target_community uuid; allowed boolean;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if public.is_user_banned() then raise exception 'Tu cuenta está suspendida.'; end if;
  if p_body is null or length(trim(p_body))=0 or length(p_body)>12000 then raise exception 'El mensaje debe tener entre 1 y 12000 caracteres.'; end if;
  if p_mentions is null or jsonb_typeof(p_mentions)<>'array' or jsonb_array_length(p_mentions)>30 then raise exception 'La lista de menciones no es válida.'; end if;
  if p_custom_emojis is null or jsonb_typeof(p_custom_emojis)<>'array' or jsonb_array_length(p_custom_emojis)>30 then raise exception 'La lista de emojis no es válida.'; end if;
  select sender_id,message_type,conversation_id,channel_id into owner_id,kind,room_conversation,room_channel
    from public.messages where id=p_message_id for update;
  if not found then raise exception 'El mensaje ya no existe.'; end if;
  if owner_id<>auth.uid() then raise exception 'Solo puedes editar tus propios mensajes.'; end if;
  if room_conversation is not null and not public.is_conversation_member(room_conversation) then raise exception 'Ya no perteneces a esta conversación.'; end if;
  if room_channel is not null and not exists(select 1 from public.channels ch where ch.id=room_channel and public.is_community_member(ch.community_id)) then raise exception 'Ya no perteneces a este megagrupo.'; end if;
  if kind<>'text' then raise exception 'Solo se pueden editar mensajes de texto.'; end if;
  for emoji_value in select value from jsonb_array_elements(p_custom_emojis) loop
    begin emoji_id := (emoji_value #>> '{}')::uuid; exception when others then raise exception 'Referencia de emoji no válida.'; end;
    select * into asset_row from public.custom_assets where id=emoji_id and asset_type='emoji' and archived_at is null;
    if not found then raise exception 'Uno de los emojis ya no está disponible.'; end if;
    allowed := case
      when asset_row.scope='personal' then asset_row.owner_id=auth.uid()
      when asset_row.scope='conversation' then room_conversation=asset_row.scope_id
      when asset_row.scope='community' and room_channel is not null then exists(select 1 from public.channels ch where ch.id=room_channel and ch.community_id=asset_row.scope_id)
      else false end;
    if not allowed then raise exception 'Un emoji no pertenece a este chat o no es tuyo.'; end if;
  end loop;
  update public.messages set body=trim(p_body), edited_at=now(),
    formatting=jsonb_set(jsonb_set(coalesce(formatting,'{}'::jsonb),'{mentions}',p_mentions,true),'{custom_emojis}',p_custom_emojis,true)
    where id=p_message_id and sender_id=auth.uid();
end;
$$;
revoke all on function public.edit_message_with_mentions(uuid,text,jsonb,jsonb) from public,anon;
grant execute on function public.edit_message_with_mentions(uuid,text,jsonb,jsonb) to authenticated;

grant usage on schema public to authenticated;

commit;
