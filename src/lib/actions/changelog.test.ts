import { describe, expect, it, vi, beforeEach } from "vitest";
import { CURRENT_CHANGELOG_VERSION } from "@/lib/changelog";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockGetUser = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({ update: mockUpdate })),
  })),
}));

import { dismissChangelogAction } from "@/lib/actions/changelog";

const USER = { id: "11111111-1111-1111-1111-111111111101" };
const OTHER_USER = { id: "11111111-1111-1111-1111-111111111102" };

describe("dismissChangelogAction", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockUpdate.mockReset();
    mockEq.mockReset();
    mockEq.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
  });

  it("does nothing when logged out", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await dismissChangelogAction();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("sets last_seen_changelog_version to the current changelog version, scoped to only the authenticated user's own profile", async () => {
    mockGetUser.mockResolvedValue({ data: { user: USER } });
    await dismissChangelogAction();

    expect(mockUpdate).toHaveBeenCalledWith({ last_seen_changelog_version: CURRENT_CHANGELOG_VERSION });
    expect(mockEq).toHaveBeenCalledWith("id", USER.id);
    expect(mockEq).not.toHaveBeenCalledWith("id", OTHER_USER.id);
  });

  it("does not throw if the update fails (best-effort, non-blocking)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: USER } });
    mockEq.mockResolvedValue({ error: { message: "db down" } });
    await expect(dismissChangelogAction()).resolves.toBeUndefined();
  });
});
