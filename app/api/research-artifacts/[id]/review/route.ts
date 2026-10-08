import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

const allowedStatuses = new Set(["APPROVED", "REJECTED"]);

export async function PATCH(request: Request, { params }: Params) {
  const { id: artifactId } = await params;

  let body: { status?: string; note?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A review status is required." }, { status: 400 });
  }

  const status = body.status?.toUpperCase();
  if (!status || !allowedStatuses.has(status)) {
    return NextResponse.json({ error: "Review status must be APPROVED or REJECTED." }, { status: 400 });
  }

  const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : "";

  const authClient = await createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: "Review service is not configured: SUPABASE_SERVICE_ROLE_KEY is missing." },
      { status: 503 },
    );
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: artifact, error: artifactError } = await admin
    .from("research_artifacts")
    .select("id, topic_id, artifact_type, title, review_status")
    .eq("id", artifactId)
    .single();

  if (artifactError || !artifact) {
    return NextResponse.json({ error: "Research artifact not found." }, { status: 404 });
  }

  const { data: participant, error: participantError } = await admin
    .from("topic_participants")
    .select("id")
    .eq("topic_id", artifact.topic_id)
    .eq("participant_type", "HUMAN")
    .eq("user_id", user.id)
    .maybeSingle();

  if (participantError || !participant) {
    return NextResponse.json(
      { error: "You must participate in this topic before reviewing its research artifacts." },
      { status: 403 },
    );
  }

  const { data: updatedArtifact, error: updateError } = await admin
    .from("research_artifacts")
    .update({
      review_status: status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_note: note || null,
    })
    .eq("id", artifactId)
    .select("id, topic_id, artifact_type, title, review_status, reviewed_by, reviewed_at, review_note")
    .single();

  if (updateError || !updatedArtifact) {
    return NextResponse.json(
      { error: updateError?.message || "Could not update the research review." },
      { status: 500 },
    );
  }

  return NextResponse.json({ artifact: updatedArtifact });
}
