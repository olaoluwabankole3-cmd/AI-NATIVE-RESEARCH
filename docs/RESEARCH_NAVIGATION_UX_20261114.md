# Converge Research & Navigation UX — Phase 2 (14 November 2026)

This release improves **understanding and wayfinding** rather than changing the approved Converge design system, permissions or data architecture.

## Navigation
- Desktop primary destinations remain **Research**, **People**, **Messages**, **AI experts** and **Alerts**. "AI experts" clarifies the existing specialist registry.
- The More menu retains Workspaces, Calls, Organisations and Network and now describes what each destination provides.
- Corrected active-link semantics so an organisation/network route no longer highlights the People primary tab at the same time as More.
- The mobile dock and focused detail-screen navigation remain intact.

## Research home
- A compact 3-step discovery pathway sends people to real routes/actions: explore recent questions, find communities and learn about AI specialists.
- Grounded counts display actual fetched recent-topic and visible-community counts, not invented activity or membership metrics.
- The community shortcuts label was corrected from "Your spaces" (which could imply membership) to "Explore spaces".
- Empty-state guidance no longer repeats the same instruction.

## Research topic workflow
- Research topics now explain the sequence: discuss ideas, save sources/evidence, preserve synthesis or decision.
- The existing mobile Discussion and Evidence tabs, agent controls and RLS logic are unchanged.

## Evidence & provenance
- Saved artifacts can be filtered by type (claims, evidence, sources, synthesis, decisions) and searched across titles, content and source URLs.
- Results show grounded visible/total counts with clear/reset behavior and a dedicated no-matches state.
- Existing artifact persistence, provenance, generation, permissions and explicit human/AI labels are unchanged.

## Follow-up UX review
After deployment verify 320/375px phones, tablet and desktop, with signed-in accounts and research topics containing real saved artifacts. Then prioritise context-aware onboarding, mobile overflow nav, research collaboration states, and evidence quality/review workflows.

No Supabase migration or API contract change is required. The original Converge URL remains unchanged.
