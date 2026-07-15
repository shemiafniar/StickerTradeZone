import * as XLSX from "@e965/xlsx";
import type { CollectionExportFilter, CollectionExportRow } from "@/lib/data/collectionExport";

export type ExportFormat = "xlsx" | "ods" | "csv";

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  xlsx: "Excel (XLSX)",
  ods: "OpenDocument (ODS)",
  csv: "CSV",
};

const FORMAT_CONFIG: Record<ExportFormat, { bookType: XLSX.BookType; contentType: string; extension: string }> = {
  xlsx: {
    bookType: "xlsx",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: "xlsx",
  },
  ods: {
    bookType: "ods",
    contentType: "application/vnd.oasis.opendocument.spreadsheet",
    extension: "ods",
  },
  csv: {
    bookType: "csv",
    contentType: "text/csv; charset=utf-8",
    extension: "csv",
  },
};

const COLUMN_HEADERS = [
  "קוד מדבקה",
  "נבחרת/קטגוריה",
  "מספר",
  "כמות בבעלות",
  "כפולות זמינות",
  "סטטוס",
  "סוג רישום",
  "מחיר",
];

const STATUS_LABELS_HE: Record<CollectionExportRow["status"], string> = {
  owned: "בבעלותי",
  missing: "חסרה",
  unmarked: "לא סומנה",
};

const LISTING_TYPE_LABELS_HE: Record<string, string> = {
  trade: "להחלפה",
  sale: "למכירה",
  both: "להחלפה ולמכירה",
};

function toSheetRow(row: CollectionExportRow): (string | number)[] {
  return [
    row.code,
    row.team,
    row.number,
    row.quantityOwned,
    row.availableDuplicates,
    STATUS_LABELS_HE[row.status],
    row.listingType ? LISTING_TYPE_LABELS_HE[row.listingType] ?? row.listingType : "",
    row.price ?? "",
  ];
}

/** A UTF-8 BOM prefix is required for Excel (particularly on Windows) to correctly display Hebrew/non-ASCII text when opening a plain CSV file - without it, the file is still valid UTF-8 but Excel guesses the wrong legacy encoding and shows mojibake. */
const UTF8_BOM = "\uFEFF";

export interface CollectionExportFile {
  buffer: Buffer;
  contentType: string;
  extension: string;
}

/** Builds the actual downloadable file bytes for a collection export - pure function over already-fetched, already-filtered rows; performs no data access or authorization itself. */
export function buildCollectionExportFile(rows: CollectionExportRow[], format: ExportFormat): CollectionExportFile {
  const config = FORMAT_CONFIG[format];
  const sheetData = [COLUMN_HEADERS, ...rows.map(toSheetRow)];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "האוסף שלי");

  if (format === "csv") {
    const csvBody = XLSX.utils.sheet_to_csv(worksheet);
    return { buffer: Buffer.from(UTF8_BOM + csvBody, "utf-8"), contentType: config.contentType, extension: config.extension };
  }

  const output = XLSX.write(workbook, { bookType: config.bookType, type: "buffer" }) as Buffer;
  return { buffer: output, contentType: config.contentType, extension: config.extension };
}

/**
 * Deliberately built from only fixed, non-user-controlled inputs (today's
 * date plus a closed enum of filter/format values) - never from a display
 * name, email, or any other free-text field - so there is no path for
 * header-injection or path-traversal via a crafted profile.
 */
export function buildExportFilename(filter: CollectionExportFilter, format: ExportFormat, date: Date = new Date()): string {
  const datePart = date.toISOString().slice(0, 10);
  const config = FORMAT_CONFIG[format];
  return `shashot-collection-${filter}-${datePart}.${config.extension}`;
}
