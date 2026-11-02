-- Nexus v0.10 initial feature migration. Safe to apply once; uses IF NOT EXISTS where possible.
begin;

-- Channel categories preserve existing channels under the General category.
alter table public.channels add column if not exists category text not null default 'General';
update public.channels set category='General' where category is null or btrim(category)='';
create index if not exists channels_community_category_position_idx on public.channels(community_id,category,position,created_at);

-- Separate message typography from the profile-name font.
alter table public.profiles add column if not exists message_font_url text;

-- Voice-note uploads. Keep private bucket, membership RLS and the existing 50 MB limit.
update storage.buckets
set allowed_mime_types = array[
  'image/png','image/jpeg','image/webp','image/gif',
  'video/mp4','video/webm',
  'audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav','audio/x-wav',
  'application/pdf','text/plain','application/zip'
]
where id='chat-media';

-- Universal badges are managed only by platform administrators (role='admin', not community admins).
create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer
set search_path=public,auth,pg_temp
as $$ select exists(select 1 from public.user_roles where user_id=auth.uid() and role='admin'); $$;
revoke all on function public.is_platform_admin() from public,anon;
grant execute on function public.is_platform_admin() to authenticated;

create table if not exists public.global_badges(
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(name) between 2 and 40),
  icon_url text not null check(length(icon_url) between 1 and 500),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.global_badge_assignments(
  badge_id uuid not null references public.global_badges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key(badge_id,user_id)
);
create index if not exists global_badge_assignments_user_idx on public.global_badge_assignments(user_id);
grant select,insert,delete on public.global_badges to authenticated;
grant select,insert,delete on public.global_badge_assignments to authenticated;
alter table public.global_badges enable row level security;
alter table public.global_badge_assignments enable row level security;
drop policy if exists global_badges_read_authenticated on public.global_badges;
create policy global_badges_read_authenticated on public.global_badges for select to authenticated using(true);
drop policy if exists global_badges_admin_insert on public.global_badges;
create policy global_badges_admin_insert on public.global_badges for insert to authenticated with check(public.is_platform_admin() and created_by=auth.uid());
drop policy if exists global_badges_admin_delete on public.global_badges;
create policy global_badges_admin_delete on public.global_badges for delete to authenticated using(public.is_platform_admin());
drop policy if exists global_badge_assignments_read_authenticated on public.global_badge_assignments;
create policy global_badge_assignments_read_authenticated on public.global_badge_assignments for select to authenticated using(true);
drop policy if exists global_badge_assignments_admin_insert on public.global_badge_assignments;
create policy global_badge_assignments_admin_insert on public.global_badge_assignments for insert to authenticated with check(public.is_platform_admin() and assigned_by=auth.uid());
drop policy if exists global_badge_assignments_admin_delete on public.global_badge_assignments;
create policy global_badge_assignments_admin_delete on public.global_badge_assignments for delete to authenticated using(public.is_platform_admin());

commit;
