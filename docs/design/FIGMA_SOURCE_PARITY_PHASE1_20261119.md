# Original Converge Figma → existing code: Phase 1 handoff

Date: 19 November 2026  
Source: user-supplied `converge-original-figma-design-handoff.zip`, format `Converge-Figma-Exact-Handoff-v1`.  
Source Figma: `mGiLAVkIWNeXrkVJ0oDN5G` (original approval draft).  

## Reference, not inspiration

The user explicitly wants the **existing approved Figma designs faithfully implemented in the live Converge Next.js application**, not another design idea. The export includes 28 original designs (10 desktop and 18 mobile, 1440×900 and 390×844) plus 16 later-imported designs. **Only the original 28 are authoritative for this batch**. An export screenshot is a visual target, never an image to render as the UI; sample people/topics/agents in Figma are placeholders and must not overwrite live Supabase data.

The Figma MCP connection is rate-limited on the connected Starter account. Design inputs were therefore measured against the user's supplied export's source-layer JSON, tokens and PNGs. No Figma access or screenshot of the actual deployed app was possible via the Figma connector for this stage.

## Implemented in this PR (first batch)

| Screen | Figma reference | Code route | Status / verification boundary |
| --- | --- | --- | --- |
| Mobile 01 / Research hub | Original 390×844 | `/communities` | Mobile title/search, 32px membership tabs, 80px community rows, compact topic cards. All/Joined/Explore backed by actual `community_members`. |
| Desktop 01 / Research | Original 1440×900 | `/communities` | Three-zone layout (82px existing app rail + 368px research navigator + center research + 300px inspector) using real topics and actions. |
| Mobile 03 / Messages inbox | Original 390×844 | `/messages` | 27px heading, compact New CTA, 46px search, functional All/Requests tabs, 82px live message rows, privacy explainer. Existing send/approval/notifications unchanged. |
| Mobile 06 / AI specialists | Original 390×844 | `/agents` | 26px heading, 46px search, All agents/Research/Review expertise categories; cards from live registry with selectable detail. |
| Mobile 09 / Settings & account safety | Original 390×844 | `/settings` | 82px focused header, four task links, planned controls clearly identified, destructive actions never triggered without deliberate confirmation. |
| Mobile 15 / Edit profile & visibility | Original 390×844 | `/profile` | 82px focused header, avatar, core controlled fields, Public/Members/Private choice, 45px Save CTA. Four optional user fields remain accessible in expanded details. |

### Shared visual foundations in the first batch

New `app/figma-parity.css` is imported after the legacy styles and opts in **only** when a page has `converge-figma`. It uses exact source-token colors (BG `#0b1110`, nav `#0e1914`, panel `#14231b`, raised `#1a2a22`, mint `#a6e6bd`, muted `#9cb3a4`, border `#294334`). Shared SiteHeader dock has 48×35px icon fields and retains existing routes/account/notification behavior. The style scope isolates Phase 1 from unported screens.

### Functionality preserved

Authentication, direct message requests, text send, voice/video calls, WebRTC/TURN, privacy visibility, profile/avatar saving, community creation, topic navigation, community membership checks, agent profiles and account deletion confirmations. No database migration or production data rewrite.

## Not yet ported

Remaining original Figma frames: 10 desktop + 18 mobile designs, of which 6 specific frames are covered at least partially above; the remaining original mobile and desktop flows include Community Detail, Topic Discussion, AI profile & topic invite, Message Thread, Profile Public View, member moderation, organization, notifications and advanced research evidence. **No claim that 28 screens are implemented.** On wide screens only the original Research hub has a full three-zone desktop parity pass; the other four pages remain existing desktop structures with Figma-mobile styling.

## Pixel accuracy / review requirements

**This PR is not yet certified pixel-perfect.** Passing static tests, TypeScript and Next.js compilation is necessary but insufficient. It needs render-based comparison to the supplied reference PNGs, on `390×844` mobile and `1440×900` desktop, with authenticated real accounts and representative data, plus a check at 320, 360, 430, 768 and 1024 CSS px. Account for Figma reference's simulated system status bar (24px, not actual DOM). Test mobile keyboard, the sticky dock, sidebars, privacy selectors and all visible actions. Fix actual visual diffs before production merge.

**Release boundary:** Keep in a GitHub PR/Vercel preview until visual QA. Do not silently merge this first batch to main and replace working production pages without checking real screenshots.
