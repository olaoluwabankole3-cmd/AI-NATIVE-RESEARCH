# Stage 3 — Authentication and account-management audit
Date: 2026-11-10
Base: Stage 2 release-candidate branch (draft PR #8)
Scope: email registration, Google OAuth, session refresh, password recovery, OAuth callback, profile settings, account deletion.

## Findings and code changes

### Email registration
- Password minimum was **6 characters** for new accounts but **8 characters** on password recovery. Now registration consistently requires **8 characters**, with matching client validation.
- Registration now handles thrown network errors and resets loading state; generic confirmation text does not unnecessarily confirm whether an email exists.
- Sign-in and sign-up links preserve canonical `redirect` and historical `next` destinations after safe same-origin normalization.
- No user account or existing password was changed.

### Email/password sign-in and Google OAuth
- Sign-in now checks for a returned user **and** session rather than interpreting any error-free response as complete authentication.
- Sign-in/sign-up Google requests now handle unexpected network failures rather than leaving indefinite loading buttons.
- The user previously confirmed that Google and email login worked. These changes have not been exercised with live credentials in a sandbox.

### Session refresh
- Existing SSR `@supabase/ssr` server and browser clients share auth cookies, and Next proxy invokes `auth.getClaims()` to refresh sessions.
- Proxy now tolerates a thrown transient Auth refresh failure so **public pages** remain reachable. Protected server API routes must still use `auth.getUser()` and reject missing/expired sessions. The implementation does not grant auth privileges on error.
- Session-expiry, cross-tab sign-out, and refresh-token rotation still require a real authenticated browser test.

### Password recovery and callbacks
- Prior Stage 2 branch added `resetPasswordForEmail`, a PKCE `exchangeCodeForSession` callback, and `updateUser({ password })`.
- Callback now handles rejected provider requests even when a `code` field is present, returns a safe redirect after a thrown exchange error, and applies `Cache-Control: private, no-store` to redirects.
- Recovery now distinguishes password-update failure from sign-out failure, with a visible warning when the new password was saved but local logout could not complete.
- Auth redirect URL allowlist, recovery email delivery, expired links, and cross-device confirmation remain live-test requirements.
- A logged-in user can also use the reset screen to update **their own** password. This is not cross-account access, but a stronger recovery-only UI gate could be added later if product policy requires it.

### OAuth consent
- Existing consent uses Supabase `getAuthorizationDetails`, `approveAuthorization`, `denyAuthorization`, and the trusted redirect URL from the Auth response.
- Network failures now display a usable retry error rather than keeping the consent screen indefinitely busy.
- Approve, deny, expired authorization, and return-to-client still require a valid OAuth client integration.

### Profile and account management
- Profile loading, avatar upload and profile save now recover from thrown requests and clear busy state. Profile writes continue through the authenticated Supabase client.
- The permanent account-deletion endpoint now verifies **same-origin** requests and requires a Supabase Auth `last_sign_in_at` within 15 minutes. Refresh-token rotation does not reset this login timestamp. Settings informs users they must sign out/in to proceed.
- The deletion preparation RPC is restricted to service_role. The endpoint already confirms DELETE plus an exact account email and the authenticated user identity.

## Open, high-priority deletion consistency issue (not silently changed)
`POST/DELETE /api/account/delete` performs a privileged `prepare_account_deletion` RPC and only then `auth.admin.deleteUser` via a separate API call. These are **two separate transactions**; if the Auth deletion fails, the user's owned communities/topics/agents may already have been removed. The server warns about partial cleanup but cannot roll back. Changing this safely requires a transaction/failure-recovery design and a disposable full-stack database test. Do **not** force automatic retries against real user content.

## What can be verified without accounts
- Auth destination and recent-login pure unit tests, including invalid and future timestamps
- Built Next.js HTTP tests for public login, sign-up, recovery pages, callback error/redirect paths and no-store headers
- Unauthenticated protected API denials and malicious-origin account-deletion attempt (403)
- Production build and TypeScript checks
- Existing Supabase project health and database advisor notices (read-only)

## Functional acceptance still required
1. Email signup -> confirmation email -> PKCE callback -> profile created once -> intended destination.
2. Google signup/sign-in -> return path -> session cookie -> refresh and browser restart -> logout across tabs.
3. Invalid password and disconnected-network handling, including no indefinite loading.
4. Password recovery email, expired token, valid update, sign-out outcome, fresh login.
5. External workspace OAuth consent approve/deny and invalid/expired authorization.
6. Profile save, avatar upload and permissions with a disposable user.
7. Fresh sign-in <15 minutes before deletion; old session 403; malicious origin 403; simulated Auth deletion failure with no data loss in an isolated backend.

## Release boundaries
- This is a **stacked PR targeting Stage 2 PR #8's branch**, not production `main`.
- It must not be merged before the Stage 2 base is reviewed and relevant live tests pass.
- Existing production URL, user records, and content are unchanged by this branch.
- Do not run `supabase db push` or replay historic migrations because the original migration baseline remains unreconciled.
