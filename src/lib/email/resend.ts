/**
 * Minimal, dependency-free client for the Resend transactional email API
 * (https://resend.com) - chosen because it's the simplest, most common
 * choice for a Next.js/Vercel project that has no existing email-sending
 * infrastructure (this app previously only ever relied on Supabase Auth's
 * own built-in emails - confirmation/magic link - never sent anything
 * app-specific). A plain `fetch()` call against Resend's REST API avoids
 * adding their SDK as a dependency, matching this app's existing pattern
 * for the OpenAI Vision provider (also a plain `fetch`, no SDK).
 *
 * Required environment variables (see .env.example):
 * - RESEND_API_KEY - from https://resend.com/api-keys. If unset, sendEmail()
 *   logs a warning and returns { success: false } instead of throwing -
 *   every caller in this app treats email delivery as best-effort (see
 *   notifyAdminsOfNewReport.ts), so a missing/invalid key never blocks the
 *   underlying feature (e.g. a submitted bug report is never lost).
 * - SUPPORT_NOTIFICATIONS_FROM_EMAIL - the verified "from" address for
 *   this app's Resend account/domain. Falls back to Resend's own sandbox
 *   sender if unset, which only works in testing (Resend rejects sending
 *   to arbitrary recipients from it in production).
 */

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "Shashot <onboarding@resend.dev>";

export interface SendEmailInput {
  to: string[];
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  success: boolean;
  error?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY not configured - skipping email "${input.subject}"`);
    return { success: false, error: "RESEND_API_KEY not configured" };
  }
  if (input.to.length === 0) {
    return { success: false, error: "No recipients" };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: process.env.SUPPORT_NOTIFICATIONS_FROM_EMAIL || DEFAULT_FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      // Never contains the API key, safe to log in full (truncated for size).
      console.error(`[email] Resend API returned ${response.status}:`, body.slice(0, 300));
      return { success: false, error: `Resend API returned ${response.status}` };
    }

    return { success: true };
  } catch (err) {
    console.error("[email] Failed to reach Resend:", err instanceof Error ? err.message : err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
