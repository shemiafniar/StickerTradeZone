"use client";

import { useActionState, useState, useTransition } from "react";
import { scanAlbumPageAction, scanDuplicatesAction, type ScanActionState } from "@/lib/actions/scanner";
import {
  bulkAddDuplicatesAction,
  bulkAddMissingAction,
  bulkRemoveMissingByNumbersAction,
  type StickerActionState,
} from "@/lib/actions/stickers";
import { ImageDropzone } from "@/components/scanner/ImageDropzone";
import { ConfidenceBadge } from "@/components/scanner/ConfidenceBadge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { ErrorMessage, SuccessMessage } from "@/components/ui/FormMessage";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type Mode = "duplicates" | "album";

interface ReviewRow {
  id: string;
  number: number;
  confidence: number;
  included: boolean;
  filled?: boolean;
}

const scanInitialState: ScanActionState = {};
const stickerInitialState: StickerActionState = {};

export function ScannerApp() {
  const [mode, setMode] = useState<Mode>("duplicates");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [manualNumber, setManualNumber] = useState("");
  const [listingType, setListingType] = useState("trade");
  const [saveState, setSaveState] = useState<{ error?: string; success?: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  const [dupState, dupFormAction, dupPending] = useActionState(scanDuplicatesAction, scanInitialState);
  const [albumState, albumFormAction, albumPending] = useActionState(scanAlbumPageAction, scanInitialState);

  const scanState = mode === "duplicates" ? dupState : albumState;
  const scanPending = mode === "duplicates" ? dupPending : albumPending;

  // Populate the review rows whenever a new scan result comes back from the
  // server action. This is React's documented "adjust state during render"
  // pattern (comparing against the last-handled result) rather than a
  // useEffect, so a fresh scan result is reflected in the very same render.
  const [handledDupResult, setHandledDupResult] = useState(dupState.duplicateResult);
  if (dupState.duplicateResult !== handledDupResult) {
    setHandledDupResult(dupState.duplicateResult);
    if (dupState.duplicateResult) {
      setRows(
        dupState.duplicateResult.detected.map((d, i) => ({
          id: `d-${i}-${d.number}`,
          number: d.number,
          confidence: d.confidence,
          included: true,
        }))
      );
      setSaveState(null);
    }
  }

  const [handledAlbumResult, setHandledAlbumResult] = useState(albumState.albumResult);
  if (albumState.albumResult !== handledAlbumResult) {
    setHandledAlbumResult(albumState.albumResult);
    if (albumState.albumResult) {
      setRows(
        albumState.albumResult.slots.map((s, i) => ({
          id: `a-${i}-${s.number}`,
          number: s.number,
          confidence: s.confidence,
          included: true,
          filled: s.filled,
        }))
      );
      setSaveState(null);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setFile(null);
    setRows([]);
    setSaveState(null);
    setUploadError(null);
  }

  function updateRow(id: string, patch: Partial<ReviewRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function addManualRow() {
    const number = Number(manualNumber);
    if (!Number.isFinite(number) || number <= 0) return;
    setRows((prev) => [
      ...prev,
      { id: `manual-${Date.now()}`, number, confidence: 1, included: true, filled: mode === "album" ? true : undefined },
    ]);
    setManualNumber("");
  }

  function handleSave() {
    const included = rows.filter((r) => r.included);
    if (included.length === 0) {
      setSaveState({ error: "לא נבחרו מדבקות לשמירה" });
      return;
    }

    startSaving(async () => {
      if (mode === "duplicates") {
        const fd = new FormData();
        fd.set("numbers", included.map((r) => r.number).join(","));
        fd.set("listingType", listingType);
        const result = await bulkAddDuplicatesAction(stickerInitialState, fd);
        if (result.error) setSaveState({ error: result.error });
        else {
          setSaveState({ success: `נוספו ${result.addedCount ?? included.length} מדבקות לרשימת הכפולים שלך!` });
          setRows([]);
          setFile(null);
        }
        return;
      }

      const filledNumbers = included.filter((r) => r.filled).map((r) => r.number);
      const emptyNumbers = included.filter((r) => !r.filled).map((r) => r.number);

      if (filledNumbers.length > 0) {
        const fd = new FormData();
        fd.set("numbers", filledNumbers.join(","));
        await bulkRemoveMissingByNumbersAction(stickerInitialState, fd);
      }

      if (emptyNumbers.length > 0) {
        const fd = new FormData();
        fd.set("numbers", emptyNumbers.join(","));
        await bulkAddMissingAction(stickerInitialState, fd);
      }

      setSaveState({
        success: `העדכון בוצע: ${filledNumbers.length} מדבקות סומנו כקיימות, ${emptyNumbers.length} נוספו לרשימת החוסרים.`,
      });
      setRows([]);
      setFile(null);
    });
  }

  return (
    <div>
      <div className="mb-5 flex gap-2 rounded-xl bg-black/5 p-1">
        <ModeTab active={mode === "duplicates"} onClick={() => switchMode("duplicates")}>
          📷 סורק כפולים
        </ModeTab>
        <ModeTab active={mode === "album"} onClick={() => switchMode("album")}>
          📖 סורק עמוד אלבום
        </ModeTab>
      </div>

      <Card>
        <p className="mb-3 text-sm text-foreground/70">
          {mode === "duplicates"
            ? "צלמו כמה מדבקות כפולות יחד על משטח אחיד, והמערכת תזהה את המספרים שלהן."
            : "צלמו עמוד פתוח באלבום, והמערכת תזהה אילו משבצות מלאות ואילו ריקות."}
        </p>

        <form
          action={mode === "duplicates" ? dupFormAction : albumFormAction}
          onSubmit={(e) => {
            if (!file) {
              e.preventDefault();
              setUploadError("נא לבחור תמונה קודם");
            }
          }}
        >
          <ImageDropzone
            onFileSelected={(f) => {
              setUploadError(null);
              setFile(f);
            }}
            onError={(message) => {
              setUploadError(message);
              setFile(null);
            }}
            disabled={scanPending}
          />
          {file && <input type="file" name="image" hidden ref={(el) => setFileOnInput(el, file)} />}

          <Button type="submit" disabled={!file || scanPending} className="mt-4 w-full">
            {scanPending ? "סורק..." : "🔍 סרוק תמונה"}
          </Button>
        </form>

        <ErrorMessage message={uploadError ?? undefined} />
        <ErrorMessage message={scanState.error} />

        {scanState.providerName && (
          <p className="mt-2 text-xs text-foreground/40">מנוע זיהוי: {scanState.providerName}</p>
        )}
        {(dupState.duplicateResult?.notes || albumState.albumResult?.notes) && (
          <p className="mt-1 text-xs text-amber-700">
            {mode === "duplicates" ? dupState.duplicateResult?.notes : albumState.albumResult?.notes}
          </p>
        )}
      </Card>

      {rows.length > 0 && (
        <Card className="mt-4">
          <h2 className="mb-3 text-lg font-bold">בדיקה ואישור לפני שמירה</h2>
          <ErrorMessage message={saveState?.error} />
          <SuccessMessage message={saveState?.success} />

          <div className="flex flex-col gap-2">
            {rows.map((row) => (
              <div
                key={row.id}
                className={cn(
                  "flex items-center gap-2 rounded-xl border p-2.5",
                  row.included ? "border-black/10 bg-white" : "border-black/5 bg-black/[0.02] opacity-50"
                )}
              >
                <input
                  type="checkbox"
                  checked={row.included}
                  onChange={(e) => updateRow(row.id, { included: e.target.checked })}
                  className="h-5 w-5 shrink-0 rounded accent-brand"
                />
                <span className="text-sm font-bold text-foreground/50">#</span>
                <input
                  type="number"
                  value={row.number}
                  onChange={(e) => updateRow(row.id, { number: Number(e.target.value) })}
                  className="w-20 rounded-lg border border-black/10 px-2 py-1 text-sm font-bold"
                />
                <ConfidenceBadge confidence={row.confidence} />

                {mode === "album" && (
                  <button
                    type="button"
                    onClick={() => updateRow(row.id, { filled: !row.filled })}
                    className={cn(
                      "mr-auto rounded-lg px-2.5 py-1 text-xs font-bold",
                      row.filled ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    )}
                  >
                    {row.filled ? "✅ מלאה" : "◻️ ריקה"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className={cn("rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50", mode !== "album" && "mr-auto")}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <input
              type="number"
              placeholder="הוספת מספר ידנית"
              value={manualNumber}
              onChange={(e) => setManualNumber(e.target.value)}
              className="w-40 rounded-lg border border-black/10 px-3 py-1.5 text-sm"
            />
            <Button type="button" variant="outline" size="sm" onClick={addManualRow}>
              הוספה
            </Button>
          </div>

          {mode === "duplicates" && (
            <div className="mt-4 max-w-xs">
              <label className="mb-1.5 block text-sm font-semibold text-foreground/80">איך להציג את המדבקות?</label>
              <Select value={listingType} onChange={(e) => setListingType(e.target.value)}>
                <option value="trade">להחלפה בלבד</option>
                <option value="sale">למכירה בלבד</option>
                <option value="both">להחלפה או למכירה</option>
              </Select>
            </div>
          )}

          <Button className="mt-4 w-full" disabled={isSaving} onClick={handleSave}>
            {isSaving
              ? "שומר..."
              : mode === "duplicates"
                ? "💾 שמירה ברשימת הכפולים שלי"
                : "💾 עדכון רשימת החוסרים שלי"}
          </Button>
        </Card>
      )}
    </div>
  );
}

// Programmatically attach the selected File to a hidden native file input so
// the surrounding <form action={serverAction}> can submit it like a normal
// file field (server actions read Files straight off the FormData).
function setFileOnInput(element: HTMLInputElement | null, file: File) {
  if (!element) return;
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  element.files = dataTransfer.files;
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-lg px-3 py-2.5 text-center text-sm font-bold transition",
        active ? "bg-white text-brand-dark shadow-sm" : "text-foreground/60 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
