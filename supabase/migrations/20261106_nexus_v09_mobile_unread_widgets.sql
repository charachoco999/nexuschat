-- Nexus v0.9: channel read state, unread counters and 32 profile widgets.
-- Safe to run once after the v0.8 migration. Existing profile widgets are retained.
begin;

-- v0.5 originally limited profile widgets to ten. Raise the database boundary
-- as well as the client-side limit so 32 widgets can be saved safely.
alter table public.profiles
  drop constraint if exists profiles_widgets_limit;
alter table public.profiles
  add constraint profiles_widgets_limit
  check (
    case
      when jsonb_typeof(widgets) = 'array' then jsonb_array_length(widgets) <= 32
      else false
    end
  );

-- Channel read receipts parallel the existing conversation_reads table.
create table if not exists public.channel_reads (
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

alter table public.channel_reads enable row level security;
revoke all on public.channel_reads from anon, authenticated;
grant select on public.channel_reads to authenticated;

drop policy if exists channel_reads_select_own on public.channel_reads;
create policy channel_reads_select_own on public.channel_reads
  for select to authenticated using (user_id = auth.uid());

-- Existing chats start with zero unread messages after the upgrade. New members
-- use joined_at as the fallback baseline, so historical chat contents are not
-- suddenly counted as unread for everyone on first launch.
insert into public.conversation_reads(conversation_id,user_id,last_read_message_id,read_at)
select cm.conversation_id,cm.user_id,null,now()
from public.conversation_members cm
on conflict(conversation_id,user_id) do nothing;

insert into public.channel_reads(channel_id,user_id,read_at)
select ch.id,cm.user_id,now()
from public.channels ch
join public.community_members cm on cm.community_id=ch.community_id
on conflict(channel_id,user_id) do nothing;

create or replace function public.mark_channel_read(p_channel_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare target_community uuid;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  select community_id into target_community
    from public.channels where id = p_channel_id;
  if target_community is null or not public.is_community_member(target_community) then
    raise exception 'No perteneces a este canal.';
  end if;
  insert into public.channel_reads(channel_id, user_id, read_at)
  values (p_channel_id, auth.uid(), now())
  on conflict (channel_id, user_id)
  do update set read_at = excluded.read_at;
end;
$$;
revoke all on function public.mark_channel_read(uuid) from public, anon;
grant execute on function public.mark_channel_read(uuid) to authenticated;

-- One RPC calculates counters for every conversation and channel visible to
-- the signed-in user, avoiding a client-side query per sidebar row.
create or replace function public.get_nexus_unread_counts()
returns table(context_type text, context_id uuid, unread_count bigint)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select 'conversation'::text, cm.conversation_id, count(m.id)::bigint
  from public.conversation_members cm
  join public.messages m on m.conversation_id = cm.conversation_id
  left join public.conversation_reads r
    on r.conversation_id = cm.conversation_id and r.user_id = auth.uid()
  where auth.uid() is not null
    and cm.user_id = auth.uid()
    and m.sender_id <> auth.uid()
    and m.created_at > coalesce(r.read_at, cm.joined_at)
  group by cm.conversation_id

  union all

  select 'channel'::text, ch.id, count(m.id)::bigint
  from public.channels ch
  join public.community_members cm on cm.community_id = ch.community_id
  join public.messages m on m.channel_id = ch.id
  left join public.channel_reads r
    on r.channel_id = ch.id and r.user_id = auth.uid()
  where auth.uid() is not null
    and cm.user_id = auth.uid()
    and m.sender_id <> auth.uid()
    and m.created_at > coalesce(r.read_at, cm.joined_at)
  group by ch.id;
$$;
revoke all on function public.get_nexus_unread_counts() from public, anon;
grant execute on function public.get_nexus_unread_counts() to authenticated;

commit;
