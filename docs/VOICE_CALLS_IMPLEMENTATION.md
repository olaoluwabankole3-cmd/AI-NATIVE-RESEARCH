# Converge Voice — 1:1 internet calling

Date: 10 November 2026. Integrated into main for testing on 11 November 2026 behind an **off-by-default** `NEXT_PUBLIC_CONVERGE_CALLS_ENABLED` feature flag. SQL migration has **not** been applied; production calling is not enabled.

## What we are building

WhatsApp-style voice calling **between Converge members** (internet calls, not carrier or phone-number calls). The first implementation includes a Voice Call control in accepted direct conversations, a Calls history page, incoming Answer/Decline card on all pages, microphone consent, mute, end, connection status, and missed-call history. It reuses Converge's existing visual branding, profiles, message permissions and blocking.

## Architecture

- Browser WebRTC RTCPeerConnection transports audio using encrypted DTLS-SRTP; no server-side audio recording. The browser asks explicitly for microphone permission.
- Supabase table public.voice_calls stores participants, current call state, call history, and temporary WebRTC offer/answer SDP. Row-level security lets **only the two participants** read a call. Authenticated, role-checking RPCs perform all writes. On termination SDP is cleared.
- Supabase Postgres Changes notifies the caller and callee while their Converge tabs are open. An 8-second poll backs up incoming notifications; the active screen polls more frequently. No offline mobile push or native lock-screen ringing yet.
- A server-only ICE endpoint at /api/calls/ice checks authenticated participation and generates temporary coturn credentials from TURN_SHARED_SECRET. Without TURN, carrier/mobile NAT and restrictive network calls can fail.
- A call requires an accepted message conversation; blocks in either direction forbid calling and end any existing call. Call attempts are serialized, rings expire, and stale calls are cleaned up.

## Integration and disabled-by-default release gate

The `voice_calls` table is currently absent from the connected Supabase project. Call code is included in Converge. The Calls destination and setup screen remain visible even while `NEXT_PUBLIC_CONVERGE_CALLS_ENABLED` is unset; actual call initiation, incoming-call listeners and history queries are not mounted, and `/api/calls/ice` returns HTTP 503 without database queries.

Do not enable voice calls until the migration is verified in a disposable test database with adversarial RLS checks and the TURN relay and real-device testing are complete. Enabling requires a deployment. No production data or migrations were changed by merging this code.

## Database status — DO NOT apply blindly

The new file supabase/migrations/20261110204800_one_to_one_voice_calls.sql has **not been applied** to production. Do not reset Supabase, replay earlier migrations, or run a blanket db push. First test it in an isolated database with disposable users and inspect RLS grants, function privileges, publication, and advisor warnings.

## TURN relay required for reliable calls

Host self-managed coturn on a VPS/VM with a public IP, TLS certificate and controlled UDP relay port range, outside Vercel's serverless HTTP functions. Configure use-auth-secret and a static-auth-secret matching the server environment; enable firewalls, quotas, rate limits, IP abuse restrictions, relay bandwidth monitoring and secret rotation.

Example **server-only** Vercel Production environment keys (never use NEXT_PUBLIC_ for the secret):
- TURN_URLS: turn:turn.example.org:3478?transport=udp,turns:turn.example.org:5349?transport=tcp
- TURN_SHARED_SECRET: private shared key configured on coturn
- STUN_URLS: stun:turn.example.org:3478 (optional)

Do not use these illustrative values as a functioning relay. TURN server, DNS and credentials still need to be provisioned.

## Safety and privacy boundaries

Audio is encrypted in transit by WebRTC. This is **not the same as WhatsApp's audited end-to-end identity/key verification architecture**. SDP temporarily stored in Supabase may include IP/network candidate information, readable by the two call participants and database administrators. No recording feature is included. Avoid logging SDP or TURN credentials.

The preview is interface-only. Calls require an open browser tab, and a call currently cannot be seamlessly rejoined after a page refresh. No video, group calling, platform push/ringtone guarantee, PSTN calls or screen sharing yet.

## Release gates

1. Verify new schema in a **disposable Supabase test project** and test with two authorized accounts plus an unrelated third user.
2. Check caller/callee RLS, request acceptance, blocking before and during a call, simultaneous calls, expiry, leave/hangup, and database notification delivery.
3. Configure and test coturn across Wi-Fi, LTE/5G, carrier NATs and desktop browsers. Inspect bandwidth costs and abuse protections.
4. Test iOS Safari, Android Chrome and desktop microphone permissions, background alerts, output playback, mute and failure states.
5. Run automated regression tests, Next/TypeScript build and Vercel protected Preview.
6. After functional signoff, apply the new migration *once*, configure TURN privately, and release to Converge's existing production URL.

Next phase: ICE restart/reconnection, notification push, call quality metrics, then video and group calls using an SFU rather than large full-mesh calls.

References: Supabase Realtime Postgres Changes and WebRTC API docs.

## Visible setup state (13 November 2026)

The Calls shortcut is accessible from Messages and the desktop/mobile More menu, including when the feature is disabled. Accepted conversations display a call setup shortcut. This is **navigation only**, not a working call: backend migration/RLS testing, TURN relay setup and device testing must pass before enabling `NEXT_PUBLIC_CONVERGE_CALLS_ENABLED` in production. No production database changes were made for this UI visibility update.

## Video calling addition (13 November 2026)

Video calls reuse the same existing WebRTC signaling and access-controlled `voice_calls` table. The new `call_type` column defaults to `audio` so every previous voice call remains unchanged. `start_video_call(uuid)` delegates to the existing verified `start_voice_call(uuid)` to preserve message-acceptance, blocking, rate-limit and concurrent-call checks. When a video call is accepted, each browser requests camera and microphone permission, then exchanges audio and video tracks via WebRTC. The in-call UI offers mute, camera off/on, and camera flip. Browser media is not recorded or uploaded by Converge. Testing requires two signed-in accounts, camera permissions, and a reachable network path. TURN relay is still unconfigured, so direct calls can fail on restrictive mobile networks. Production release requires successful CI, migration verification and browser smoke; real two-device video remains a user-validation step.

## Managed Cloudflare TURN integration (13 November 2026)

Converge now supports **Cloudflare Realtime TURN** via the same active-call participant-authenticated `GET /api/calls/ice?callId=...` endpoint that audio and video already use. The endpoint calls Cloudflare server-to-server for expiring TURN credentials (four-hour TTL), validates returned STUN/TURN URLs and returns ICE servers to the authenticated call participant. It does **not** expose the long-lived Cloudflare API token. Direct STUN calls and legacy self-hosted coturn are preserved as fallback when managed TURN is not configured or its API is unavailable.

**Manual Cloudflare setup required (not provisioned by GitHub/Vercel integration):**
1. In your Cloudflare account, create a **Realtime TURN key** under Realtime > TURN. Review pricing and account billing controls (Cloudflare documents a free 1,000 GB tier and usage-based egress beyond it).
2. In **Vercel > Converge project > Settings > Environment Variables > Production**, set two *server-only* encrypted variables:
   - `CLOUDFLARE_TURN_KEY_ID`: the TURN key ID (not the account ID).
   - `CLOUDFLARE_TURN_API_TOKEN`: the TURN key's long-lived secret for generating temporary credentials (not a browser/public environment variable).
3. Trigger a new Vercel production deployment so the runtime picks up those keys.
4. Test calls from **different networks** (Wi-Fi ⇄ 4G/5G), verifying both audio and video, and run a controlled relay-only WebRTC diagnostic in the browser to confirm a relay candidate is allocated. The fact the endpoint returns `turnConfigured: true` alone does not prove media actually traverses TURN.
5. Monitor Cloudflare TURN egress and rate limits, revoke/rotate the key if exposed. Remember that participant-authenticated calls can still consume bandwidth.

Official API: `POST https://rtc.live.cloudflare.com/v1/turn/keys/<key-id>/credentials/generate-ice-servers` with `Authorization: Bearer <secret>` and `{"ttl":14400}`. Source: https://developers.cloudflare.com/realtime/turn/generate-credentials/.

**Status:** Application-side integration is complete. Managed relay cannot become active until the Cloudflare TURN key and API token are created and added to Vercel. Do not paste secrets into GitHub issues, frontend code or chat messages. Calls continue to work directly before provisioning.


## TURN verification after Vercel secrets are configured (14 November 2026)

The Calls room now offers **Test TURN relay** after a call connects. It uses the already-authenticated, call-scoped ICE response and creates a temporary **separate** RTCPeerConnection with `iceTransportPolicy: "relay"` and an empty data channel. It never changes the existing audio/video peer, requests additional camera permission, logs IP addresses, or exposes the Cloudflare API token. When the browser gathers a relay candidate, the UI reports **TURN relay candidate allocated**. This verifies the browser could allocate a TURN path, not that the ongoing call necessarily routed through it (a direct connection is preferable when available). If allocation fails, check Vercel Production variables, Cloudflare credential validity and network restrictions.

Test during a live call between two accepted-conversation members, from Wi-Fi and mobile data, and observe voice and video quality. A four-hour TURN credential may expire on unusually long calls; reconnection and automatic ICE restart remain future work.
