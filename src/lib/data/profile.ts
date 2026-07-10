import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database, Profile, ProfileContact } from "@/types/database";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function metadataString(user: User, key: string): string {
  const value = user.user_metadata?.[key];
  return typeof value === "string" ? value : "";
}

/**
 * The `handle_new_user` Postgres trigger (see supabase/migrations/0001_schema.sql)
 * is the primary, fast path for creating a profile/profile_contacts row the
 * moment someone signs up. This is a deliberate defense-in-depth fallback for
 * that same work: if a profile is ever missing for an authenticated user -
 * e.g. the app was deployed against a Supabase project where migrations were
 * applied out of order, or any other edge case - we self-heal here instead
 * of leaving the user stuck in a "profile not found" redirect loop that
 * would otherwise require a manual SQL fix.
 *
 * Uses `ignoreDuplicates` (`ON CONFLICT DO NOTHING`) so this is always safe
 * to call even if the trigger *did* run - no data is ever overwritten.
 */
async function ensureProfileExists(supabase: SupabaseClient<Database>, user: User): Promise<Profile | null> {
  const phone = metadataString(user, "phone") || null;

  // Mirrors handle_new_user()'s "first signup becomes admin" bootstrap
  // logic (see supabase/migrations/0008_bootstrap.sql), so that guarantee
  // still holds even when this self-heal path is the one creating the very
  // first profile (e.g. the trigger failed and logged a warning instead -
  // see 0009_auth_trigger_resilience.sql).
  const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
  const isFirstUser = (count ?? 0) === 0;

  await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        full_name: metadataString(user, "full_name"),
        city: metadataString(user, "city"),
        neighborhood: metadataString(user, "neighborhood") || null,
        role: isFirstUser ? "admin" : "user",
      },
      { onConflict: "id", ignoreDuplicates: true }
    );

  await supabase
    .from("profile_contacts")
    .upsert({ user_id: user.id, phone, whatsapp: phone }, { onConflict: "user_id", ignoreDuplicates: true });

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return (data as Profile) ?? null;
}

/**
 * Wrapped in React's `cache()` so multiple call sites within the same
 * request (root layout's notification provider, SiteHeader's nav items,
 * DashboardLayout's auth guard, individual pages, ...) share a single
 * underlying fetch instead of each re-querying `profiles` independently.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (data) return data as Profile;

  return ensureProfileExists(supabase, user);
});

export async function getCurrentContact(): Promise<ProfileContact | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profile_contacts")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (data) return data as ProfileContact;

  // Same self-healing rationale as getCurrentProfile() above.
  await ensureProfileExists(supabase, user);

  const { data: retried } = await supabase
    .from("profile_contacts")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  return (retried as ProfileContact) ?? null;
}

export async function getProfileById(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return (data as Profile) ?? null;
}

/**
 * Returns contact info for another user, but RLS on profile_contacts will
 * only actually return a row if the caller is the owner, an admin, or has
 * an accepted/completed trade with that user - this is enforced in the DB,
 * this function just performs the query.
 */
export async function getRevealedContact(userId: string): Promise<ProfileContact | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profile_contacts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as ProfileContact) ?? null;
}
