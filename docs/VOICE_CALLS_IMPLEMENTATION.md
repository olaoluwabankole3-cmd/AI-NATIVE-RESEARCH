# Converge Voice — 1:1 internet calling

Date: 10 November 2026. Status: review branch only — not released and SQL not applied.

## What we are building

WhatsApp-style voice calling **between Converge members** (internet calls, not carrier or phone-number calls). The first implementation includes a Voice Call control in accepted direct conversations, a Calls history page, incoming Answer/Decline card on all pages, microphone consent, mute, end, connection status, and missed-call history. It reuses Converge's existing visual branding, profiles, message permissions and blocking.

## Architecture

- Browser WebRTC RTCPeerConnection transports audio using encrypted DTLS-SRTP; no server-side audio recording. The browser asks explicitly for microphone permission.
- Supabase table public.voice_calls stores participants, current call state, call history, and temporary WebRTC offer/answer SDP. Row-level security lets **only the two participants** read a call. Authenticated, role-checking RPCs perform all writes. On termination SDP is cleared.
- Supabase Postgres Changes notifies the caller and callee while their Converge tabs are open. An 8-second poll backs up incoming notifications; the active screen polls more frequently. No offline mobile push or native lock-screen ringing yet.
- A server-only ICE endpoint at /api/calls/ice checks authenticated participation and generates temporary coturn credentials from TURN_SHARED_SECRET. Without TURN, carrier/mobile NAT and restrictive network calls can fail.
- A call requires an accepted message conversation; blocks in either direction forbid calling and end any existing call. Call attempts are serialized, rings expire, and stale calls are cleaned up.

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
