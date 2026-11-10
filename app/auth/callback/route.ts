import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { safeAuthDestination } from "@/lib/auth/destination";

function safeDestination(url: URL): string {
  return safeAuthDestination(url.searchParams.get("next"), url.origin);
}

function signInRedirect(origin: string, destination: string, errorCode?: string) {
  const recovery = destination === "/reset-password";
  const target = new URL(recovery ? "/forgot-password" : "/sign-in", origin);
  if (!recovery) target.searchParams.set("redirect", destination);
  if (errorCode) target.searchParams.set("auth_error", errorCode);
  const response = NextResponse.redirect(target);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const destination = safeDestination(url);
  const code = url.searchParams.get("code");

  if (url.searchParams.has("error")) {
    return signInRedirect(url.origin, destination, "provider");
  }
  if (!code) {
    return signInRedirect(url.origin, destination, "callback");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return signInRedirect(url.origin, destination, "configuration");
  }

  const response = NextResponse.redirect(new URL(destination, url.origin));
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // A transient provider failure must never strand the user on a 500 page.
  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return signInRedirect(url.origin, destination, "callback");
  } catch {
    return signInRedirect(url.origin, destination, "callback");
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
