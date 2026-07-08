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

export async function setUserSuspendedAction(formData: FormData): Promise<void> {
  const { supabase, adminId } = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const suspend = formData.get("suspend") === "true";
  if (!userId) return;

  await supabase.from("profiles").update({ status: suspend ? "suspended" : "active" }).eq("id", userId);
  await logAdminAction(supabase, adminId, suspend ? "suspend_user" : "reactivate_user", userId);

  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

export interface UpdateCatalogState {
  error?: string;
  success?: boolean;
}

export async function updateTotalStickersAction(
  _prevState: UpdateCatalogState,
  formData: FormData
): Promise<UpdateCatalogState> {
  try {
    const { supabase, adminId } = await requireAdmin();
    const total = Number(formData.get("total") ?? 0);

    if (!Number.isFinite(total) || total < 0 || total > 5000) {
      return { error: "נא להזין מספר תקין בין 0 ל-5000" };
    }

    const { error } = await supabase.rpc("generate_sticker_range", { p_total: total });
    if (error) return { error: error.message };

    await logAdminAction(supabase, adminId, "update_total_stickers", null, { total });

    revalidatePath("/admin/stickers");
    revalidatePath("/dashboard/stickers");
    return { success: true };
  } catch {
    return { error: "פעולה זו מיועדת למנהלים בלבד" };
  }
}

export async function importStickerListAction(
  _prevState: UpdateCatalogState,
  formData: FormData
): Promise<UpdateCatalogState> {
  try {
    const { supabase, adminId } = await requireAdmin();
    const text = String(formData.get("list") ?? "");

    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const rows = lines
      .map((line) => {
        const [numberStr, name, team] = line.split(",").map((p) => p?.trim());
        const number = Number(numberStr);
        if (!Number.isFinite(number) || number <= 0) return null;
        return { number, name: name || null, team: team || null };
      })
      .filter((r): r is { number: number; name: string | null; team: string | null } => Boolean(r));

    if (rows.length === 0) {
      return { error: "לא נמצאו שורות תקינות. פורמט: מספר,שם (אופציונלי),קבוצה (אופציונלי)" };
    }

    const { error } = await supabase.from("stickers").upsert(rows, { onConflict: "number" });
    if (error) return { error: error.message };

    const maxNumber = Math.max(...rows.map((r) => r.number));
    await supabase
      .from("app_settings")
      .update({ total_stickers: maxNumber })
      .eq("id", true)
      .lt("total_stickers", maxNumber);

    await logAdminAction(supabase, adminId, "import_sticker_list", null, { count: rows.length });

    revalidatePath("/admin/stickers");
    revalidatePath("/dashboard/stickers");
    return { success: true };
  } catch {
    return { error: "פעולה זו מיועדת למנהלים בלבד" };
  }
}
