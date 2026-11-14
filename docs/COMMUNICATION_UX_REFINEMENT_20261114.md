# Converge communication experience · UX refinement 1

Date: 14 November 2026

## Scope
A focused code-backed improvement across Messages inbox, conversation detail, and the audio/video call screen. This is not a full-site redesign. It retains the current Converge dark-green/mint design system, responsive layout and production URL, and does **not** alter Supabase RLS, messaging data, WebRTC signaling, camera/mic permissions or call history.

### Messages inbox
- Search now has a clear button, consistent iconography and visible focus state.
- Inbox displays grounded conversation/request counts, with a manual refresh action.
- Live INSERT events in `direct_messages` and conversation changes silently refresh the inbox instead of flashing full skeletons.
- Existing private-message request moderation and navigation remain in place.

### Conversation detail
- Video and voice buttons now use consistent, accessible icons.
- Profile and block/unblock actions are grouped in a native, keyboard-accessible conversation options disclosure instead of crowding the header.
- Composer offers visible character count and distinct success vs failure feedback; unsuccessful inserts retain the user's draft.
- Physical keyboards can use Enter to send and Shift+Enter for newline; touch layouts preserve the normal keyboard return behavior.
- A failed send in an otherwise valid empty conversation no longer hides the composer behind a "conversation unavailable" page.
- A successful insert is never reported as failed just because the subsequent refresh throws.

### Voice and video call
- Video uses a roomier, responsive presentation with a clearer local camera preview.
- End-call, microphone and camera controls stay visible.
- TURN diagnostics move to an expandable `Connection details` disclosure, without disabling the existing independent relay probe.

## Further UI/UX work
1. Structured visual QA across 320px/375px mobile, tablet and desktop with real user accounts, including safe-area/keyboard checks.
2. Main navigation & onboarding audit (new-user first sessions, research/community discovery and mobile destination grouping).
3. Research room hierarchy and evidence presentation, collaborative activity states, and responsive document viewing.
4. Notifications, loading/error and empty-state consistency, plus accessibility review.
5. Full-screen call experience polish and connection recovery after TURN verification.

## Verification
Code-level regression tests and Next.js build/smoke checks must pass. Browser-authenticated UX testing remains necessary because static code review cannot prove visual polish across actual devices.
