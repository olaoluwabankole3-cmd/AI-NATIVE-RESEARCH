# Converge Stage 1 — migration and production baseline (2026-11-10)

This is a **read-only audit record** of the existing production Supabase project `voinobmxpoxqlygswyui` and Vercel project `ai-native-research-qfeh`. No data backup, reset, migration replay, re-deployment, or production URL change is authorized by this document.

## Database restore and integrity
- The original Supabase project was restored from `INACTIVE` to `ACTIVE_HEALTHY`.
- PostgreSQL 17.11 responded to read-only SQL; 25 application tables had RLS enabled; four Auth users, five Auth identities, and two Storage buckets were observed. These are **observed counts**, not a complete end-to-end validation or backup.
- The original Supabase hostname and Vercel production URL were preserved.

## Migration history drift — do not run db push until reconciled
The remote `supabase_migrations.schema_migrations` ledger records **nine migrations**, including two new security migrations dated 2026-11-10. The repository originally had **20 SQL files** in `supabase/migrations/`; only five older filenames represented the same named changes as ledger entries, but **even those five differed in content and recorded version**. Another two ledger entries were missing from GitHub entirely. Earlier repository scripts are not recorded in this remote ledger and may have been applied outside the migration workflow.

For auditability, **seven original applied migrations** have now been recovered as new files matching the ledger's exact `<version>_<name>.sql`, taken from `schema_migrations.statements`. Their existing, differently named or differing repository counterparts are intentionally preserved. Two recently applied security migration files also match the ledger.

Recovered original migration versions:
- `20261028184719_community_privacy_join_requests_and_owned_agents.sql`
- `20261028184849_community_access_review_rpc_and_legacy_activity_privacy.sql`
- `20261028185924_community_topic_owner_and_creator_policy_hardening.sql`
- `20261028190327_community_access_integrity_hardening.sql`
- `20261029122046_account_and_content_deletion.sql`
- `20261029123757_community_moderation_and_message_requests.sql`
- `20261029124214_preserve_message_requests_when_blocking.sql`

Existing legacy paths with differing applied SQL:
- `supabase/migrations/20261028_community_privacy_join_requests_and_owned_agents.sql` — differs from ledger version `20261028184719`
- `supabase/migrations/20261028_community_topic_owner_and_creator_policy_hardening.sql` — differs from ledger version `20261028185924`
- `supabase/migrations/20261029_account_and_content_deletion.sql` — differs from ledger version `20261029122046`
- `supabase/migrations/20261029134000_community_moderation_and_message_requests.sql` — differs from ledger version `20261029123757`
- `supabase/migrations/20261029134100_preserve_message_requests_when_blocking.sql` — differs from ledger version `20261029124214`

**Safety gate:** Do **not** execute `supabase db push`, `supabase db reset`, or manually apply the repository migration folder against production. Before enabling automated migrations, create and test a reproducible baseline on a separate, disposable local database or isolated environment, then reconcile/rename legacy scripts and migration tracking in a reviewed, versioned change. Never mark a migration applied merely because a table exists; verify its exact effects first. Do not create a replacement production database.

## Security posture
- First security migration: `20261110143258_restrict_anonymous_mutation_rpcs.sql`, revoked anon EXECUTE for 13 signed-in mutation functions without removing authenticated/service_role access.
- Second migration: `20261110144258_restrict_anonymous_helpers_and_trigger_functions.sql`, revoked direct anon/authenticated execution of nine trigger functions and anon execution of four helpers used only by authenticated workflows. Their trigger definitions remain installed.
- Security-advisor anonymous security-definer warnings decreased **28 → 2**.
- Two remaining public-executable functions are intentional exceptions pending user-flow validation:
  - `public.get_profile_social_summary(uuid)` supports public user profiles with function-level privacy checks.
  - `public.is_organization_admin(uuid)` occurs in an `anon, authenticated` organisation-member SELECT policy.
- Signed-in security-definer warnings remain: 20. These functions include authenticated RPCs and RLS helpers. Do not blanket-revoke signed-in access.
- `agent_registry` and `community_agent_prompts` have RLS without client policies, and neither has direct anon/authenticated SELECT grants. Keep server-only access unless a separate API design review justifies otherwise.
- Supabase Auth leaked-password protection is not enabled; confirm plan eligibility and configure through Auth settings if available. No Auth setting was changed.

## Vercel production
- Production project ID: `prj_FZcd4coNtnvGd68zdp1pATJVBktM`.
- Production URL: https://ai-native-research-qfeh.vercel.app/ (unchanged).
- Last confirmed READY production deployment: `dpl_4XAGGqE3RGrzzq3NB6vuj4Hk6tNy`, from `main` commit `a61ba1dc61a46dab05237f439dd52328bfca278d`.
- Nine named Production environment variables are present; the Supabase public URL points to the original project. Their presence does not prove runtime Auth flows.
- Vercel SSO protection is enabled for `all_except_custom_domains`; externally accessible public-site behavior remains unverified.
- Preview builds from the security branch failed during Next.js prerender of `/communities` because the **Preview** environment has no Supabase URL and publishable key. **Do not put production service-role or provider credentials into Preview** as a workaround. Provide a deliberate preview configuration or separate, safe build-time design.
- Vercel project settings specify Node 24.x while `package.json` specifies `>=22.0.0`, causing Vercel preview builds to select 26.x. Pin and test Node consistently in a separate infrastructure PR.
- No production deployment, domain, project or repository default branch was replaced.

## Remaining gates before declaring production fully stable
1. Reconcile old migration files and establish a verified baseline without replaying SQL on production.
2. Inspect unauthenticated user experience under Vercel protection; determine whether public access is intended.
3. Verify Auth email/Google OAuth, callback URLs, and reset/recovery from an actual browser session with test accounts.
4. Validate RLS authorization with negative-permission tests using disposable accounts; verify triggers after ACL hardening.
5. Resolve Preview build config safely and pin production Node/dependency versions after a build test.
