"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ISRAEL_CITIES } from "@/lib/cities";

export interface AuthActionState {
  error?: string;
  message?: string;
}

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

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, city, neighborhood: neighborhood || null, phone },
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
  return map[message] ?? message;
}
