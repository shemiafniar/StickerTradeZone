import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site";
import { sendEmail } from "@/lib/email/resend";
import { SUPPORT_CATEGORY_LABELS } from "@/lib/supportCategories";
import type { SupportReport } from "@/types/database";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Best-effort - every caller (createSupportReportAction) inserts the
 * report row *first*, then calls this. A failure here (missing
 * RESEND_API_KEY, Resend being down, network hiccup, ...) is logged and
 * swallowed - it must never undo or appear to undo the already-saved
 * report, and the user must still see a normal success confirmation
 * regardless of whether this email goes out.
 */
export async function notifyAdminsOfNewReport(report: SupportReport, reporterName: string, reporterEmail: string | null): Promise<void> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_admin_notification_emails");
    if (error) {
      console.error("[email] Could not resolve admin notification emails:", error.message);
      return;
    }

    const adminEmails = ((data as { email: string }[]) ?? []).map((row) => row.email).filter(Boolean);
    if (adminEmails.length === 0) {
      console.warn("[email] No admin emails found - skipping new-report notification");
      return;
    }

    const siteUrl = await getSiteUrl();
    const reportUrl = `${siteUrl}/admin/reports/${report.id}`;
    const categoryLabel = SUPPORT_CATEGORY_LABELS[report.category] ?? report.category;
    const createdAt = new Date(report.created_at).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });

    const result = await sendEmail({
      to: adminEmails,
      subject: `דיווח תקלה חדש: ${report.subject}`,
      text: [
        `דיווח תקלה חדש התקבל ב-Shashot`,
        ``,
        `נושא: ${report.subject}`,
        `קטגוריה: ${categoryLabel}`,
        `דיווח מאת: ${reporterName}${reporterEmail ? ` (${reporterEmail})` : ""}`,
        `תאריך: ${createdAt}`,
        report.page_url ? `עמוד: ${report.page_url}` : null,
        ``,
        `תיאור:`,
        report.description,
        ``,
        `לצפייה בדיווח: ${reportUrl}`,
      ]
        .filter(Boolean)
        .join("\n"),
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
          <h2 style="color:#101c34;">דיווח תקלה חדש התקבל ב-Shashot</h2>
          <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding:6px 0; color:#666; width:120px;">נושא</td><td style="padding:6px 0; font-weight:bold;">${escapeHtml(report.subject)}</td></tr>
            <tr><td style="padding:6px 0; color:#666;">קטגוריה</td><td style="padding:6px 0;">${escapeHtml(categoryLabel)}</td></tr>
            <tr><td style="padding:6px 0; color:#666;">דיווח מאת</td><td style="padding:6px 0;">${escapeHtml(reporterName)}${reporterEmail ? ` (${escapeHtml(reporterEmail)})` : ""}</td></tr>
            <tr><td style="padding:6px 0; color:#666;">תאריך</td><td style="padding:6px 0;">${escapeHtml(createdAt)}</td></tr>
            ${report.page_url ? `<tr><td style="padding:6px 0; color:#666;">עמוד</td><td style="padding:6px 0;" dir="ltr">${escapeHtml(report.page_url)}</td></tr>` : ""}
          </table>
          <p style="color:#666;">תיאור:</p>
          <p style="white-space: pre-wrap; background:#f7f8fb; border-radius:8px; padding:12px;">${escapeHtml(report.description)}</p>
          <p style="margin-top:24px;">
            <a href="${reportUrl}" style="display:inline-block; background:#10b872; color:#fff; text-decoration:none; padding:10px 20px; border-radius:8px; font-weight:bold;">
              לצפייה בדיווח באזור הניהול
            </a>
          </p>
        </div>
      `,
    });

    if (!result.success) {
      console.error("[email] Failed to send new-report admin notification:", result.error);
    }
  } catch (err) {
    console.error("[email] Unexpected error notifying admins of new report:", err instanceof Error ? err.message : err);
  }
}
