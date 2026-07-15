"use client";

import { useRef, useState } from "react";
import { EXPORT_FORMAT_LABELS, type ExportFormat } from "@/lib/collectionExportFile";
import type { CollectionExportFilter } from "@/lib/data/collectionExport";
import { Button } from "@/components/ui/Button";
import { useClickOutside } from "@/lib/useClickOutside";

const FILTER_LABELS: Record<CollectionExportFilter, string> = {
  full: "כל האוסף",
  owned: "יש לי",
  missing: "חסר לי",
  duplicates: "כפולות",
  for_sale: "למכירה",
  for_trade: "להחלפה",
  team: "נבחרת ספציפית",
};

const FORMATS: ExportFormat[] = ["xlsx", "ods", "csv"];
const FILTERS: CollectionExportFilter[] = ["full", "owned", "missing", "duplicates", "for_sale", "for_trade", "team"];

export function ExportCollectionPanel({ teams }: { teams: { code: string; name_he: string }[] }) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [filter, setFilter] = useState<CollectionExportFilter>("full");
  const [teamCode, setTeamCode] = useState<string>(teams[0]?.code ?? "");
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));

  const params = new URLSearchParams({ format, filter });
  if (filter === "team" && teamCode) params.set("team", teamCode);
  const downloadHref = `/api/collection-export?${params.toString()}`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-bold text-foreground/70 transition hover:bg-black/5"
      >
        ⬇️ ייצוא אוסף
      </button>

      {open && (
        <div className="fixed inset-x-2 top-24 z-40 rounded-2xl border border-black/10 bg-white p-4 shadow-xl sm:absolute sm:inset-x-auto sm:top-11 sm:right-0 sm:w-72">
          <p className="mb-3 text-sm font-bold">ייצוא האוסף שלי</p>

          <label className="mb-1 block text-xs font-bold text-foreground/60">סינון</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as CollectionExportFilter)}
            className="mb-3 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
          >
            {FILTERS.map((f) => (
              <option key={f} value={f}>
                {FILTER_LABELS[f]}
              </option>
            ))}
          </select>

          {filter === "team" && (
            <>
              <label className="mb-1 block text-xs font-bold text-foreground/60">נבחרת</label>
              <select
                value={teamCode}
                onChange={(e) => setTeamCode(e.target.value)}
                className="mb-3 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
              >
                {teams.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name_he} ({t.code})
                  </option>
                ))}
              </select>
            </>
          )}

          <label className="mb-1 block text-xs font-bold text-foreground/60">פורמט קובץ</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as ExportFormat)}
            className="mb-4 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
          >
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {EXPORT_FORMAT_LABELS[f]}
              </option>
            ))}
          </select>

          <a href={downloadHref} download onClick={() => setOpen(false)}>
            <Button type="button" size="sm" className="w-full">
              הורדת קובץ
            </Button>
          </a>
        </div>
      )}
    </div>
  );
}
