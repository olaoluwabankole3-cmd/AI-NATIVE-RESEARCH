import { NextResponse } from "next/server";
import { createCommunityAdminClient } from "@/lib/community-access";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  const auth = await createServerClient();
  const { data: { user }, error: authError } = await auth.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Sign in again before deleting your account." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null) as {
    confirmation?: unknown;
    emailConfirmation?: unknown;
  } | null;

  if (payload?.confirmation !== "DELETE") {
    return NextResponse.json({ error: 'Type "DELETE" to confirm permanent account deletion.' }, { status: 400 });
  }
  const submittedEmail = typeof payload.emailConfirmation === "string" ? payload.emailConfirmation.trim().toLowerCase() : "";
  if (user.email && submittedEmail !== user.email.toLowerCase()) {
    return NextResponse.json({ error: "The email address does not match your signed-in account." }, { status: 400 });
  }

  const admin = await createCommunityAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Account deletion is not configured on the server. Please contact support." }, { status: 503 });
  }

  const { data: cleanup, error: cleanupError } = await admin.rpc("prepare_account_deletion", {
    target_user_id: user.id,
  });

  if (cleanupError) {
    console.error("Account deletion preparation failed", cleanupError);
    return NextResponse.json({ error: "We could not prepare your account for deletion. No account deletion was completed." }, { status: 500 });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("Account deletion failed after content cleanup", { userId: user.id, deleteError });
    return NextResponse.json({
      error: "Some account-owned content was removed, but account deletion could not finish. Please contact support before retrying.",
      cleanupApplied: true,
    }, { status: 500 });
  }

  return NextResponse.json({ success: true, cleanup });
}
