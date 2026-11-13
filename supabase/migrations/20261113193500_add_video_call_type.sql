-- Converge audio + video call type support, additive migration.
-- Existing audio calls remain audio via the default. All media uses the
-- existing participant-only RLS, accepted-conversation checks, blocking,
-- rate limiting, heartbeat, signaling and session lifecycle.
alter table public.voice_calls
  add column call_type text not null default 'audio'
  constraint voice_calls_call_type_valid check (call_type in ('audio', 'video'));

-- Reuse the already audited start_voice_call() function rather than
-- duplicating its concurrency, blocking, and authorization logic.
-- This transaction marks the new row as a video call atomically.
create function public.start_video_call(p_conversation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_call_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in before making a video call.';
  end if;

  v_call_id := public.start_voice_call(p_conversation_id);
  update public.voice_calls
     set call_type = 'video'
   where id = v_call_id and caller_id = auth.uid() and status = 'ringing';

  if not found then
    raise exception 'Unable to start a video call.';
  end if;

  return v_call_id;
end;
$function$;

revoke execute on function public.start_video_call(uuid) from public, anon;
grant execute on function public.start_video_call(uuid) to authenticated;
notify pgrst, 'reload schema';
