
create or replace function public.review_community_join_request(p_request_id uuid, p_decision text)
returns public.community_join_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.community_join_requests;
  v_community public.communities;
begin
  if p_decision not in ('APPROVED', 'REJECTED') then
    raise exception 'Decision must be APPROVED or REJECTED';
  end if;

  select * into v_request
  from public.community_join_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Join request not found';
  end if;

  select * into v_community from public.communities where id = v_request.community_id;
  if not found or v_community.created_by <> auth.uid() then
    raise exception 'Only the community owner can review access requests';
  end if;

  if v_request.status <> 'PENDING' then
    raise exception 'This request has already been reviewed';
  end if;

  if p_decision = 'APPROVED' then
    insert into public.community_members (community_id, user_id, role)
    values (v_request.community_id, v_request.user_id, 'MEMBER')
    on conflict (community_id, user_id) do nothing;
  end if;

  update public.community_join_requests
  set status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = v_request.id
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.review_community_join_request(uuid, text) from public, anon;
grant execute on function public.review_community_join_request(uuid, text) to authenticated;

drop policy if exists "Members can read activity posts" on public.activity_posts;
create policy "Activity posts follow community and topic privacy"
on public.activity_posts for select to authenticated
using (
  (
    community_id is null
    or exists (
      select 1 from public.communities c
      where c.id = activity_posts.community_id
        and (
          c.visibility = 'PUBLIC'
          or c.created_by = auth.uid()
          or exists (select 1 from public.community_members cm where cm.community_id = c.id and cm.user_id = auth.uid())
        )
    )
  )
  and (
    topic_id is null
    or exists (
      select 1 from public.topics t
      join public.communities c on c.id = t.community_id
      where t.id = activity_posts.topic_id
        and (
          c.visibility = 'PUBLIC'
          or c.created_by = auth.uid()
          or exists (select 1 from public.community_members cm where cm.community_id = c.id and cm.user_id = auth.uid())
        )
    )
  )
);

drop policy if exists "Members can read activity comments" on public.activity_comments;
create policy "Activity comments follow parent visibility"
on public.activity_comments for select to authenticated
using (exists (select 1 from public.activity_posts p where p.id = activity_comments.post_id));

drop policy if exists "Members can read activity likes" on public.activity_likes;
create policy "Activity likes follow parent visibility"
on public.activity_likes for select to authenticated
using (exists (select 1 from public.activity_posts p where p.id = activity_likes.post_id));
