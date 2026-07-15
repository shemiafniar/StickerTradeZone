import { NextResponse, type NextRequest } from "next/server";
import { getMyCollectionForExport, type CollectionExportFilter } from "@/lib/data/collectionExport";
import { buildCollectionExportFile, buildExportFilename, type ExportFormat } from "@/lib/collectionExportFile";

const VALID_FORMATS: ExportFormat[] = ["xlsx", "ods", "csv"];
const VALID_FILTERS: CollectionExportFilter[] = ["full", "owned", "missing", "duplicates", "for_sale", "for_trade", "team"];

/**
 * Authenticated file-download endpoint for a user's own collection export.
 * getMyCollectionForExport() only ever reads the *caller's* session-derived
 * user id (see its own doc comment) - there is no userId query param here
 * and none is accepted, so there is no way for this endpoint to return
 * another user's collection.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const formatParam = searchParams.get("format") ?? "xlsx";
  const filterParam = searchParams.get("filter") ?? "full";
  const teamParam = searchParams.get("team") ?? undefined;

  if (!VALID_FORMATS.includes(formatParam as ExportFormat)) {
    return NextResponse.json({ error: "פורמט קובץ לא נתמך" }, { status: 400 });
  }
  if (!VALID_FILTERS.includes(filterParam as CollectionExportFilter)) {
    return NextResponse.json({ error: "סינון לא נתמך" }, { status: 400 });
  }
  const format = formatParam as ExportFormat;
  const filter = filterParam as CollectionExportFilter;

  const rows = await getMyCollectionForExport(filter, teamParam);
  if (rows === null) {
    return NextResponse.json({ error: "יש להתחבר כדי לייצא את האוסף" }, { status: 401 });
  }

  const file = buildCollectionExportFile(rows, format);
  const filename = buildExportFilename(filter, format);

  return new NextResponse(new Uint8Array(file.buffer), {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(file.buffer.length),
      "Cache-Control": "no-store",
    },
  });
}
