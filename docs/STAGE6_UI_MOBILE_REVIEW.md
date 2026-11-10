# Stage 6 — UI/UX and mobile usability review

Date: 10 November 2026  
Based on: Stage 5 draft PR #11 (`stage5/production-reliability-20261110`)  
Stage 6 branch: `stage6/mobile-ui-polish-20261110`

## Design boundaries
- Preserve Converge's current logo, header lockup, dark evergreen/charcoal backgrounds, emerald accent, typography and established navigation vocabulary.
- Improve existing components rather than introducing a different design system, database schema or product architecture.
- Keep the original production URL and connected user data untouched.

## Navigation and mobile accessibility
- Preserve the existing five-item authenticated mobile dock and responsive desktop navigation.
- Restore keyboard focus to the More trigger when the menu closes using Escape or its close button.
- Move initial focus into the modal and wrap keyboard Tab/Shift+Tab inside the open menu.
- Keep page scrolling locked while the mobile menu is open, restore the prior value on close.
- Show unread notification count in the mobile dock without disrupting the established brand identity.
- Use visible emerald focus outlines and a 44-pixel minimum for key mobile menu, research and message actions.
- Respect reduced-motion preferences in new loading skeletons.

## Research rooms
- Keep the existing Evidence & provenance record and saved artifact types (claim, evidence, source, synthesis, decision).
- Add loading skeletons, an explicit retry action on failed retrieval, and a clear first-artifact action.
- Catch unexpected Supabase upload/save failures without leaving the submit button busy.
- Preserve draft research content if saving fails; do not optimistically claim an unconfirmed save.
- Validate synthesis response shape before adding a generated artifact to the UI.
- Focus the artifact title input when the editor opens on mobile and keyboard devices.
- Wrap long source and artifact content without horizontal overflow.

## Communities and topics
- Add compact phone navigation to the topic list and directory.
- Give topic filter buttons an announced selected state and enlarge touch targets.
- Maintain community creation form draft and release busy state if a request throws.
- Distinguish loading failures from an empty research directory.
- Retain the site header on topic loading and unavailable screens, with a non-jarring skeleton.
- Add jump links between topic discussion and the research evidence record.
- Improve text wrapping, accessible AI participant picker state and reply editor labels.

## Messaging
- Make active chat viewport-aware using `100dvh` and a scrollable message area, reducing layout conflicts with the bottom navigation and mobile keyboard.
- Keep the message composer readable at 16px on mobile (avoid automatic mobile browser zoom).
- Show the live message character count, and ensure long messages can wrap.
- Give message-request actions a compact three-column phone layout with larger touch targets.
- Add a Retry inbox action for failed loading and avoid showing a misleading empty-inbox state during an error.

## Validation and release
- `tests/stage6-mobile-ui.test.mjs` checks essential accessible/mobile interface contracts, critical user-facing labels and established logo references.
- CI continues to run existing unit tests, critical dependency audit, lint on reliability modules, Next.js/TypeScript build and built-server HTTP smoke tests.
- A protected branch-specific UI-only Vercel Preview uses fake Supabase public variables, not production credentials. It verifies rendering and build compatibility, not real data workflows.
- Before production sign-off: manually inspect at 320px, 375px, 390px, 768px and desktop widths; open/close modal by touch and keyboard; use both iOS and Android browser keyboards on message composer; test empty/loading/offline states; and exercise real community/message/research flows with disposable accounts in a safe environment.
- This is a **draft stacked** on Stage 5; earlier Stage 2–5 PRs remain unmerged. Do not merge out of order or promote UI-only Preview as Production.
