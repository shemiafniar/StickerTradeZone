import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PKCE code-exchange callback. This is where Supabase redirects after a
 * user clicks an email confirmation link (or any other email/OAuth flow) -
 * `emailRedirectTo` is set to this route in signUpAction, so this works with
 * Supabase's default "Confirm signup" email template out of the box, with
 * no dashboard email-template edits required. See also ../confirm/route.ts,
 * a fallback for projects whose template uses the older token_hash style.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = normalizeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
}

function normalizeNext(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}
