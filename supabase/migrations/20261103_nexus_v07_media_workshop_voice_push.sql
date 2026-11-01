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
returns boolean
language plpgsql stable security definer
set search_path = public, auth, pg_temp
as $$
declare target_id uuid;
begin
  if auth.uid() is null or public.is_user_banned() then return false; end if;
  if p_topic in (
    'nexus-friends-'||auth.uid()::text,
    'nexus-inbox-'||auth.uid()::text,
    'nexus-notifications-'||auth.uid()::text
  ) then return true; end if;
  if p_topic ~ '^nexus-(conversation|channel)-[0-9a-fA-F-]{36}$' then
    begin target_id := regexp_replace(p_topic,'^nexus-(conversation|channel)-','')::uuid; exception when others then return false; end;
    if split_part(p_topic,'-',2)='conversation' then
      return public.is_conversation_member(target_id);
    end if;
    return exists(
      select 1 from public.channels ch
      where ch.id=target_id and public.is_community_member(ch.community_id)
    );
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
