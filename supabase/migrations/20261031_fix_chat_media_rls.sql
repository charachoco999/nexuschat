-- Storage buckets. Profile media is public; chat files remain private and membership-gated.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
 ('profile-media','profile-media',true,8388608,array['image/png','image/jpeg','image/webp','image/gif']),
 ('chat-media','chat-media',false,52428800,array['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm','application/pdf','text/plain','application/zip'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- Storage policies call narrow SECURITY DEFINER helpers rather than querying
-- RLS-protected application tables inline from storage.objects policies.
create or replace function public.can_upload_chat_media(p_object_name text)
returns boolean
language plpgsql stable security definer
set search_path = public, auth, storage, pg_temp
as $$
declare
  folders text[];
  target_id uuid;
  target_community uuid;
begin
  if auth.uid() is null or public.is_user_banned() then return false; end if;
  folders := storage.foldername(coalesce(p_object_name,''));
  if coalesce(array_length(folders,1),0) <> 2 then return false; end if;
  begin
    target_id := folders[2]::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  if folders[1] = 'dm' then
    return exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id=target_id and cm.user_id=auth.uid()
    );
  elsif folders[1] = 'community' then
    select ch.community_id into target_community
    from public.channels ch where ch.id=target_id;
    return target_community is not null
      and public.is_community_member(target_community)
      and public.has_community_permission(target_community,'send_messages');
  end if;
  return false;
end;
$$;

create or replace function public.can_read_chat_media(p_object_name text)
returns boolean
language plpgsql stable security definer
set search_path = public, auth, storage, pg_temp
as $$
declare
  folders text[];
  target_id uuid;
  target_community uuid;
begin
  if auth.uid() is null then return false; end if;
  folders := storage.foldername(coalesce(p_object_name,''));
  if coalesce(array_length(folders,1),0) <> 2 then return false; end if;
  begin
    target_id := folders[2]::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  if folders[1] = 'dm' then
    return exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id=target_id and cm.user_id=auth.uid()
    );
  elsif folders[1] = 'community' then
    select ch.community_id into target_community
    from public.channels ch where ch.id=target_id;
    return target_community is not null and public.is_community_member(target_community);
  end if;
  return false;
end;
$$;

revoke all on function public.can_upload_chat_media(text) from public, anon;
revoke all on function public.can_read_chat_media(text) from public, anon;
grant execute on function public.can_upload_chat_media(text) to authenticated;
grant execute on function public.can_read_chat_media(text) to authenticated;

-- Profile images: anyone can view; users may write only inside their own folder.
drop policy if exists profile_media_public_read on storage.objects;
create policy profile_media_public_read on storage.objects for select to public using (bucket_id='profile-media');
drop policy if exists profile_media_insert_own on storage.objects;
create policy profile_media_insert_own on storage.objects for insert to authenticated with check (bucket_id='profile-media' and (storage.foldername(name))[1]=auth.uid()::text and not public.is_user_banned());
drop policy if exists profile_media_update_own on storage.objects;
create policy profile_media_update_own on storage.objects for update to authenticated using (bucket_id='profile-media' and (storage.foldername(name))[1]=auth.uid()::text) with check (bucket_id='profile-media' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists profile_media_delete_own on storage.objects;
create policy profile_media_delete_own on storage.objects for delete to authenticated using (bucket_id='profile-media' and (storage.foldername(name))[1]=auth.uid()::text);

-- Chat uploads must use dm/<conversation-uuid>/<file> or community/<channel-uuid>/<file>.
drop policy if exists chat_media_read_member on storage.objects;
create policy chat_media_read_member on storage.objects for select to authenticated
using (bucket_id='chat-media' and public.can_read_chat_media(name));
drop policy if exists chat_media_insert_member on storage.objects;
create policy chat_media_insert_member on storage.objects for insert to authenticated
with check (bucket_id='chat-media' and public.can_upload_chat_media(name));
drop policy if exists chat_media_delete_own on storage.objects;
create policy chat_media_delete_own on storage.objects for delete to authenticated
using (bucket_id='chat-media' and owner_id::text=auth.uid()::text);
