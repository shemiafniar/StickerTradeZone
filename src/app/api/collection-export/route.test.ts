import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockGetMyCollectionForExport } = vi.hoisted(() => ({
  mockGetMyCollectionForExport: vi.fn(),
}));

vi.mock("@/lib/data/collectionExport", () => ({
  getMyCollectionForExport: mockGetMyCollectionForExport,
}));

import { GET } from "@/app/api/collection-export/route";
import type { CollectionExportRow } from "@/lib/data/collectionExport";

const SAMPLE_ROWS: CollectionExportRow[] = [
  {
    code: "GER-1",
    team: "גרמניה",
    number: 1,
    quantityOwned: 2,
    availableDuplicates: 1,
    status: "owned",
    listingType: "trade",
    price: null,
  },
];

function makeRequest(query: string) {
  return new Request(`http://localhost:3000/api/collection-export${query}`) as never;
}

describe("GET /api/collection-export", () => {
  beforeEach(() => {
    mockGetMyCollectionForExport.mockReset();
  });

  it("rejects an unauthenticated request with 401 (getMyCollectionForExport returned null)", async () => {
    mockGetMyCollectionForExport.mockResolvedValue(null);

    const response = await GET(makeRequest("?format=xlsx&filter=full"));

    expect(response.status).toBe(401);
  });

  it("rejects an unsupported format with 400 before ever touching the data layer", async () => {
    const response = await GET(makeRequest("?format=exe&filter=full"));
    expect(response.status).toBe(400);
    expect(mockGetMyCollectionForExport).not.toHaveBeenCalled();
  });

  it("rejects an unsupported filter with 400 before ever touching the data layer", async () => {
    const response = await GET(makeRequest("?format=xlsx&filter=not-a-real-filter"));
    expect(response.status).toBe(400);
    expect(mockGetMyCollectionForExport).not.toHaveBeenCalled();
  });

  it("defaults to format=xlsx and filter=full when neither is specified", async () => {
    mockGetMyCollectionForExport.mockResolvedValue(SAMPLE_ROWS);
    const response = await GET(makeRequest(""));

    expect(response.status).toBe(200);
    expect(mockGetMyCollectionForExport).toHaveBeenCalledWith("full", undefined);
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  });

  it.each([
    ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["ods", "application/vnd.oasis.opendocument.spreadsheet"],
    ["csv", "text/csv; charset=utf-8"],
  ])("returns the correct Content-Type for format=%s", async (format, expectedContentType) => {
    mockGetMyCollectionForExport.mockResolvedValue(SAMPLE_ROWS);
    const response = await GET(makeRequest(`?format=${format}&filter=owned`));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(expectedContentType);
  });

  it("returns a safe Content-Disposition filename derived only from the filter/format/date, never from user data", async () => {
    mockGetMyCollectionForExport.mockResolvedValue(SAMPLE_ROWS);
    const response = await GET(makeRequest("?format=csv&filter=duplicates"));

    const disposition = response.headers.get("content-disposition");
    expect(disposition).toContain("attachment");
    expect(disposition).toMatch(/filename="shashot-collection-duplicates-\d{4}-\d{2}-\d{2}\.csv"/);
  });

  it("passes the team query param through to the data layer for the 'team' filter", async () => {
    mockGetMyCollectionForExport.mockResolvedValue(SAMPLE_ROWS);
    await GET(makeRequest("?format=xlsx&filter=team&team=GER"));

    expect(mockGetMyCollectionForExport).toHaveBeenCalledWith("team", "GER");
  });

  it("produces a non-empty response body", async () => {
    mockGetMyCollectionForExport.mockResolvedValue(SAMPLE_ROWS);
    const response = await GET(makeRequest("?format=xlsx&filter=full"));

    const buf = Buffer.from(await response.arrayBuffer());
    expect(buf.length).toBeGreaterThan(0);
  });
});
