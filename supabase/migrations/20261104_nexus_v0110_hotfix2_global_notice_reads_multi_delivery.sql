begin;

-- Global announcement acknowledgements are stored per account, not per browser.
-- This prevents already-dismissed notices from returning when users switch channels,
-- reopen Nexus on another device, or restore local browser storage.
create table if not exists public.nexus_important_announcement_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  announcement_id uuid not null references public.nexus_important_announcements(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key(user_id,announcement_id)
);
alter table public.nexus_important_announcement_reads enable row level security;
drop policy if exists nexus_important_announcement_reads_select_own on public.nexus_important_announcement_reads;
create policy nexus_important_announcement_reads_select_own
  on public.nexus_important_announcement_reads for select to authenticated
  using(user_id=auth.uid());
drop policy if exists nexus_important_announcement_reads_insert_own on public.nexus_important_announcement_reads;
create policy nexus_important_announcement_reads_insert_own
  on public.nexus_important_announcement_reads for insert to authenticated
  with check(user_id=auth.uid());
drop policy if exists nexus_important_announcement_reads_update_own on public.nexus_important_announcement_reads;
create policy nexus_important_announcement_reads_update_own
  on public.nexus_important_announcement_reads for update to authenticated
  using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,update on public.nexus_important_announcement_reads to authenticated;

-- Administrators need an explicit, RLS-safe destination list; reading the
-- communities table directly can hide megagroups they do not belong to.
create or replace function public.list_nexus_announcement_communities()
returns table(community_id uuid,community_name text,subscribed_channels bigint)
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Solo los administradores de plataforma pueden consultar los destinos de avisos.';
  end if;
  return query
  select c.id,c.name,count(ch.id)::bigint
  from public.communities c
  join public.channels ch on ch.community_id=c.id
  where ch.important_announcements_enabled is true and ch.type<>'voice'
  group by c.id,c.name
  order by c.name;
end;
$$;
revoke all on function public.list_nexus_announcement_communities() from public,anon;
grant execute on function public.list_nexus_announcement_communities() to authenticated;

-- Reassert the multi-community publisher so this database can be upgraded from
-- hotfix1 even if the previous announcement-delivery patch was not applied.
create or replace function public.publish_nexus_community_announcement(
  p_title text,
  p_body text,
  p_community_ids uuid[] default '{}',
  p_all_opted_in boolean default false
)
returns integer
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  target_community record;
  target_channel record;
  announcement_id uuid;
  community_count integer:=0;
  normalized_title text:=left(trim(coalesce(p_title,'')),100);
  normalized_body text:=left(trim(coalesce(p_body,'')),3000);
begin
  p_all_opted_in:=coalesce(p_all_opted_in,false);
  p_community_ids:=coalesce(p_community_ids,'{}'::uuid[]);
  if not public.is_platform_admin() then
    raise exception 'Solo los administradores de plataforma pueden publicar avisos importantes.';
  end if;
  if length(normalized_title)<3 or length(normalized_body)<5 then
    raise exception 'El título debe tener al menos 3 caracteres y el mensaje al menos 5.';
  end if;
  if not p_all_opted_in and coalesce(cardinality(p_community_ids),0)=0 then
    raise exception 'Selecciona uno o varios megagrupos, o activa todos.';
  end if;
  if not p_all_opted_in and exists(
    select 1 from unnest(p_community_ids) chosen(id)
    where not exists(select 1 from public.communities c where c.id=chosen.id)
  ) then
    raise exception 'Uno de los megagrupos seleccionados ya no existe.';
  end if;

  for target_community in
    select distinct c.id
    from public.communities c
    where exists(
      select 1 from public.channels ch
      where ch.community_id=c.id
        and ch.important_announcements_enabled is true
        and ch.type<>'voice'
    )
    and (p_all_opted_in or c.id=any(p_community_ids))
    order by c.id
  loop
    insert into public.nexus_important_announcements(scope,community_id,title,body,created_by)
    values('community',target_community.id,normalized_title,normalized_body,auth.uid())
    returning id into announcement_id;

    for target_channel in
      select ch.id
      from public.channels ch
      where ch.community_id=target_community.id
        and ch.important_announcements_enabled is true
        and ch.type<>'voice'
      order by ch.position,ch.created_at
    loop
      insert into public.messages(channel_id,sender_id,body,message_type,formatting)
      values(
        target_channel.id,
        auth.uid(),
        normalized_title || E'\n\n' || normalized_body,
        'system',
        jsonb_build_object(
          'nexus_important_announcement',true,
          'announcement_id',announcement_id::text,
          'announcement_title',normalized_title
        )
      );
    end loop;
    community_count:=community_count+1;
  end loop;

  if community_count=0 then
    raise exception 'Ninguno de los megagrupos seleccionados tiene canales suscritos a avisos importantes.';
  end if;
  return community_count;
end;
$$;
revoke all on function public.publish_nexus_community_announcement(text,text,uuid[],boolean) from public,anon;
grant execute on function public.publish_nexus_community_announcement(text,text,uuid[],boolean) to authenticated;

commit;
