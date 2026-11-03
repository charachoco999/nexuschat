begin;

-- Activity metadata for the separated platform administration panel.
alter table public.profiles add column if not exists last_seen_at timestamptz;

-- Per-megagroup identity. Quick-Alt intentionally remains account-wide.
create table if not exists public.community_profiles (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null default '' check(length(nickname)<=40),
  pronouns text not null default '' check(length(pronouns)<=30),
  bio text not null default '' check(length(bio)<=300),
  avatar_url text,
  banner_url text,
  default_name_color text not null default '#a99bff' check(default_name_color ~ '^#[0-9A-Fa-f]{6}$'),
  name_font_url text,
  name_effect_url text,
  profile_effect_url text,
  profile_plate_url text,
  profile_frame_url text,
  message_font_url text,
  aliases text[] not null default '{}',
  widgets jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key(community_id,user_id)
);
alter table public.community_profiles add column if not exists message_font_url text;
alter table public.community_profiles add column if not exists aliases text[] not null default '{}';
alter table public.community_profiles add column if not exists widgets jsonb not null default '[]'::jsonb;
alter table public.community_profiles enable row level security;
drop policy if exists community_profiles_read_members on public.community_profiles;
create policy community_profiles_read_members on public.community_profiles for select to authenticated
using(public.is_community_member(community_id));
drop policy if exists community_profiles_insert_self on public.community_profiles;
create policy community_profiles_insert_self on public.community_profiles for insert to authenticated
with check(user_id=auth.uid() and public.is_community_member(community_id) and not public.is_user_banned());
drop policy if exists community_profiles_update_self on public.community_profiles;
create policy community_profiles_update_self on public.community_profiles for update to authenticated
using(user_id=auth.uid() and public.is_community_member(community_id) and not public.is_user_banned())
with check(user_id=auth.uid() and public.is_community_member(community_id) and not public.is_user_banned());
grant select,insert,update on public.community_profiles to authenticated;

-- Suggestions and bug reports are private to the author and platform admins.
create table if not exists public.nexus_platform_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feedback_type text not null check(feedback_type in ('suggestion','bug')),
  title text not null check(length(title) between 3 and 100),
  body text not null check(length(body) between 10 and 3000),
  status text not null default 'open' check(status in ('open','reviewing','resolved','rejected')),
  admin_note text not null default '' check(length(admin_note)<=1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists nexus_platform_feedback_created_idx on public.nexus_platform_feedback(created_at desc);
alter table public.nexus_platform_feedback enable row level security;
drop policy if exists nexus_platform_feedback_read on public.nexus_platform_feedback;
create policy nexus_platform_feedback_read on public.nexus_platform_feedback for select to authenticated
using(user_id=auth.uid() or public.is_platform_admin());
drop policy if exists nexus_platform_feedback_insert on public.nexus_platform_feedback;
create policy nexus_platform_feedback_insert on public.nexus_platform_feedback for insert to authenticated
with check(user_id=auth.uid() and not public.is_user_banned());
drop policy if exists nexus_platform_feedback_admin_update on public.nexus_platform_feedback;
create policy nexus_platform_feedback_admin_update on public.nexus_platform_feedback for update to authenticated
using(public.is_platform_admin()) with check(public.is_platform_admin());
grant select,insert,update on public.nexus_platform_feedback to authenticated;

-- System inbox used for moderation notices from the reserved Nexus (App) identity.
create table if not exists public.nexus_system_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Nexus (App)',
  body text not null check(length(body) between 1 and 2000),
  message_type text not null default 'notice' check(message_type in ('notice','warning','moderation')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists nexus_system_messages_user_idx on public.nexus_system_messages(user_id,created_at desc);
alter table public.nexus_system_messages enable row level security;
drop policy if exists nexus_system_messages_read_own on public.nexus_system_messages;
create policy nexus_system_messages_read_own on public.nexus_system_messages for select to authenticated using(user_id=auth.uid());
drop policy if exists nexus_system_messages_update_own on public.nexus_system_messages;
create policy nexus_system_messages_update_own on public.nexus_system_messages for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,update on public.nexus_system_messages to authenticated;

-- Platform-wide text mutes are separate from bans.
create table if not exists public.nexus_user_mutes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  muted_until timestamptz not null,
  reason text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.nexus_user_mutes enable row level security;
drop policy if exists nexus_user_mutes_admin_read on public.nexus_user_mutes;
create policy nexus_user_mutes_admin_read on public.nexus_user_mutes for select to authenticated using(public.is_platform_admin());
grant select on public.nexus_user_mutes to authenticated;

create or replace function public.is_user_muted()
returns boolean language sql stable security definer set search_path=public,auth,pg_temp
as $$ select exists(select 1 from public.nexus_user_mutes where user_id=auth.uid() and muted_until>now()); $$;

create or replace function public.admin_mute_user(p_target uuid,p_reason text default '',p_minutes integer default 60)
returns void language plpgsql security definer set search_path=public,auth,pg_temp
as $$
begin
  if not public.is_platform_admin() then raise exception 'Solo los administradores de plataforma pueden silenciar cuentas.'; end if;
  if p_target=auth.uid() then raise exception 'No puedes silenciar tu propia cuenta.'; end if;
  if p_minutes<1 or p_minutes>525600 then raise exception 'Duración no válida (1 minuto a 365 días).'; end if;
  insert into public.nexus_user_mutes(user_id,muted_until,reason,created_by)
  values(p_target,now()+make_interval(mins=>p_minutes),coalesce(p_reason,''),auth.uid())
  on conflict(user_id) do update set muted_until=excluded.muted_until,reason=excluded.reason,created_by=excluded.created_by,created_at=now();
  insert into public.nexus_system_messages(user_id,title,body,message_type)
  values(p_target,'Nexus (App)','Tu cuenta no puede enviar mensajes hasta '||to_char(now()+make_interval(mins=>p_minutes),'YYYY-MM-DD HH24:MI')||'. Motivo: '||left(coalesce(p_reason,'Sin motivo especificado.'),500),'moderation');
end;
$$;

create or replace function public.admin_warn_user(p_target uuid,p_reason text)
returns void language plpgsql security definer set search_path=public,auth,pg_temp
as $$
begin
  if not public.is_platform_admin() then raise exception 'Solo los administradores de plataforma pueden emitir advertencias.'; end if;
  if p_target=auth.uid() then raise exception 'No puedes advertirte a ti mismo.'; end if;
  if length(trim(coalesce(p_reason,'')))<3 or length(p_reason)>1500 then raise exception 'Escribe un motivo de entre 3 y 1500 caracteres.'; end if;
  insert into public.nexus_system_messages(user_id,title,body,message_type)
  values(p_target,'Nexus (App)','Has recibido una advertencia del equipo de Nexus. Motivo: '||trim(p_reason),'warning');
end;
$$;
revoke all on function public.admin_mute_user(uuid,text,integer) from public,anon;
revoke all on function public.admin_warn_user(uuid,text) from public,anon;
grant execute on function public.admin_mute_user(uuid,text,integer) to authenticated;
grant execute on function public.admin_warn_user(uuid,text) to authenticated;

create or replace function public.guard_nexus_user_mute()
returns trigger language plpgsql security definer set search_path=public,auth,pg_temp
as $$
begin
  if new.sender_id=auth.uid() and public.is_user_muted() then raise exception 'Tu cuenta está silenciada temporalmente y no puede enviar mensajes.'; end if;
  return new;
end;
$$;
drop trigger if exists nexus_user_mute_guard on public.messages;
create trigger nexus_user_mute_guard before insert on public.messages for each row execute function public.guard_nexus_user_mute();

-- Personal emoji visibility and public sticker workshop.
alter table public.custom_assets add column if not exists visibility text not null default 'private'
  check(visibility in ('private','friends','community','public'));

create table if not exists public.sticker_workshop (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null unique references public.custom_assets(id) on delete cascade,
  publisher_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(length(name) between 2 and 32),
  description text not null default '' check(length(description)<=300),
  created_at timestamptz not null default now(),
  installs integer not null default 0 check(installs>=0)
);
create table if not exists public.sticker_workshop_saves (
  sticker_id uuid not null references public.sticker_workshop(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(sticker_id,user_id)
);
alter table public.sticker_workshop enable row level security;
alter table public.sticker_workshop_saves enable row level security;
drop policy if exists sticker_workshop_read on public.sticker_workshop;
create policy sticker_workshop_read on public.sticker_workshop for select to authenticated using(true);
drop policy if exists sticker_workshop_publish on public.sticker_workshop;
create policy sticker_workshop_publish on public.sticker_workshop for insert to authenticated with check(
  publisher_id=auth.uid() and not public.is_user_banned() and exists(
    select 1 from public.custom_assets a where a.id=asset_id and a.owner_id=auth.uid() and a.asset_type='sticker' and a.archived_at is null
  )
);
drop policy if exists sticker_workshop_remove_own on public.sticker_workshop;
create policy sticker_workshop_remove_own on public.sticker_workshop for delete to authenticated using(publisher_id=auth.uid() or public.is_platform_admin());
drop policy if exists sticker_workshop_saves_read_own on public.sticker_workshop_saves;
create policy sticker_workshop_saves_read_own on public.sticker_workshop_saves for select to authenticated using(user_id=auth.uid());
drop policy if exists sticker_workshop_saves_insert_own on public.sticker_workshop_saves;
create policy sticker_workshop_saves_insert_own on public.sticker_workshop_saves for insert to authenticated with check(user_id=auth.uid() and not public.is_user_banned());
drop policy if exists sticker_workshop_saves_delete_own on public.sticker_workshop_saves;
create policy sticker_workshop_saves_delete_own on public.sticker_workshop_saves for delete to authenticated using(user_id=auth.uid());
grant select,insert,delete on public.sticker_workshop to authenticated;
grant select,insert,delete on public.sticker_workshop_saves to authenticated;

-- Allow published personal stickers/emojis to be resolved by signed-in members.
drop policy if exists custom_assets_read_scope on public.custom_assets;
create policy custom_assets_read_scope on public.custom_assets for select to authenticated using (
  (scope='personal' and (
    owner_id=auth.uid()
    or (visibility='public')
    or (visibility='friends' and exists(select 1 from public.friends f where f.status='accepted' and ((f.requester=owner_id and f.addressee=auth.uid()) or (f.addressee=owner_id and f.requester=auth.uid()))))
    or (visibility='community' and exists(select 1 from public.community_members owner_cm join public.community_members viewer_cm on viewer_cm.community_id=owner_cm.community_id where owner_cm.user_id=custom_assets.owner_id and viewer_cm.user_id=auth.uid()))
    or exists(select 1 from public.messages m where (m.attachment->>'custom_asset_id'=custom_assets.id::text or coalesce(m.formatting->'custom_emojis','[]'::jsonb) @> jsonb_build_array(custom_assets.id::text)) and ((m.conversation_id is not null and public.is_conversation_member(m.conversation_id)) or (m.channel_id is not null and exists(select 1 from public.channels ch where ch.id=m.channel_id and public.is_community_member(ch.community_id)))))
    or exists(select 1 from public.message_reactions r join public.messages m on m.id=r.message_id where r.emoji='custom:'||custom_assets.id::text and ((m.conversation_id is not null and public.is_conversation_member(m.conversation_id)) or (m.channel_id is not null and exists(select 1 from public.channels ch where ch.id=m.channel_id and public.is_community_member(ch.community_id)))))
    or exists(select 1 from public.sticker_workshop sw where sw.asset_id=custom_assets.id)
  ))
  or (scope='conversation' and public.is_conversation_member(scope_id))
  or (scope='community' and public.is_community_member(scope_id))
);
grant update(visibility) on public.custom_assets to authenticated;

-- Storage remains private. A personal asset can be read by an authorized friend,
-- community member, or anyone only when its owner explicitly published it.
create or replace function public.can_read_nexus_asset(p_object_name text)
returns boolean language plpgsql stable security definer set search_path=public,auth,storage,pg_temp
as $$
declare folders text[]; scope_id uuid; owner_text text;
begin
  if auth.uid() is null then return false; end if;
  folders:=storage.foldername(coalesce(p_object_name,''));
  if coalesce(array_length(folders,1),0)=2 and folders[1]='personal' then
    owner_text:=folders[2];
    if owner_text=auth.uid()::text then return true; end if;
    return exists(
      select 1 from public.custom_assets a where a.asset_url=p_object_name and a.scope='personal' and (
        a.visibility='public'
        or (a.visibility='friends' and exists(select 1 from public.friends f where f.status='accepted' and ((f.requester=a.owner_id and f.addressee=auth.uid()) or (f.addressee=a.owner_id and f.requester=auth.uid()))))
        or (a.visibility='community' and exists(select 1 from public.community_members owner_cm join public.community_members viewer_cm on viewer_cm.community_id=owner_cm.community_id where owner_cm.user_id=a.owner_id and viewer_cm.user_id=auth.uid()))
        or exists(select 1 from public.sticker_workshop sw where sw.asset_id=a.id)
        or exists(select 1 from public.messages m where (m.attachment->>'custom_asset_id'=a.id::text or coalesce(m.formatting->'custom_emojis','[]'::jsonb) @> jsonb_build_array(a.id::text) or exists(select 1 from public.message_reactions r where r.message_id=m.id and r.emoji='custom:'||a.id::text)) and ((m.conversation_id is not null and public.is_conversation_member(m.conversation_id)) or (m.channel_id is not null and exists(select 1 from public.channels ch where ch.id=m.channel_id and public.is_community_member(ch.community_id)))))
      )
    );
  end if;
  if coalesce(array_length(folders,1),0)=3 and folders[1]='conversation' then
    begin scope_id:=folders[2]::uuid; exception when others then return false; end;
    return public.is_conversation_member(scope_id);
  end if;
  if coalesce(array_length(folders,1),0)=3 and folders[1]='community' then
    begin scope_id:=folders[2]::uuid; exception when others then return false; end;
    return public.is_community_member(scope_id);
  end if;
  return false;
end;
$$;
revoke all on function public.can_read_nexus_asset(text) from public,anon;
grant execute on function public.can_read_nexus_asset(text) to authenticated;

-- Permit a published personal sticker to be attached by any signed-in member.
create or replace function public.guard_nexus_v07_message_assets()
returns trigger language plpgsql security definer set search_path=public,auth,pg_temp
as $$
declare asset_row public.custom_assets%rowtype; asset_id uuid; asset_value jsonb; target_community uuid; is_allowed boolean;
begin
  if new.formatting is null or jsonb_typeof(new.formatting)<>'object' then new.formatting:='{}'::jsonb; end if;
  if new.formatting ? 'custom_emojis' then
    if jsonb_typeof(new.formatting->'custom_emojis')<>'array' or jsonb_array_length(new.formatting->'custom_emojis')>30 then raise exception 'La lista de emojis personalizados no es válida.'; end if;
    for asset_value in select value from jsonb_array_elements(new.formatting->'custom_emojis') loop
      begin asset_id:=(asset_value #>> '{}')::uuid; exception when others then raise exception 'Referencia de emoji no válida.'; end;
      select * into asset_row from public.custom_assets where id=asset_id and asset_type='emoji' and archived_at is null;
      if not found then raise exception 'Uno de los emojis ya no existe.'; end if;
      is_allowed:=asset_row.scope='personal' and (asset_row.owner_id=new.sender_id or asset_row.visibility='public' or (asset_row.visibility='friends' and exists(select 1 from public.friends f where f.status='accepted' and ((f.requester=asset_row.owner_id and f.addressee=new.sender_id) or (f.addressee=asset_row.owner_id and f.requester=new.sender_id)))) or (asset_row.scope='conversation' and asset_row.scope_id=new.conversation_id) or (asset_row.scope='community' and new.channel_id is not null and exists(select 1 from public.channels ch where ch.id=new.channel_id and ch.community_id=asset_row.scope_id));
      if not is_allowed then raise exception 'Un emoji no pertenece a este chat o no es tuyo.'; end if;
    end loop;
  end if;
  if coalesce(new.attachment,'{}'::jsonb)->>'kind'='sticker' then
    if new.message_type<>'media' then raise exception 'Un sticker debe enviarse como mensaje multimedia.'; end if;
    begin asset_id:=(new.attachment->>'custom_asset_id')::uuid; exception when others then raise exception 'Sticker no válido.'; end;
    select * into asset_row from public.custom_assets where id=asset_id and asset_type='sticker' and archived_at is null;
    if not found then raise exception 'El sticker ya no existe.'; end if;
    is_allowed:=(asset_row.scope='personal' and (asset_row.owner_id=new.sender_id or exists(select 1 from public.sticker_workshop sw where sw.asset_id=asset_row.id))) or (asset_row.scope='conversation' and asset_row.scope_id=new.conversation_id) or (asset_row.scope='community' and new.channel_id is not null and exists(select 1 from public.channels ch where ch.id=new.channel_id and ch.community_id=asset_row.scope_id));
    if not is_allowed then raise exception 'El sticker no está disponible en este chat.'; end if;
  end if;
  if coalesce(new.attachment,'{}'::jsonb)->>'kind'='gif' and (new.message_type<>'media' or coalesce(new.attachment->>'provider','')<>'giphy' or coalesce(new.attachment->>'url','') !~ '^https://([a-z0-9-]+\.)*giphy\.com/' or coalesce(new.attachment->>'preview_url','') !~ '^https://([a-z0-9-]+\.)*giphy\.com/') then raise exception 'El GIF debe proceder del catálogo de GIPHY.'; end if;
  return new;
end;
$$;


-- Keep the public workshop install counter derived from actual saved items.
create or replace function public.refresh_sticker_workshop_installs()
returns trigger language plpgsql security definer set search_path=public,auth,pg_temp
as $$
declare target_sticker uuid;
begin
  target_sticker:=coalesce(new.sticker_id,old.sticker_id);
  update public.sticker_workshop sw set installs=(select count(*)::integer from public.sticker_workshop_saves s where s.sticker_id=target_sticker) where sw.id=target_sticker;
  if TG_OP='DELETE' then return old; else return new; end if;
end;
$$;
drop trigger if exists sticker_workshop_install_count on public.sticker_workshop_saves;
create trigger sticker_workshop_install_count after insert or delete on public.sticker_workshop_saves
for each row execute function public.refresh_sticker_workshop_installs();

-- Narrow community visibility to people who share an actual megagroup with the owner.
create or replace function public.guard_nexus_v07_message_assets()
returns trigger language plpgsql security definer set search_path=public,auth,pg_temp
as $$
declare asset_row public.custom_assets%rowtype; asset_id uuid; asset_value jsonb; target_community uuid; is_allowed boolean;
begin
  if new.formatting is null or jsonb_typeof(new.formatting)<>'object' then new.formatting:='{}'::jsonb; end if;
  if new.formatting ? 'custom_emojis' then
    if jsonb_typeof(new.formatting->'custom_emojis')<>'array' or jsonb_array_length(new.formatting->'custom_emojis')>30 then raise exception 'La lista de emojis personalizados no es válida.'; end if;
    if new.channel_id is not null then select community_id into target_community from public.channels where id=new.channel_id; end if;
    for asset_value in select value from jsonb_array_elements(new.formatting->'custom_emojis') loop
      begin asset_id:=(asset_value #>> '{}')::uuid; exception when others then raise exception 'Referencia de emoji no válida.'; end;
      select * into asset_row from public.custom_assets where id=asset_id and asset_type='emoji' and archived_at is null;
      if not found then raise exception 'Uno de los emojis ya no existe.'; end if;
      is_allowed:=asset_row.scope='personal' and (
        asset_row.owner_id=new.sender_id or asset_row.visibility='public'
        or (asset_row.visibility='friends' and exists(select 1 from public.friends f where f.status='accepted' and ((f.requester=asset_row.owner_id and f.addressee=new.sender_id) or (f.addressee=asset_row.owner_id and f.requester=new.sender_id))))
        or (asset_row.visibility='community' and target_community is not null and exists(select 1 from public.community_members owner_cm join public.community_members sender_cm on sender_cm.community_id=owner_cm.community_id where owner_cm.user_id=asset_row.owner_id and sender_cm.user_id=new.sender_id and sender_cm.community_id=target_community))
      ) or (asset_row.scope='conversation' and asset_row.scope_id=new.conversation_id) or (asset_row.scope='community' and target_community=asset_row.scope_id);
      if not is_allowed then raise exception 'Un emoji no pertenece a este chat o no está disponible para tu cuenta.'; end if;
    end loop;
  end if;
  if coalesce(new.attachment,'{}'::jsonb)->>'kind'='sticker' then
    if new.message_type<>'media' then raise exception 'Un sticker debe enviarse como mensaje multimedia.'; end if;
    begin asset_id:=(new.attachment->>'custom_asset_id')::uuid; exception when others then raise exception 'Sticker no válido.'; end;
    select * into asset_row from public.custom_assets where id=asset_id and asset_type='sticker' and archived_at is null;
    if not found then raise exception 'El sticker ya no existe.'; end if;
    is_allowed:=(asset_row.scope='personal' and (asset_row.owner_id=new.sender_id or exists(select 1 from public.sticker_workshop sw where sw.asset_id=asset_row.id))) or (asset_row.scope='conversation' and asset_row.scope_id=new.conversation_id) or (asset_row.scope='community' and new.channel_id is not null and exists(select 1 from public.channels ch where ch.id=new.channel_id and ch.community_id=asset_row.scope_id));
    if not is_allowed then raise exception 'El sticker no está disponible en este chat.'; end if;
  end if;
  if coalesce(new.attachment,'{}'::jsonb)->>'kind'='gif' and (new.message_type<>'media' or coalesce(new.attachment->>'provider','')<>'giphy' or coalesce(new.attachment->>'url','') !~ '^https://([a-z0-9-]+\.)*giphy\.com/' or coalesce(new.attachment->>'preview_url','') !~ '^https://([a-z0-9-]+\.)*giphy\.com/') then raise exception 'El GIF debe proceder del catálogo de GIPHY.'; end if;
  return new;
end;
$$;

-- Also validate a personal custom reaction's visibility against the message's actual destination.
create or replace function public.guard_nexus_custom_reaction()
returns trigger language plpgsql security definer set search_path=public,auth,pg_temp
as $$
declare asset_row public.custom_assets%rowtype; message_row public.messages%rowtype; asset_id uuid; target_community uuid; is_allowed boolean:=false;
begin
  if new.emoji not like 'custom:%' then return new; end if;
  if auth.uid() is null or new.user_id<>auth.uid() or public.is_user_banned() then raise exception 'No puedes usar esta reacción.'; end if;
  begin asset_id:=substring(new.emoji from 8)::uuid; exception when others then raise exception 'La referencia del emoji personalizado no es válida.'; end;
  select * into message_row from public.messages where id=new.message_id;
  if not found then raise exception 'El mensaje de la reacción no existe.'; end if;
  select * into asset_row from public.custom_assets where id=asset_id and asset_type='emoji' and archived_at is null;
  if not found then raise exception 'El emoji personalizado no existe o está archivado.'; end if;
  if asset_row.scope='personal' then
    is_allowed:=asset_row.owner_id=auth.uid() or asset_row.visibility='public'
      or (asset_row.visibility='friends' and exists(select 1 from public.friends f where f.status='accepted' and ((f.requester=asset_row.owner_id and f.addressee=auth.uid()) or (f.addressee=asset_row.owner_id and f.requester=auth.uid()))));
    if not is_allowed and asset_row.visibility='community' then
      if message_row.channel_id is not null then select community_id into target_community from public.channels where id=message_row.channel_id; end if;
      is_allowed:=target_community is not null and exists(select 1 from public.community_members owner_cm join public.community_members viewer_cm on viewer_cm.community_id=owner_cm.community_id where owner_cm.user_id=asset_row.owner_id and viewer_cm.user_id=auth.uid() and viewer_cm.community_id=target_community);
    end if;
    if not is_allowed then
      is_allowed:=exists(select 1 from public.messages m where (m.attachment->>'custom_asset_id'=asset_row.id::text or coalesce(m.formatting->'custom_emojis','[]'::jsonb) @> jsonb_build_array(asset_row.id::text) or exists(select 1 from public.message_reactions r where r.message_id=m.id and r.emoji='custom:'||asset_row.id::text)) and ((m.conversation_id is not null and public.is_conversation_member(m.conversation_id)) or (m.channel_id is not null and exists(select 1 from public.channels ch where ch.id=m.channel_id and public.is_community_member(ch.community_id)))));
    end if;
  elsif asset_row.scope='conversation' then
    is_allowed:=message_row.conversation_id=asset_row.scope_id and public.is_conversation_member(asset_row.scope_id);
  elsif asset_row.scope='community' and message_row.channel_id is not null then
    select community_id into target_community from public.channels where id=message_row.channel_id;
    is_allowed:=target_community=asset_row.scope_id and public.is_community_member(asset_row.scope_id);
  end if;
  if not is_allowed then raise exception 'Este emoji no está disponible en este chat.'; end if;
  return new;
end;
$$;

commit;
