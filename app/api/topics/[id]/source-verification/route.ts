import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createCommunityAdminClient, getTopicCommunityAccess } from "@/lib/community-access";
import { sourceUrl, quoteMatches } from "@/lib/source-verification";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
const responseHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function respond(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: responseHeaders });
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


const fields = "id, topic_id, source_artifact_id, edge_id, reviewer_id, verdict, rationale, publisher, publication_date, original_url, original_excerpt, quote_match, snapshot, created_at";
export async function GET(_request: Request, { params }: Params) {
  const { id: topicId } = await params;
  if (!uuid.test(topicId)) return respond({ error: "Invalid research topic." }, 400);
  const context = await authorized(topicId);
  if (context.error) return context.error;
  const { data, error } = await context.admin!.from("research_source_verifications")
    .select(fields).eq("topic_id", topicId).order("created_at", { ascending: false }).limit(501);
  if (error || !data || data.length > 500) return respond({ error: "Verification history unavailable or exceeds the current record limit." }, 503);
  return respond({ verifications: data });
}
export async function POST(request: Request, { params }: Params) {
  const { id: topicId } = await params;
  if (!uuid.test(topicId)) return respond({ error: "Invalid research topic." }, 400);
  const origin = request.headers.get("origin");
  if (origin !== new URL(request.url).origin) return respond({ error: "Invalid request origin." }, 403);
  const context = await authorized(topicId);
  if (context.error) return context.error;
  const { admin, user, participant } = context;
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return respond({ error: "Invalid verification request." }, 400);
  const sourceId = field(payload.sourceId, 64), edgeId = field(payload.edgeId, 64);
  const verdict = field(payload.verdict, 30), rationale = field(payload.rationale, 3000);
  const publisher = field(payload.publisher, 200), publicationDate = field(payload.publicationDate, 100);
  const originalUrl = sourceUrl(field(payload.originalUrl, 2048));
  const excerpt = field(payload.excerpt, 8000);
  if (!uuid.test(sourceId) || (edgeId && !uuid.test(edgeId)) || !["ORIGIN_CHECKED", "QUESTIONABLE", "UNREACHABLE"].includes(verdict)
      || rationale.length < 40 || rationale.length > 3000 || publisher.length > 200 || publicationDate.length > 100 ||
      !originalUrl || originalUrl.length > 2048 || excerpt.length > 8000 || (verdict === "ORIGIN_CHECKED" && (!publisher || payload.attested !== true))) {
    return respond({ error: "Choose a source, reference URL and verdict, and explain your assessment (40–3000 characters). Origin checked requires a publisher and explicit attestation." }, 400);
  }
  const { data: source, error: sourceError } = await admin!.from("research_artifacts")
    .select("id, topic_id, title, artifact_type, created_by_participant_id, updated_at, provenance")
    .eq("topic_id", topicId).eq("id", sourceId).maybeSingle();
  if (sourceError) return respond({ error: "Could not inspect the saved source." }, 503);
  if (!source || !["SOURCE", "EVIDENCE"].includes(source.artifact_type)) return respond({ error: "Source not found in this topic." }, 404);
  if (source.created_by_participant_id === participant!.id) return respond({ error: "A different human participant must verify this source." }, 403);
  let passage: string | null = null, locator: string | null = null;
  if (edgeId) {
    const { data: edge, error } = await admin!.from("research_evidence_edges")
      .select("id, passage, locator, created_by").eq("topic_id", topicId).eq("evidence_artifact_id", sourceId).eq("id", edgeId).maybeSingle();
    if (error) return respond({ error: "Could not inspect the evidence relationship." }, 503);
    if (!edge) return respond({ error: "Passage not found for this source." }, 404);
    if (edge.created_by === user!.id) return respond({ error: "Another participant must check a passage you linked." }, 403);
    passage = edge.passage; locator = edge.locator;
    if (verdict === "ORIGIN_CHECKED" && !excerpt) return respond({ error: "Provide the original publication excerpt for a passage check." }, 400);
  } else if (excerpt) return respond({ error: "Choose a linked passage before submitting an excerpt." }, 400);
  const quoteMatch = passage && excerpt ? quoteMatches(passage, excerpt) : null;
  const { data, error } = await admin!.from("research_source_verifications").insert({
    topic_id: topicId, source_artifact_id: sourceId, edge_id: edgeId || null, reviewer_id: user!.id,
    verdict, rationale, publisher, publication_date: publicationDate, original_url: originalUrl, original_excerpt: excerpt,
    quote_match: quoteMatch, snapshot: { title: source.title, updated_at: source.updated_at, saved_url: sourceUrl(source.provenance?.source_url), passage, locator },
  }).select(fields).single();
  if (error || !data) return respond({ error: "Could not record source verification." }, 503);
  return respond({ verification: data }, 201);
}
