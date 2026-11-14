# Converge presentation-readiness: mobile hierarchy repair

**Source of review:** Six annotated screenshots of the live Android app from 14 November 2026. Users reported cramped three-column cards, nested boxes, excessive panels and a topic reply editor that overlaps content.

## Concrete fixes
- Research: replace 3 cramped “Discover / Collaborate / Deepen” cards with simple, discoverable topic/community/AI shortcut links. Existing topic filters and community directory remain.
- Profile: replace the 3 narrow visibility cards with a single full-width radio group; retain exact public/members/private preference values and backend save behavior.
- Messages: remove detached “Refresh” button, integrate refresh icon beside search, reduce overlapping borders, flatten thread rows and improve long-name truncation. Retain realtime refresh and manual refresh.
- AI: shorten technical marketing copy, remove duplicate back CTA, make “Manage registry” a subdued secondary link while retaining the route and selected specialist details.
- Topic: remove redundant posting-as-user label, shrink text area and remove sticky positioning on <=900px screens so the reply editor cannot cover discussion.
- Shared styles: replace the previous research mini-card treatment rather than stacking another visual override; retain original Converge dark/green visual identity.

## Deliberately unchanged
Supabase authentication/RLS, private-community approvals, research history and evidence provenance, messages/notifications and audio/video WebRTC operations. Production URL remains `https://ai-native-research-qfeh.vercel.app`.

## QA still required
This source-level patch has dedicated regression tests. **Visual QA on a device** at 360/390/480/720 CSS-pixel widths, user interactions, text resizing, dark theme contrast, and keyboard-safe areas must be reviewed before describing the *entire* platform as presentation-ready.

## Broader follow-up
Audit the research topic feed, individual community management, people profiles, settings, organization/network flows, and evidence detail for unnecessary duplicated panels and complex empty states. The “Converge Test Researcher” record is test content and should be explicitly reviewed before public presentations—avoid deleting or reclassifying production agents without authorization.
