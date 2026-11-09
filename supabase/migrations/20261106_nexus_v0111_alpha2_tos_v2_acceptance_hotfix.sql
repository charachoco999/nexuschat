-- Nexus v0.11.1-alpha2-hotfix: synchronize ToS v2 contract with frontend.
-- Idempotent; never auto-accepts the new terms.
begin;
create table if not exists public.tos_acceptances (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 terms_version text not null check(length(terms_version) between 3 and 80),
 terms_hash text not null check(terms_hash ~ '^[0-9a-f]{64}$'),
 accepted_at timestamptz not null default now(),
 unique(user_id,terms_version)
);
alter table public.tos_acceptances enable row level security;
revoke all on table public.tos_acceptances from public, anon, authenticated;
grant select on table public.tos_acceptances to authenticated;
drop policy if exists tos_acceptances_read_own on public.tos_acceptances;
create policy tos_acceptances_read_own on public.tos_acceptances for select to authenticated using(user_id=(select auth.uid()));

create or replace function public.nexus_terms_acceptance_status()
returns jsonb language plpgsql stable security definer
set search_path=public,auth,pg_temp as $$
declare current_ok boolean; old_ok boolean;
begin
 if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
 select exists(select 1 from public.tos_acceptances t where t.user_id=auth.uid() and t.terms_version='2026-11-06-v2' and t.terms_hash='f0f2322c78f8a4daf53335bf64017f60c74de4230f57d6df9b49a8184fccd8dd') into current_ok;
 select exists(select 1 from public.tos_acceptances t where t.user_id=auth.uid()) into old_ok;
 return jsonb_build_object('accepted',current_ok,'previously_accepted',old_ok and not current_ok,'terms_version','2026-11-06-v2','terms_hash','f0f2322c78f8a4daf53335bf64017f60c74de4230f57d6df9b49a8184fccd8dd');
end $$;
revoke all on function public.nexus_terms_acceptance_status() from public,anon;
grant execute on function public.nexus_terms_acceptance_status() to authenticated;

drop function if exists public.accept_nexus_terms(text,text);
create function public.accept_nexus_terms(p_terms_version text,p_terms_hash text)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare accepted_time timestamptz;
begin
 if auth.uid() is null then raise exception 'Debes iniciar sesión para aceptar las condiciones.'; end if;
 if p_terms_version <> '2026-11-06-v2' then raise exception 'La versión de las condiciones no coincide.'; end if;
 if p_terms_hash <> 'f0f2322c78f8a4daf53335bf64017f60c74de4230f57d6df9b49a8184fccd8dd' then raise exception 'La huella de las condiciones no coincide.'; end if;
 insert into public.tos_acceptances(user_id,terms_version,terms_hash) values(auth.uid(),p_terms_version,p_terms_hash)
 on conflict(user_id,terms_version) do update set terms_hash=excluded.terms_hash returning accepted_at into accepted_time;
 return jsonb_build_object('accepted',true,'terms_version',p_terms_version,'terms_hash',p_terms_hash,'accepted_at',accepted_time);
end $$;
revoke all on function public.accept_nexus_terms(text,text) from public,anon;
grant execute on function public.accept_nexus_terms(text,text) to authenticated;

create or replace function public.nexus_has_current_terms()
returns boolean language sql stable security definer set search_path=public,auth,pg_temp as $$
 select exists(select 1 from public.tos_acceptances t where t.user_id=auth.uid() and t.terms_version='2026-11-06-v2' and t.terms_hash='f0f2322c78f8a4daf53335bf64017f60c74de4230f57d6df9b49a8184fccd8dd');
$$;
revoke all on function public.nexus_has_current_terms() from public,anon;
grant execute on function public.nexus_has_current_terms() to authenticated;
notify pgrst,'reload schema';
commit;
