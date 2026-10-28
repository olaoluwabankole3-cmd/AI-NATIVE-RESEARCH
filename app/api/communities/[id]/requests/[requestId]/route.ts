import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string; requestId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id, requestId } = await params;
  const payload = await request.json().catch(() => null) as { decision?: unknown } | null;
  const decision = payload?.decision === "APPROVED" || payload?.decision === "REJECTED" ? payload.decision : null;
  if (!decision) return NextResponse.json({ error: "Choose approve or reject." }, { status: 400 });

  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data, error } = await auth.rpc("review_community_join_request", {
    p_request_id: requestId,
    p_decision: decision,
  });
  if (error) {
    const message = /Only the community owner/i.test(error.message)
      ? "Only the community owner can review access requests."
      : /already been reviewed/i.test(error.message)
        ? "This request has already been reviewed."
        : /not found/i.test(error.message)
          ? "Join request not found."
          : "Could not update this access request.";
    const status = /Only the community owner/i.test(error.message) ? 403 : /not found/i.test(error.message) ? 404 : 409;
    return NextResponse.json({ error: message }, { status });
  }

  if (!data || data.community_id !== id) {
    return NextResponse.json({ error: "The request does not belong to this community." }, { status: 404 });
  }
  return NextResponse.json({ request: data });
}
