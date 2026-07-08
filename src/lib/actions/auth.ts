"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ISRAEL_CITIES } from "@/lib/cities";
import { checkRateLimit, formatRetrySeconds } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/requestInfo";
import { getSiteUrl } from "@/lib/site";
import { normalizeAuthError } from "@/lib/authErrors";

export interface AuthActionState {
  error?: string;
  message?: string;
}

const SIGNUP_LIMIT = { attempts: 6, windowMs: 60 * 60 * 1000 }; // 6 signups/hour/IP
const SIGNIN_LIMIT = { attempts: 10, windowMs: 5 * 60 * 1000 }; // 10 attempts/5min/IP+email

function normalizeIsraeliPhone(raw: string): string {
  return raw.replace(/[^\d+]/g, "");
}

function normalizeNext(next: string | null | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

/**
 * next/navigation's redirect() signals a redirect by throwing an object
 * with a `NEXT_REDIRECT` digest. Every action below wraps its body in a
 * try/catch so any *unexpected* error (network failure, programming bug,
 * etc.) is normalized into a safe Hebrew message instead of ever reaching
 * the client as a raw object - this guard makes sure that catch-all doesn't
 * accidentally intercept a legitimate redirect() and turn a successful
 * sign-in into an error message.
 */
function isNextRedirectError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export async function signUpAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const fullName = String(formData.get("fullName") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    const neighborhood = String(formData.get("neighborhood") ?? "").trim();
    const phone = normalizeIsraeliPhone(String(formData.get("phone") ?? ""));

    if (!email || !password || !fullName || !city || !phone) {
      return { error: "נא למלא את כל שדות החובה" };
    }

    if (password.length < 6) {
      return { error: "הסיסמה חייבת להכיל לפחות 6 תווים" };
    }

    if (!ISRAEL_CITIES.includes(city)) {
      return { error: "נא לבחור עיר מהרשימה" };
    }

    const ip = await getClientIp();
    const rateLimit = checkRateLimit(`signup:${ip}`, SIGNUP_LIMIT.attempts, SIGNUP_LIMIT.windowMs);
    if (!rateLimit.allowed) {
      return {
        error: `יותר מדי ניסיונות הרשמה. נסו שוב בעוד ${formatRetrySeconds(rateLimit.retryAfterSeconds ?? 60)}.`,
      };
    }

    const siteUrl = await getSiteUrl();
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, city, neighborhood: neighborhood || null, phone },
        // Where Supabase sends the user after they click the confirmation
        // link in their email - our /auth/callback route exchanges the code
        // for a session, so this works with the default email template with
        // no dashboard changes required.
        emailRedirectTo: `${siteUrl}/auth/callback?next=/dashboard`,
      },
    });

    if (error) {
      return { error: normalizeAuthError(error, "signup") };
    }

    if (!data.session) {
      return {
        message: "נרשמת בהצלחה! בדוק/י את תיבת המייל שלך כדי לאשר את החשבון, ואז התחבר/י.",
      };
    }

    redirect("/dashboard");
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return { error: normalizeAuthError(err, "signup") };
  }
}

export async function signInAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const next = normalizeNext(String(formData.get("next") ?? ""));

    if (!email || !password) {
      return { error: "נא למלא אימייל וסיסמה" };
    }

    const ip = await getClientIp();
    const rateLimit = checkRateLimit(
      `signin:${ip}:${email.toLowerCase()}`,
      SIGNIN_LIMIT.attempts,
      SIGNIN_LIMIT.windowMs
    );
    if (!rateLimit.allowed) {
      return {
        error: `יותר מדי ניסיונות התחברות. נסו שוב בעוד ${formatRetrySeconds(rateLimit.retryAfterSeconds ?? 60)}.`,
      };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { error: normalizeAuthError(error, "signin") };
    }

    redirect(next);
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return { error: normalizeAuthError(err, "signin") };
  }
}

export async function signOutAction() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    console.error("[auth:signout] error:", err);
  }
  redirect("/");
}

export async function signInWithGoogleAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const next = normalizeNext(String(formData.get("next") ?? ""));
    const siteUrl = await getSiteUrl();
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error || !data?.url) {
      return { error: normalizeAuthError(error ?? new Error("No OAuth URL returned"), "oauth") };
    }

    redirect(data.url);
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return { error: normalizeAuthError(err, "oauth") };
  }
}
