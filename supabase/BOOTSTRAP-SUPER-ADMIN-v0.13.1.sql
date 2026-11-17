-- Nexus v0.13.1-alpha1 · one-time Super Admin bootstrap.
-- Run only after 20261117_nexus_v0131_super_admin.sql.
-- Replace the UUID below with YOUR account UUID from Supabase → Authentication → Users.
-- This does not use an email address and does not expose any service key.
do $$
declare
  bootstrap_user uuid := 'REPLACE_WITH_YOUR_AUTH_USER_UUID'::uuid;
begin
  if not exists (select 1 from auth.users where id = bootstrap_user) then
    raise exception 'No existe la cuenta indicada en auth.users. Comprueba el UUID.';
  end if;
  insert into public.platform_super_admins(user_id, granted_by)
  values (bootstrap_user, null)
  on conflict (user_id) do nothing;
end;
$$;

-- Verify the bootstrapped account:
select sa.user_id, p.username, p.nickname, sa.created_at
from public.platform_super_admins sa
left join public.profiles p on p.id = sa.user_id
where sa.user_id = 'REPLACE_WITH_YOUR_AUTH_USER_UUID'::uuid;
