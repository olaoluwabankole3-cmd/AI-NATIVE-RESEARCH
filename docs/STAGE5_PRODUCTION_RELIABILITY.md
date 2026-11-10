# Stage 5 — Production reliability and release operations
Date: 10 November 2026
Repository: `olaoluwabankole3-cmd/AI-NATIVE-RESEARCH`
Vercel project: `ai-native-research-qfeh`
Production hostname: https://ai-native-research-qfeh.vercel.app/
Supabase project: `voinobmxpoxqlygswyui`

## Deployment protection

Vercel currently reports `ssoProtection.enabled=true` and
`ssoProtection.deploymentType=all_except_custom_domains` (Standard Protection).
Its purpose is to protect preview and generated deployment URLs while leaving
the public production domain available. The production alias and an unchanged,
READY production deployment exist.

**Protection was not disabled or broadened.** The GitHub/Vercel connections
cannot perform an independent anonymous web request here, so anonymous access
to the short production URL must be checked in an incognito browser. Do not
use a long, generated deployment URL as the public submission link.

Before launch, open the short production hostname in an incognito browser and
confirm the Converge page loads rather than Vercel Authentication. Open a
generated preview deployment URL separately and confirm that it requires
team authorization.

## Configuration audit

Production environment variables were inspected by **key and target only**,
without decrypting or printing values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CONVERGE_ADMIN_EMAILS`
- `AGENT_PROVIDER_ORDER`
- The four configured `Converge_*_Api` AI-provider credentials

These variables are scoped to Production. Stage 2–5 test branches have their
own *fake* public Supabase values and
`NEXT_PUBLIC_CONVERGE_PREVIEW_MODE=ui-only`. Do not promote a UI-only preview,
copy service-role keys into Preview or assume an arbitrary new preview branch
can use Production configuration.

Node runtime in Vercel and `package.json` is Node.js 24.x.

## Dependency integrity and security

- `@supabase/ssr`: **0.12.7**
- `@supabase/supabase-js`: **2.119.0**
- Next.js: upgraded from **16.3.8** to the patched **16.4.6**, with matching
  `eslint-config-next=16.4.6`
- Other top-level dependency versions remain exactly pinned.
- Full npm v3 `package-lock.json` committed.
- CI uses `npm ci` and checks the lock's exact top-level version mapping.
- CI rejects **critical** production dependency advisories using npm audit;
  the first Stage 5 run detected the published critical Next.js advisory,
  which motivated the patched version. Future vulnerability updates must still
  be reviewed and pinned, not silently auto-upgraded.
- Both CI and the brand-kit checkout action use reviewed immutable SHA refs.
- CI has read-only repository permissions and disables Git credential persistence.
- The temporary workflows used to generate lockfiles were removed from the
  Stage 5 branch after successful use.

## Health endpoints — no secrets or mutations

`GET /api/health`
- 200 JSON `{"status":"ok"}`
- Checks **application process liveness only**.
- No database requests, user data, identity or API key required.

`GET /api/ready`
- 200 JSON `{"status":"ready"}` when the configured Supabase Auth health
  endpoint responds successfully.
- 503 JSON `{"status":"degraded"}` when Supabase Auth cannot be reached,
  required configuration is unavailable, or this is an intentionally
  disconnected `ui-only` Preview.
- The probe uses only the public publishable key and a 3-second timeout.
  It does not read private tables, call service-role endpoints, send email
  or disclose upstream errors.
- Health and readiness paths bypass the Auth session-refresh proxy.

Neither endpoint proves all business workflows (messaging, OAuth, AI) are
healthy. They are an early warning, not a substitute for functional tests.

## Ongoing monitor

`.github/workflows/production-health.yml` schedules a read-only check at
minute 17 every six hours (UTC), plus manual dispatch. The Node script
`scripts/monitor-production.mjs` requests both endpoints from the **short
production hostname** and verifies both HTTP 200 and the expected JSON.
It deliberately fails on redirects, Vercel login pages and 503 readiness.

No API credentials, secret bypass header, user sessions or writes are used.
GitHub Actions provides the pass/fail record; configure GitHub workflow
notification preferences if you need email alerts. A schedule defined in a PR
**does not run until that workflow is present on the default branch.**

## Release checks

1. Approve and integrate dependent draft PRs (Stage 2 #8, Stage 3 #9,
   Stage 4 #10) in the correct order before Stage 5 #11. Review each PR; do
   not merge a cumulative UI-only test branch as production code.
2. Confirm the final CI job passes: `npm ci`, all unit tests, critical advisory
   check, reliability lint, Next.js build, and built-server HTTP smoke tests.
3. Verify the preview is READY with isolated config, then separately test real
   auth, communities, messages, and AI using disposable accounts.
4. Confirm Production remains connected to the intended Supabase project, that
   the production hostname is anonymously accessible, and that Preview remains
   protected. Do not change the submitted production URL.
5. Merge the reviewed code into `main`; Vercel's Git integration will build
   from `main`. Confirm a new READY production deployment at the submitted
   hostname, and verify both `/api/health` and `/api/ready` on that URL.
6. Check the scheduled health workflow after it reaches `main`. On a failure,
   inspect Vercel deployment status/runtime logs and Supabase status before
   re-deploying. Never reveal environment values in logs.
7. Roll back using Vercel's production rollback or promote the last known-good
   production build if a release introduces a regression. **No database
   migration rollback or deletion of user data** is part of Stage 5.

The GitHub integration cannot read this repository's branch-protection rules
(403 permission error). A repository administrator should verify that the
`main` branch requires PR review and the `Build / build` check before merge,
as supported by the repository's plan.

## Current release boundary

The Stage 5 branch is a **draft stacked on Stage 4**, not Production.
The current Production deployment and existing user data remain untouched.
Production monitoring of these new endpoints cannot be considered active
until the Stage 5 code and monitoring workflow are actually merged/deployed.
