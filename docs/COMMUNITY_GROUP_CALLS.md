# Community group calls (media room integration)

## Scope

Community-specific voice and video meetings in the existing Converge website. Members can start or join an ongoing call without affecting topics or messages. The same room supports multiple members, unlike the existing one-to-one peer connection. Daily's SFU/Prebuilt media room is embedded inside a responsive Converge call page and provides microphone, camera, participant grid, screen-sharing and leave controls.

## Paths and permissions

- A call card on /communities/[slug] is shown only to an approved, unbanned community member or owner.
- The status GET /api/communities/[id]/call checks the Supabase session, server-side community membership, and bans; it returns whether a group call is live and participant count without any join token. Status refreshes every 20 seconds while visible.
- POST on the same endpoint independently repeats those authorization checks, gets a server-only Daily room, and issues a **room-scoped, individually identified, two-hour token** with expiration ejection. The route never accepts a user ID or role from the browser.
- /communities/[slug]/call holds the responsive embedded video UI. Its outer Leave button destroys the iframe. Daily Prebuilt supplies its own microphone/video controls and per-person exit.
- DELETE ends the group meeting for everyone and requires a current community OWNER or MODERATOR; a normal MEMBER is forbidden. The backend rechecks that permission on each request.
- Banned, unauthenticated, non-member and pending private-applicant sessions cannot see call status or obtain new tokens. Public visibility alone does not grant access.
- Uses a deterministic, **private** room per community. User-derived URLs are not trusted: the server verifies both room privacy and the room URL's permitted HTTPS origin and path before issuing a token.
- No new Supabase tables or policies and no changes to existing one-to-one calling, marketing pages or sign-in.

## Configuration required before real calls

Create a Daily developer account and its API key at https://dashboard.daily.co/ . Set **DAILY_API_KEY** as a secret, server-only environment variable in the **correct Vercel Converge project** (production and preview, as applicable). Never add it to GitHub, public environment variables, or a browser.

Then redeploy the same commit and test with at least three approved accounts across mobile and desktop. This branch ships a deliberately disabled state when the key is absent rather than a fake working call button.

The provider's public API is https://docs.daily.co/reference/rest-api . Daily is a separate managed paid/usage-limited service; review its current quotas and pricing before inviting many participants. Unlike the app's one-to-one Cloudflare TURN relay, managed group media uses a dedicated SFU.

## Security and release requirements

1. Test member/owner/moderator access, banned users, nonmembers, sign-out, private join-pending users, and identity sharing. API keys must remain server-only.
2. Test simultaneous starts: second concurrent room creation recovers by loading the already-created room. Test moderator End for everyone and normal member Leave behavior.
3. Check embedded camera/mic permissions on Android Chrome, iPhone Safari and desktop; test Wi-Fi/mobile network, 3+ participants, audio echo and screen sharing.
4. **Token expiry:** members are ejected after two hours and must rejoin to refresh eligibility. This limits stale invite credentials, but an already-admitted banned member is **not automatically ejected** between checks. A production-grade immediate-ban enforcement flow needs provider participant ejection/webhook.
5. The joining member can share their two-hour access URL if copied from the browser inspector, so validate unique IDs, token controls, provider session admission, and abuse monitoring before launch. Do not copy or log these URLs.
6. Daily Prebuilt is an embedded provider UI and is not yet a pixel-perfect custom Converge participant-grid design. This is the functional SFU phase, not the final custom call visual system.
7. On production, leave the feature disabled until a provider key is provisioned, capacity/cost controls are reviewed and real authenticated multi-device testing passes.

## Reference
- https://docs.daily.co/reference/rest-api/rooms/create-room
- https://docs.daily.co/reference/rest-api/rooms/get-room-presence
- https://docs.daily.co/reference/rest-api/meeting-tokens/create-meeting-token
- https://docs.daily.co/guides/products/prebuilt/customizing-daily-prebuilt
