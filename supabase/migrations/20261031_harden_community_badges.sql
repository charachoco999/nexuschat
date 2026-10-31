-- Only the owner may assign their personal badge to themselves.
-- Community badges may only be assigned by users with manage_badges permission,
-- and only to accounts that are actually members of the same community.
drop policy if exists member_badges_assign_admin on public.member_badges;
create policy member_badges_assign_admin on public.member_badges for all to authenticated
using (
  exists (
    select 1 from public.badges b
    where b.id=member_badges.badge_id and (
      (b.community_id is null and member_badges.community_id is null and b.owner_id=auth.uid() and member_badges.user_id=auth.uid())
      or (b.community_id is not null and b.community_id=member_badges.community_id
          and public.has_community_permission(b.community_id,'manage_badges')
          and exists(select 1 from public.community_members cm where cm.community_id=b.community_id and cm.user_id=member_badges.user_id))
    )
  )
)
with check (
  exists (
    select 1 from public.badges b
    where b.id=member_badges.badge_id and (
      (b.community_id is null and member_badges.community_id is null and b.owner_id=auth.uid() and member_badges.user_id=auth.uid())
      or (b.community_id is not null and b.community_id=member_badges.community_id
          and public.has_community_permission(b.community_id,'manage_badges')
          and exists(select 1 from public.community_members cm where cm.community_id=b.community_id and cm.user_id=member_badges.user_id))
    )
  )
);
