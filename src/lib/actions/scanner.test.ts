import { describe, expect, it, vi, beforeEach } from "vitest";
import { VisionApiError, VisionParseError, VisionTimeoutError } from "@/lib/vision/errors";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

const mockScanStickerBacks = vi.fn();
const mockProviderName = { current: "Mock Provider" };

vi.mock("@/lib/vision", () => ({
  getVisionProvider: vi.fn(() => ({
    get name() {
      return mockProviderName.current;
    },
    isMock: true,
    scanStickerBacks: mockScanStickerBacks,
  })),
}));

vi.mock("@/lib/rateLimit", () => ({
  formatRetrySeconds: vi.fn(() => "כמה דקות"),
}));

import { scanStickerBacksAction } from "@/lib/actions/scanner";

const AUTHENTICATED_USER = { id: "11111111-1111-1111-1111-111111111101" };

/** Builds a chainable mock matching the subset of the Supabase query builder scanner.ts actually calls. */
function makeScanEventsTable({ count = 0, insertError = null }: { count?: number; insertError?: unknown } = {}) {
  const selectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockResolvedValue({ count }),
  };
  return {
    ...selectChain,
    insert: vi.fn().mockResolvedValue({ error: insertError }),
  };
}

function makeFormDataWithImage(overrides: Partial<{ name: string; type: string; size: number }> = {}) {
  const { name = "photo.jpg", type = "image/jpeg", size = 1024 } = overrides;
  const bytes = new Uint8Array(size);
  const file = new File([bytes], name, { type });
  const formData = new FormData();
  formData.set("image", file);
  return formData;
}

describe("scanStickerBacksAction", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockFrom.mockReset();
    mockScanStickerBacks.mockReset();
    mockProviderName.current = "Mock Provider";
  });

  it("requires authentication before touching the vision provider", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await scanStickerBacksAction({}, makeFormDataWithImage());

    expect(result.error).toBeTruthy();
    expect(mockScanStickerBacks).not.toHaveBeenCalled();
  });

  it("rejects a missing image with a clear Hebrew message", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTHENTICATED_USER } });

    const result = await scanStickerBacksAction({}, new FormData());

    expect(result.error).toBeTruthy();
    expect(mockScanStickerBacks).not.toHaveBeenCalled();
  });

  it("rejects an invalid/non-image file type", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTHENTICATED_USER } });

    const formData = makeFormDataWithImage({ name: "resume.pdf", type: "application/pdf" });
    const result = await scanStickerBacksAction({}, formData);

    expect(result.error).toMatch(/פורמט/);
    expect(mockScanStickerBacks).not.toHaveBeenCalled();
  });

  it("rejects an oversized image", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTHENTICATED_USER } });

    const formData = makeFormDataWithImage({ size: 9 * 1024 * 1024 });
    const result = await scanStickerBacksAction({}, formData);

    expect(result.error).toMatch(/גדולה מדי/);
    expect(mockScanStickerBacks).not.toHaveBeenCalled();
  });

  it("enforces the per-hour scan rate limit", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTHENTICATED_USER } });
    mockFrom.mockReturnValue(makeScanEventsTable({ count: 20 }));

    const result = await scanStickerBacksAction({}, makeFormDataWithImage());

    expect(result.error).toMatch(/מגבלת הסריקות/);
    expect(mockScanStickerBacks).not.toHaveBeenCalled();
  });

  it("returns the detected stickers on success, without leaking internals", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTHENTICATED_USER } });
    mockFrom.mockReturnValue(makeScanEventsTable());
    mockScanStickerBacks.mockResolvedValue({ detected: [{ teamCode: "GER", number: 2, confidence: 0.9 }], isMock: true });

    const result = await scanStickerBacksAction({}, makeFormDataWithImage());

    expect(result.error).toBeUndefined();
    expect(result.result?.detected).toHaveLength(1);
    expect(result.providerName).toBe("Mock Provider");
  });

  it("still succeeds (with an empty result, not an error) when no stickers are identified", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTHENTICATED_USER } });
    mockFrom.mockReturnValue(makeScanEventsTable());
    mockScanStickerBacks.mockResolvedValue({ detected: [], isMock: true });

    const result = await scanStickerBacksAction({}, makeFormDataWithImage());

    expect(result.error).toBeUndefined();
    expect(result.result?.detected).toHaveLength(0);
  });

  it("never lets an unexpected provider exception through to an uncaught throw - and never leaks the raw error text", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTHENTICATED_USER } });
    mockFrom.mockReturnValue(makeScanEventsTable());
    mockScanStickerBacks.mockRejectedValue(new Error("some very specific internal stack trace with a sk-secret123 in it"));

    const result = await expect(scanStickerBacksAction({}, makeFormDataWithImage())).resolves.toBeDefined();
    const state = await scanStickerBacksAction({}, makeFormDataWithImage());

    expect(state.error).toBeTruthy();
    expect(state.error).not.toContain("sk-secret123");
    expect(state.error).toMatch(/[\u0590-\u05FF]/); // Hebrew
    expect(result).toBeDefined();
  });

  it("maps a timeout to a specific 'took too long' Hebrew message", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTHENTICATED_USER } });
    mockFrom.mockReturnValue(makeScanEventsTable());
    mockScanStickerBacks.mockRejectedValue(new VisionTimeoutError());

    const result = await scanStickerBacksAction({}, makeFormDataWithImage());

    expect(result.error).toMatch(/זמן רב/);
  });

  it("maps a 429 rate-limit response from the provider to a 'busy, try later' message", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTHENTICATED_USER } });
    mockFrom.mockReturnValue(makeScanEventsTable());
    mockScanStickerBacks.mockRejectedValue(new VisionApiError("rate limited upstream", 429));

    const result = await scanStickerBacksAction({}, makeFormDataWithImage());

    expect(result.error).toMatch(/עמוס/);
  });

  it("maps a malformed AI response to a 'could not parse result' message, distinct from a network failure", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTHENTICATED_USER } });
    mockFrom.mockReturnValue(makeScanEventsTable());
    mockScanStickerBacks.mockRejectedValue(new VisionParseError("bad json"));

    const result = await scanStickerBacksAction({}, makeFormDataWithImage());

    expect(result.error).toMatch(/לפרש/);
  });

  it("does not block the scan itself when the best-effort rate-limit log insert fails (e.g. a drifted check constraint)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTHENTICATED_USER } });
    mockFrom.mockReturnValue(makeScanEventsTable({ insertError: { message: "violates check constraint" } }));
    mockScanStickerBacks.mockResolvedValue({ detected: [], isMock: true });

    const result = await scanStickerBacksAction({}, makeFormDataWithImage());

    expect(result.error).toBeUndefined();
  });
});
