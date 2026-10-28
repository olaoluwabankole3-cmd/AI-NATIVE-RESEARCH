-- Converge community visibility, join approvals, topic permissions, and owner-managed AI agents.
-- Private-community metadata can be discovered, but its topic content and research history are members-only.

alter table public.communities
  add column if not exists visibility text not null default 'PUBLIC' check (visibility in ('PUBLIC', 'PRIVATE')),
  add column if not exists members_can_create_topics boolean not null default true;

create table if not exists public.community_join_requests (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  message text check (message is null or char_length(message) <= 1000),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists community_join_requests_one_pending
  on public.community_join_requests(community_id, user_id) where status = 'PENDING';
create index if not exists community_join_requests_owner_queue
  on public.community_join_requests(community_id, created_at desc) where status = 'PENDING';

create table if not exists public.community_agents (
  id text primary key default ('community-' || replace(gen_random_uuid()::text, '-', '')),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 100),
  handle text not null check (handle ~ '^@[a-zA-Z0-9][a-zA-Z0-9_-]*$'),
  role text not null check (char_length(btrim(role)) between 2 and 180),
  description text not null check (char_length(btrim(description)) between 2 and 1500),
  capabilities text[] not null default '{}',
  specialties text[] not null default '{}',
  participation text not null default '',
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE', 'PAUSED')),
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, handle)
);
create index if not exists community_agents_community_idx
  on public.community_agents(community_id, created_at desc);

create table if not exists public.community_agent_prompts (
  agent_id text primary key references public.community_agents(id) on delete cascade,
  system_prompt text not null default '' check (char_length(system_prompt) <= 15000),
  updated_at timestamptz not null default now()
);

alter table public.community_join_requests enable row level security;
alter table public.community_agents enable row level security;
alter table public.community_agent_prompts enable row level security;

create or replace function public.add_community_owner_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.community_members (community_id, user_id, role)
  values (new.id, new.created_by, 'OWNER')
  on conflict (community_id, user_id) do update set role = 'OWNER';
  return new;
end;
$$;
drop trigger if exists communities_add_owner_membership on public.communities;
create trigger communities_add_owner_membership
after insert on public.communities for each row execute function public.add_community_owner_membership();

-- Backfill ownership membership for communities created before the automatic trigger existed.
insert into public.community_members (community_id, user_id, role)
select c.id, c.created_by, 'OWNER'
from public.communities c
on conflict (community_id, user_id) do update set role = 'OWNER';

drop policy if exists "Authenticated users can view communities" on public.communities;
create policy "Authenticated users can view communities"
on public.communities for select to authenticated using (true);

drop policy if exists "Authenticated users can view memberships" on public.community_members;
create policy "Community members can view relevant memberships"
on public.community_members for select to authenticated using (
  user_id = auth.uid()
  or exists (
    select 1 from public.communities c
    where c.id = community_members.community_id and (c.visibility = 'PUBLIC' or c.created_by = auth.uid())
  )
);
drop policy if exists "Users can join communities" on public.community_members;
create policy "Users can join public communities"
on public.community_members for insert to authenticated with check (
  user_id = auth.uid()
  and exists (select 1 from public.communities c where c.id = community_members.community_id and c.visibility = 'PUBLIC')
);
drop policy if exists "Users can leave communities" on public.community_members;
create policy "Members can leave communities"
on public.community_members for delete to authenticated using (user_id = auth.uid() and role <> 'OWNER');

drop policy if exists "Authenticated users can view topics" on public.topics;
create policy "Topics visible according to community access"
on public.topics for select to authenticated using (
  exists (
    select 1 from public.communities c where c.id = topics.community_id and (
      c.visibility = 'PUBLIC' or c.created_by = auth.uid()
      or exists (select 1 from public.community_members cm where cm.community_id = c.id and cm.user_id = auth.uid())
    )
  )
);
drop policy if exists "Community members can create topics" on public.topics;
create policy "Community topic creation follows owner settings"
on public.topics for insert to authenticated with check (
  auth.uid() = created_by
  and exists (
    select 1 from public.communities c where c.id = topics.community_id and (
      c.created_by = auth.uid()
      or (c.members_can_create_topics = true and exists (
        select 1 from public.community_members cm where cm.community_id = c.id and cm.user_id = auth.uid()
      ))
    )
  )
);

drop policy if exists "Authenticated users can view topic participants" on public.topic_participants;
create policy "Topic participants visible according to community access"
on public.topic_participants for select to authenticated using (
  exists (
    select 1 from public.topics t join public.communities c on c.id = t.community_id
    where t.id = topic_participants.topic_id and (
      c.visibility = 'PUBLIC' or c.created_by = auth.uid()
      or exists (select 1 from public.community_members cm where cm.community_id = c.id and cm.user_id = auth.uid())
    )
  )
);
drop policy if exists "Users can join topics" on public.topic_participants;
create policy "Community members can join topic discussions"
on public.topic_participants for insert to authenticated with check (
  participant_type = 'HUMAN' and user_id = auth.uid() and agent_id is null
  and exists (
    select 1 from public.topics t join public.communities c on c.id = t.community_id
    where t.id = topic_participants.topic_id and (
      c.created_by = auth.uid()
      or exists (select 1 from public.community_members cm where cm.community_id = c.id and cm.user_id = auth.uid())
    )
  )
);
drop policy if exists "Users can leave topics" on public.topic_participants;
create policy "Humans can leave their own topic participation"
on public.topic_participants for delete to authenticated using (participant_type = 'HUMAN' and user_id = auth.uid());

drop policy if exists "Authenticated users can view posts" on public.posts;
create policy "Posts visible according to community access"
on public.posts for select to authenticated using (
  exists (
    select 1 from public.topics t join public.communities c on c.id = t.community_id
    where t.id = posts.topic_id and (
      c.visibility = 'PUBLIC' or c.created_by = auth.uid()
      or exists (select 1 from public.community_members cm where cm.community_id = c.id and cm.user_id = auth.uid())
    )
  )
);
drop policy if exists "Users can create posts as themselves" on public.posts;
create policy "Community members can create topic replies"
on public.posts for insert to authenticated with check (
  exists (
    select 1 from public.topic_participants tp
    join public.topics t on t.id = tp.topic_id
    join public.communities c on c.id = t.community_id
    where tp.id = posts.participant_id and tp.topic_id = posts.topic_id
      and tp.participant_type = 'HUMAN' and tp.user_id = auth.uid()
      and (c.created_by = auth.uid() or exists (
        select 1 from public.community_members cm where cm.community_id = c.id and cm.user_id = auth.uid()
      ))
  )
);
drop policy if exists "Users can update their own posts" on public.posts;
create policy "Authors can update replies while they have community access"
on public.posts for update to authenticated
using (
  exists (
    select 1 from public.topic_participants tp
    join public.topics t on t.id = tp.topic_id
    join public.communities c on c.id = t.community_id
    where tp.id = posts.participant_id and tp.participant_type = 'HUMAN' and tp.user_id = auth.uid()
      and (c.created_by = auth.uid() or exists (select 1 from public.community_members cm where cm.community_id = c.id and cm.user_id = auth.uid()))
  )
)
with check (
  exists (
    select 1 from public.topic_participants tp
    join public.topics t on t.id = tp.topic_id
    join public.communities c on c.id = t.community_id
    where tp.id = posts.participant_id and tp.topic_id = posts.topic_id
      and tp.participant_type = 'HUMAN' and tp.user_id = auth.uid()
      and (c.created_by = auth.uid() or exists (select 1 from public.community_members cm where cm.community_id = c.id and cm.user_id = auth.uid()))
  )
);
drop policy if exists "Users can delete their own posts" on public.posts;
create policy "Authors can delete replies while they have community access"
on public.posts for delete to authenticated using (
  exists (
    select 1 from public.topic_participants tp
    join public.topics t on t.id = tp.topic_id
    join public.communities c on c.id = t.community_id
    where tp.id = posts.participant_id and tp.participant_type = 'HUMAN' and tp.user_id = auth.uid()
      and (c.created_by = auth.uid() or exists (select 1 from public.community_members cm where cm.community_id = c.id and cm.user_id = auth.uid()))
  )
);

drop policy if exists "research artifacts visible to topic participants" on public.research_artifacts;
create policy "Research artifacts visible according to community access"
on public.research_artifacts for select to authenticated using (
  exists (select 1 from public.topics t join public.communities c on c.id = t.community_id
    where t.id = research_artifacts.topic_id and (
      c.visibility = 'PUBLIC' or c.created_by = auth.uid()
      or exists (select 1 from public.community_members cm where cm.community_id = c.id and cm.user_id = auth.uid())
    ))
);
drop policy if exists "humans can create research artifacts" on public.research_artifacts;
create policy "Members can create research artifacts"
on public.research_artifacts for insert to authenticated with check (
  exists (
    select 1 from public.topic_participants tp
    join public.topics t on t.id = tp.topic_id
    join public.communities c on c.id = t.community_id
    where tp.id = research_artifacts.created_by_participant_id and tp.topic_id = research_artifacts.topic_id
      and tp.participant_type = 'HUMAN' and tp.user_id = auth.uid()
      and (c.created_by = auth.uid() or exists (select 1 from public.community_members cm where cm.community_id = c.id and cm.user_id = auth.uid()))
  )
);
drop policy if exists "artifact authors can update research artifacts" on public.research_artifacts;
create policy "Artifact authors can update artifacts with community access"
on public.research_artifacts for update to authenticated
using (
  exists (
    select 1 from public.topic_participants tp
    join public.topics t on t.id = tp.topic_id
    join public.communities c on c.id = t.community_id
    where tp.id = research_artifacts.created_by_participant_id and tp.participant_type = 'HUMAN' and tp.user_id = auth.uid()
      and (c.created_by = auth.uid() or exists (select 1 from public.community_members cm where cm.community_id = c.id and cm.user_id = auth.uid()))
  )
)
with check (
  exists (
    select 1 from public.topic_participants tp
    join public.topics t on t.id = tp.topic_id
    join public.communities c on c.id = t.community_id
    where tp.id = research_artifacts.created_by_participant_id and tp.topic_id = research_artifacts.topic_id
      and tp.participant_type = 'HUMAN' and tp.user_id = auth.uid()
      and (c.created_by = auth.uid() or exists (select 1 from public.community_members cm where cm.community_id = c.id and cm.user_id = auth.uid()))
  )
);
drop policy if exists "artifact authors can delete research artifacts" on public.research_artifacts;
create policy "Artifact authors can delete artifacts with community access"
on public.research_artifacts for delete to authenticated using (
  exists (
    select 1 from public.topic_participants tp
    join public.topics t on t.id = tp.topic_id
    join public.communities c on c.id = t.community_id
    where tp.id = research_artifacts.created_by_participant_id and tp.participant_type = 'HUMAN' and tp.user_id = auth.uid()
      and (c.created_by = auth.uid() or exists (select 1 from public.community_members cm where cm.community_id = c.id and cm.user_id = auth.uid()))
  )
);

drop policy if exists "topic participants can view agent executions" on public.agent_executions;
create policy "Agent executions visible according to community access"
on public.agent_executions for select to authenticated using (
  exists (
    select 1 from public.topics t join public.communities c on c.id = t.community_id
    where t.id = agent_executions.topic_id and (
      c.visibility = 'PUBLIC' or c.created_by = auth.uid()
      or exists (select 1 from public.community_members cm where cm.community_id = c.id and cm.user_id = auth.uid())
    )
  )
);

drop policy if exists "Community join requests visible to requester or owner" on public.community_join_requests;
create policy "Community join requests visible to requester or owner"
on public.community_join_requests for select to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.communities c where c.id = community_join_requests.community_id and c.created_by = auth.uid())
);
drop policy if exists "Members can request private community access" on public.community_join_requests;
create policy "Members can request private community access"
on public.community_join_requests for insert to authenticated with check (
  user_id = auth.uid() and status = 'PENDING'
  and exists (select 1 from public.communities c where c.id = community_join_requests.community_id and c.visibility = 'PRIVATE' and c.created_by <> auth.uid())
  and not exists (select 1 from public.community_members cm where cm.community_id = community_join_requests.community_id and cm.user_id = auth.uid())
);
drop policy if exists "Owners can update community join requests" on public.community_join_requests;
drop policy if exists "Requesters can cancel pending join requests" on public.community_join_requests;
create policy "Requesters can cancel pending join requests"
on public.community_join_requests for delete to authenticated using (user_id = auth.uid() and status = 'PENDING');

drop policy if exists "Community agent profiles visible to accessible members" on public.community_agents;
create policy "Community agent profiles visible to accessible members"
on public.community_agents for select to authenticated using (
  exists (select 1 from public.communities c where c.id = community_agents.community_id and (
    c.visibility = 'PUBLIC' or c.created_by = auth.uid()
    or exists (select 1 from public.community_members cm where cm.community_id = c.id and cm.user_id = auth.uid())
  ))
);
drop policy if exists "Community owners can create agents" on public.community_agents;
create policy "Community owners can create agents"
on public.community_agents for insert to authenticated with check (
  created_by = auth.uid() and exists (select 1 from public.communities c where c.id = community_agents.community_id and c.created_by = auth.uid())
);
drop policy if exists "Community owners can update agents" on public.community_agents;
create policy "Community owners can update agents" on public.community_agents for update to authenticated
using (exists (select 1 from public.communities c where c.id = community_agents.community_id and c.created_by = auth.uid()))
with check (created_by = auth.uid() and exists (select 1 from public.communities c where c.id = community_agents.community_id and c.created_by = auth.uid()));
drop policy if exists "Community owners can delete agents" on public.community_agents;
create policy "Community owners can delete agents"
on public.community_agents for delete to authenticated using (exists (select 1 from public.communities c where c.id = community_agents.community_id and c.created_by = auth.uid()));

revoke all on public.community_agent_prompts from anon, authenticated;
grant all on public.community_agent_prompts to service_role;
grant select, insert, delete on public.community_join_requests to authenticated;
grant select, insert, update, delete on public.community_agents to authenticated;

create or replace function public.review_community_join_request(p_request_id uuid, p_decision text)
returns public.community_join_requests language plpgsql security definer set search_path = public as $$
declare
  v_request public.community_join_requests;
  v_community public.communities;
begin
  if p_decision not in ('APPROVED', 'REJECTED') then raise exception 'Decision must be APPROVED or REJECTED'; end if;
  select * into v_request from public.community_join_requests where id = p_request_id for update;
  if not found then raise exception 'Join request not found'; end if;
  select * into v_community from public.communities where id = v_request.community_id;
  if not found or v_community.created_by <> auth.uid() then raise exception 'Only the community owner can review access requests'; end if;
  if v_request.status <> 'PENDING' then raise exception 'This request has already been reviewed'; end if;
  if p_decision = 'APPROVED' then
    insert into public.community_members (community_id, user_id, role)
    values (v_request.community_id, v_request.user_id, 'MEMBER')
    on conflict (community_id, user_id) do nothing;
  end if;
  update public.community_join_requests set status = p_decision, reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  where id = v_request.id returning * into v_request;
  return v_request;
end;
$$;
revoke all on function public.review_community_join_request(uuid, text) from public, anon;
grant execute on function public.review_community_join_request(uuid, text) to authenticated;

drop policy if exists "Members can read activity posts" on public.activity_posts;
create policy "Activity posts follow community and topic privacy"
on public.activity_posts for select to authenticated using (
  (community_id is null or exists (select 1 from public.communities c where c.id = activity_posts.community_id and (
    c.visibility = 'PUBLIC' or c.created_by = auth.uid()
    or exists (select 1 from public.community_members cm where cm.community_id = c.id and cm.user_id = auth.uid())
  )))
  and (topic_id is null or exists (select 1 from public.topics t join public.communities c on c.id = t.community_id where t.id = activity_posts.topic_id and (
    c.visibility = 'PUBLIC' or c.created_by = auth.uid()
    or exists (select 1 from public.community_members cm where cm.community_id = c.id and cm.user_id = auth.uid())
  )))
);
drop policy if exists "Members can read activity comments" on public.activity_comments;
create policy "Activity comments follow parent visibility"
on public.activity_comments for select to authenticated using (
  exists (select 1 from public.activity_posts p where p.id = activity_comments.post_id)
);
drop policy if exists "Members can read activity likes" on public.activity_likes;
create policy "Activity likes follow parent visibility"
on public.activity_likes for select to authenticated using (
  exists (select 1 from public.activity_posts p where p.id = activity_likes.post_id)
);

-- A topic creator who has left a community must not retain modify/delete access to its topics.
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
