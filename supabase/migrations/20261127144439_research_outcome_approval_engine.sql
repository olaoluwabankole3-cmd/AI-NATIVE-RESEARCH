-- Frozen outcomes and independent, append-only decisions.
create table public.research_outcome_versions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  version_no integer not null check (version_no between 1 and 100),
  submitted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  digest text not null check (digest ~ '^[a-f0-9]{64}$'),
  sections jsonb not null check (jsonb_typeof(sections)='object'),
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  report text not null check (octet_length(report) between 1 and 3000000),
  unique(topic_id,version_no),
  unique(topic_id,id)
);
create table public.research_outcome_decisions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  version_id uuid not null,
  reviewer_id uuid references auth.users(id) on delete set null,
  verdict text not null check (verdict in ('APPROVED','CHANGES_REQUESTED')),
  rationale text not null check (char_length(rationale) between 40 and 3000),
  created_at timestamptz not null default now(),
  foreign key(topic_id,version_id) references public.research_outcome_versions(topic_id,id) on delete cascade,
  unique(version_id,reviewer_id)
);
create index research_outcome_versions_submitter_idx on public.research_outcome_versions(submitted_by);
create index research_outcome_decisions_topic_version_idx on public.research_outcome_decisions(topic_id,version_id);
create index research_outcome_decisions_reviewer_idx on public.research_outcome_decisions(reviewer_id);
alter table public.research_outcome_versions enable row level security;
alter table public.research_outcome_decisions enable row level security;
revoke all on public.research_outcome_versions,public.research_outcome_decisions from public,anon,authenticated,service_role;
grant select,insert on public.research_outcome_versions,public.research_outcome_decisions to service_role;

create function public.check_research_outcome_independence() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare author_id uuid;
begin
  select submitted_by into author_id from public.research_outcome_versions
    where topic_id=new.topic_id and id=new.version_id;
  if author_id is null or new.reviewer_id is null or author_id=new.reviewer_id then
    raise exception 'Independent outcome reviewer required' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function public.check_research_outcome_independence() from public,anon,authenticated;
grant execute on function public.check_research_outcome_independence() to service_role;
create trigger research_outcome_independent_reviewer before insert on public.research_outcome_decisions
for each row execute function public.check_research_outcome_independence();

-- One statement, one MVCC snapshot. Bounded result; API refuses partial records.
create function public.capture_research_outcome_record(p_topic_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'topic', jsonb_build_object('id',t.id,'title',t.title,'body',coalesce(t.body,'')),
    'artifacts', coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from (select * from public.research_artifacts where topic_id=t.id order by id limit 501) a),'[]'::jsonb),
    'edges', coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from (select * from public.research_evidence_edges where topic_id=t.id order by id limit 501) e),'[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(to_jsonb(r) order by r.id) from (select * from public.research_review_events where topic_id=t.id order by id limit 501) r),'[]'::jsonb),
    'verifications', coalesce((select jsonb_agg(to_jsonb(v) order by v.id) from (select * from public.research_source_verifications where topic_id=t.id order by id limit 501) v),'[]'::jsonb)
  ) from public.topics t where t.id=p_topic_id and t.type='RESEARCH';
$$;
revoke all on function public.capture_research_outcome_record(uuid) from public,anon,authenticated;
grant execute on function public.capture_research_outcome_record(uuid) to service_role;
