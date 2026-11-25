-- Applied to Converge Supabase on 2026-11-25 (migration version 20261125222724).
-- Additive same-topic evidence references and append-only human-review events.
-- API access is service-only; next-server endpoints check real user, membership, ban
-- and topic participation before each read/write. No direct browser role grants.

alter table public.research_artifacts
  add constraint research_artifacts_topic_id_id_unique unique (topic_id, id);

create table public.research_evidence_edges (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  claim_artifact_id uuid not null,
  evidence_artifact_id uuid not null,
  relation text not null check (relation in ('SUPPORTS','CONTRADICTS','CONTEXT')),
  passage text not null check (char_length(passage) between 16 and 1600),
  locator text not null default '' check (char_length(locator) <= 160),
  note text not null default '' check (char_length(note) <= 1000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint research_evidence_claim_same_topic
    foreign key (topic_id, claim_artifact_id)
    references public.research_artifacts(topic_id, id) on delete cascade,
  constraint research_evidence_source_same_topic
    foreign key (topic_id, evidence_artifact_id)
    references public.research_artifacts(topic_id, id) on delete cascade,
  constraint research_evidence_not_self check (claim_artifact_id <> evidence_artifact_id),
  constraint research_evidence_unique_claim_source_relation
    unique (topic_id, claim_artifact_id, evidence_artifact_id, relation)
);

create table public.research_review_events (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  claim_artifact_id uuid not null,
  reviewer_id uuid references auth.users(id) on delete set null,
  verdict text not null check (verdict in ('SUPPORTED','DISPUTED','INCONCLUSIVE','REQUIRES_REVISION')),
  rationale text not null check (char_length(rationale) between 40 and 3000),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now(),
  constraint research_review_claim_same_topic
    foreign key (topic_id, claim_artifact_id)
    references public.research_artifacts(topic_id, id) on delete cascade
);

create index research_evidence_edges_by_topic_created on public.research_evidence_edges(topic_id, created_at desc);
create index research_evidence_edges_by_claim on public.research_evidence_edges(topic_id, claim_artifact_id);
create index research_review_events_by_topic_created on public.research_review_events(topic_id, created_at desc);
create index research_review_events_by_claim on public.research_review_events(topic_id, claim_artifact_id, created_at desc);

alter table public.research_evidence_edges enable row level security;
alter table public.research_review_events enable row level security;
revoke all on public.research_evidence_edges from public, anon, authenticated, service_role;
revoke all on public.research_review_events from public, anon, authenticated, service_role;
grant select, insert on public.research_evidence_edges to service_role;
grant select, insert on public.research_review_events to service_role;

comment on table public.research_evidence_edges is
  'Researcher-reported supporting/contradicting passage associations; NOT independent verification.';
comment on table public.research_review_events is
  'Append-only human peer-review verdicts against snapshots; NOT formal certification.';
