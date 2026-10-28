-- Preserve private-community access after the original topic creator leaves.
drop policy if exists "Topic creators can update topics" on public.topics;
create policy "Topic creators can update topics while in community"
on public.topics for update to authenticated
using (
  auth.uid() = created_by
  and exists (
    select 1 from public.communities c
    where c.id = topics.community_id
      and (c.created_by = auth.uid() or exists (
        select 1 from public.community_members cm where cm.community_id = c.id and cm.user_id = auth.uid()
      ))
  )
)
with check (
  auth.uid() = created_by
  and exists (
    select 1 from public.communities c
    where c.id = topics.community_id
      and (c.created_by = auth.uid() or exists (
        select 1 from public.community_members cm where cm.community_id = c.id and cm.user_id = auth.uid()
      ))
  )
);

drop policy if exists "Topic creators can delete topics" on public.topics;
create policy "Topic creators can delete topics while in community"
on public.topics for delete to authenticated
using (
  auth.uid() = created_by
  and exists (
    select 1 from public.communities c
    where c.id = topics.community_id
      and (c.created_by = auth.uid() or exists (
        select 1 from public.community_members cm where cm.community_id = c.id and cm.user_id = auth.uid()
      ))
  )
);
