import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockGetUser = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
  })),
}));

import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions/notifications";

const AUTHENTICATED_USER = { id: "11111111-1111-1111-1111-111111111101" };

describe("markAllNotificationsReadAction", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockRpc.mockReset();
  });

  it("requires authentication - returns an error and never calls the RPC when logged out", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await markAllNotificationsReadAction();

    expect(result.error).toBeTruthy();
    expect(result.success).toBeUndefined();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("calls the mark_all_notifications_read RPC with no arguments for the authenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTHENTICATED_USER } });
    mockRpc.mockResolvedValue({ error: null });

    const result = await markAllNotificationsReadAction();

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockRpc).toHaveBeenCalledWith("mark_all_notifications_read");
  });

  it("surfaces a Hebrew error message (instead of silently succeeding) when the RPC call fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTHENTICATED_USER } });
    mockRpc.mockResolvedValue({ error: { message: "permission denied" } });

    const result = await markAllNotificationsReadAction();

    expect(result.success).toBeUndefined();
    expect(result.error).toBeTruthy();
    expect(result.error).toMatch(/[\u0590-\u05FF]/); // contains Hebrew characters
  });

  it("returns a friendly error instead of throwing when the client setup itself throws", async () => {
    mockGetUser.mockRejectedValue(new Error("network down"));

    const result = await markAllNotificationsReadAction();

    expect(result.error).toBeTruthy();
  });
});

describe("markNotificationReadAction", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockRpc.mockReset();
  });

  it("requires authentication", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await markNotificationReadAction("some-notification-id");

    expect(result.error).toBeTruthy();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("passes the notification id through to the RPC - server-side scoping to the caller's own rows happens inside mark_notification_read() itself (user_id = auth.uid()), not here", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTHENTICATED_USER } });
    mockRpc.mockResolvedValue({ error: null });

    const result = await markNotificationReadAction("notif-123");

    expect(result.success).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith("mark_notification_read", { p_notification_id: "notif-123" });
  });

  it("surfaces an error when the RPC fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTHENTICATED_USER } });
    mockRpc.mockResolvedValue({ error: { message: "boom" } });

    const result = await markNotificationReadAction("notif-123");

    expect(result.error).toBeTruthy();
  });
});
