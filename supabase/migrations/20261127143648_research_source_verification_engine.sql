-- Server-only, append-only assessments. Source inspection is a human attestation, not a truth certificate.
create unique index if not exists research_evidence_edges_topic_source_id_unique
  on public.research_evidence_edges(topic_id, evidence_artifact_id, id);

create table public.research_source_verifications (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  source_artifact_id uuid not null,
  edge_id uuid,
  reviewer_id uuid references auth.users(id) on delete set null,
  verdict text not null check (verdict in ('ORIGIN_CHECKED','QUESTIONABLE','UNREACHABLE')),
  rationale text not null check (char_length(rationale) between 40 and 3000),
  publisher text not null default '' check (char_length(publisher) <= 200),
  publication_date text not null default '' check (char_length(publication_date) <= 100),
  original_url text not null check (char_length(original_url) between 8 and 2048 and original_url ~ '^https?://'),
  original_excerpt text not null default '' check (char_length(original_excerpt) <= 8000),
  quote_match boolean,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (topic_id,source_artifact_id) references public.research_artifacts(topic_id,id) on delete cascade,
  foreign key (topic_id,source_artifact_id,edge_id) references public.research_evidence_edges(topic_id,evidence_artifact_id,id) on delete cascade,
  check (edge_id is not null or (original_excerpt = '' and quote_match is null)),
  check (verdict <> 'ORIGIN_CHECKED' or (publisher <> '' and (edge_id is null or (original_excerpt <> '' and quote_match is not null))))
);
create index research_source_verifications_topic_created_idx on public.research_source_verifications(topic_id, created_at desc);
create index research_source_verifications_source_idx on public.research_source_verifications(topic_id, source_artifact_id, edge_id);
create index research_source_verifications_reviewer_idx on public.research_source_verifications(reviewer_id);
alter table public.research_source_verifications enable row level security;
revoke all on public.research_source_verifications from public, anon, authenticated, service_role;
grant select, insert on public.research_source_verifications to service_role;
