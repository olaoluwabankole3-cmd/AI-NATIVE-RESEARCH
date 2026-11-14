# Converge — screen-by-screen UX & presentation audit

**Audit date:** 14 November 2026  
**Repository:** `olaoluwabankole3-cmd/AI-NATIVE-RESEARCH`  
**Baseline:** `main` at `e4111320853df1488885fb3151c40ea16a34f7c2` (the deployed PR #26 mobile repair)  
**Scope:** 35 Next.js page routes, shared UI components, navigation and four imported CSS stylesheets.  
**Status:** Source audit and six user-supplied annotated Android screenshots reviewed. **Full rendered visual QA across devices has NOT yet been performed**. This document is a worklist, not a certification that all routes were manually tested.

## Executive decision

**Do not call Converge presentation-ready yet.** Preserve the underlying working messaging, audio/video calls and research permissions. The main UI problem is inconsistent *system architecture*: too many independent card/container patterns, contradictory responsive rules, excessive helper copy and duplicated actions. A high-volume, page-by-page CSS patch would make this worse.

The first design phase must establish a coherent authenticated-app shell and component contract before turning to layout polish. Public/marketing styling should remain distinct where intentional, but its transition to the signed-in product must be clear.

### What was actually observed vs inferred

**Observed in six Android screenshots (prior to PR #26):**
1. Messages: visually nested search field; oversized separate refresh action; crowded list and bottom navigation.
2. AI specialists (top): large text intro; card-like search and filters competing with list.
3. AI specialists (lower): redundant manage/back links and extensive boxed directory structure; a live “Converge Test Researcher” entry.
4. Research: narrow three-column cards with broken words inside titles and descriptions.
5. Topic discussion: an oversized reply editor and action area at the bottom, obscuring reading space.
6. Profile visibility: three narrow radio cards breaking “Public”, “Members” and “Private” across lines.

**Code-verified:** PR #26 replaced the 3-column research cards and profile visibility cards, integrated message refresh, reduced specialist intro/management chrome and removed sticky mobile topic reply. **Their success on the user's device is not yet visually verified.** Other routes below have code-based risks, *not* photographed defects.

## Architecture findings — cross-cutting

| ID | Severity | Finding | Evidence | Required direction |
| --- | --- | --- | --- | --- |
| DS-01 | P0 | Style cascade fragmentation | `globals.css` 97,815 bytes / 237 `!important`; `marketing.css` 17,355 / 13; `application-redesign.css` 41,324 / 156; `application-refinement.css` 32,409 / 295. **188,903 CSS bytes and 701 `!important` declarations**. | Consolidate authenticated-app token/primitive styles incrementally. Stop appending overrides. Marketing styles can remain separate. |
| DS-02 | P0 | Cross-breakpoint density and truncation | Simultaneous max-width thresholds 600, 639, 680, 767, 900, 1023 and 1280; screenshots showed narrow grid labels. | A documented mobile-first breakpoint policy; no 3-up labeled options at phone widths; minimum widths and safe truncation. |
| DS-03 | P0 | Card-in-card information hierarchy | Authenticated routes independently define dozens of rounded/bordered surfaces, including community admin and agent admin. Counts reflect source style occurrences, *not exact rendered box counts*. | Only one primary surface per task; flat list rows; separators; avoid nested cards without a distinct information role. |
| DS-04 | P1 | Mismatched foundational tokens | Current app uses `--converge-accent: #8de4bb` and `--cx-mint: #a6e6bd` plus multiple dark-surface aliases. | Preserve recognizable Converge mint/dark tones while mapping colors to a single semantic token system. |
| DS-05 | P0 | Dense instructional and placeholder copy | Large headings/prose in AI directory; Settings declares 'Still to be configured'; screenshot shows a test agent entry. | One-sentence purpose + one primary action; progressive disclosure; clearly label unpublished features without implying they work; separately review seeded/test content. |
| DS-06 | P1 | Inconsistent common patterns | Search, filters, status messages, form spacing and actions are reauthored across independent pages. | Shared AppHeader, PageHeader, Tabs, SearchField, EntityRow, FormField, StatusMessage, EmptyState and DestructiveAction patterns. |
| DS-07 | P1 | Complex mobile shell | Different authenticated/marketing headers; mobile dock hides Alerts in More and places notification counts on More. | Confirm mobile navigation affordances, notification discovery, sticky elements, scroll and focus handling. |
| DS-08 | P0 | Visual sign-off absent | No device screenshots of the **current** PR #26 state at required breakpoints. | Perform authenticated visual walkthroughs with test accounts at defined widths and actual keyboard interactions before demo. |

## Route-by-route audit matrix

Priorities: **P0** blocks a credible demonstration or is a shared layout foundation; **P1** needs substantial polish/interaction QA; **P2** can follow the core application. The `Evidence` column is explicit: **Screenshot** means visually observed before PR #26; **Code** means risk inferred from examined source.

| # | Route | Priority | Finding / risk | Target correction | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | `/` | P2 | Long multi-section hero and illustrations use a separate marketing system; responsive contrast and motion not yet inspected visually | Check headline wrapping, accessible reduced motion, CTA clarity, and continuity into the signed-in app | Code |
| 2 | `/about` | P2 | Several narrative blocks and full marketing shell; possible excessive information density | Establish the same editorial spacing, heading scale and compact mobile sections as other public pages | Code |
| 3 | `/platform` | P2 | Three-part product explanation and marketing modules vary from in-app research language | Unify research terms and distinguish present capabilities from future-facing positioning | Code |
| 4 | `/how-it-works` | P2 | Long procedural content may demand too much scrolling before an actionable next step | Use concise steps with one visible next action and consistent illustrations | Code |
| 5 | `/for-organizations` | P2 | Long organisational value-proposition and generic feature modules | Clarify live organisational functions versus aspirational capabilities without adding faux dashboards | Code |
| 6 | `/contact` | P2 | Marketing copy and calls-to-action need consistency with public navigation | Simplify contact hierarchy and verify all actions actually resolve | Code |
| 7 | `/medical-intelligence` | P2 | Medical Intelligence is a separate experience but visually related to Converge | Distinguish external product boundaries, preserve accurate feature claims and provide clear return route | Code |
| 8 | `/ai-research` | P2 | Marketing-only AI research page differs from authenticated AI specialists registry | Clarify that this is explanatory content, not the specialist management interface | Code |
| 9 | `/workspaces` | P1 | A workspace chooser inside the app links to a separate medical app; navigation and expectations differ | Present a restrained workspace switcher with explicit external-app labeling and a consistent way back | Code |
| 10 | `/sign-in` | P1 | Custom auth forms include multiple borders and status panels independent of app field patterns | Standardize labeled fields, password affordance, Google flow, error placement and mobile keyboard behavior without auth rewrites | Code |
| 11 | `/sign-up` | P1 | Separate registration form with its own grid, helper text and validation | One clear primary action; readable privacy/help text and consistent password controls | Code |
| 12 | `/forgot-password` | P2 | Password recovery uses a smaller independent card pattern | Unify auth visual hierarchy, concise state transitions and confirmation messaging | Code |
| 13 | `/reset-password` | P2 | Password-reset form has independent error and success handling | Apply shared form styling and accessible strength/validation feedback | Code |
| 14 | `/oauth/consent` | P1 | Dedicated OAuth consent component is a sensitive, separate authorization surface | Verify clear requesting-app identity, scopes, deny/approve affordances and accessible mobile treatment; do not alter security decisions | Code |
| 15 | `/communities` | P0 | Research landing previously displayed three narrow cards breaking words; PR #26 replaced cards with plain shortcut links but device appearance remains unverified | Editorial Research home with one search, lightweight tabs/links, grounded topic cards, no duplicated instructions | Screenshot 4 + Code |
| 16 | `/communities/[slug]` | P0 | Large page mixes membership requests, topic creation, topic lists and community context; 66 border-related utility occurrences | Separate membership state and community info from topic feed; progressive-disclosure creation; consistent mobile order | Code |
| 17 | `/communities/[slug]/members` | P1 | Moderation view includes member search, blocked list and several stacked panels | Use simple segmented moderation views and flat member rows with clearly separated destructive controls | Code |
| 18 | `/communities/[slug]/settings` | P1 | Settings, approvals, AI-specific controls and deletion occupy one 27k-character page with many fields | Group controls by access, people, AI and danger; reduce nested sections and avoid dense multi-action rows | Code |
| 19 | `/topics/[id]` | P0 | Reply textarea and Post reply previously dominated/overlapped mobile discussion; PR #26 removed mobile sticky behavior; evidence tabs and long posts still need visual QA | Thread-first reading flow, clear author vs AI labels, compact non-overlapping composer and predictable Discussion/Evidence tabs | Screenshot 5 + Code |
| 20 | `/agents` | P0 | Large explanatory banner, dense directory borders and visible test agent weakened presentation; PR #26 reduced chrome and duplicate navigation | Directory-first experience, concise expertise descriptions, readable agent list and role/status truthfulness | Screenshots 2–3 + Code |
| 21 | `/agents/[id]` | P1 | Individual agent has multiple bordered profile and detail sections | Use one expert overview plus tabs/sections for roles, capabilities and participation; avoid fake profile metrics | Code |
| 22 | `/admin/agents` | P1 | 38k-character admin surface has 103 border and 50 rounded-class occurrences; many nested panels and stats | Retain permission checks but separate catalogue, editor and safety notices into task-focused screens; mobile one column | Code |
| 23 | `/people` | P1 | Member discovery has cards, filters and several action states; row/card density differs from messaging | Create repeatable PeopleRow/PersonCard with consistent name truncation, bio limits and connection state | Code |
| 24 | `/u/[username]` | P1 | Public member profile combines identity, biography, social actions and sections with several frames | Make identity and primary connect/message actions prominent; move secondary metadata below fold | Code |
| 25 | `/profile` | P0 | Visibility choices previously split words into narrow columns; PR #26 converts choices to full-width radio rows; 10 additional fields and preview still need review | Mobile-friendly profile editor with grouped fields, simple visibility rows, sticky save only when safe, and uncluttered preview | Screenshot 6 + Code |
| 26 | `/messages` | P0 | Nested search surface and oversized Refresh control were observed; PR #26 integrates refresh and flattens list, visual outcome pending | Inbox-first hierarchy with one search field, clear tabs, readable sender/time/preview rows and contextual refresh | Screenshot 1 + Code |
| 27 | `/messages/[conversationId]` | P0 | 25k-character conversation screen holds chat header, context sidebar, request moderation and composer; CSS contains mobile viewport overrides | Keep messages dominant, group secondary actions, preserve keyboard-safe composer and explicit unsent/sent feedback | Code |
| 28 | `/calls` | P1 | Call history page has multiple status/empty states and uses a separate layout from Messages | Present an accessible call log with clear audio/video state, time and entry back into a conversation | Code |
| 29 | `/calls/[callId]` | P1 | Call room includes video overlays, several media controls and tucked-away TURN diagnostics | Prioritize video, active speaker and end-call control; keep network details secondary and controls accessible | Code |
| 30 | `/notifications` | P1 | Notification rows have icon, title, timestamp, body, dismiss action; More dock also carries unread badge | Unify compact update rows and make read/unread state clear; verify badge and Alerts destination without relying on More alone | Code |
| 31 | `/network` | P1 | Connections, incoming/outgoing requests and follows have multiple independent grids | Use lightweight tabs and shared PeopleRow actions with truthful counts instead of stacked card collections | Code |
| 32 | `/organizations` | P1 | Directory and creation form share a large 17k-character screen with multiple card/grids | Prioritize discovery and route creation to focused task rather than adding a long inline form | Code |
| 33 | `/organizations/[slug]` | P1 | Large mixed public profile/management screen includes logo, people, membership approvals and editing | Separate public overview from manager-only actions, simplify member rows and display permission state clearly | Code |
| 34 | `/settings` | P0 | Visible 'Still to be configured' section and 'Available now' wording read like an unfinished prototype; account deletion must stay guarded | Separate functional settings from roadmap messaging; concise Account/Privacy/Notifications sections while retaining deletion confirmations | Code |
| 35 | `/feed` | P2 | Retired feed route redirects to /communities; no independent screen to redesign | Verify redirect and avoid listing Feed as an active destination | Code |

### Visual test scenarios per route

The accompanying CSV stores each route's group, priority, evidence class and exact responsive/interaction checks. **All 35 currently require post-PR #26 rendered verification.** Static build success is not a replacement for mobile screenshots, browser interaction or accessibility tests.

## Repair backlog and release boundaries

**Foundation — P0:** Define tokens and layout boundaries, consistent type scale, readable grid minimums, input sizes, touch sizes, app header/More/dock rules, focus-visible states, panel/row hierarchy and a brief copy standard. Make the foundations measurable. No auth/DB/call logic changes.

**Wave 1 — presentable core:** Research home `/communities`, community detail, topic `/topics/[id]`, AI directory, Messages inbox/conversation, profile editor, Settings. Convert one flow at a time in small PRs with before/after screen captures and current-state QA.

**Wave 2 — collaboration depth:** Research evidence editor, community membership/settings, AI profile/admin, People/network, public profile, org directory/detail, notifications. Consolidate shared components rather than cloning a new page for each case.

**Wave 3 — account & outer product:** Sign-in/up/recovery/OAuth consent, workspaces switcher, medical/external transitions, calls/hangup/permission states and marketing content alignment.

**Wave 4 — presentation verification:** Check 320, 360, 390, 430, 768, 1024 and 1440 CSS px; touch scroll; on-screen keyboard; font scaling; light/dark OS contrast if applicable; hover/focus; reduced motion; state variants and realistic long data; link correctness. Review installed/real-browser behavior, not just emulators.

### Acceptance criteria for all core screens

- No horizontal document scrolling at 320–430 CSS px, no single-word broken headings or 3-up tiny option cards.
- Legible 14–16px base body text on mobile; supporting labels must remain readable without relying on 9–10px text for essential actions.
- One meaningful page title and a visually dominant primary action; secondary/admin actions are grouped or disclosed.
- Interactable targets at least ~44×44 CSS px where practical; visible focus and error messages associated with the relevant input.
- Loading, error, empty, pending, blocked/private and permission-denied states do not masquerade as a missing page.
- No floating CTA/editor hides scrolling content; on-screen keyboard does not obscure Send/Post reply.
- Research artifacts retain provenance and human/AI attribution; messaging preserves drafts on failed sends; calls preserve media consent and hangup access.
- Existing database authorization, business workflows, production URL and Google/email sign-in stay unchanged.
- No placeholder/test records on presentation paths without explicit review/approval to remove, rename or hide them.
- QA screenshots must be captured **after** the relevant PR is built, at mobile and desktop sizes, and signed off separately from CI.

## Presentation flows to test end-to-end

1. **Research:** Research → community → topic → discussion → evidence/synthesis → return to the same topic.
2. **Community governance:** Public/private visibility → request to join → admin review → membership → topic creation.
3. **Communications:** Find person → message request/accepted conversation → text send → voice/video call → return to messages.
4. **Identity:** Sign up → profile setup → visibility choice → public profile → network request and privacy controls.
5. **AI:** Search specialist → view availability/role → join supported research discussion → distinguish AI from human evidence.
6. **Organization:** Discover organization → visit profile → join/request → admin review; workspace switching should warn about external app boundaries.

## Non-goals for this audit PR

No production code, style, env, database, or route behavior changes. No deletion of the test agent or undisclosed changes to visibility/access. No claims that every screen was manually visually tested. This is a documented review baseline for subsequent controlled design PRs.

**First implementation recommendation:** Begin with DS-01/02/03 as a small reusable shell/typography/spacing foundation, then a visual pass on Research and Topics, followed by Messages, AI and Profile. Reuse current Converge branding and keep existing features operational.
