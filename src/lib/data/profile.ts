import { createClient } from "@/lib/supabase/server";
import type { Profile, ProfileContact } from "@/types/database";

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return (data as Profile) ?? null;
}

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
  return (data as ProfileContact) ?? null;
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
