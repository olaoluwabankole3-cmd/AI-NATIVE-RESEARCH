-- Converge: account/content deletion ownership and authorization.
-- Account cleanup is callable only by the server-side service role; the client must never supply trusted identity by itself.

create or replace function public.prepare_account_deletion(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  org_record record;
  successor_id uuid;
  transferred_count integer := 0;
  deleted_org_count integer := 0;
  deleted_community_count integer := 0;
  deleted_topic_count integer := 0;
  deleted_agent_count integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if target_user_id is null then
    raise exception 'User ID is required' using errcode = '22004';
  end if;

  -- Retain organisations when another active owner/admin exists. Otherwise remove the orphaned organisation.
  for org_record in
    select id from public.organizations where created_by = target_user_id
  loop
    successor_id := null;
    select om.user_id
      into successor_id
    from public.organization_members om
    where om.organization_id = org_record.id
      and om.user_id <> target_user_id
      and om.status = 'ACTIVE'
      and upper(om.role) in ('OWNER', 'ADMIN')
    order by case when upper(om.role) = 'OWNER' then 0 else 1 end, om.created_at asc
    limit 1;

    if successor_id is null then
      delete from public.organizations where id = org_record.id;
      deleted_org_count := deleted_org_count + 1;
    else
      update public.organizations set created_by = successor_id where id = org_record.id;
      transferred_count := transferred_count + 1;
    end if;
  end loop;

  delete from public.communities where created_by = target_user_id;
  get diagnostics deleted_community_count = row_count;

  delete from public.topics where created_by = target_user_id;
  get diagnostics deleted_topic_count = row_count;

  delete from public.community_agents where created_by = target_user_id;
  get diagnostics deleted_agent_count = row_count;

  return jsonb_build_object(
    'organisations_transferred', transferred_count,
    'organisations_deleted', deleted_org_count,
    'communities_deleted', deleted_community_count,
    'topics_deleted', deleted_topic_count,
    'community_agents_deleted', deleted_agent_count
  );
end;
$$;

revoke all on function public.prepare_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;

drop policy if exists "Topic creators can delete topics while in community" on public.topics;
drop policy if exists "Topic creators and community managers can delete topics" on public.topics;
create policy "Topic creators and community managers can delete topics"
on public.topics for delete to authenticated
using (
  exists (
    select 1
    from public.communities c
    where c.id = topics.community_id
      and (
        (
          auth.uid() = topics.created_by
          and (
            c.created_by = auth.uid()
            or exists (
              select 1 from public.community_members cm
              where cm.community_id = c.id and cm.user_id = auth.uid()
            )
          )
        )
        or c.created_by = auth.uid()
        or exists (
          select 1 from public.community_members cm
          where cm.community_id = c.id
            and cm.user_id = auth.uid()
            and cm.role in ('OWNER', 'MODERATOR')
        )
      )
  )
);
