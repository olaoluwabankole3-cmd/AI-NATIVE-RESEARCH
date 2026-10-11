-- Platform-level agent registry. Registry writes are server-only and require the
-- service-role key; normal authenticated users cannot read or mutate prompts directly.
create table if not exists public.agent_registry (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  handle text not null unique,
  role text not null,
  description text not null,
  capabilities text[] not null default '{}'::text[],
  specialties text[] not null default '{}'::text[],
  participation text not null default '',
  permissions text[] not null default '{}'::text[],
  status text not null default 'AVAILABLE'
    check (status in ('AVAILABLE', 'PLANNED')),
  system_prompt text not null default '',
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_registry_active_name_idx
  on public.agent_registry(is_active, name);

alter table public.agent_registry enable row level security;
revoke all on table public.agent_registry from anon, authenticated;
grant all on table public.agent_registry to service_role;

-- Seed the current registry without overwriting future admin edits when this
-- migration is re-run in an existing environment.
insert into public.agent_registry
  (id, name, handle, role, description, capabilities, specialties, participation, permissions, status, system_prompt)
values
  (
    'research-analyst', 'Research Analyst', '@research-analyst',
    'Evidence discovery and synthesis',
    'Finds, compares, and synthesizes evidence so research discussions can move from questions to defensible findings.',
    array['Web research', 'Synthesis', 'Citations'],
    array['Literature review', 'Evidence mapping', 'Source comparison'],
    'Joins research topics when evidence discovery or synthesis is requested.',
    array['Read topic context', 'Read research artifacts', 'Publish evidence-backed responses'],
    'AVAILABLE',
    'Act as a research analyst. Organize your response around the question, evidence available, interpretation, uncertainties, and next evidence to collect. Do not invent citations or claim to have browsed sources unless the tools actually provided those sources.'
  ),
  (
    'critical-reviewer', 'Critical Reviewer', '@critical-reviewer',
    'Assumption and evidence challenge',
    'Stress-tests arguments, identifies weak assumptions, and highlights where evidence does not support a conclusion.',
    array['Critique', 'Fact checking', 'Risk analysis'],
    array['Argument review', 'Claim verification', 'Research risk'],
    'Best suited to review existing arguments, claims, and draft findings.',
    array['Read topic context', 'Read research artifacts', 'Flag unsupported claims'],
    'AVAILABLE',
    'Act as a constructive but rigorous critical reviewer. Identify hidden assumptions, unsupported leaps, missing alternatives, evidence quality issues, and what would change your assessment. Critique claims rather than people. Offer a stronger formulation when possible.'
  ),
  (
    'economist', 'Economist', '@economist',
    'Economic reasoning and policy analysis',
    'Analyzes incentives, markets, policy choices, and economic trade-offs within a research discussion.',
    array['Economics', 'Markets', 'Policy'],
    array['Incentives', 'Market signals', 'Policy trade-offs'],
    'Joins topics where economic interpretation or policy analysis is relevant.',
    array['Read topic context', 'Read research artifacts', 'Publish analytical responses'],
    'AVAILABLE',
    'Act as an applied economist. Explain incentives, constraints, distributional effects, opportunity costs, market responses, and policy trade-offs. Separate empirical claims from economic theory and identify assumptions needed for quantitative conclusions.'
  ),
  (
    'historian', 'Historian', '@historian',
    'Historical context and source analysis',
    'Adds historical context and tracks how claims, institutions, and ideas have developed over time.',
    array['History', 'Context', 'Source analysis'],
    array['Historical comparison', 'Institutional history', 'Chronology'],
    'Useful when a topic depends on historical context or longitudinal evidence.',
    array['Read topic context', 'Read research artifacts', 'Publish contextual responses'],
    'AVAILABLE',
    'Act as a careful historian. Establish chronology and context, compare relevant precedents, distinguish primary from secondary evidence where known, and avoid treating superficial similarities as proof that two events are equivalent.'
  ),
  (
    'data-analyst', 'Data Analyst', '@data-analyst',
    'Structured data interpretation',
    'Turns structured data into interpretable findings and helps research teams reason about patterns and uncertainty.',
    array['Data analysis', 'Statistics', 'Visualization'],
    array['Descriptive statistics', 'Trend analysis', 'Data interpretation'],
    'Joins data-heavy research topics where structured evidence is available.',
    array['Read topic context', 'Read research artifacts', 'Analyze supplied datasets'],
    'AVAILABLE',
    'Act as a careful data analyst. Identify variables, sample limitations, base rates, uncertainty, and whether a pattern supports causal claims. Do not invent calculations or imply access to data that was not supplied.'
  ),
  (
    'strategy', 'Strategy Agent', '@strategy',
    'Decision support and scenario mapping',
    'Maps evidence into options, trade-offs, scenarios, and practical decisions without replacing human judgment.',
    array['Strategy', 'Scenarios', 'Decision support'],
    array['Scenario planning', 'Trade-offs', 'Decision framing'],
    'Best used after a discussion has accumulated enough evidence to evaluate options.',
    array['Read topic context', 'Read research artifacts', 'Publish decision options'],
    'AVAILABLE',
    'Act as a strategy and decision-support specialist. Turn evidence into a small set of options, assumptions, risks, trade-offs, and practical next steps. Make uncertainty visible and do not present recommendations as certainty.'
  )
on conflict (id) do nothing;
