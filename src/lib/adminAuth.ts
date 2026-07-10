import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

/**
 * Server-only admin authorization guard, shared by every admin Server
 * Action (actions/admin.ts) and every admin-only data reader that returns
 * sensitive per-user detail (e.g. getAdminUserCollectionDetail() in
 * data/admin.ts) - defense in depth alongside the page-level redirect in
 * app/admin/layout.tsx, so a collector's full collection detail (or any
 * other admin-only read) can never be reached even if a future route ever
 * forgets to nest under /admin/layout.tsx.
 *
 * This file intentionally does NOT have a "use server" directive - it's a
 * plain server-only helper, not a Server Action itself (its return value,
 * a Supabase client instance, isn't serializable, so it must never be
 * exported from a "use server" module).
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHENTICATED");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if ((profile as Profile | null)?.role !== "admin") throw new Error("FORBIDDEN");

  return { supabase, adminId: user.id };
}
