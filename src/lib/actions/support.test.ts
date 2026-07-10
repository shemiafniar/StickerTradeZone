import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockGetUser, mockFrom, mockGetCurrentProfile, mockNotifyAdmins } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockGetCurrentProfile: vi.fn(),
  mockNotifyAdmins: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

vi.mock("@/lib/data/profile", () => ({
  getCurrentProfile: mockGetCurrentProfile,
}));

vi.mock("@/lib/email/notifyAdminsOfReport", () => ({
  notifyAdminsOfNewReport: mockNotifyAdmins,
}));

import { createSupportReportAction, updateSupportReportAction } from "@/lib/actions/support";

const REPORTER = { id: "22222222-2222-2222-2222-222222222201", email: "reporter@example.com" };
const ADMIN = { id: "11111111-1111-1111-1111-111111111101", email: "admin@example.com" };

function makeReportFormData(overrides: Partial<Record<string, string>> = {}) {
  const fd = new FormData();
  fd.set("subject", overrides.subject ?? "התאמות לא נטענות");
  fd.set("category", overrides.category ?? "matches");
  fd.set("description", overrides.description ?? "פתחתי את עמוד ההתאמות ולא נטען כלום.");
  fd.set("attachmentPath", overrides.attachmentPath ?? "");
  fd.set("pageUrl", overrides.pageUrl ?? "https://shashot.app/dashboard/matches");
  fd.set("userAgent", overrides.userAgent ?? "Mozilla/5.0 test");
  return fd;
}

/** Chainable mock matching the subset of the Supabase query builder support.ts actually calls for support_reports. */
function makeSupportReportsTable({
  rateLimitCount = 0,
  insertError = null,
  insertedRow = { id: "report-1" },
}: { rateLimitCount?: number; insertError?: unknown; insertedRow?: Record<string, unknown> } = {}) {
  const selectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockResolvedValue({ count: rateLimitCount }),
  };
  const insertChain = {
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: insertedRow, error: insertError }),
  };
  return {
    ...selectChain,
    insert: vi.fn().mockReturnValue(insertChain),
    update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
  };
}

describe("createSupportReportAction", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockFrom.mockReset();
    mockGetCurrentProfile.mockReset();
    mockNotifyAdmins.mockReset();
    mockGetCurrentProfile.mockResolvedValue({ full_name: "דנה כהן" });
  });

  it("requires authentication", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await createSupportReportAction({}, makeReportFormData());

    expect(result.error).toBeTruthy();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("rejects an empty subject", async () => {
    mockGetUser.mockResolvedValue({ data: { user: REPORTER } });

    const result = await createSupportReportAction({}, makeReportFormData({ subject: "" }));

    expect(result.error).toMatch(/נושא/);
  });

  it("rejects an invalid category", async () => {
    mockGetUser.mockResolvedValue({ data: { user: REPORTER } });

    const result = await createSupportReportAction({}, makeReportFormData({ category: "not-a-real-category" }));

    expect(result.error).toMatch(/קטגוריה/);
  });

  it("rejects an empty description", async () => {
    mockGetUser.mockResolvedValue({ data: { user: REPORTER } });

    const result = await createSupportReportAction({}, makeReportFormData({ description: "" }));

    expect(result.error).toBeTruthy();
  });

  it("rejects an attachment path that doesn't belong to the caller (defense in depth beyond storage RLS)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: REPORTER } });

    const result = await createSupportReportAction(
      {},
      makeReportFormData({ attachmentPath: "someone-elses-id/screenshot.png" })
    );

    expect(result.error).toBeTruthy();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("enforces the per-hour report rate limit", async () => {
    mockGetUser.mockResolvedValue({ data: { user: REPORTER } });
    mockFrom.mockReturnValue(makeSupportReportsTable({ rateLimitCount: 10 }));

    const result = await createSupportReportAction({}, makeReportFormData());

    expect(result.error).toMatch(/מגבלת הדיווחים/);
  });

  it("creates the report and notifies admins on success, only ever scoped to the current user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: REPORTER } });
    const table = makeSupportReportsTable({ insertedRow: { id: "report-1", user_id: REPORTER.id } });
    mockFrom.mockReturnValue(table);

    const result = await createSupportReportAction({}, makeReportFormData());

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(table.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: REPORTER.id }));
    expect(mockNotifyAdmins).toHaveBeenCalledTimes(1);
  });

  it("still returns success to the user even if the admin email notification unexpectedly throws (belt-and-suspenders beyond notifyAdminsOfNewReport's own internal try/catch)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: REPORTER } });
    const table = makeSupportReportsTable();
    mockFrom.mockReturnValue(table);
    mockNotifyAdmins.mockRejectedValue(new Error("email provider down"));

    const result = await createSupportReportAction({}, makeReportFormData());

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    // The report was genuinely saved, not just "reported as saved" - the
    // insert happened before the (failing) notification step ran.
    expect(table.insert).toHaveBeenCalledTimes(1);
  });

  it("surfaces a clear Hebrew error (not a raw DB error) when the insert fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: REPORTER } });
    mockFrom.mockReturnValue(makeSupportReportsTable({ insertError: { message: "constraint violation xyz" } }));

    const result = await createSupportReportAction({}, makeReportFormData());

    expect(result.error).toBeTruthy();
    expect(result.error).not.toContain("constraint violation xyz");
  });
});

describe("updateSupportReportAction", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockFrom.mockReset();
  });

  function makeProfilesTable(role: string) {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { role } }),
    };
  }

  it("rejects a non-admin caller", async () => {
    mockGetUser.mockResolvedValue({ data: { user: REPORTER } });
    mockFrom.mockReturnValue(makeProfilesTable("user"));

    const fd = new FormData();
    fd.set("reportId", "report-1");
    fd.set("status", "resolved");
    fd.set("adminNote", "");

    const result = await updateSupportReportAction({}, fd);

    expect(result.error).toBeTruthy();
  });

  it("rejects an invalid status value", async () => {
    mockGetUser.mockResolvedValue({ data: { user: ADMIN } });
    mockFrom.mockReturnValue(makeProfilesTable("admin"));

    const fd = new FormData();
    fd.set("reportId", "report-1");
    fd.set("status", "not-a-real-status");
    fd.set("adminNote", "");

    const result = await updateSupportReportAction({}, fd);

    expect(result.error).toMatch(/סטטוס/);
  });

  it("allows an admin to update status and internal note", async () => {
    mockGetUser.mockResolvedValue({ data: { user: ADMIN } });
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeProfilesTable("admin");
      return {
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      };
    });

    const fd = new FormData();
    fd.set("reportId", "report-1");
    fd.set("status", "resolved");
    fd.set("adminNote", "טופל, היה בעיית קאש");

    const result = await updateSupportReportAction({}, fd);

    expect(result.success).toBe(true);
  });
});
