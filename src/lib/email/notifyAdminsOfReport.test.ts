import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockRpc, mockSendEmail, mockGetSiteUrl } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockSendEmail: vi.fn(),
  mockGetSiteUrl: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: mockRpc })),
}));

vi.mock("@/lib/site", () => ({
  getSiteUrl: mockGetSiteUrl,
}));

vi.mock("@/lib/email/resend", () => ({
  sendEmail: mockSendEmail,
}));

import { notifyAdminsOfNewReport } from "@/lib/email/notifyAdminsOfReport";
import type { SupportReport } from "@/types/database";

const REPORT: SupportReport = {
  id: "report-1",
  user_id: "reporter-1",
  subject: "התאמות לא נטענות",
  category: "matches",
  description: "פתחתי את עמוד ההתאמות ולא נטען כלום.",
  attachment_url: null,
  page_url: "https://shashot.app/dashboard/matches",
  user_agent: "Mozilla/5.0 test",
  status: "open",
  admin_note: null,
  created_at: "2026-01-01T10:00:00.000Z",
  updated_at: "2026-01-01T10:00:00.000Z",
};

describe("notifyAdminsOfNewReport", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockSendEmail.mockReset();
    mockGetSiteUrl.mockReset();
    mockGetSiteUrl.mockResolvedValue("https://shashot.app");
    mockSendEmail.mockResolvedValue({ success: true });
  });

  it("resolves recipients via get_admin_notification_emails() and emails exactly those admins", async () => {
    mockRpc.mockResolvedValue({
      data: [{ email: "admin1@shashot.local" }, { email: "admin2@shashot.local" }],
      error: null,
    });

    await notifyAdminsOfNewReport(REPORT, "דנה כהן", "dana@example.com");

    expect(mockRpc).toHaveBeenCalledWith("get_admin_notification_emails");
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.to).toEqual(["admin1@shashot.local", "admin2@shashot.local"]);
    expect(call.subject).toContain(REPORT.subject);
    expect(call.html).toContain(REPORT.description);
    expect(call.html).toContain(`/admin/reports/${REPORT.id}`);
  });

  it("does not attempt to send an email when there are no admins with a resolvable email", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    await notifyAdminsOfNewReport(REPORT, "דנה כהן", "dana@example.com");

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("never throws when the RPC itself fails (e.g. a transient DB error)", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "connection reset" } });

    await expect(notifyAdminsOfNewReport(REPORT, "דנה כהן", "dana@example.com")).resolves.toBeUndefined();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("never throws when sendEmail itself fails - the caller (createSupportReportAction) must not lose the already-saved report over this", async () => {
    mockRpc.mockResolvedValue({ data: [{ email: "admin1@shashot.local" }], error: null });
    mockSendEmail.mockResolvedValue({ success: false, error: "Resend API returned 500" });

    await expect(notifyAdminsOfNewReport(REPORT, "דנה כהן", "dana@example.com")).resolves.toBeUndefined();
  });

  it("never throws even if an unexpected exception occurs mid-flow", async () => {
    mockRpc.mockRejectedValue(new Error("totally unexpected"));

    await expect(notifyAdminsOfNewReport(REPORT, "דנה כהן", "dana@example.com")).resolves.toBeUndefined();
  });
});
