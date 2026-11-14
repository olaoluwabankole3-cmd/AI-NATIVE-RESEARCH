# Converge — authenticated UI design foundations (audit proposal)

**Status:** Proposed design contract, **not implemented**. Preserve Converge's established dark/green/mint identity and separate marketing aesthetic.

## 1. Design intent

Calm, editorial, rigorous research software. The product should feel like an environment for serious collaboration, not a grid of nested dashboards. Optimise for a single clear next action, readable conversation and primary content, meaningful provenance, and deliberate secondary tooling.

## 2. Existing tokens to consolidate (not brand replacements)

The repository currently includes `--converge-bg: #0b1110`, `--converge-accent: #8de4bb`, `--cx-bg: #0b1110`, `--cx-surface: #14231b`, `--cx-nav: #0e1914`, and `--cx-mint: #a6e6bd`. Define one semantic source for `surface.app`, `surface.raised`, `surface.input`, `border.subtle`, `text.primary`, `text.secondary`, `action.primary`, `action.danger`, `focus.ring`. Use design tokens, not repeated literal colors in every route. Existing shades can be migrated carefully; don't invent a new palette without approval.

## 3. Layout and responsive contract

- **Mobile-first** at 320–430 CSS px: a single content column and no fixed-width right rail or 3-up option group; use intrinsic min-width, text wrapping/truncation where justified, and safe-area spacing.
- **Tablet** at ~768 CSS px: evaluate whether a 2-pane layout is usable. Do not trigger 3 columns solely because a utility `sm:` breakpoint crossed 640px.
- **Desktop** at 1024–1440 CSS px: navigation and context rail may appear where a real workflow justifies them, but research writing/reading widths should remain comfortably constrained.
- **Touch:** 44px controls; fixed/sticky call controls and reply composer cannot obscure posts when soft keyboard is open. Allow scroll and safe insets.
- **Typography:** coherent heading ladder (page title, section title, body, metadata), generous line height, no necessary information hidden at 10px; form text at least 16px on mobile when needed to avoid browser zoom.
- **Density:** use borders for boundaries between interactions, not around every paragraph. Prefer flat lists, separators and clear selected/hover/focus states.

## 4. Reusable UI primitives to extract

1. `AppShell`: shared authenticated header, primary nav, mobile dock, scroll and safe-area management.
2. `PageHeader`: one title and optionally one primary CTA; avoid stacked three-paragraph introductions.
3. `SearchField` & `FilterTabs`: one input border, coherent clear/refresh actions, accessible filters and counts.
4. `EntityRow`: reusable member, conversation, specialist and organisation rows with avatar, title, subtitle, trailing metadata/action.
5. `StatusMessage` & `EmptyState`: distinct loading/error/empty/access-denied states with relevant retry/next step.
6. `FormField`, `RadioList`, `ActionBar`: readable labels, radio choices, inline validation and non-overlapping action controls.
7. `ResearchArtifact`: distinguish human source from AI synthesis and consistently surface provenance, date and source link.
8. `DisclosureMenu`: secondary/profile/admin actions, never hide a primary action.

## 5. Staged CSS migration approach

- Stop appending feature-level `!important` overrides in `application-refinement.css`.
- Maintain current base/marketing app behavior while extracting token values and shared primitives.
- Replace one class namespace at a time. Delete obsolete rules in the same change; avoid adding a fourth authenticated-app override layer.
- Build before/after screenshots at 320, 390, 768, 1440 and check regressions with signed-in accounts before merging visual code.
- Keep regressions for long usernames/emails, real topics, empty datasets, private communities, keyboard-active composers, and zoomed text.

## 6. Presentation quality gates

**Visual:** no overlapping content, no broken single-word labels, no redundant navigation, legible status and hierarchy.  
**Functional:** message sends, calls, research post/agent behavior, privacy choices and moderation unchanged.  
**Accessibility:** keyboard-focus paths, readable control names, sufficient contrast, visible error states and reduced-motion support.  
**Content:** remove developer-facing placeholder copy from core paths only after the product state is truthful; review seeded test agents explicitly without modifying data by default.

The audit matrix is in `CONVERGE_SCREEN_AUDIT_20261114.md`; the route-by-route execution checklist is in `CONVERGE_VISUAL_QA_MATRIX_20261114.csv`.
