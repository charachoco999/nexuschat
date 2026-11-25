-- Nexus legal revision 2026-11-25-v3.
-- Run this migration before publishing the matching frontend.
-- It does not auto-accept the revised Terms; users must review and accept them.

begin;

create or replace function public.accept_nexus_terms(p_terms_version text, p_terms_hash text)
returns jsonb
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare accepted_time timestamptz;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión para aceptar las condiciones.'; end if;
  if p_terms_version <> '2026-11-25-v3' then raise exception 'La versión de las condiciones no coincide.'; end if;
  if p_terms_hash <> '31a50f78135ea52ea2faa41645b5f85e0a776f6c4a562eb76285c159d26a59b7' then raise exception 'La huella de las condiciones no coincide.'; end if;
  insert into public.tos_acceptances(user_id, terms_version, terms_hash)
  values ((select auth.uid()), p_terms_version, p_terms_hash)
  on conflict (user_id, terms_version)
  do update set terms_hash = excluded.terms_hash
  returning accepted_at into accepted_time;
  return jsonb_build_object('accepted',true,'terms_version',p_terms_version,'terms_hash',p_terms_hash,'accepted_at',accepted_time);
end;
$$;
revoke all on function public.accept_nexus_terms(text,text) from public, anon;
grant execute on function public.accept_nexus_terms(text,text) to authenticated;

create or replace function public.nexus_terms_acceptance_status()
returns jsonb
language plpgsql stable security definer
set search_path = public, auth, pg_temp
as $$
declare
  is_accepted boolean := false;
  had_previous boolean := false;
  previous_version text := null;
  previous_accepted_at timestamptz := null;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  select exists (
    select 1 from public.tos_acceptances t
    where t.user_id=(select auth.uid())
      and t.terms_version='2026-11-25-v3'
      and t.terms_hash='31a50f78135ea52ea2faa41645b5f85e0a776f6c4a562eb76285c159d26a59b7'
  ) into is_accepted;
  select t.terms_version,t.accepted_at
    into previous_version,previous_accepted_at
    from public.tos_acceptances t
   where t.user_id=(select auth.uid())
     and (t.terms_version<>'2026-11-25-v3' or t.terms_hash<>'31a50f78135ea52ea2faa41645b5f85e0a776f6c4a562eb76285c159d26a59b7')
   order by t.accepted_at desc limit 1;
  had_previous:=previous_version is not null;
  return jsonb_build_object(
    'accepted',is_accepted,
    'previously_accepted',had_previous,
    'previous_terms_version',previous_version,
    'previous_accepted_at',previous_accepted_at,
    'terms_version','2026-11-25-v3',
    'terms_hash','31a50f78135ea52ea2faa41645b5f85e0a776f6c4a562eb76285c159d26a59b7'
  );
end;
$$;
revoke all on function public.nexus_terms_acceptance_status() from public,anon;
grant execute on function public.nexus_terms_acceptance_status() to authenticated;

create or replace function public.nexus_has_current_terms()
returns boolean language sql stable security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1 from public.tos_acceptances t
    where t.user_id=(select auth.uid())
      and t.terms_version='2026-11-25-v3'
      and t.terms_hash='31a50f78135ea52ea2faa41645b5f85e0a776f6c4a562eb76285c159d26a59b7'
  );
$$;
revoke all on function public.nexus_has_current_terms() from public,anon;
grant execute on function public.nexus_has_current_terms() to authenticated;

notify pgrst,'reload schema';
commit;
