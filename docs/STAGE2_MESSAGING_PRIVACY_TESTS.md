# Stage 2 — Messaging access control audit (2026-11-10)

## Confirmed exposure
The public `users_blocked(uuid,uuid)` SECURITY DEFINER RPC was callable by any authenticated user and returned whether **arbitrary other user pairs** blocked each other. It was not restricted to the caller's pair, so the relationship could be queried without involvement.

## Applied fix
- Applied Supabase migration `20261110153051_restrict_users_blocked_to_request_participants.sql` to the *existing* project.
- The function returns `false` unless `auth.uid()` matches one of the two supplied users. Authenticated callers can still check their own conversation partner; the direct-message INSERT RLS policy calls it with `auth.uid()` as the first argument.
- It is still unavailable to the `anon` role.
- The UI now fails closed on a block-RPC lookup error, rather than assuming the relationship is unblocked.
- No existing accounts, blocks, or conversation records were edited.

## Required follow-up before deployment
- Test participant A and B sending messages after acceptance, and sender's single introductory message.
- Test ignoring or blocking a request; message INSERT RLS must prevent further writes.
- Verify a third party receives no relationship information from the RPC.
- Verify `anon` has no EXECUTE access, and sign-out/revoked session behavior.
- Test the UI error case where the RPC request fails while a conversation is visible.

## Rollout
The SQL was already applied to production's **existing database**. The code is a separate draft PR. GitHub CI build is necessary but does not replace real multi-user session tests.
