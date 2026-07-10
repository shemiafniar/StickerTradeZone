"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { requireAdmin } from "@/lib/adminAuth";
import { ISRAEL_CITIES } from "@/lib/cities";
import type { Database, Profile, UserRole } from "@/types/database";

export interface AdminActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

async function logAdminAction(
  supabase: SupabaseClient<Database>,
  adminId: string,
  action: string,
  targetUserId: string | null,
  details: Record<string, unknown> = {}
) {
  await supabase.from("admin_logs").insert({ admin_id: adminId, action, target_user_id: targetUserId, details });
}

export interface SuspendUserState {
  error?: string;
  success?: boolean;
}

export async function setUserSuspendedAction(
  _prevState: SuspendUserState,
  formData: FormData
): Promise<SuspendUserState> {
  try {
    const { supabase, adminId } = await requireAdmin();
    const userId = String(formData.get("userId") ?? "");
    const suspend = formData.get("suspend") === "true";
    if (!userId) return { error: "משתמש לא תקין" };
    if (userId === adminId) return { error: "לא ניתן להשעות את החשבון שלך" };

    const { error } = await supabase
      .from("profiles")
      .update({ status: suspend ? "suspended" : "active" })
      .eq("id", userId);

    if (error) return { error: error.message };

    await logAdminAction(supabase, adminId, suspend ? "suspend_user" : "reactivate_user", userId);

    revalidatePath("/admin/users");
    revalidatePath("/admin");
    return { success: true };
  } catch {
    return { error: "פעולה זו מיועדת למנהלים בלבד" };
  }
}

// ============================================================================
// User management: view/edit/suspend/delete. Impersonation ("login as
// user") isn't implemented yet, but this is the seam for it later: it
// would be another action here, gated by the same requireAdmin() guard,
// probably issuing a short-lived session for the target user rather than
// touching any of the actions below.
// ============================================================================

export interface UpdateUserState {
  error?: string;
  success?: boolean;
}

/** Edits another user's public profile fields, including promoting/demoting their role. */
export async function updateUserAction(_prevState: UpdateUserState, formData: FormData): Promise<UpdateUserState> {
  try {
    const { supabase, adminId } = await requireAdmin();
    const userId = String(formData.get("userId") ?? "");
    const fullName = String(formData.get("fullName") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    const neighborhood = String(formData.get("neighborhood") ?? "").trim();
    const role = String(formData.get("role") ?? "user") as UserRole;

    if (!userId) return { error: "משתמש לא תקין" };
    if (!fullName) return { error: "נא להזין שם מלא" };
    if (!ISRAEL_CITIES.includes(city)) return { error: "נא לבחור עיר תקינה מהרשימה" };
    if (role !== "user" && role !== "admin") return { error: "תפקיד לא תקין" };
    if (userId === adminId && role !== "admin") {
      return { error: "לא ניתן להסיר הרשאות מנהל מהחשבון שלך" };
    }

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, city, neighborhood: neighborhood || null, role })
      .eq("id", userId);

    if (error) return { error: error.message };

    await logAdminAction(supabase, adminId, "update_user", userId, { fullName, city, neighborhood, role });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
    return { success: true };
  } catch {
    return { error: "פעולה זו מיועדת למנהלים בלבד" };
  }
}

export interface DeleteUserState {
  error?: string;
  success?: boolean;
}

/**
 * Permanently deletes a user's `auth.users` row via the Supabase Admin
 * API (service-role key) - this cascades through `profiles` and every
 * app table referencing it (contacts, collection, trades, chat,
 * notifications, locations) via their existing ON DELETE CASCADE foreign
 * keys. Deleting only the `profiles` row would leave an orphaned
 * `auth.users` entry that could still sign in and would just get a fresh
 * profile re-created by the self-heal path in `data/profile.ts` - this
 * is why a real deletion needs the service-role client, not a plain RLS
 * DELETE.
 */
export async function deleteUserAction(_prevState: DeleteUserState, formData: FormData): Promise<DeleteUserState> {
  try {
    const { supabase, adminId } = await requireAdmin();
    const userId = String(formData.get("userId") ?? "");
    if (!userId) return { error: "משתמש לא תקין" };
    if (userId === adminId) return { error: "לא ניתן למחוק את החשבון שלך" };

    const { data: target } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if ((target as Profile | null)?.role === "admin") {
      return { error: "לא ניתן למחוק חשבון מנהל - יש להסיר הרשאות ניהול קודם" };
    }

    await logAdminAction(supabase, adminId, "delete_user", userId, { fullName: (target as Profile | null)?.full_name });

    const serviceClient = createServiceRoleClient();
    const { error } = await serviceClient.auth.admin.deleteUser(userId);
    if (error) return { error: error.message };

    revalidatePath("/admin/users");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    if (err instanceof Error && (err.message === "UNAUTHENTICATED" || err.message === "FORBIDDEN")) {
      return { error: "פעולה זו מיועדת למנהלים בלבד" };
    }
    return { error: "שגיאה במחיקת המשתמש. ודאו ש-SUPABASE_SERVICE_ROLE_KEY מוגדר בסביבת השרת." };
  }
}

// ============================================================================
// Trades management
// ============================================================================

export interface AdminTradeActionState {
  error?: string;
  success?: boolean;
}

async function adminSetTradeStatus(
  tradeId: string,
  status: "cancelled" | "completed"
): Promise<AdminTradeActionState> {
  try {
    const { supabase, adminId } = await requireAdmin();
    if (!tradeId) return { error: "בקשת טרייד לא תקינה" };

    // validate_trade_status_transition() already lets an admin caller set
    // any status unconditionally (see 0001_schema.sql/0007_hardening.sql) -
    // no special-casing needed here beyond the requireAdmin() guard itself.
    const { error } = await supabase.from("trade_requests").update({ status }).eq("id", tradeId);
    if (error) return { error: error.message };

    await logAdminAction(supabase, adminId, status === "cancelled" ? "admin_cancel_trade" : "admin_force_complete_trade", null, {
      tradeId,
    });

    revalidatePath("/admin/trades");
    return { success: true };
  } catch {
    return { error: "פעולה זו מיועדת למנהלים בלבד" };
  }
}

export async function adminCancelTradeAction(
  _prevState: AdminTradeActionState,
  formData: FormData
): Promise<AdminTradeActionState> {
  return adminSetTradeStatus(String(formData.get("tradeId") ?? ""), "cancelled");
}

export async function adminForceCompleteTradeAction(
  _prevState: AdminTradeActionState,
  formData: FormData
): Promise<AdminTradeActionState> {
  return adminSetTradeStatus(String(formData.get("tradeId") ?? ""), "completed");
}

/** Permanently deletes a trade request (cascades to its items and chat messages). */
export async function adminDeleteTradeAction(
  _prevState: AdminTradeActionState,
  formData: FormData
): Promise<AdminTradeActionState> {
  try {
    const { supabase, adminId } = await requireAdmin();
    const tradeId = String(formData.get("tradeId") ?? "");
    if (!tradeId) return { error: "בקשת טרייד לא תקינה" };

    const { error } = await supabase.from("trade_requests").delete().eq("id", tradeId);
    if (error) return { error: error.message };

    await logAdminAction(supabase, adminId, "admin_delete_trade", null, { tradeId });

    revalidatePath("/admin/trades");
    return { success: true };
  } catch {
    return { error: "פעולה זו מיועדת למנהלים בלבד" };
  }
}

export interface UpdateCatalogState {
  error?: string;
  success?: boolean;
}

/** Adds a new participating national team (and auto-generates its 20 stickers) via the admin_add_team() RPC. */
export async function addTeamAction(_prevState: UpdateCatalogState, formData: FormData): Promise<UpdateCatalogState> {
  try {
    const { supabase, adminId } = await requireAdmin();
    const code = String(formData.get("code") ?? "").trim().toUpperCase();
    const nameHe = String(formData.get("nameHe") ?? "").trim();
    const flagEmoji = String(formData.get("flagEmoji") ?? "").trim();

    if (!/^[A-Z]{3}$/.test(code)) {
      return { error: "קוד הנבחרת חייב להיות 3 אותיות באנגלית (למשל GER)" };
    }
    if (!nameHe) {
      return { error: "נא להזין שם נבחרת בעברית" };
    }

    const { error } = await supabase.rpc("admin_add_team", {
      p_code: code,
      p_name_he: nameHe,
      p_flag_emoji: flagEmoji || null,
      p_sort_order: null,
    });
    if (error) {
      if (error.message.includes("duplicate key")) return { error: `הקוד ${code} כבר קיים במערכת` };
      return { error: error.message };
    }

    await logAdminAction(supabase, adminId, "add_team", null, { code, nameHe });

    revalidatePath("/admin/stickers");
    revalidatePath("/dashboard/stickers");
    return { success: true };
  } catch {
    return { error: "פעולה זו מיועדת למנהלים בלבד" };
  }
}
