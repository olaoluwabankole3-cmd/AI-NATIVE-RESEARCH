# Messaging RLS repair (14 November 2026)

## Incident
Converge messages returned HTTP 500 because the `direct_messages` INSERT policy checks `direct_messages` directly inside its own policy to enforce only one message when the request is pending. PostgreSQL rejects this recursion with SQLSTATE `42P17`; Supabase logs showed two `POST /rest/v1/direct_messages` responses with HTTP 500.

## Repair
Applied additive migration `20261114113202_fix_recursive_direct_message_insert_rls` directly to the existing production Supabase project (by user request). A private, authenticated-only `SECURITY DEFINER` helper evaluates message permissions and first-pending-message state without triggering recursive RLS. Replaced only the table INSERT policy; SELECT and notification/activity triggers were unchanged.

## Validation
Live production rollback-only SQL tests passed for: accepted-message send; pending-conversation creator's first message; rejecting a second pending message; rejecting a pending recipient; rejecting sender impersonation and blocked-user messages. The rollback left three original messages, zero blocks and zero test messages. Security advisors showed no new policy/helper findings. Existing audio and video calling are unaffected.

No browser-authenticated user send was performed by the assistant; verify through the existing Converge Messages UI after this repair.

## Security
- Never grant direct_messages INSERT to broad client roles without appropriate RLS.
- Keep the helper in an unexposed `private` schema with explicit `auth.uid()` verification.
- Do not replace `SECURITY DEFINER` with `SECURITY INVOKER` without an alternative to the recursive self-read.
- Future policy changes must include a transactionally rolled-back live-schema send test for both accepted and pending conversations.

## Release
The repair was already applied in Supabase before the GitHub follow-up commit; **do not replay this migration manually on that production database**. It is committed to source control to support clean future environments.
