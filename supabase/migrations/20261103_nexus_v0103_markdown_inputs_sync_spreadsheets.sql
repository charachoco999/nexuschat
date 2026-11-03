-- Nexus v0.10.0-alpha.3
-- Shared InputSync values are scoped to a message and readable only by chat members.
-- Spreadsheet attachments extend the existing private chat-media MIME allowlist.
begin;

create table if not exists public.nexus_input_sync_states (
  message_id uuid not null references public.messages(id) on delete cascade,
  sync_key text not null check (length(sync_key) between 1 and 80),
  state jsonb not null default '{}'::jsonb,
  updated_by uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (message_id, sync_key),
  check (octet_length(state::text) <= 2048)
);

create index if not exists nexus_input_sync_updated_at_idx
  on public.nexus_input_sync_states(updated_at desc);

alter table public.nexus_input_sync_states enable row level security;
grant select, insert, update on public.nexus_input_sync_states to authenticated;
revoke all on public.nexus_input_sync_states from anon;

drop policy if exists nexus_input_sync_read_chat_members on public.nexus_input_sync_states;
create policy nexus_input_sync_read_chat_members
on public.nexus_input_sync_states for select to authenticated
using (
  exists (
    select 1 from public.messages m
    where m.id = nexus_input_sync_states.message_id
      and (
        (m.conversation_id is not null and public.is_conversation_member(m.conversation_id))
        or
        (m.channel_id is not null and exists (
          select 1 from public.channels ch
          where ch.id=m.channel_id and public.is_community_member(ch.community_id)
        ))
      )
  )
);

drop policy if exists nexus_input_sync_insert_chat_members on public.nexus_input_sync_states;
create policy nexus_input_sync_insert_chat_members
on public.nexus_input_sync_states for insert to authenticated
with check (
  updated_by=auth.uid()
  and not public.is_user_banned()
  and exists (
    select 1 from public.messages m
    where m.id = nexus_input_sync_states.message_id
      and (
        (m.conversation_id is not null and public.is_conversation_member(m.conversation_id))
        or
        (m.channel_id is not null and exists (
          select 1 from public.channels ch
          where ch.id=m.channel_id and public.is_community_member(ch.community_id)
        ))
      )
  )
);

drop policy if exists nexus_input_sync_update_chat_members on public.nexus_input_sync_states;
create policy nexus_input_sync_update_chat_members
on public.nexus_input_sync_states for update to authenticated
using (
  exists (
    select 1 from public.messages m
    where m.id = nexus_input_sync_states.message_id
      and (
        (m.conversation_id is not null and public.is_conversation_member(m.conversation_id))
        or
        (m.channel_id is not null and exists (
          select 1 from public.channels ch
          where ch.id=m.channel_id and public.is_community_member(ch.community_id)
        ))
      )
  )
)
with check (
  updated_by=auth.uid()
  and not public.is_user_banned()
  and exists (
    select 1 from public.messages m
    where m.id = nexus_input_sync_states.message_id
      and (
        (m.conversation_id is not null and public.is_conversation_member(m.conversation_id))
        or
        (m.channel_id is not null and exists (
          select 1 from public.channels ch
          where ch.id=m.channel_id and public.is_community_member(ch.community_id)
        ))
      )
  )
);

-- Realtime delivers only rows permitted by the table's RLS policies.
do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
     and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='nexus_input_sync_states') then
    alter publication supabase_realtime add table public.nexus_input_sync_states;
  end if;
end $$;

update storage.buckets
set allowed_mime_types = array[
  'image/png','image/jpeg','image/webp','image/gif',
  'video/mp4','video/webm',
  'audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav','audio/x-wav',
  'application/pdf','text/plain','application/zip',
  'text/csv','text/tab-separated-values',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.spreadsheet'
]
where id='chat-media';

commit;
