-- Nexus v0.3: channel-aware posting permissions.
-- Run once in Supabase SQL Editor after the v0.2 schema/migrations.

-- Existing member roles may send normal messages, but may not publish
-- announcement-channel posts unless an owner grants that permission.
update public.community_roles
set permissions = coalesce(permissions,'{}'::jsonb) || '{"post_announcements":false}'::jsonb
where not (coalesce(permissions,'{}'::jsonb) ? 'post_announcements');

-- Channel types are enforced by RLS, not just by hiding controls in JavaScript.
drop policy if exists messages_insert_member on public.messages;
create policy messages_insert_member on public.messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and not public.is_user_banned()
  and (
    (conversation_id is not null and public.is_conversation_member(messages.conversation_id))
    or (
      channel_id is not null
      and exists (
        select 1
        from public.channels ch
        where ch.id = messages.channel_id
          and public.is_community_member(ch.community_id)
          and case
            when ch.type = 'announcements' then
              public.has_community_permission(ch.community_id,'post_announcements')
            when ch.type = 'media' then
              public.has_community_permission(ch.community_id,'send_messages')
              and messages.message_type = 'media'
              and messages.attachment is not null
            when ch.type = 'voice' then false
            else
              public.has_community_permission(ch.community_id,'send_messages')
          end
      )
    )
  )
);

comment on policy messages_insert_member on public.messages is
  'Nexus: members may post by channel type; announcement channels require post_announcements, media channels accept attachments only, and voice channels reject chat messages.';
