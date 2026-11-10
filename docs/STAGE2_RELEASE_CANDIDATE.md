# Stage 2 — Release-candidate validation (10 November 2026)

This clean branch combines the application changes from draft PRs #4, #5 and #6 with the Node 24 upgrade. **Unlike the UI-only test PR #7, this is designed to become production code after release validation.**

## Changes
- Preserve intended destinations for sign-up/sign-in links, including legacy `next` URLs; reject off-site redirects.
- Add `/forgot-password` and `/reset-password` through Supabase Auth and the existing server-side PKCE callback.
- Report a failed sign-out rather than claiming the user was signed out.
- Send private community requests with the authenticated user's RLS permissions instead of service-role writes.
- Check community bans in privileged server-side permission helpers before topic replies, AI agent runs and research synthesis.
- Fail closed if the message block-relationship lookup fails.
- Pin Node 24 and add automated CI regression and built-server HTTP smoke checks.
- Include a conditional UI-only banner. This is displayed only if `NEXT_PUBLIC_CONVERGE_PREVIEW_MODE=ui-only`, a **branch-specific** preview setting that is not configured for production.

## Automated testing
- Eleven unit regression cases for post-login destinations and community authorization.
- Next.js production build with TypeScript validation.
- Six rendered page checks, three callback redirect/error scenarios and seven unauthenticated API denial cases in the HTTP smoke test.
- No privileged Supabase or third-party AI keys used by the test runner.

## Live Supabase changes already applied
The original Supabase database currently includes:
- `20261110143258_restrict_anonymous_mutation_rpcs`
- `20261110144258_restrict_anonymous_helpers_and_trigger_functions`
- `20261110151451_deduplicate_auth_user_profile_trigger`
- `20261110153051_restrict_users_blocked_to_request_participants`

Those migrations are **already applied** and stored in the Supabase ledger. They are NOT copied into this release candidate, so there is no need to replay SQL for this application-only change. Draft PRs #2, #4 and #6 retain reproducible migration source.

**Do not run `supabase db push`, a blanket schema reset, or replay old migrations without reconciling early project history.** Several historic repository migration files are absent from the live migration ledger.

## Still needed for fully verified launch
- User reports email and Google sign-in worked previously. Verify post-login return destinations after this code changes.
- Verify password reset delivery, allowed redirect URLs, successful/expired links with a disposable inbox.
- Verify private-community approval/rejection/ban and direct-message request/ignore/block with two test identities.
- Verify fresh AI responses and saved research artifacts using a test research topic.
- Confirm production is reachable without unintended deployment protection and preserve the submitted project URL.

No production data was modified by this release-candidate GitHub branch. A passing CI smoke test cannot substitute for live multi-account functional testing.

## Verified live database assertions (read-only, 10 November 2026)

13 non-destructive checks returned the expected results:
- One active, full-metadata user-profile creation trigger; the legacy duplicate is absent.
- All 4 existing auth users retain profiles (4/4); no account data was changed by this check.
- Community join-request RLS is enabled and its INSERT policy checks community bans.
- Direct-message INSERT policy checks blocked relationships.
- Authenticated members may execute the `users_blocked` RPC, but anonymous users may not.
- The `users_blocked` function checks that `auth.uid()` is part of the pair; an unauthenticated synthetic-ID call returns false.
- All four relevant already-applied Supabase migrations remain recorded in the ledger.

Current security advisor findings remain the same as in Stage 1: 2 anonymous-executable helper notices (documented exceptions), 20 authenticated-executable definer notices, 2 informational RLS/no-policy notices for service-only tables, and the Auth leaked-password-protection warning. No new advisory findings were introduced by the recent changes.

The separate UI-only integration PR #7 previously passed the same 11 unit cases and built-server HTTP smoke tests. This clean candidate reruns those same checks on its own commit.
