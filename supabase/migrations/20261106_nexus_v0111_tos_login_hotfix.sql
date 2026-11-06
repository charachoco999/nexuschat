-- Nexus v0.11.1-alpha1-hotfix1
-- Repair login/ToS acceptance for accounts without an acceptance row.
-- This migration NEVER auto-accepts the Terms of Service for a user.
-- Safe to re-run.
begin;

-- Ensure the private acceptance table exists and the current user can read only
-- their own record. The acceptance status itself is read through a SECURITY
-- DEFINER RPC so a missing row is returned as {accepted:false}, not HTTP 406.
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

create or replace function public.nexus_terms_acceptance_status()
returns jsonb
language plpgsql stable security definer
set search_path = public, auth, pg_temp
as $$
declare is_accepted boolean := false;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  select exists (
    select 1 from public.tos_acceptances t
    where t.user_id = (select auth.uid())
      and t.terms_version = '2026-11-06-v1'
      and t.terms_hash = '88fe87771d333d444807568ec6906441e23e1e6afe37c39fa30ed01f98ba33a0'
  ) into is_accepted;
  return jsonb_build_object(
    'accepted', is_accepted,
    'terms_version', '2026-11-06-v1',
    'terms_hash', '88fe87771d333d444807568ec6906441e23e1e6afe37c39fa30ed01f98ba33a0'
  );
end;
$$;
revoke all on function public.nexus_terms_acceptance_status() from public, anon;
grant execute on function public.nexus_terms_acceptance_status() to authenticated;

-- Postgres cannot change a function's return type with CREATE OR REPLACE.
-- Drop the previous timestamp-returning version and replace it with a stable
-- JSON contract that the client can validate before unlocking the app.
drop function if exists public.accept_nexus_terms(text, text);
create function public.accept_nexus_terms(p_terms_version text, p_terms_hash text)
returns jsonb
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare accepted_time timestamptz;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión para aceptar las condiciones.'; end if;
  if p_terms_version <> '2026-11-06-v1' then raise exception 'La versión de las condiciones no coincide.'; end if;
  if p_terms_hash <> '88fe87771d333d444807568ec6906441e23e1e6afe37c39fa30ed01f98ba33a0' then raise exception 'La huella de las condiciones no coincide.'; end if;
  insert into public.tos_acceptances(user_id, terms_version, terms_hash)
  values ((select auth.uid()), p_terms_version, p_terms_hash)
  on conflict (user_id, terms_version)
  do update set terms_hash = excluded.terms_hash
  returning accepted_at into accepted_time;
  return jsonb_build_object(
    'accepted', true,
    'terms_version', p_terms_version,
    'terms_hash', p_terms_hash,
    'accepted_at', accepted_time
  );
end;
$$;
revoke all on function public.accept_nexus_terms(text, text) from public, anon;
grant execute on function public.accept_nexus_terms(text, text) to authenticated;

create or replace function public.nexus_has_current_terms()
returns boolean
language sql stable security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1 from public.tos_acceptances t
    where t.user_id = (select auth.uid())
      and t.terms_version = '2026-11-06-v1'
      and t.terms_hash = '88fe87771d333d444807568ec6906441e23e1e6afe37c39fa30ed01f98ba33a0'
  );
$$;
revoke all on function public.nexus_has_current_terms() from public, anon;
grant execute on function public.nexus_has_current_terms() to authenticated;

-- Ensure a user can always read their own profile row while they are being
-- routed through the mandatory ToS screen. This does not expose other profiles
-- and does not grant access to the rest of the application data plane.
alter table public.profiles enable row level security;
drop policy if exists profiles_read_own_login_recovery on public.profiles;
create policy profiles_read_own_login_recovery on public.profiles
  for select to authenticated using (id = (select auth.uid()));

-- Fetch/create only the current account's public profile after ToS acceptance.
-- This repairs legacy accounts whose auth.users row exists but profiles row was
-- not created by a trigger. No auth secrets or private session data are returned.
create or replace function public.nexus_ensure_current_profile()
returns jsonb
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare
  current_id uuid := auth.uid();
  profile_json jsonb;
  user_metadata jsonb;
  candidate text;
  candidate_nickname text;
begin
  if current_id is null then raise exception 'Debes iniciar sesión.'; end if;
  if not public.nexus_has_current_terms() then
    raise exception 'Debes aceptar las condiciones actuales antes de cargar tu perfil.';
  end if;

  select to_jsonb(p) into profile_json
  from public.profiles p where p.id = current_id;
  if profile_json is not null then return profile_json; end if;

  select coalesce(u.raw_user_meta_data, '{}'::jsonb)
    into user_metadata from auth.users u where u.id = current_id;
  candidate := lower(regexp_replace(
    coalesce(user_metadata ->> 'username', 'user_' || substr(current_id::text, 1, 8)),
    '[^a-z0-9_]', '', 'g'
  ));
  if length(candidate) < 3 then candidate := 'user_' || substr(current_id::text, 1, 8); end if;
  candidate := left(candidate, 24);
  if exists (select 1 from public.profiles p where p.username = candidate and p.id <> current_id) then
    candidate := left(candidate, 15) || '_' || substr(current_id::text, 1, 8);
  end if;
  if exists (select 1 from public.profiles p where p.username = candidate and p.id <> current_id) then
    candidate := 'user_' || replace(substr(current_id::text, 1, 20), '-', '');
  end if;
  candidate_nickname := left(coalesce(user_metadata ->> 'nickname', ''), 80);

  insert into public.profiles(id, username, nickname)
  values(current_id, candidate, candidate_nickname)
  on conflict (id) do nothing;
  select to_jsonb(p) into profile_json
  from public.profiles p where p.id = current_id;
  if profile_json is null then raise exception 'No se pudo crear el perfil de esta cuenta.'; end if;
  return profile_json;
end;
$$;
revoke all on function public.nexus_ensure_current_profile() from public, anon;
grant execute on function public.nexus_ensure_current_profile() to authenticated;

notify pgrst, 'reload schema';
commit;
