begin;

-- Indexes for the platform administration panel and Sticker Workshop.
create index if not exists profiles_last_seen_at_desc_idx
  on public.profiles(last_seen_at desc nulls last);
create index if not exists nexus_platform_feedback_filter_idx
  on public.nexus_platform_feedback(status,feedback_type,created_at desc);
create index if not exists sticker_workshop_installs_idx
  on public.sticker_workshop(installs desc,created_at desc);

-- Platform administrators are the only accounts allowed to inspect bans.
create table if not exists public.user_bans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  banned_until timestamptz,
  reason text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.user_bans enable row level security;
drop policy if exists user_bans_admin_read on public.user_bans;
create policy user_bans_admin_read on public.user_bans
  for select to authenticated using(public.is_platform_admin());
grant select on public.user_bans to authenticated;

create or replace function public.is_user_banned()
returns boolean
language sql stable security definer set search_path=public,auth,pg_temp
as $$
  select exists(
    select 1 from public.user_bans
    where user_id=auth.uid() and (banned_until is null or banned_until>now())
  );
$$;

create or replace function public.admin_ban_user(
  p_target uuid,p_reason text default '',p_hours integer default null
)
returns void language plpgsql security definer set search_path=public,auth,pg_temp
as $$
begin
  if not public.is_platform_admin() then raise exception 'Solo los administradores de plataforma pueden banear cuentas.'; end if;
  if p_target=auth.uid() then raise exception 'No puedes banear tu propia cuenta.'; end if;
  if p_hours is not null and (p_hours<1 or p_hours>87600) then raise exception 'Duración no válida.'; end if;
  insert into public.user_bans(user_id,banned_until,reason,created_by)
  values(p_target,case when p_hours is null then null else now()+make_interval(hours=>p_hours) end,left(coalesce(p_reason,''),1500),auth.uid())
  on conflict(user_id) do update set banned_until=excluded.banned_until,reason=excluded.reason,created_by=excluded.created_by,created_at=now();
  insert into public.nexus_system_messages(user_id,title,body,message_type)
  values(p_target,'Nexus (App)',
    case when p_hours is null then 'Tu cuenta ha sido baneada permanentemente por el equipo de Nexus.'
    else 'Tu cuenta ha sido baneada hasta '||to_char(now()+make_interval(hours=>p_hours),'YYYY-MM-DD HH24:MI')||'.' end
    ||' Motivo: '||left(coalesce(p_reason,'Sin motivo especificado.'),500),'moderation');
end;
$$;

create or replace function public.admin_unban_user(p_target uuid)
returns void language plpgsql security definer set search_path=public,auth,pg_temp
as $$
declare removed_count integer;
begin
  if not public.is_platform_admin() then raise exception 'Solo los administradores de plataforma pueden retirar bans.'; end if;
  delete from public.user_bans where user_id=p_target;
  get diagnostics removed_count=row_count;
  if removed_count>0 then
    insert into public.nexus_system_messages(user_id,title,body,message_type)
    values(p_target,'Nexus (App)','El equipo de Nexus ha retirado el ban de tu cuenta.','notice');
  end if;
end;
$$;
revoke all on function public.admin_ban_user(uuid,text,integer) from public,anon;
revoke all on function public.admin_unban_user(uuid) from public,anon;
grant execute on function public.admin_ban_user(uuid,text,integer) to authenticated;
grant execute on function public.admin_unban_user(uuid) to authenticated;

commit;
