-- Server-only mapping from a community to its Cloudflare RealtimeKit meeting.
-- Not applied to live production by this PR. Requires targeted review + migration.
-- Browser clients must never read or mutate meeting identifiers directly.

create table if not exists public.community_group_call_rooms (
  community_id uuid primary key references public.communities(id) on delete cascade,
  meeting_id uuid unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.community_group_call_rooms enable row level security;
revoke all on table public.community_group_call_rooms from public, anon, authenticated;
-- Server-side Supabase service-role client accesses this private mapping
-- after independently verifying membership, bans, and moderation permissions.
-- Intentionally no authenticated or anonymous RLS policies.
create index if not exists community_group_call_rooms_meeting
  on public.community_group_call_rooms(meeting_id)
  where meeting_id is not null;
