import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockGetUser, mockFrom, mockRpc, mockResolveTarget } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  mockRpc: vi.fn(async (..._args: unknown[]): Promise<{ error: { message: string } | null }> => ({ error: null })),
  mockResolveTarget: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

vi.mock("@/lib/notifications/resolveTarget", () => ({
  resolveNotificationTarget: mockResolveTarget,
}));

import { GET } from "@/app/dashboard/notifications/go/[id]/route";

const USER_ID = "11111111-1111-1111-1111-111111111101";
const NOTIFICATION_ID = "33333333-3333-3333-3333-333333333301";

function makeRequest() {
  return new Request(`http://localhost:3000/dashboard/notifications/go/${NOTIFICATION_ID}`) as never;
}

function makeParams() {
  return Promise.resolve({ id: NOTIFICATION_ID });
}

function notificationTable(data: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data }),
  };
}

describe("GET /dashboard/notifications/go/[id]", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockFrom.mockReset();
    mockRpc.mockClear();
    mockRpc.mockResolvedValue({ error: null });
    mockResolveTarget.mockReset();
  });

  it("redirects to /login when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const response = await GET(makeRequest(), { params: makeParams() });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("redirects to the resolved target for the notification's own recipient", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockFrom.mockReturnValue(
      notificationTable({ id: NOTIFICATION_ID, user_id: USER_ID, link: "/dashboard/trades/abc" })
    );
    mockResolveTarget.mockResolvedValue("/dashboard/trades/abc");

    const response = await GET(makeRequest(), { params: makeParams() });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/dashboard/trades/abc");
    expect(mockRpc).toHaveBeenCalledWith("mark_notification_read", { p_notification_id: NOTIFICATION_ID });
  });

  it("falls back to the notifications page with an unavailable flag when the notification doesn't exist", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockFrom.mockReturnValue(notificationTable(null));

    const response = await GET(makeRequest(), { params: makeParams() });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/dashboard/notifications?unavailable=1");
    // Never even attempts to mark-as-read a notification that isn't there / isn't theirs.
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("falls back safely instead of redirecting into another user's notification, even if a row is somehow returned", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockFrom.mockReturnValue(
      notificationTable({ id: NOTIFICATION_ID, user_id: "someone-else", link: "/dashboard/trades/abc" })
    );

    const response = await GET(makeRequest(), { params: makeParams() });

    expect(response.headers.get("location")).toContain("/dashboard/notifications?unavailable=1");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("falls back to the notifications page when the target cannot be resolved (deleted/inaccessible/malformed)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockFrom.mockReturnValue(
      notificationTable({ id: NOTIFICATION_ID, user_id: USER_ID, link: "/dashboard/trades/deleted-trade" })
    );
    mockResolveTarget.mockResolvedValue(null);

    const response = await GET(makeRequest(), { params: makeParams() });

    expect(response.headers.get("location")).toContain("/dashboard/notifications?unavailable=1");
  });

  it("still redirects to the resolved target even if marking as read fails (never blocks navigation)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockFrom.mockReturnValue(
      notificationTable({ id: NOTIFICATION_ID, user_id: USER_ID, link: "/dashboard/trades/abc" })
    );
    mockRpc.mockResolvedValue({ error: { message: "boom" } });
    mockResolveTarget.mockResolvedValue("/dashboard/trades/abc");

    const response = await GET(makeRequest(), { params: makeParams() });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/dashboard/trades/abc");
  });
});
