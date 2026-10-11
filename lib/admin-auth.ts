import { createClient } from "@/lib/supabase/server";

export type AdminCheck =
  | { ok: true; user: { id: string; email?: string } }
  | { ok: false; status: 401 | 403 | 503; error: string };

export async function checkPlatformAdmin(): Promise<AdminCheck> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { ok: false, status: 401, error: "Sign in to manage the Converge agent registry." };
  }

  const allowedEmails = (process.env.CONVERGE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (allowedEmails.length === 0) {
    return {
      ok: false,
      status: 503,
      error: "Agent administration is not configured yet. Add the email you use to sign in to CONVERGE_ADMIN_EMAILS in the Vercel Production environment, then redeploy.",
    };
  }

  const email = user.email?.trim().toLowerCase();
  if (!email || !allowedEmails.includes(email)) {
    return { ok: false, status: 403, error: "Your account is not on the Converge platform-admin allowlist." };
  }

  return { ok: true, user: { id: user.id, email: user.email } };
}
