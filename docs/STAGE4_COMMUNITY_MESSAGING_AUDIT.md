# Stage 4 — Community and messaging workflow audit
Date: 10 November 2026
Branch: `stage4/community-messaging-hardening-20261110`
Base: unmerged Stage 3 candidate `stage3/auth-stabilization-20261110`.

## Confirmed production database issues and fixes

### 1. Private community request approval
`review_community_join_request` was SECURITY DEFINER and used a privileged membership INSERT without first checking whether the applicant was banned. The new function explicitly rejects banned applicants while preserving owner-only approval, the pending-only state transition, and grants to authenticated roles only.

Migration already applied:
`20261110162933_reject_banned_community_join_approvals.sql`.

### 2. Missing notifications for community and DM decisions
Existing notification triggers handled direct-message INSERTs, connection requests, activity, and topic replies. They did not notify community owners when someone requested private access or applicants of approval/rejection. There was also no message-request **acceptance** notification.

A new trigger on `community_join_requests` notifies:
- The community owner on a new PENDING request
- The applicant on PENDING → APPROVED
- The applicant on PENDING → REJECTED (including rejection caused by blocking)

Another trigger on `direct_conversations` notifies the original sender on PENDING → ACCEPTED. The notification type constraint now allows exactly four new types; existing notification rows are untouched. Trigger functions are not directly executable by anon or authenticated roles.

Migration already applied:
`20261110163057_notify_community_requests_and_message_acceptance.sql`.

Notes: Incoming introductory messages were **already** covered by the `direct_messages` notification trigger. The new acceptance event is additional. No backfill was made for old requests.

### 3. Moderation and message response validation
The two SECURITY DEFINER RPCs treated a null action as falling through to the final branch: `moderate_community_member(NULL)` could reach the UNBLOCK branch; `respond_direct_message_request(NULL)` could change a pending request to IGNORED. Both RPCs now reject null and unsupported actions.

A community **owner** may block a person with a pending private access request even if they have never been a member. This rejects the pending request and prevents new requests. Moderators can still act only on regular members; owners cannot be blocked or removed. Unblocking remains owner-only.

Migration already applied:
`20261110163357_validate_moderation_actions_and_block_pending_applicants.sql`.

### 4. Notification integrity
Authenticated recipients previously held table-wide UPDATE permission on `notifications`; although RLS restricted which rows, they could change their own notification titles, links, metadata, and actor identity. Users now have column-level `UPDATE(is_read)` only. Inserts from anon/authenticated roles are revoked. Recipients retain RLS-scoped SELECT and DELETE for dismissing their own notifications; service role and trigger notifications continue working.

Migration already applied:
`20261110163620_restrict_notification_updates_to_read_status.sql`.

## Application changes
- Community member management now preserves success/error feedback when lists refresh and recovers from rejected RPC calls.
- Community owners can **Block** pending applicants in the private-community review screen.
- Join-request API returns a specific error when a banned applicant cannot be approved.
- Direct-message inbox and conversation actions safely release their busy state after failures, including block/unblock, accept/ignore, and sending.
- Notifications recognise the four new event types, show useful icons, validate internal navigation using the existing safe redirect helper and recover from failed read/dismiss operations.
- Community joining, topic deletion, and community deletion recover from rejected requests and retain their existing confirmation UI.

## Read-only verification
- RPC signatures preserved and anonymous RPC execution remains disabled.
- One join-request notification trigger and one acceptance trigger exist; new notification types are permitted.
- Trigger functions are not directly executable by regular users.
- Existing notification rows were preserved; grants were checked after the restrictive migration.
- Postgres policies still ensure only community owners delete communities, regular members cannot delete an owner membership, and only notification recipients can delete their notifications.

## Important outstanding tests and constraints
- The live Supabase project does not have a disposable staging branch. We did **not** create fake community or message traffic in production, delete any real content, or modify existing membership/notification records.
- Functional two-account tests remain necessary for: private join/approval/rejection; owner blocking pending applicants and unblocking them; moderators vs owners; message introductions, acceptance, ignore, block and unblock; notification delivery and mark-read/dismiss; blocked-account history.
- Deletion audit checked RLS and UI confirmations. A determined owner can still call permitted Data API DELETE operations without the interface's confirmation dialog. A stronger server-side confirmation or recent-sign-in design for community/topic deletion would require a separately verified release. The existing account deletion is also not transactional across content cleanup and Auth user removal (documented in Stage 3).
- Live update and schema changes are recorded in the original Supabase migration ledger. All SQL in this PR is copied verbatim from the ledger. **Do not replay migrations using `supabase db push`** while the historical migration baseline is unreconciled.
- This is a **stacked draft PR**, not a production deployment. CI and UI-only preview are necessary but insufficient for multi-user functional sign-off.

## Post-migration read-only verification (10 November 2026)
- All **four** Stage 4 migrations are present in the original Supabase ledger.
- Public `communities`: 1; `community_members`: 1; `community_join_requests`: 0; `community_bans`: 0.
- `direct_conversations`: 1; `direct_messages`: 3; `notifications`: 7. No existing data was changed or deleted.
- Exactly one active community request notification trigger and one active DM-acceptance notification trigger.
- `authenticated` can SELECT notifications, DELETE own notifications under RLS and UPDATE the `is_read` column only.
- `authenticated` cannot INSERT/forge notifications or UPDATE their `title` / `recipient_id`.
- `anon` cannot execute request approvals, moderation, or DM request response functions.
- Owner-only community DELETE and recipient-only notification DELETE policies remain intact.
- Supabase advisor findings remain: 2 informational no-policy notices, 2 anonymous SECURITY DEFINER exceptions, 20 authenticated SECURITY DEFINER function notices, 1 Auth leaked-password-protection notice. These are existing findings, not new migration regressions.

All of these are schema/policy checks, **not a substitute for two-account end-to-end testing**.
