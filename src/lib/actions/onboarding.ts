"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Marks the first-time onboarding walkthrough as done - called both when
 * the user finishes it and when they skip/dismiss it (both are treated as
 * "seen", per the requirement to never reopen it automatically again).
 * Idempotent: harmless to call more than once.
 */
export async function completeOnboardingAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", user.id)
    .is("onboarding_completed_at", null);

  if (error) console.error("[onboarding] Failed to record onboarding completion:", error.message);
  revalidatePath("/dashboard");
}
