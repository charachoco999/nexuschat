begin;

-- Validate global important-announcement text before inserting it. Older
-- function versions passed short/blank bodies directly to the table CHECK
-- constraint, resulting in an opaque Postgres error in the admin panel.
create or replace function public.create_nexus_important_announcement(
  p_scope text,
  p_community_id uuid,
  p_title text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  normalized_scope text:=trim(coalesce(p_scope,''));
  normalized_title text:=left(trim(coalesce(p_title,'')),100);
  normalized_body text:=left(trim(coalesce(p_body,'')),3000);
  new_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Solo los administradores de plataforma pueden publicar avisos importantes.';
  end if;
  if normalized_scope not in ('global','community') then
    raise exception 'Alcance de aviso no válido.';
  end if;
  if length(normalized_title)<3 then
    raise exception 'El título debe tener al menos 3 caracteres.';
  end if;
  if length(normalized_body)<5 then
    raise exception 'El mensaje debe tener al menos 5 caracteres.';
  end if;
  if normalized_scope='community' and (
    p_community_id is null
    or not exists(select 1 from public.communities where id=p_community_id)
  ) then
    raise exception 'Selecciona un megagrupo válido.';
  end if;
  if normalized_scope='global' then
    p_community_id:=null;
  end if;

  insert into public.nexus_important_announcements(scope,community_id,title,body,created_by)
  values(normalized_scope,p_community_id,normalized_title,normalized_body,auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.create_nexus_important_announcement(text,uuid,text,text) from public,anon;
grant execute on function public.create_nexus_important_announcement(text,uuid,text,text) to authenticated;

commit;
