import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockGetUser = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockIs = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({ update: mockUpdate })),
  })),
}));

import { completeOnboardingAction } from "@/lib/actions/onboarding";

const USER = { id: "11111111-1111-1111-1111-111111111101" };

describe("completeOnboardingAction", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockUpdate.mockReset();
    mockEq.mockReset();
    mockIs.mockReset();
    mockIs.mockResolvedValue({ error: null });
    mockEq.mockReturnValue({ is: mockIs });
    mockUpdate.mockReturnValue({ eq: mockEq });
  });

  it("does nothing when logged out", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await completeOnboardingAction();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("sets onboarding_completed_at only for the current user, only if not already set", async () => {
    mockGetUser.mockResolvedValue({ data: { user: USER } });
    await completeOnboardingAction();

    expect(mockUpdate).toHaveBeenCalledWith({ onboarding_completed_at: expect.any(String) });
    expect(mockEq).toHaveBeenCalledWith("id", USER.id);
    expect(mockIs).toHaveBeenCalledWith("onboarding_completed_at", null);
  });

  it("does not throw if the update fails (best-effort, non-blocking)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: USER } });
    mockIs.mockResolvedValue({ error: { message: "db down" } });
    await expect(completeOnboardingAction()).resolves.toBeUndefined();
  });
});
