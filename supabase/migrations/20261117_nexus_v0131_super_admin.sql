-- Nexus v0.13.1-alpha1: Super Admin hierarchy and protected platform-admin assignment.
-- Apply once after the existing v0.11.1 platform-admin migrations.
-- This migration deliberately does NOT promote any account automatically.
begin;

create table if not exists public.platform_super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.platform_super_admins enable row level security;
revoke all on table public.platform_super_admins from public, anon, authenticated;
grant select on table public.platform_super_admins to authenticated;

create table if not exists public.platform_admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('grant_admin','revoke_admin')),
  created_at timestamptz not null default now()
);
alter table public.platform_admin_audit enable row level security;
revoke all on table public.platform_admin_audit from public, anon, authenticated;
grant select on table public.platform_admin_audit to authenticated;

create or replace function public.is_platform_super_admin()
returns boolean
language sql stable security definer
set search_path = public, auth, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1 from public.platform_super_admins sa where sa.user_id = auth.uid()
  );
$$;
revoke all on function public.is_platform_super_admin() from public, anon;
grant execute on function public.is_platform_super_admin() to authenticated;
drop policy if exists platform_admin_audit_read on public.platform_admin_audit;
create policy platform_admin_audit_read on public.platform_admin_audit
  for select to authenticated using (public.is_platform_super_admin());
drop policy if exists platform_super_admins_read on public.platform_super_admins;
create policy platform_super_admins_read on public.platform_super_admins
  for select to authenticated using (public.is_platform_super_admin());

-- Super Admin inherits all platform-admin permissions, but ordinary admins
-- cannot add/remove user_roles and cannot grant the Super Admin tier.
create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer
set search_path = public, auth, pg_temp
as $$
  select auth.uid() is not null and (
    exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin')
    or public.is_platform_super_admin()
  );
$$;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public, auth, pg_temp
as $$
  select auth.uid() is not null and (
    exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role in ('admin','moderator'))
    or public.is_platform_super_admin()
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.list_platform_admins()
returns table (
  user_id uuid,
  username text,
  nickname text,
  created_at timestamptz,
  is_super_admin boolean
)
language plpgsql stable security definer
set search_path = public, auth, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_platform_super_admin() then
    raise exception 'Solo Super Admin puede consultar la lista de administradores.';
  end if;
  return query
  select targets.user_id, p.username, p.nickname, targets.created_at,
         (sa.user_id is not null) as is_super_admin
  from (
    select role_rows.user_id, min(role_rows.created_at) as created_at
    from (
      select ur.user_id, ur.created_at
      from public.user_roles ur
      where ur.role = 'admin'
      union all
      select psa.user_id, psa.created_at
      from public.platform_super_admins psa
    ) role_rows
    group by role_rows.user_id
  ) targets
  left join public.profiles p on p.id = targets.user_id
  left join public.platform_super_admins sa on sa.user_id = targets.user_id
  order by (sa.user_id is not null) desc, lower(coalesce(p.username,''));
end;
$$;
revoke all on function public.list_platform_admins() from public, anon;
grant execute on function public.list_platform_admins() to authenticated;

create or replace function public.set_platform_admin_role(p_user_id uuid, p_enabled boolean)
returns void
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare changed_rows integer := 0;
begin
  if auth.uid() is null or not public.is_platform_super_admin() then
    raise exception 'Solo Super Admin puede designar o retirar administradores.';
  end if;
  if p_user_id is null or p_enabled is null then
    raise exception 'Faltan datos para modificar el rol.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'No puedes modificar tu propio rol desde este panel.';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'La cuenta indicada no existe.';
  end if;
  if exists (select 1 from public.platform_super_admins sa where sa.user_id = p_user_id) then
    raise exception 'No se puede modificar un Super Admin desde la lista de administradores.';
  end if;
  if p_enabled then
    insert into public.user_roles(user_id, role)
    values (p_user_id, 'admin')
    on conflict (user_id, role) do nothing;
    get diagnostics changed_rows = row_count;
    if changed_rows > 0 then
      insert into public.platform_admin_audit(actor_id,target_user_id,action)
      values (auth.uid(),p_user_id,'grant_admin');
    end if;
  else
    delete from public.user_roles
    where user_id = p_user_id and role = 'admin';
    get diagnostics changed_rows = row_count;
    if changed_rows > 0 then
      insert into public.platform_admin_audit(actor_id,target_user_id,action)
      values (auth.uid(),p_user_id,'revoke_admin');
    end if;
  end if;
end;
$$;
revoke all on function public.set_platform_admin_role(uuid, boolean) from public, anon;
grant execute on function public.set_platform_admin_role(uuid, boolean) to authenticated;

commit;
