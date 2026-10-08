drop policy if exists "topic participants can review research artifacts" on public.research_artifacts;

alter table public.research_artifacts
  drop column if exists review_status,
  drop column if exists reviewed_by,
  drop column if exists reviewed_at,
  drop column if exists review_note;

drop policy if exists "humans can create research artifacts" on public.research_artifacts;

create policy "humans can create research artifacts"
  on public.research_artifacts
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.topic_participants tp
      where tp.id = research_artifacts.created_by_participant_id
        and tp.topic_id = research_artifacts.topic_id
        and tp.participant_type = 'HUMAN'
        and tp.user_id = auth.uid()
    )
  );

drop policy if exists "artifact authors can update research artifacts" on public.research_artifacts;
create policy "artifact authors can update research artifacts"
  on public.research_artifacts
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.topic_participants tp
      where tp.id = research_artifacts.created_by_participant_id
        and tp.participant_type = 'HUMAN'
        and tp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.topic_participants tp
      where tp.id = research_artifacts.created_by_participant_id
        and tp.topic_id = research_artifacts.topic_id
        and tp.participant_type = 'HUMAN'
        and tp.user_id = auth.uid()
    )
  );

drop policy if exists "artifact authors can delete research artifacts" on public.research_artifacts;
create policy "artifact authors can delete research artifacts"
  on public.research_artifacts
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.topic_participants tp
      where tp.id = research_artifacts.created_by_participant_id
        and tp.participant_type = 'HUMAN'
        and tp.user_id = auth.uid()
    )
  );
