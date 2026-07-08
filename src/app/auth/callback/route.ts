import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PKCE code-exchange callback. This is where Supabase redirects after a
 * user clicks an email confirmation link, or completes a Google OAuth
 * consent screen - `emailRedirectTo`/`redirectTo` are set to this route in
 * signUpAction/signInWithGoogleAction, so this works with Supabase's default
 * email template and OAuth flow out of the box. See also ../confirm/route.ts,
 * a fallback for projects whose email template uses the older token_hash
 * style.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const providerError = searchParams.get("error") || searchParams.get("error_description");
  const next = normalizeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth:callback] exchangeCodeForSession error:", error);
  } else if (providerError) {
    // The user cancelled the Google consent screen, or the provider itself
    // reported a problem - logged for debugging, never shown raw to the user.
    console.error("[auth:callback] provider error:", providerError);
  }

  const errorCode = providerError ? "oauth_failed" : "confirmation_failed";
  return NextResponse.redirect(`${origin}/login?error=${errorCode}`);
}

function normalizeNext(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}
