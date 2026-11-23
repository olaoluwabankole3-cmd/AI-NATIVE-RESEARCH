# Converge evidence-to-outcome pilot

## Goal
Demonstrate whether a team can turn a research discussion into a transparent, reviewable outcome with less reconstruction effort and better traceability than their current workflow. This is **product validation**, not a claim of scientific novelty.

Initial live topic suggestion: **How should AI agents participate in online communities?** This is an existing Converge research discussion. Use a research topic (type RESEARCH) to access the Evidence panel. Never seed artificial evidence into production.

## Existing infrastructure
- The research_artifacts table stores CLAIM, EVIDENCE, SOURCE, SYNTHESIS, DECISION, with RLS restricted to topic participants; no new database schema is required.
- Existing Research Analyst synthesis creates AI-generated SYNTHESIS artifacts with model/provider attribution and context metadata.
- Provenance field context_artifact_ids: model context presented to an agent, **not citations**.
- Provenance field linked_artifact_ids: new, explicit researcher-authored links to other saved artifacts in the same topic; not independent verification.
- Human DECISION artifacts are recorded through the existing authenticated insertion permission. They represent recorded decisions, not formal peer review.

## Researcher journey
1. A human opens a community research topic and selects Evidence.
2. Save a CLAIM expressing the proposition.
3. Save one or more SOURCE artifacts (with external URL if available), and EVIDENCE artifacts describing observations. Verify external URLs independently; saving a link does not verify the contents.
4. In **Evidence connections & outcome**, choose the claim and connect it to saved sources/evidence. Only the original human author can change that artifact's links.
5. Ask a registered AI Research Analyst or Critical Reviewer to discuss gaps. Treat its SYNTHESIS as a labeled model contribution, not a human-verified conclusion.
6. Human records a DECISION artifact (including rejected claims or unresolved disagreements) and explicitly connects it to claims and evidence.
7. Use Preview / Download Markdown outcome. The outcome lists claims, explicit connections, AI provenance, decisions, open gaps, and in-app deep links. Downloads are private local files, **not published reports**.
8. Independently review sources and citations. A trustworthy outcome includes unresolved questions, not merely a confident summary.

## First comparison experiment
- **Population:** 3–5 real researchers, plus one independent reviewer.
- **Workload:** the same scoped research question and available input sources in Converge and a baseline conventional discussion/document workflow.
- **Design:** alternate workflow order by team, use equal time budgets, do not silently prefill claims/answers, and disclose all AI usage to participants.
- **Primary metric:** percentage of final claims with an inspectable, retrievable source/evidence trail.
- **Secondary metrics:** time to reconstruct why a decision was made, number of unsupported claims after human review, number of source errors, time to complete, and reviewer-rated confidence.
- **Guardrails:** measure model hallucinations, privacy boundary failures, attempts to access a private community and changing a link authored by another participant.
- **Acceptance criteria for engineering pilot:** create/link/export succeeds on mobile and desktop; private-topic RLS is respected; unlinked claims are visibly flagged; source URLs are never auto-verified; human decisions are distinguishable from generated syntheses; exported artifact links resolve only for authorized users.
- **Product proof:** report quantitative results of the comparison, including failures. Do not assert superiority or willingness-to-pay from the existence of functionality.

## Current limitations
- Existing research_artifacts table had **zero stored artifacts** when this milestone started. No production research outcome has been validated.
- Explicit links are stored as JSONB IDs; validated against loaded topic in UI and exports, but are **not database-enforced foreign keys**. For high-assurance use, add normalized relational links and immutable event history after validating the workflow.
- The outcome is a time-stamped Markdown export, not signed, peer-reviewed, or independently fact-checked. File downloads can be forwarded outside Converge.
- Edited artifact links use optimistic timestamp comparison and existing author-only RLS, but are not an immutable audit trail.
- There is no automatic conference transcription or AI voice-contribution inclusion in this milestone.
- No fabricated source scores, “verified evidence” badge, invented decisions, or synthetic pilot results.

## Suggested next technical stage
After an actual pilot, prioritize normalized, permission-aware provenance edges (with database-enforced same-topic integrity), immutable change events, explicit reviewer sign-off and source extraction integrity. Then bridge real conference transcripts and AI contributions into the same research record—with consent and usage controls.
