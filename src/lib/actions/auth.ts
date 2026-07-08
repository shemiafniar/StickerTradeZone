"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ISRAEL_CITIES } from "@/lib/cities";
import { checkRateLimit, formatRetrySeconds } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/requestInfo";
import { getSiteUrl } from "@/lib/site";

export interface AuthActionState {
  error?: string;
  message?: string;
}

const SIGNUP_LIMIT = { attempts: 6, windowMs: 60 * 60 * 1000 }; // 6 signups/hour/IP
const SIGNIN_LIMIT = { attempts: 10, windowMs: 5 * 60 * 1000 }; // 10 attempts/5min/IP+email

function normalizeIsraeliPhone(raw: string): string {
  return raw.replace(/[^\d+]/g, "");
}

export async function signUpAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
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
    return { error: translateAuthError(error.message) };
  }

  if (!data.session) {
    return {
      message: "נרשמת בהצלחה! בדוק/י את תיבת המייל שלך כדי לאשר את החשבון, ואז התחבר/י.",
    };
  }

  redirect("/dashboard");
}

export async function signInAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!email || !password) {
    return { error: "נא למלא אימייל וסיסמה" };
  }

  const ip = await getClientIp();
  const rateLimit = checkRateLimit(`signin:${ip}:${email.toLowerCase()}`, SIGNIN_LIMIT.attempts, SIGNIN_LIMIT.windowMs);
  if (!rateLimit.allowed) {
    return {
      error: `יותר מדי ניסיונות התחברות. נסו שוב בעוד ${formatRetrySeconds(rateLimit.retryAfterSeconds ?? 60)}.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: translateAuthError(error.message) };
  }

  redirect(next.startsWith("/") ? next : "/dashboard");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

function translateAuthError(message: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials": "אימייל או סיסמה שגויים",
    "User already registered": "המשתמש כבר רשום במערכת, נסה/י להתחבר",
    "Email not confirmed": "יש לאשר את כתובת המייל לפני ההתחברות",
  };
  if (map[message]) return map[message];
  if (/rate limit|too many/i.test(message)) {
    return "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.";
  }
  return message;
}
