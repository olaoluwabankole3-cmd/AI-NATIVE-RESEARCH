
insert into public.community_members (community_id, user_id, role)
select c.id, c.created_by, 'OWNER'
from public.communities c
on conflict (community_id, user_id) do update set role = 'OWNER';

drop policy if exists "Owners can update community join requests" on public.community_join_requests;
revoke update on public.community_join_requests from authenticated;
grant select, insert, delete on public.community_join_requests to authenticated;
