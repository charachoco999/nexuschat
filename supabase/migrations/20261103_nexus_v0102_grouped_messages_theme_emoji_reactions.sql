-- Nexus v0.10.0-alpha.2
-- Custom emoji reactions are stored as "custom:<asset-uuid>".
-- The previous 16-character limit only accommodated literal Unicode emoji.
-- Message/user uniqueness remains intact; RLS is extended only for members
-- who can already read the message that carries the reaction.

alter table public.message_reactions
  drop constraint if exists message_reactions_emoji_check;

alter table public.message_reactions
  drop constraint if exists message_reactions_emoji_length_check;

alter table public.message_reactions
  add constraint message_reactions_emoji_length_check
  check (length(emoji) between 1 and 80);


-- Permit members of a message context to read a personal custom emoji only
-- after somebody has used it as a reaction to a message they can already see.
-- The same membership checks used for message attachments remain in force.
create or replace function public.can_read_nexus_asset(p_object_name text)
returns boolean
language plpgsql stable security definer
set search_path = public, auth, storage, pg_temp
as $$
declare
  folders text[];
  scope_id uuid;
begin
  if auth.uid() is null then return false; end if;
  folders := storage.foldername(coalesce(p_object_name,''));

  if coalesce(array_length(folders,1),0)=2 and folders[1]='personal' then
    if folders[2]=auth.uid()::text then return true; end if;
    return exists (
      select 1
        from public.custom_assets a
        join public.messages m on (
          m.attachment->>'custom_asset_id'=a.id::text
          or coalesce(m.formatting->'custom_emojis','[]'::jsonb) @> jsonb_build_array(a.id::text)
          or exists (
            select 1 from public.message_reactions r
             where r.message_id=m.id
               and r.emoji='custom:' || a.id::text
          )
        )
       where a.asset_url=p_object_name
         and a.scope='personal'
         and (
           (m.conversation_id is not null and public.is_conversation_member(m.conversation_id))
           or (m.channel_id is not null and exists (
             select 1 from public.channels ch
              where ch.id=m.channel_id and public.is_community_member(ch.community_id)
           ))
         )
    );
  end if;

  if coalesce(array_length(folders,1),0)=3 and folders[1]='conversation' then
    begin scope_id := folders[2]::uuid; exception when others then return false; end;
    return public.is_conversation_member(scope_id);
  end if;

  if coalesce(array_length(folders,1),0)=3 and folders[1]='community' then
    begin scope_id := folders[2]::uuid; exception when others then return false; end;
    return public.is_community_member(scope_id);
  end if;
  return false;
end;
$$;

-- custom_assets SELECT RLS must expose the asset row to eligible chat members
-- so the client can resolve its UUID and request a signed Storage URL.
drop policy if exists custom_assets_read_scope on public.custom_assets;
create policy custom_assets_read_scope on public.custom_assets for select to authenticated using (
  (scope='personal' and (
    owner_id=auth.uid()
    or exists (
      select 1 from public.messages m
       where (m.attachment->>'custom_asset_id'=custom_assets.id::text
          or coalesce(m.formatting->'custom_emojis','[]'::jsonb) @> jsonb_build_array(custom_assets.id::text))
         and (
           (m.conversation_id is not null and public.is_conversation_member(m.conversation_id))
           or (m.channel_id is not null and exists(select 1 from public.channels ch where ch.id=m.channel_id and public.is_community_member(ch.community_id)))
         )
    )
    or exists (
      select 1
        from public.message_reactions r
        join public.messages m on m.id=r.message_id
       where r.emoji='custom:' || custom_assets.id::text
         and (
           (m.conversation_id is not null and public.is_conversation_member(m.conversation_id))
           or (m.channel_id is not null and exists(select 1 from public.channels ch where ch.id=m.channel_id and public.is_community_member(ch.community_id)))
         )
    )
  ))
  or (scope='conversation' and exists(select 1 from public.conversation_members cm where cm.conversation_id=scope_id and cm.user_id=auth.uid()))
  or (scope='community' and public.is_community_member(scope_id))
);



-- Validate custom emoji reactions server-side. The client picker is not a
-- security boundary: a caller must not be able to reveal a personal asset by
-- guessing its UUID and inserting a custom:<uuid> reaction directly.
create or replace function public.guard_nexus_custom_reaction()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  asset_row public.custom_assets%rowtype;
  message_row public.messages%rowtype;
  asset_id uuid;
  target_community uuid;
  is_allowed boolean := false;
begin
  if new.emoji not like 'custom:%' then return new; end if;
  if auth.uid() is null or new.user_id<>auth.uid() or public.is_user_banned() then
    raise exception 'No puedes usar esta reacción.';
  end if;

  begin
    asset_id := substring(new.emoji from 8)::uuid;
  exception when others then
    raise exception 'La referencia del emoji personalizado no es válida.';
  end;

  select * into message_row from public.messages where id=new.message_id;
  if not found then raise exception 'El mensaje de la reacción no existe.'; end if;

  select * into asset_row
    from public.custom_assets
   where id=asset_id and asset_type='emoji' and archived_at is null;
  if not found then raise exception 'El emoji personalizado no existe o está archivado.'; end if;

  if asset_row.scope='personal' then
    is_allowed := asset_row.owner_id=auth.uid();
    if not is_allowed then
      is_allowed := exists (
        select 1
          from public.messages m
         where (
           m.attachment->>'custom_asset_id'=asset_row.id::text
           or coalesce(m.formatting->'custom_emojis','[]'::jsonb) @> jsonb_build_array(asset_row.id::text)
           or exists (
             select 1 from public.message_reactions r
              where r.message_id=m.id
                and r.emoji='custom:' || asset_row.id::text
           )
         )
           and (
             (m.conversation_id is not null and public.is_conversation_member(m.conversation_id))
             or (m.channel_id is not null and exists (
               select 1 from public.channels ch
                where ch.id=m.channel_id and public.is_community_member(ch.community_id)
             ))
           )
      );
    end if;
  elsif asset_row.scope='conversation' then
    is_allowed := message_row.conversation_id=asset_row.scope_id
      and public.is_conversation_member(asset_row.scope_id);
  elsif asset_row.scope='community' and message_row.channel_id is not null then
    select community_id into target_community
      from public.channels where id=message_row.channel_id;
    is_allowed := target_community=asset_row.scope_id
      and public.is_community_member(asset_row.scope_id);
  end if;

  if not is_allowed then
    raise exception 'Este emoji no está disponible en este chat.';
  end if;
  return new;
end;
$$;

drop trigger if exists nexus_custom_reaction_guard on public.message_reactions;
create trigger nexus_custom_reaction_guard
before insert or update of emoji,message_id,user_id on public.message_reactions
for each row execute function public.guard_nexus_custom_reaction();

revoke all on function public.can_read_nexus_asset(text) from public,anon;
grant execute on function public.can_read_nexus_asset(text) to authenticated;
