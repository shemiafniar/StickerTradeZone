import { describe, expect, it } from "vitest";
import * as XLSX from "@e965/xlsx";
import { buildCollectionExportFile, buildExportFilename, type ExportFormat } from "@/lib/collectionExportFile";
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
  {
    code: "GER-2",
    team: "גרמניה",
    number: 2,
    quantityOwned: 0,
    availableDuplicates: 0,
    status: "missing",
    listingType: null,
    price: null,
  },
  {
    code: "FRA-5",
    team: "צרפת",
    number: 5,
    quantityOwned: 3,
    availableDuplicates: 2,
    status: "owned",
    listingType: "sale",
    price: 5,
  },
];

const FORMATS: ExportFormat[] = ["xlsx", "ods", "csv"];

describe("buildCollectionExportFile - content type per format", () => {
  it("returns the correct Content-Type for xlsx", () => {
    const file = buildCollectionExportFile(SAMPLE_ROWS, "xlsx");
    expect(file.contentType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(file.extension).toBe("xlsx");
  });

  it("returns the correct Content-Type for ods", () => {
    const file = buildCollectionExportFile(SAMPLE_ROWS, "ods");
    expect(file.contentType).toBe("application/vnd.oasis.opendocument.spreadsheet");
    expect(file.extension).toBe("ods");
  });

  it("returns the correct Content-Type for csv", () => {
    const file = buildCollectionExportFile(SAMPLE_ROWS, "csv");
    expect(file.contentType).toBe("text/csv; charset=utf-8");
    expect(file.extension).toBe("csv");
  });
});

describe("buildCollectionExportFile - produces real, non-empty file bytes", () => {
  it.each(FORMATS)("produces a non-empty buffer for %s", (format) => {
    const file = buildCollectionExportFile(SAMPLE_ROWS, format);
    expect(file.buffer.length).toBeGreaterThan(0);
    expect(Buffer.isBuffer(file.buffer)).toBe(true);
  });

  it("the xlsx buffer round-trips back to the exact same row data via XLSX.read", () => {
    const file = buildCollectionExportFile(SAMPLE_ROWS, "xlsx");
    const workbook = XLSX.read(file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

    // header row + one row per sticker
    expect(rows).toHaveLength(SAMPLE_ROWS.length + 1);
    expect(rows[0]).toEqual([
      "קוד מדבקה",
      "נבחרת/קטגוריה",
      "מספר",
      "כמות בבעלות",
      "כפולות זמינות",
      "סטטוס",
      "סוג רישום",
      "מחיר",
    ]);
    expect(rows[1][0]).toBe("GER-1");
    expect(rows[1][3]).toBe(2);
    expect(rows[2][0]).toBe("GER-2");
    expect(rows[3][0]).toBe("FRA-5");
  });

  it("the CSV output includes a UTF-8 BOM so Hebrew text renders correctly in Excel", () => {
    const file = buildCollectionExportFile(SAMPLE_ROWS, "csv");
    const text = file.buffer.toString("utf-8");
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain("GER-1");
    expect(text).toContain("קוד מדבקה");
  });

  it("handles an empty row list without throwing (still produces a header-only file)", () => {
    for (const format of FORMATS) {
      const file = buildCollectionExportFile([], format);
      expect(file.buffer.length).toBeGreaterThan(0);
    }
  });
});

describe("buildExportFilename", () => {
  const fixedDate = new Date("2026-07-15T10:00:00Z");

  it("includes the filter, the date, and the correct extension for each format", () => {
    expect(buildExportFilename("owned", "xlsx", fixedDate)).toBe("shashot-collection-owned-2026-07-15.xlsx");
    expect(buildExportFilename("missing", "ods", fixedDate)).toBe("shashot-collection-missing-2026-07-15.ods");
    expect(buildExportFilename("full", "csv", fixedDate)).toBe("shashot-collection-full-2026-07-15.csv");
  });

  it("never includes characters unsafe for a Content-Disposition header (only alnum, hyphen, dot)", () => {
    const filename = buildExportFilename("duplicates", "xlsx", fixedDate);
    expect(filename).toMatch(/^[a-zA-Z0-9.-]+$/);
  });
});
