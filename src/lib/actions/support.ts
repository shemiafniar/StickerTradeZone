"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";
import { notifyAdminsOfNewReport } from "@/lib/email/notifyAdminsOfReport";
import { formatRetrySeconds } from "@/lib/rateLimit";
import type { Profile, SupportReport, SupportReportCategory, SupportReportStatus } from "@/types/database";

export interface SupportReportActionState {
  error?: string;
  success?: boolean;
}

const CATEGORIES = new Set<SupportReportCategory>([
  "technical",
  "trade",
  "matches",
  "scanner",
  "notifications",
  "suggestion",
  "other",
]);

const SUBJECT_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 5000;
// DB-backed (accurate across serverless instances) - generous enough for
// legitimate back-and-forth reporting, tight enough to block spam/loops.
const REPORT_LIMIT = { max: 10, windowHours: 1 };

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return { supabase, user };
}

async function checkReportRateLimit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<{ error?: string }> {
  const { count } = await supabase
    .from("support_reports")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", new Date(Date.now() - REPORT_LIMIT.windowHours * 60 * 60 * 1000).toISOString());

  if ((count ?? 0) >= REPORT_LIMIT.max) {
    return { error: `הגעת למגבלת הדיווחים (${REPORT_LIMIT.max} בשעה). נסו שוב בעוד ${formatRetrySeconds(3600)}.` };
  }
  return {};
}

/**
 * Creates a support/bug report, then makes a best-effort attempt to email
 * every admin about it. The report is always saved first and the user
 * always gets a normal success response even if the email step fails -
 * see notifyAdminsOfNewReport()'s own doc comment for why.
 */
export async function createSupportReportAction(
  _prevState: SupportReportActionState,
  formData: FormData
): Promise<SupportReportActionState> {
  try {
    const { supabase, user } = await requireAuth();

    const subject = String(formData.get("subject") ?? "").trim();
    const category = String(formData.get("category") ?? "") as SupportReportCategory;
    const description = String(formData.get("description") ?? "").trim();
    const attachmentPath = String(formData.get("attachmentPath") ?? "").trim() || null;
    const pageUrl = String(formData.get("pageUrl") ?? "").trim() || null;
    const userAgent = String(formData.get("userAgent") ?? "").trim().slice(0, 500) || null;

    if (!subject) return { error: "נא להזין נושא לדיווח" };
    if (subject.length > SUBJECT_MAX_LENGTH) return { error: `הנושא ארוך מדי (מקסימום ${SUBJECT_MAX_LENGTH} תווים)` };
    if (!CATEGORIES.has(category)) return { error: "נא לבחור קטגוריה תקינה" };
    if (!description) return { error: "נא להזין תיאור מפורט של הבעיה" };
    if (description.length > DESCRIPTION_MAX_LENGTH) {
      return { error: `התיאור ארוך מדי (מקסימום ${DESCRIPTION_MAX_LENGTH} תווים)` };
    }
    // Defense in depth beyond storage RLS (which already enforces this) -
    // catch an obviously wrong path before it's ever stored.
    if (attachmentPath && !attachmentPath.startsWith(`${user.id}/`)) {
      return { error: "קובץ מצורף לא תקין" };
    }

    const rateLimit = await checkReportRateLimit(supabase, user.id);
    if (rateLimit.error) return { error: rateLimit.error };

    const { data: inserted, error } = await supabase
      .from("support_reports")
      .insert({
        user_id: user.id,
        subject,
        category,
        description,
        attachment_url: attachmentPath,
        page_url: pageUrl,
        user_agent: userAgent,
      })
      .select()
      .single();

    if (error) {
      console.error("[support] Failed to insert report:", error.message);
      return { error: "לא ניתן היה לשלוח את הדיווח. נסו שוב." };
    }

    // The report is already committed at this point - everything below is
    // best-effort. notifyAdminsOfNewReport() already catches its own errors
    // internally, but this extra try/catch is a deliberate belt-and-suspenders
    // guarantee: nothing after the insert above should ever be able to turn
    // a successful submission into an error response for the user.
    try {
      const profile = await getCurrentProfile();
      await notifyAdminsOfNewReport(inserted as SupportReport, profile?.full_name || "אספן", user.email ?? null);
    } catch (err) {
      console.error("[support] Admin notification step failed after the report was already saved:", err instanceof Error ? err.message : err);
    }

    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return { error: "יש להתחבר מחדש כדי לשלוח דיווח" };
    }
    console.error("[support] Unexpected error creating report:", err instanceof Error ? err.message : err);
    return { error: "אירעה שגיאה בלתי צפויה. נסו שוב." };
  }
}

// ============================================================================
// Admin management
// ============================================================================

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

export interface UpdateReportActionState {
  error?: string;
  success?: boolean;
}

const STATUSES = new Set<SupportReportStatus>(["open", "in_progress", "resolved", "closed"]);

/** Admin-only: update a report's status and/or internal note - never exposed to the reporting user (see RLS + the reports data layer). */
export async function updateSupportReportAction(
  _prevState: UpdateReportActionState,
  formData: FormData
): Promise<UpdateReportActionState> {
  try {
    const { supabase, adminId } = await requireAdmin();
    const reportId = String(formData.get("reportId") ?? "");
    const status = String(formData.get("status") ?? "") as SupportReportStatus;
    const adminNote = String(formData.get("adminNote") ?? "");

    if (!reportId) return { error: "דיווח לא תקין" };
    if (!STATUSES.has(status)) return { error: "סטטוס לא תקין" };

    const { error } = await supabase
      .from("support_reports")
      .update({ status, admin_note: adminNote || null })
      .eq("id", reportId);

    if (error) {
      console.error(`[support] Admin ${adminId} failed to update report ${reportId}:`, error.message);
      return { error: "לא ניתן היה לעדכן את הדיווח. נסו שוב." };
    }

    revalidatePath("/admin/reports");
    revalidatePath(`/admin/reports/${reportId}`);
    return { success: true };
  } catch (err) {
    if (err instanceof Error && (err.message === "UNAUTHENTICATED" || err.message === "FORBIDDEN")) {
      return { error: "פעולה זו מיועדת למנהלים בלבד" };
    }
    console.error("[support] Unexpected error updating report:", err instanceof Error ? err.message : err);
    return { error: "אירעה שגיאה בלתי צפויה. נסו שוב." };
  }
}
