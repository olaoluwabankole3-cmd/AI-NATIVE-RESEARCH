import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createCommunityAdminClient, getTopicCommunityAccess } from "@/lib/community-access";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
const responseHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validRelations = new Set(["SUPPORTS", "CONTRADICTS", "CONTEXT"]);
const validVerdicts = new Set(["SUPPORTED", "DISPUTED", "INCONCLUSIVE", "REQUIRES_REVISION"]);

function respond(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: responseHeaders });
}
function normalizeQuote(input: string) {
  return input.replace(/\s+/g, " ").trim().toLowerCase();
}
function field(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max + 1) : "";
}
async function authorized(topicId: string) {
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { error: respond({ error: "Sign in before reviewing research." }, 401) };
  const admin = await createCommunityAdminClient();
  if (!admin) return { error: respond({ error: "Research review storage is unavailable." }, 503) };
  const access = await getTopicCommunityAccess(admin, topicId, user.id);
  if (access.error) return { error: respond({ error: "Could not check community permissions." }, 503) };
  if (!access.topic || !access.community) return { error: respond({ error: "Research topic not found." }, 404) };
  if (!access.canParticipate) return { error: respond({ error: "Only approved, unbanned community members may review research." }, 403) };
  if (access.topic.type !== "RESEARCH") return { error: respond({ error: "Reviews are only available for research topics." }, 409) };
  const { data: participant, error: participantError } = await admin.from("topic_participants")
    .select("id").eq("topic_id", topicId).eq("participant_type", "HUMAN")
    .eq("user_id", user.id).maybeSingle();
  if (participantError) return { error: respond({ error: "Could not check research participation." }, 503) };
  if (!participant) return { error: respond({ error: "Open the research topic as a participant before reviewing." }, 403) };
  return { admin, user, participant };
}

async function records(admin: SupabaseClient, topicId: string) {
  const [edges, reviews] = await Promise.all([
    admin.from("research_evidence_edges")
      .select("id, topic_id, claim_artifact_id, evidence_artifact_id, relation, passage, locator, note, created_by, created_at")
      .eq("topic_id", topicId).order("created_at", { ascending: true }).limit(300),
    admin.from("research_review_events")
      .select("id, topic_id, claim_artifact_id, reviewer_id, verdict, rationale, snapshot, created_at")
      .eq("topic_id", topicId).order("created_at", { ascending: true }).limit(300),
  ]);
  if (edges.error || reviews.error) return null;
  return { edges: edges.data ?? [], reviews: reviews.data ?? [] };
}

export async function GET(_request: Request, { params }: Params) {
  const { id: topicId } = await params;
  if (!uuid.test(topicId)) return respond({ error: "Invalid research topic." }, 400);
  const context = await authorized(topicId);
  if (context.error) return context.error;
  const result = await records(context.admin!, topicId);
  if (!result) return respond({ error: "Could not read the evidence review record." }, 503);
  return respond(result);
}

export async function POST(request: Request, { params }: Params) {
  const { id: topicId } = await params;
  if (!uuid.test(topicId)) return respond({ error: "Invalid research topic." }, 400);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return respond({ error: "Invalid request origin." }, 403);
  }
  const context = await authorized(topicId);
  if (context.error) return context.error;
  const { admin, user, participant } = context;
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return respond({ error: "Invalid review request." }, 400);
  const claimId = field(payload.claimId, 64);
  if (!uuid.test(claimId)) return respond({ error: "Choose a valid saved claim." }, 400);

  const { data: claim, error: claimError } = await admin!.from("research_artifacts")
    .select("id, topic_id, title, content, artifact_type, created_by_participant_id, updated_at")
    .eq("topic_id", topicId).eq("id", claimId).maybeSingle();
  if (claimError || !claim || claim.artifact_type !== "CLAIM") return respond({ error: "Claim not found in this research topic." }, 404);

  if (payload.action === "edge") {
    const evidenceId = field(payload.evidenceId, 64);
    const relation = field(payload.relation, 30);
    const passage = field(payload.passage, 1600);
    const locator = field(payload.locator, 160);
    const note = field(payload.note, 1000);
    if (!uuid.test(evidenceId) || evidenceId === claimId || !validRelations.has(relation)) {
      return respond({ error: "Choose a different evidence or source item and relationship." }, 400);
    }
    if (passage.length < 16 || passage.length > 1600 || locator.length > 160 || note.length > 1000) {
      return respond({ error: "Quote must be 16–1600 characters; locator and note must be within limits." }, 400);
    }
    const { data: evidence, error: evidenceError } = await admin!.from("research_artifacts")
      .select("id, topic_id, artifact_type, content")
      .eq("topic_id", topicId).eq("id", evidenceId).maybeSingle();
    if (evidenceError || !evidence || !["SOURCE", "EVIDENCE"].includes(evidence.artifact_type)) {
      return respond({ error: "Choose a saved source or evidence item from the same research topic." }, 404);
    }
    if (!normalizeQuote(evidence.content).includes(normalizeQuote(passage))) {
      return respond({ error: "The quotation must appear verbatim in the saved source or evidence material. Copy its exact passage first." }, 422);
    }
    const { data, error } = await admin!.from("research_evidence_edges")
      .insert({
        topic_id: topicId, claim_artifact_id: claimId, evidence_artifact_id: evidenceId,
        relation, passage, locator, note, created_by: user!.id,
      })
      .select("id, topic_id, claim_artifact_id, evidence_artifact_id, relation, passage, locator, note, created_by, created_at")
      .single();
    if (error?.code === "23505") return respond({ error: "This source has already been linked with the same relationship." }, 409);
    if (error || !data) return respond({ error: "Could not save this evidence relationship." }, 503);
    return respond({ edge: data }, 201);
  }

  if (payload.action === "review") {
    const verdict = field(payload.verdict, 30);
    const rationale = field(payload.rationale, 3000);
    if (!validVerdicts.has(verdict) || rationale.length < 40 || rationale.length > 3000) {
      return respond({ error: "Select a verdict and provide 40–3000 characters explaining your reasoning." }, 400);
    }
    if (claim.created_by_participant_id === participant!.id) {
      return respond({ error: "You cannot independently review a claim you authored. Invite another research participant." }, 403);
    }
    const { data: edges, error: edgesError } = await admin!.from("research_evidence_edges")
      .select("id, evidence_artifact_id, relation, passage, locator, created_at")
      .eq("topic_id", topicId).eq("claim_artifact_id", claimId)
      .order("created_at", { ascending: true }).limit(120);
    if (edgesError) return respond({ error: "Could not inspect the claim's evidence relationships." }, 503);
    if (verdict === "SUPPORTED" && !(edges ?? []).some((edge) => edge.relation === "SUPPORTS")) {
      return respond({ error: "A supported verdict requires at least one explicitly linked supporting passage. This still does not independently verify the claim." }, 409);
    }
    const evidenceIds = [...new Set((edges ?? []).map((edge) => edge.evidence_artifact_id))];
    const { data: evidence, error: evidenceError } = evidenceIds.length
      ? await admin!.from("research_artifacts")
        .select("id, title, updated_at, content").eq("topic_id", topicId).in("id", evidenceIds)
      : { data: [], error: null };
    if (evidenceError) return respond({ error: "Could not snapshot supporting material." }, 503);
    const sourceMap = new Map((evidence ?? []).map((item) => [item.id, item]));
    const snapshot = {
      claim: { title: claim.title, content: claim.content, updated_at: claim.updated_at },
      edges: (edges ?? []).map((edge) => ({
        id: edge.id, evidence_id: edge.evidence_artifact_id, relation: edge.relation,
        passage: edge.passage, locator: edge.locator,
        source_title: sourceMap.get(edge.evidence_artifact_id)?.title ?? "",
        source_updated_at: sourceMap.get(edge.evidence_artifact_id)?.updated_at ?? null,
      })),
      snapshot_version: 1,
    };
    const { data, error } = await admin!.from("research_review_events")
      .insert({
        topic_id: topicId, claim_artifact_id: claimId, reviewer_id: user!.id,
        verdict, rationale, snapshot,
      })
      .select("id, topic_id, claim_artifact_id, reviewer_id, verdict, rationale, snapshot, created_at")
      .single();
    if (error || !data) return respond({ error: "Could not record independent review." }, 503);
    return respond({ review: data }, 201);
  }
  return respond({ error: "Unsupported research review action." }, 400);
}
