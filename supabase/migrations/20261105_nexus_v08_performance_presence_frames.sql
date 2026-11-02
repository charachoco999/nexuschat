-- Nexus v0.8 — message pagination support, global presence and avatar frames.
-- Safe to run once after v0.7.2; statements are idempotent.
begin;

-- Dedicated transparent profile frame asset. Frames are public profile decoration;
-- the existing profiles RLS policy still permits writes only to the owner's row.
alter table public.profiles
  add column if not exists profile_frame_url text;

-- Cover the latest-page query and older-page keyset query efficiently.
create index if not exists messages_conversation_created_desc_idx
  on public.messages(conversation_id, created_at desc, id desc);
create index if not exists messages_channel_created_desc_idx
  on public.messages(channel_id, created_at desc, id desc);

-- Realtime presence topic: any authenticated, non-banned Nexus user can join.
-- The presence payload contains only public username/nickname/status fields.
create or replace function public.can_join_nexus_app_topic(p_topic text)
returns boolean
language plpgsql stable security definer
set search_path = public, auth, pg_temp
as $$
declare target_id uuid;
begin
  if auth.uid() is null or public.is_user_banned() then return false; end if;

  if p_topic = 'nexus-online' then
    return true;
  end if;

  if p_topic in (
    'nexus-friends-'||auth.uid()::text,
    'nexus-inbox-'||auth.uid()::text,
    'nexus-notifications-'||auth.uid()::text
  ) then
    return true;
  end if;

  if p_topic ~ '^nexus-(conversation|channel)-[0-9a-fA-F-]{36}$' then
    begin
      target_id := regexp_replace(p_topic,'^nexus-(conversation|channel)-','')::uuid;
    exception when others then
      return false;
    end;
    if left(p_topic,18) = 'nexus-conversation' then
      return public.is_conversation_member(target_id);
    end if;
    return exists (
      select 1 from public.channels ch
      where ch.id=target_id and public.is_community_member(ch.community_id)
    );
  end if;
  return false;
end;
$$;
revoke all on function public.can_join_nexus_app_topic(text) from public, anon;
grant execute on function public.can_join_nexus_app_topic(text) to authenticated;

-- Refresh the existing private-topic policies so they also admit nexus-online.
drop policy if exists nexus_app_private_topics_read on realtime.messages;
create policy nexus_app_private_topics_read on realtime.messages
for select to authenticated
using (public.can_join_nexus_app_topic(realtime.topic()));

drop policy if exists nexus_app_private_topics_write on realtime.messages;
create policy nexus_app_private_topics_write on realtime.messages
for insert to authenticated
with check (
  extension in ('broadcast','presence')
  and public.can_join_nexus_app_topic(realtime.topic())
);

commit;
