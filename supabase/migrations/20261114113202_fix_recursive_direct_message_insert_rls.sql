-- Repair live messaging failure: PostgreSQL 42P17 (recursive RLS policy).
-- The old direct_messages INSERT policy queried direct_messages itself when
-- checking first-time message requests, causing HTTP 500 on every send.
-- This is additive except for replacing that single INSERT policy.
-- A private SECURITY DEFINER helper checks the conversation and first-message
-- state without recursing through the table's RLS. Its internal authorization
-- checks enforce the same accepted/pending/blocked/sender rules.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create function private.can_send_direct_message(p_conversation_id uuid, p_sender_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $function$
 select p_conversation_id is not null and p_sender_id is not null
   and p_sender_id = (select auth.uid())
   and exists (
     select 1 from public.direct_conversations c
     where c.id = p_conversation_id
       and p_sender_id in (c.user_low_id, c.user_high_id)
       and not exists (
         select 1 from public.user_blocks b
         where (b.blocker_id = p_sender_id and b.blocked_id = case when c.user_low_id=p_sender_id then c.user_high_id else c.user_low_id end)
            or (b.blocked_id = p_sender_id and b.blocker_id = case when c.user_low_id=p_sender_id then c.user_high_id else c.user_low_id end)
       )
       and (
         c.request_status = 'ACCEPTED'
         or (c.request_status = 'PENDING' and c.created_by = p_sender_id
             and not exists (select 1 from public.direct_messages m where m.conversation_id = c.id))
       )
   );
$function$;

revoke all on function private.can_send_direct_message(uuid,uuid) from public, anon;
grant execute on function private.can_send_direct_message(uuid,uuid) to authenticated;
drop policy "Participants can send direct messages" on public.direct_messages;
create policy "Participants can send direct messages" on public.direct_messages
 for insert to authenticated
 with check (
   sender_id = (select auth.uid())
   and char_length(btrim(body)) between 1 and 5000
   and private.can_send_direct_message(conversation_id,sender_id)
 );
notify pgrst, 'reload schema';
