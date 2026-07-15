"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_CHANGELOG_VERSION } from "@/lib/changelog";

/**
 * Marks the current changelog version as seen for the authenticated user -
 * called when the "What's New" modal is dismissed. Unlike
 * completeOnboardingAction() (a one-time, `.is(..., null)`-guarded flip),
 * this update is unconditional: it must keep working every time
 * CURRENT_CHANGELOG_VERSION changes in a future release, not just once
 * ever, so there is deliberately no "already set, never show again" guard
 * here - only the exact version comparison in shouldShowChangelogModal()
 * decides whether the modal reappears.
 */
export async function dismissChangelogAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("profiles")
    .update({ last_seen_changelog_version: CURRENT_CHANGELOG_VERSION })
    .eq("id", user.id);

  if (error) console.error("[changelog] Failed to record changelog dismissal:", error.message);
  revalidatePath("/dashboard");
}
