# Converge community group calls — Cloudflare RealtimeKit

This PR replaces the Daily group-call draft with Cloudflare RealtimeKit, using the same Cloudflare ecosystem as the existing 1:1 TURN implementation. TURN alone cannot provide scalable community conferences; group video is served by RealtimeKit and its SFU.

## Member journey

- Approved, unbanned members see a call card on their community page.
- GET /api/communities/[id]/call checks identity, membership and ban status before returning active-session state and participant counts. No token is returned.
- POST independently verifies identity, membership and ban status; it creates or reuses a server-only mapped Cloudflare meeting and obtains a participant token restricted to that meeting.
- /communities/[slug]/call uses Cloudflare RealtimeKit web components for responsive voice/video meeting controls, off until the participant enables them.
- Owners and moderators can DELETE the active session: Cloudflare kick-all, mark meeting INACTIVE to reject old tokens, clear mapping. Ordinary members leave individually.

## Setup before real calls

Create a RealtimeKit app in the existing Cloudflare account at https://dash.cloudflare.com/ under Realtime. Create a meeting preset for participants allowing microphones and cameras but not starting recordings, transcription, or livestreams. Cloudflare account API tokens with Realtime / Realtime Admin permissions are different from the existing TURN key credentials. DO NOT replace the latter.

Add the following server-only environment variables to the intended Vercel project Preview first:
- CLOUDFLARE_REALTIMEKIT_ACCOUNT_ID: Cloudflare account ID
- CLOUDFLARE_REALTIMEKIT_APP_ID: RealtimeKit app ID
- CLOUDFLARE_REALTIMEKIT_API_TOKEN: encrypted API token with Realtime permission
- CLOUDFLARE_REALTIMEKIT_PRESET: meeting participant preset name

These four fields are absent until configured. No secrets are committed in this PR. Production should remain unconfigured pending device tests and cost review.

## Supabase schema

New migration: supabase/migrations/20261121120000_community_realtimekit_call_mapping.sql.
This adds a service-only community-to-Cloudflare-meeting mapping (community_id, meeting_id and timestamps). Browser roles have zero grants and RLS is on. Do not run a blanket database push or replay migrations; review and apply only the new intended migration once to the target environment. This PR does not change the live database.

## Cost controls and caveats

- Initially at most 10 participants and 30 minutes per call. Status polls and joins trigger kick-all on an expired live session.
- Participant auth tokens expire after 35 minutes, but Cloudflare explicitly says token expiry does not itself eject existing live participants.
- All automatic recording, transcription, summarization and livestream options are off when creating meetings. The Cloudflare member preset must also disallow optional recording-related controls.
- Presence is polled every 20 seconds. Browser background throttling, abandoned sessions, or provider failure can bypass the best-effort expiry enforcement. This is NOT an account-level billing cap. Add backend scheduled enforcement and Cloudflare spend monitoring before public rollout.
- An already-connected member banned during the call is not automatically kicked out yet. A provider-side participant ejection path must be added before private communities require instant revocation.
- Joining around the participant cap is susceptible to small races; count enforcement is best effort.
- Cloudflare includes a monthly participant-minute allowance; excess usage may be billed.
- The preview uses Cloudflare's documented CDN web component integration pinned to Core 2.0.4 and UI 2.0.3. Before production, bundle audited packages in the lockfile and restrict CSP/SRI.

## Release checks

1. GitHub CI + Next build.
2. Deploy isolated preview after supplying the Supabase preview variables and new mapping migration.
3. Connect Cloudflare RealtimeKit app/preset and encrypted API token (do not reuse the TURN key).
4. Test 3+ real accounts across mobile and desktop; verify permission blocking, media, moderator end and the time cap.
5. Add ban ejection and robust provider-side usage enforcement, then approve a production merge.

Official docs: https://developers.cloudflare.com/realtime/realtimekit/quickstart/ and https://developers.cloudflare.com/realtime/realtimekit/platform/pricing/ .
