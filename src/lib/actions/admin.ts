"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database, Profile } from "@/types/database";

export interface AdminActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHENTICATED");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if ((profile as Profile | null)?.role !== "admin") throw new Error("FORBIDDEN");

  return { supabase, adminId: user.id };
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
