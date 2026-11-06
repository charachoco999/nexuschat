-- Nexus v0.11.1 alpha1: Terms acceptance, user blocking, message reports and evidence.
-- Apply once after all v0.11.0 migrations. Safe to re-run where possible.
begin;

-- ---------------------------------------------------------------------------
-- Versioned Terms of Service acceptance. No IP address or user-agent is stored.
-- ---------------------------------------------------------------------------
create table if not exists public.tos_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null check (length(terms_version) between 3 and 80),
  terms_hash text not null check (terms_hash ~ '^[0-9a-f]{64}$'),
  accepted_at timestamptz not null default now(),
  unique(user_id, terms_version)
);
alter table public.tos_acceptances enable row level security;
revoke all on table public.tos_acceptances from public, anon, authenticated;
grant select on table public.tos_acceptances to authenticated;
drop policy if exists tos_acceptances_read_own on public.tos_acceptances;
create policy tos_acceptances_read_own on public.tos_acceptances
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.accept_nexus_terms(p_terms_version text, p_terms_hash text)
returns timestamptz
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare accepted_time timestamptz;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión para aceptar las condiciones.'; end if;
  if p_terms_version <> '2026-11-06-v1' then raise exception 'La versión de las condiciones no coincide.'; end if;
  if p_terms_hash <> '88fe87771d333d444807568ec6906441e23e1e6afe37c39fa30ed01f98ba33a0' then raise exception 'La huella de las condiciones no coincide.'; end if;
  insert into public.tos_acceptances(user_id,terms_version,terms_hash)
  values(auth.uid(),p_terms_version,p_terms_hash)
  on conflict(user_id,terms_version) do update set terms_hash=excluded.terms_hash
  returning accepted_at into accepted_time;
  return accepted_time;
end;
$$;
revoke all on function public.accept_nexus_terms(text,text) from public, anon;
grant execute on function public.accept_nexus_terms(text,text) to authenticated;

-- Enforce acceptance on the main app data plane, not only in the UI.
create or replace function public.nexus_has_current_terms()
returns boolean language sql stable security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1 from public.tos_acceptances t
     where t.user_id=(select auth.uid())
       and t.terms_version='2026-11-06-v1'
       and t.terms_hash='88fe87771d333d444807568ec6906441e23e1e6afe37c39fa30ed01f98ba33a0'
  );
$$;
revoke all on function public.nexus_has_current_terms() from public, anon;
grant execute on function public.nexus_has_current_terms() to authenticated;

-- Replace the principal read/write policies so a signed-in account cannot use
-- the REST API to continue chatting before accepting this exact ToS revision.
drop policy if exists profiles_read_authenticated on public.profiles;
create policy profiles_read_authenticated on public.profiles for select to authenticated
  using (public.nexus_has_current_terms());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id=auth.uid() and public.nexus_has_current_terms() and not public.is_user_banned())
  with check (id=auth.uid() and public.nexus_has_current_terms() and not public.is_user_banned());
drop policy if exists conversations_read_members on public.conversations;
create policy conversations_read_members on public.conversations for select to authenticated
  using (public.nexus_has_current_terms() and public.is_conversation_member(id));
drop policy if exists conversation_members_read_self on public.conversation_members;
create policy conversation_members_read_self on public.conversation_members for select to authenticated
  using (public.nexus_has_current_terms() and public.is_conversation_member(conversation_id));
drop policy if exists messages_read_member on public.messages;
create policy messages_read_member on public.messages for select to authenticated using (
  public.nexus_has_current_terms() and (
    (conversation_id is not null and public.is_conversation_member(messages.conversation_id))
    or (channel_id is not null and exists(select 1 from public.channels ch where ch.id=messages.channel_id and public.is_community_member(ch.community_id)))
  )
);
drop policy if exists messages_insert_member on public.messages;
create policy messages_insert_member on public.messages for insert to authenticated with check (
  public.nexus_has_current_terms() and sender_id=auth.uid() and not public.is_user_banned() and (
    (conversation_id is not null and public.is_conversation_member(messages.conversation_id))
    or (channel_id is not null and exists(select 1 from public.channels ch where ch.id=messages.channel_id and public.is_community_member(ch.community_id) and public.has_community_permission(ch.community_id,'send_messages')))
  )
);
drop policy if exists communities_read_signed_in on public.communities;
create policy communities_read_signed_in on public.communities for select to authenticated
  using (public.nexus_has_current_terms() and (is_public=true or public.is_community_member(id)));
drop policy if exists community_members_read on public.community_members;
create policy community_members_read on public.community_members for select to authenticated
  using (public.nexus_has_current_terms() and (public.is_community_member(community_id) or user_id=auth.uid()));
drop policy if exists channels_read_members on public.channels;
create policy channels_read_members on public.channels for select to authenticated
  using (public.nexus_has_current_terms() and public.is_community_member(community_id));
drop policy if exists friends_read_participant on public.friends;
create policy friends_read_participant on public.friends for select to authenticated
  using (public.nexus_has_current_terms() and (requester=auth.uid() or addressee=auth.uid()));
drop policy if exists friends_create_request on public.friends;
create policy friends_create_request on public.friends for insert to authenticated
  with check (public.nexus_has_current_terms() and requester=auth.uid() and status='pending' and not public.is_user_banned());
drop policy if exists friends_accept_request on public.friends;
create policy friends_accept_request on public.friends for update to authenticated
  using (public.nexus_has_current_terms() and addressee=auth.uid() and status in ('pending','accepted'))
  with check (public.nexus_has_current_terms() and addressee=auth.uid() and status in ('accepted','declined','blocked'));
drop policy if exists friends_cancel_request on public.friends;
create policy friends_cancel_request on public.friends for delete to authenticated
  using (public.nexus_has_current_terms() and (requester=auth.uid() or addressee=auth.uid()));


-- ---------------------------------------------------------------------------
-- User blocks. Blocks affect direct conversations and friend requests only;
-- shared community channels remain governed by their own membership rules.
-- ---------------------------------------------------------------------------
create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id,blocked_id),
  check(blocker_id <> blocked_id)
);
create index if not exists user_blocks_blocked_idx on public.user_blocks(blocked_id,blocker_id);
alter table public.user_blocks enable row level security;
revoke all on table public.user_blocks from public, anon, authenticated;
grant select, insert, delete on table public.user_blocks to authenticated;
drop policy if exists user_blocks_read_own on public.user_blocks;
create policy user_blocks_read_own on public.user_blocks
  for select to authenticated using (public.nexus_has_current_terms() and blocker_id = (select auth.uid()));
drop policy if exists user_blocks_insert_own on public.user_blocks;
create policy user_blocks_insert_own on public.user_blocks
  for insert to authenticated with check (public.nexus_has_current_terms() and blocker_id = (select auth.uid()) and not public.is_user_banned());
drop policy if exists user_blocks_delete_own on public.user_blocks;
create policy user_blocks_delete_own on public.user_blocks
  for delete to authenticated using (public.nexus_has_current_terms() and blocker_id = (select auth.uid()));

create or replace function public.nexus_users_block_each_other(p_user_a uuid, p_user_b uuid)
returns boolean language sql stable security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1 from public.user_blocks b
    where (b.blocker_id=p_user_a and b.blocked_id=p_user_b)
       or (b.blocker_id=p_user_b and b.blocked_id=p_user_a)
  );
$$;
revoke all on function public.nexus_users_block_each_other(uuid,uuid) from public, anon, authenticated;

create or replace function public.guard_nexus_direct_block_message()
returns trigger language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare other_member uuid; target_kind text;
begin
  if new.conversation_id is null then return new; end if;
  select kind into target_kind from public.conversations where id=new.conversation_id;
  if target_kind <> 'direct' then return new; end if;
  select user_id into other_member
    from public.conversation_members
   where conversation_id=new.conversation_id and user_id<>new.sender_id
   limit 1;
  if other_member is not null and public.nexus_users_block_each_other(new.sender_id,other_member) then
    raise exception 'No puedes enviar mensajes en este MD porque existe un bloqueo entre las cuentas.';
  end if;
  return new;
end;
$$;
drop trigger if exists nexus_direct_block_message_guard on public.messages;
create trigger nexus_direct_block_message_guard
before insert on public.messages for each row execute function public.guard_nexus_direct_block_message();

create or replace function public.guard_nexus_direct_block_member()
returns trigger language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare target_kind text; existing_member uuid; actor_id uuid;
begin
  actor_id := auth.uid();
  if actor_id is null or new.user_id=actor_id then return new; end if;
  select kind into target_kind from public.conversations where id=new.conversation_id;
  if target_kind <> 'direct' then return new; end if;
  select user_id into existing_member from public.conversation_members
   where conversation_id=new.conversation_id and user_id<>new.user_id limit 1;
  if existing_member is not null and public.nexus_users_block_each_other(actor_id,new.user_id) then
    raise exception 'No puedes abrir un MD con esta cuenta porque existe un bloqueo.';
  end if;
  return new;
end;
$$;
drop trigger if exists nexus_direct_block_member_guard on public.conversation_members;
create trigger nexus_direct_block_member_guard
before insert on public.conversation_members for each row execute function public.guard_nexus_direct_block_member();

create or replace function public.guard_nexus_friend_block()
returns trigger language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
begin
  if new.status in ('pending','accepted') and public.nexus_users_block_each_other(new.requester,new.addressee) then
    raise exception 'No puedes enviar ni aceptar una solicitud de amistad mientras exista un bloqueo.';
  end if;
  return new;
end;
$$;
drop trigger if exists nexus_friend_block_guard on public.friends;
create trigger nexus_friend_block_guard
before insert or update of status on public.friends for each row execute function public.guard_nexus_friend_block();

-- ---------------------------------------------------------------------------
-- Message reports. The reporter's client copies any attached files into a
-- private evidence bucket before finalize_nexus_message_report() removes the
-- selected message and the five immediately preceding messages from chat.
-- ---------------------------------------------------------------------------
create table if not exists public.nexus_message_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  reported_message_id uuid not null,
  conversation_id uuid references public.conversations(id) on delete set null,
  channel_id uuid references public.channels(id) on delete set null,
  reason text not null check (length(reason) between 5 and 1200),
  message_ids uuid[] not null default '{}',
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence)='array'),
  evidence_files jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_files)='array'),
  status text not null default 'pending_upload' check(status in ('pending_upload','open','reviewing','actioned','dismissed')),
  admin_note text not null default '' check(length(admin_note)<=1500),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  unique(reporter_id,reported_message_id)
);
create index if not exists nexus_message_reports_status_idx
  on public.nexus_message_reports(status,created_at desc);
create index if not exists nexus_message_reports_reported_user_idx
  on public.nexus_message_reports(reported_user_id,created_at desc);
alter table public.nexus_message_reports enable row level security;
revoke all on table public.nexus_message_reports from public, anon, authenticated;
grant select, update on table public.nexus_message_reports to authenticated;
drop policy if exists nexus_message_reports_admin_read on public.nexus_message_reports;
create policy nexus_message_reports_admin_read on public.nexus_message_reports
  for select to authenticated using (public.is_platform_admin());
drop policy if exists nexus_message_reports_admin_update on public.nexus_message_reports;
create policy nexus_message_reports_admin_update on public.nexus_message_reports
  for update to authenticated using (public.is_platform_admin())
  with check (public.is_platform_admin());

create or replace function public.create_nexus_message_report(p_message_id uuid, p_reason text)
returns jsonb language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare target public.messages%rowtype; report_id uuid; context_rows jsonb; context_ids uuid[];
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if not public.nexus_has_current_terms() then raise exception 'Debes aceptar las condiciones actuales antes de reportar mensajes.'; end if;
  if public.is_user_banned() then raise exception 'Tu cuenta no puede enviar reportes en este momento.'; end if;
  if length(trim(coalesce(p_reason,'')))<5 or length(p_reason)>1200 then
    raise exception 'Explica el motivo del reporte con entre 5 y 1200 caracteres.';
  end if;
  select * into target from public.messages where id=p_message_id;
  if not found then raise exception 'El mensaje ya no existe.'; end if;
  if target.sender_id=auth.uid() then raise exception 'No puedes reportar un mensaje propio.'; end if;
  if target.conversation_id is not null then
    if not public.is_conversation_member(target.conversation_id) then raise exception 'No perteneces a esta conversación.'; end if;
  elsif target.channel_id is not null then
    if not exists(select 1 from public.channels ch where ch.id=target.channel_id and public.is_community_member(ch.community_id)) then
      raise exception 'No perteneces a este canal.';
    end if;
  end if;
  if exists(select 1 from public.nexus_message_reports r where r.reporter_id=auth.uid() and r.reported_message_id=p_message_id) then
    raise exception 'Ya has reportado este mensaje.';
  end if;
  if (select count(*) from public.nexus_message_reports where reporter_id=auth.uid() and created_at>now()-interval '1 hour')>=8 then
    raise exception 'Has alcanzado el límite temporal de reportes. Inténtalo más tarde.';
  end if;
  select jsonb_agg(jsonb_build_object(
           'id',x.id,'sender_id',x.sender_id,'body',x.body,'message_type',x.message_type,
           'attachment',x.attachment,'formatting',x.formatting,'created_at',x.created_at
         ) order by x.created_at,x.id),
         array_agg(x.id order by x.created_at,x.id)
    into context_rows,context_ids
    from (
      select m.* from public.messages m
       where ((target.conversation_id is not null and m.conversation_id=target.conversation_id)
           or (target.channel_id is not null and m.channel_id=target.channel_id))
         and (m.created_at,m.id)<=(target.created_at,target.id)
       order by m.created_at desc,m.id desc
       limit 6
    ) x;
  if context_rows is null or not (context_ids @> array[p_message_id]::uuid[]) then
    raise exception 'No se pudo reunir el contexto del mensaje.';
  end if;
  insert into public.nexus_message_reports(
    reporter_id,reported_user_id,reported_message_id,conversation_id,channel_id,
    reason,message_ids,evidence,status
  ) values(
    auth.uid(),target.sender_id,target.id,target.conversation_id,target.channel_id,
    trim(p_reason),context_ids,context_rows,'pending_upload'
  ) returning id into report_id;
  return jsonb_build_object('report_id',report_id,'messages',context_rows);
end;
$$;
revoke all on function public.create_nexus_message_report(uuid,text) from public, anon;
grant execute on function public.create_nexus_message_report(uuid,text) to authenticated;

create or replace function public.finalize_nexus_message_report(p_report_id uuid, p_evidence_files jsonb default '[]'::jsonb)
returns void language plpgsql security definer
set search_path = public, auth, storage, pg_temp
as $$
declare report_row public.nexus_message_reports%rowtype; file_row jsonb; file_path text;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if not public.nexus_has_current_terms() then raise exception 'Debes aceptar las condiciones actuales.'; end if;
  if jsonb_typeof(coalesce(p_evidence_files,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_evidence_files,'[]'::jsonb))>60 then
    raise exception 'La lista de archivos de evidencia no es válida.';
  end if;
  select * into report_row from public.nexus_message_reports where id=p_report_id for update;
  if not found or report_row.reporter_id<>auth.uid() then raise exception 'No tienes acceso a este reporte.'; end if;
  if report_row.status<>'pending_upload' then raise exception 'Este reporte ya se ha procesado.'; end if;
  for file_row in select value from jsonb_array_elements(coalesce(p_evidence_files,'[]'::jsonb)) loop
    file_path:=file_row->>'path';
    if file_path is null or file_path not like auth.uid()::text||'/'||p_report_id::text||'/%' then
      raise exception 'Una ruta de evidencia no pertenece a este reporte.';
    end if;
    if not exists(select 1 from storage.objects o where o.bucket_id='nexus-report-evidence' and o.name=file_path) then
      raise exception 'Falta un archivo de evidencia. No se han eliminado los mensajes.';
    end if;
  end loop;
  update public.nexus_message_reports
     set evidence_files=coalesce(p_evidence_files,'[]'::jsonb),status='open'
   where id=p_report_id;
  delete from public.messages where id=any(report_row.message_ids);
end;
$$;
revoke all on function public.finalize_nexus_message_report(uuid,jsonb) from public, anon;
grant execute on function public.finalize_nexus_message_report(uuid,jsonb) to authenticated;

create or replace function public.cancel_nexus_message_report(p_report_id uuid)
returns void language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare report_row public.nexus_message_reports%rowtype;
begin
  if auth.uid() is null then return; end if;
  select * into report_row from public.nexus_message_reports where id=p_report_id for update;
  if not found or report_row.reporter_id<>auth.uid() then return; end if;
  if report_row.status='pending_upload' then delete from public.nexus_message_reports where id=p_report_id; end if;
end;
$$;
revoke all on function public.cancel_nexus_message_report(uuid) from public, anon;
grant execute on function public.cancel_nexus_message_report(uuid) to authenticated;

-- RLS helper: a reporter can upload/delete objects only inside their own
-- pending report. SECURITY DEFINER avoids the admin-only report-table RLS from
-- hiding the row inside the Storage policy expression.
create or replace function public.nexus_can_manage_pending_report_evidence(p_report_id text)
returns boolean language sql stable security definer
set search_path = public, auth, pg_temp
as $$
  select exists(select 1 from public.nexus_message_reports r
    where r.id::text=p_report_id and r.reporter_id=(select auth.uid())
      and r.status='pending_upload' and public.nexus_has_current_terms());
$$;
revoke all on function public.nexus_can_manage_pending_report_evidence(text) from public, anon;
grant execute on function public.nexus_can_manage_pending_report_evidence(text) to authenticated;

-- Private evidence bucket. Only the reporter can upload into their pending
-- report path; only platform admins can read evidence after submission.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('nexus-report-evidence','nexus-report-evidence',false,52428800,
  array['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm','audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav','audio/x-wav','application/pdf','application/zip','application/x-zip-compressed','application/octet-stream','text/plain','text/csv','text/tab-separated-values','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.oasis.opendocument.spreadsheet'])
on conflict(id) do update set public=false,file_size_limit=52428800,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists nexus_report_evidence_upload_pending on storage.objects;
create policy nexus_report_evidence_upload_pending on storage.objects
  for insert to authenticated with check (
    bucket_id='nexus-report-evidence'
    and (storage.foldername(name))[1]=(select auth.uid())::text
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and public.nexus_can_manage_pending_report_evidence((storage.foldername(name))[2])
  );
drop policy if exists nexus_report_evidence_delete_pending on storage.objects;
create policy nexus_report_evidence_delete_pending on storage.objects
  for delete to authenticated using (
    bucket_id='nexus-report-evidence'
    and (storage.foldername(name))[1]=(select auth.uid())::text
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and public.nexus_can_manage_pending_report_evidence((storage.foldername(name))[2])
  );
drop policy if exists nexus_report_evidence_read_admin on storage.objects;
create policy nexus_report_evidence_read_admin on storage.objects
  for select to authenticated using (bucket_id='nexus-report-evidence' and public.is_platform_admin());

commit;
