-- Converge one-to-one, internet voice calls (WebRTC).
-- Release gate: apply to a disposable Supabase database and test with TWO accounts
-- before applying to production. Never replay the previous migration history.
-- Audio is end-to-end encrypted in transit by WebRTC DTLS-SRTP; SDP is signaling
-- metadata visible only to participants via RLS (not WhatsApp's E2EE identity model).

create table public.voice_calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  caller_id uuid not null references auth.users(id) on delete cascade,
  callee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'ringing'
    check (status in ('ringing','active','ended','declined','missed','failed')),
  created_at timestamptz not null default now(),
  ring_expires_at timestamptz not null default (now() + interval '45 seconds'),
  answered_at timestamptz,
  ended_at timestamptz,
  caller_seen_at timestamptz not null default now(),
  callee_seen_at timestamptz,
  offer_sdp text,
  answer_sdp text,
  constraint voice_calls_distinct_participants check (caller_id <> callee_id),
  constraint voice_calls_sdp_limits check (
    char_length(coalesce(offer_sdp,'')) <= 65536 and
    char_length(coalesce(answer_sdp,'')) <= 65536
  )
);
create index voice_calls_callee_recent on public.voice_calls(callee_id,created_at desc);
create index voice_calls_caller_recent on public.voice_calls(caller_id,created_at desc);
create index voice_calls_status_recent on public.voice_calls(status,created_at desc)
  where status in ('ringing','active');

alter table public.voice_calls enable row level security;
revoke all on public.voice_calls from public,anon,authenticated;
grant select on public.voice_calls to authenticated;
create policy "Only voice call participants can see their calls"
  on public.voice_calls for select to authenticated
  using (caller_id = (select auth.uid()) or callee_id = (select auth.uid()));

-- Function authorization is checked per call. No caller can choose arbitrary
-- participants: they must use an existing ACCEPTED DM conversation, and a block
-- in either direction prevents the call.
create function public.start_voice_call(p_conversation_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_conv public.direct_conversations%rowtype;
  v_other uuid;
  v_id uuid;
begin
  if v_actor is null then raise exception 'Sign in before making a call.'; end if;
  if p_conversation_id is null then raise exception 'Choose a conversation to call.'; end if;

  select * into v_conv from public.direct_conversations c
  where c.id=p_conversation_id and c.request_status='ACCEPTED'
    and v_actor in (c.user_low_id,c.user_high_id);
  if not found then raise exception 'Calls require an accepted private conversation.'; end if;
  v_other := case when v_conv.user_low_id=v_actor then v_conv.user_high_id else v_conv.user_low_id end;

  -- Serialize call attempts across roles to avoid simultaneous cross-calls.
  perform pg_advisory_xact_lock(hashtext(least(v_actor,v_other)::text));
  perform pg_advisory_xact_lock(hashtext(greatest(v_actor,v_other)::text));

  if exists (select 1 from public.user_blocks b
    where (b.blocker_id=v_actor and b.blocked_id=v_other)
       or (b.blocker_id=v_other and b.blocked_id=v_actor)) then
    raise exception 'Calling is unavailable because a member is blocked.';
  end if;

  -- Expired incoming requests never hold a member busy indefinitely.
  update public.voice_calls
  set status='missed',ended_at=now(),offer_sdp=null,answer_sdp=null
  where status='ringing' and ring_expires_at < now()
    and (v_actor in (caller_id,callee_id) or v_other in (caller_id,callee_id));

  -- Close orphaned calls when either participant stopped heartbeating.
  -- Without this cleanup a crashed browser could block new calls forever.
  update public.voice_calls
  set status='failed',ended_at=now(),offer_sdp=null,answer_sdp=null
  where status='active' and
    (caller_seen_at < now() - interval '75 seconds'
      or callee_seen_at is null
      or callee_seen_at < now() - interval '75 seconds')
    and (v_actor in (caller_id,callee_id) or v_other in (caller_id,callee_id));

  -- Limit unwanted repeated ringing even when calls end immediately.
  if (select count(*) from public.voice_calls
      where caller_id=v_actor and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'Call limit reached. Try again later.';
  end if;
  if exists (select 1 from public.voice_calls
      where caller_id=v_actor and callee_id=v_other
        and created_at > now() - interval '30 seconds') then
    raise exception 'Please wait before calling this member again.';
  end if;

  if exists (select 1 from public.voice_calls
    where status in ('ringing','active')
      and (v_actor in (caller_id,callee_id) or v_other in (caller_id,callee_id))) then
    raise exception 'One of you is already on another Converge call.';
  end if;

  insert into public.voice_calls(conversation_id,caller_id,callee_id)
  values (p_conversation_id,v_actor,v_other)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.answer_voice_call(p_call_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_call public.voice_calls%rowtype;
begin
  if v_actor is null then raise exception 'Sign in before answering.'; end if;
  select * into v_call from public.voice_calls where id=p_call_id for update;
  if not found or v_actor is distinct from v_call.callee_id then
    raise exception 'This incoming call is not available to you.';
  end if;
  if v_call.status <> 'ringing' or v_call.ring_expires_at < now() then
    raise exception 'This call is no longer ringing.';
  end if;
  if exists (select 1 from public.user_blocks b
    where (b.blocker_id=v_call.caller_id and b.blocked_id=v_call.callee_id)
       or (b.blocker_id=v_call.callee_id and b.blocked_id=v_call.caller_id)) then
    raise exception 'Calling is blocked.';
  end if;
  update public.voice_calls set status='active',answered_at=now(),callee_seen_at=now()
  where id=p_call_id;
end;
$$;

create function public.publish_voice_call_sdp(
  p_call_id uuid,p_type text,p_sdp text
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_call public.voice_calls%rowtype;
begin
  if v_actor is null then raise exception 'Sign in before joining a call.'; end if;
  if p_type is null or p_type not in ('offer','answer') then
    raise exception 'Invalid call negotiation type.';
  end if;
  if p_sdp is null or char_length(p_sdp) not between 30 and 65536 or
     left(p_sdp,2) <> 'v=' then
    raise exception 'Invalid call negotiation payload.';
  end if;
  select * into v_call from public.voice_calls where id=p_call_id for update;
  if not found or v_actor not in (v_call.caller_id,v_call.callee_id) or v_call.status <> 'active' then
    raise exception 'You cannot negotiate this call.';
  end if;
  if p_type='offer' then
    if v_actor <> v_call.caller_id or v_call.offer_sdp is not null then
      raise exception 'The offer has already been submitted or is not yours.';
    end if;
    update public.voice_calls set offer_sdp=p_sdp where id=p_call_id;
  else
    if v_actor <> v_call.callee_id or v_call.offer_sdp is null
       or v_call.answer_sdp is not null then
      raise exception 'The answer is not allowed yet.';
    end if;
    update public.voice_calls set answer_sdp=p_sdp where id=p_call_id;
  end if;
end;
$$;

create function public.heartbeat_voice_call(p_call_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'Not signed in.'; end if;
  update public.voice_calls
  set caller_seen_at=case when caller_id=v_actor then now() else caller_seen_at end,
      callee_seen_at=case when callee_id=v_actor then now() else callee_seen_at end
  where id=p_call_id and status in ('ringing','active')
    and v_actor in (caller_id,callee_id);
  if not found then raise exception 'Call no longer available.'; end if;
end;
$$;

create function public.finish_voice_call(p_call_id uuid,p_reason text default 'ended')
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_call public.voice_calls%rowtype;
  v_reason text;
begin
  if v_actor is null then raise exception 'Not signed in.'; end if;
  if p_reason is null or p_reason not in ('ended','declined','missed','failed') then
    raise exception 'Invalid call end reason.';
  end if;
  select * into v_call from public.voice_calls where id=p_call_id for update;
  if not found or v_actor not in (v_call.caller_id,v_call.callee_id) then
    raise exception 'This call is unavailable.';
  end if;
  if v_call.status not in ('ringing','active') then return; end if;

  v_reason := case
    when v_call.status='ringing' and v_actor=v_call.callee_id then 'declined'
    when v_call.status='ringing' then 'missed'
    when p_reason='failed' then 'failed'
    else 'ended'
  end;
  update public.voice_calls
  set status=v_reason, ended_at=now(),offer_sdp=null,answer_sdp=null
  where id=p_call_id;
end;
$$;

-- Block operations terminate any existing sessions immediately, and client
-- polling stops media tracks once the call is no longer active.
create function public.stop_blocked_voice_calls()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.voice_calls set status='ended',ended_at=now(),
      offer_sdp=null,answer_sdp=null
  where status in ('ringing','active') and
    ((caller_id=new.blocker_id and callee_id=new.blocked_id)
    or (callee_id=new.blocker_id and caller_id=new.blocked_id));
  return new;
end;
$$;
revoke execute on function public.stop_blocked_voice_calls() from public,anon,authenticated;
create trigger stop_voice_calls_on_block after insert on public.user_blocks
  for each row execute function public.stop_blocked_voice_calls();

revoke execute on function public.start_voice_call(uuid) from public,anon;
revoke execute on function public.answer_voice_call(uuid) from public,anon;
revoke execute on function public.publish_voice_call_sdp(uuid,text,text) from public,anon;
revoke execute on function public.heartbeat_voice_call(uuid) from public,anon;
revoke execute on function public.finish_voice_call(uuid,text) from public,anon;
grant execute on function public.start_voice_call(uuid) to authenticated;
grant execute on function public.answer_voice_call(uuid) to authenticated;
grant execute on function public.publish_voice_call_sdp(uuid,text,text) to authenticated;
grant execute on function public.heartbeat_voice_call(uuid) to authenticated;
grant execute on function public.finish_voice_call(uuid,text) to authenticated;

-- Supabase Postgres Changes notifies participants of their visible RLS rows.
-- Periodic read fallback in UI covers missed Realtime events.
do $m$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and
     not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
        and schemaname='public' and tablename='voice_calls') then
    alter publication supabase_realtime add table public.voice_calls;
  end if;
end $m$;

notify pgrst,'reload schema';
