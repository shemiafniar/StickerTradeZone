import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role Supabase client - bypasses Row Level Security entirely and
 * can call the Auth Admin API (e.g. deleting a user's `auth.users` row,
 * which cascades through every app table via existing foreign keys, unlike
 * deleting just the `profiles` row).
 *
 * NEVER import this from client-side code, and never call it without
 * first re-verifying the caller is an admin (see `requireAdmin()` in
 * `src/lib/actions/admin.ts`) - this client has no per-request
 * authorization of its own; it trusts the caller completely.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_URL). Required for admin user deletion - " +
        "set it from your Supabase project's Settings -> API -> service_role key. Never expose this key to " +
        "the client or commit it to git."
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
