-- Nexus v0.4: live friend/conversation lists, threaded replies, message edits and reactions.
-- Safe to run once on an existing v0.3 project; all DDL is idempotent.

alter table public.messages
  add column if not exists reply_to uuid references public.messages(id) on delete set null,
  add column if not exists edited_at timestamptz;

create index if not exists messages_reply_to_idx on public.messages(reply_to) where reply_to is not null;

-- A reply must reference a message in the very same DM/group/channel.
create or replace function public.guard_message_reply()
returns trigger
language plpgsql
set search_path = public, auth
as $$
declare target_conversation uuid; target_channel uuid;
begin
  if new.reply_to is null then return new; end if;
  select conversation_id, channel_id
    into target_conversation, target_channel
    from public.messages
    where id = new.reply_to;
  if not found then
    raise exception 'El mensaje al que respondes ya no existe o no es accesible.';
  end if;
  if target_conversation is distinct from new.conversation_id
     or target_channel is distinct from new.channel_id then
    raise exception 'Solo puedes responder a mensajes del mismo chat.';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_guard_reply on public.messages;
create trigger messages_guard_reply
before insert or update of reply_to on public.messages
for each row execute function public.guard_message_reply();

-- Editing is performed through a narrow RPC. Clients cannot change authorship,
-- room IDs, attachment metadata, or message type while editing.
create or replace function public.edit_message(p_message_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare owner_id uuid; kind text; room_conversation uuid; room_channel uuid;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if public.is_user_banned() then raise exception 'Tu cuenta está suspendida.'; end if;
  if p_body is null or length(trim(p_body)) = 0 or length(p_body) > 12000 then
    raise exception 'El mensaje debe tener entre 1 y 12000 caracteres.';
  end if;
  select sender_id, message_type, conversation_id, channel_id into owner_id, kind, room_conversation, room_channel
    from public.messages where id = p_message_id;
  if not found then raise exception 'El mensaje ya no existe.'; end if;
  if owner_id <> auth.uid() then raise exception 'Solo puedes editar tus propios mensajes.'; end if;
  if room_conversation is not null and not public.is_conversation_member(room_conversation) then raise exception 'Ya no perteneces a esta conversación.'; end if;
  if room_channel is not null and not exists(select 1 from public.channels ch where ch.id=room_channel and public.is_community_member(ch.community_id)) then raise exception 'Ya no perteneces a este megagrupo.'; end if;
  if kind <> 'text' then raise exception 'Solo se pueden editar mensajes de texto.'; end if;
  update public.messages
     set body = trim(p_body), edited_at = now()
   where id = p_message_id and sender_id = auth.uid();
end;
$$;
revoke all on function public.edit_message(uuid, text) from public;
grant execute on function public.edit_message(uuid, text) to authenticated;

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index if not exists message_reactions_message_idx on public.message_reactions(message_id);
alter table public.message_reactions enable row level security;
grant select, insert, delete on public.message_reactions to authenticated;

drop policy if exists message_reactions_read_member on public.message_reactions;
create policy message_reactions_read_member on public.message_reactions
  for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id));

drop policy if exists message_reactions_insert_self on public.message_reactions;
create policy message_reactions_insert_self on public.message_reactions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and not public.is_user_banned()
    and exists (select 1 from public.messages m where m.id = message_id)
  );

drop policy if exists message_reactions_delete_self on public.message_reactions;
create policy message_reactions_delete_self on public.message_reactions
  for delete to authenticated
  using (user_id = auth.uid());

-- Update conversation ordering whenever a new DM/group message is inserted.
create or replace function public.bump_conversation_activity()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.conversation_id is not null then
    update public.conversations set updated_at = now() where id = new.conversation_id;
  end if;
  return new;
end;
$$;

drop trigger if exists messages_bump_conversation_activity on public.messages;
create trigger messages_bump_conversation_activity
after insert on public.messages
for each row execute function public.bump_conversation_activity();

-- Enable Postgres Changes for rows needed by the live inbox and reactions.
do $$
declare table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    for table_name in select unnest(array['messages','friends','conversation_members','conversations','message_reactions']) loop
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
