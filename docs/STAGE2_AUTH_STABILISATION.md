# Stage 2: Authentication and account stabilisation

This is a reviewable code change on a non-production branch of the existing Converge app.

## Improvements
- Accept both redirect (canonical) and next (legacy in protected Converge pages) after sign-in and sign-up; reject external redirect targets.
- Add a Forgot password link and recovery-request page.
- Recovery email uses Supabase Auth resetPasswordForEmail, returning through the existing PKCE server callback to reset-password.
- New password form verifies an authenticated recovery session, confirms matching passwords, enforces at least 8 characters, and requests a fresh sign-in afterward.
- Generic password-reset confirmation avoids revealing whether an email exists.
- Automated safe-return-path tests run in GitHub Actions.

## Requirements before end-to-end testing
1. Verify Supabase Auth URL Configuration permits https://ai-native-research-qfeh.vercel.app/auth/callback?next=/reset-password.
2. Verify the email provider can deliver reset emails. Do not reuse a real user's password; use disposable test accounts.
3. Test Google sign-in, email sign-in, password reset, expired links, and post-login returns in the browser.
4. Existing Preview environment has no Supabase public variables and preview builds fail. Do not copy production service-role or AI-provider secrets into Preview.
5. No account data or database migrations were changed. This PR should stay unmerged until end-to-end smoke checks are possible.
