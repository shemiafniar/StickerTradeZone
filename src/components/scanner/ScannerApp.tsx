"use client";

import { useActionState, useState, useTransition } from "react";
import { scanStickerBacksAction, type ScanActionState } from "@/lib/actions/scanner";
import { saveScannedStickersAsOwnedAction } from "@/lib/actions/stickers";
import { normalizeStickerCode } from "@/lib/stickerCodes";
import { resizeImageForUpload, ImageProcessingError } from "@/lib/image/resizeForUpload";
import { ImageDropzone } from "@/components/scanner/ImageDropzone";
import { ConfidenceBadge } from "@/components/scanner/ConfidenceBadge";
import { Button } from "@/components/ui/Button";
import { ErrorMessage, SuccessMessage } from "@/components/ui/FormMessage";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

interface ReviewRow {
  id: string;
  teamCode: string;
  number: number;
  confidence: number;
  included: boolean;
}

const scanInitialState: ScanActionState = {};

export function ScannerApp() {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [manualCode, setManualCode] = useState("");
  const [saveState, setSaveState] = useState<{ error?: string; success?: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isSaving, startSaving] = useTransition();

  // Every photo is resized/re-encoded to a modest JPEG client-side before
  // it's ever attached to the upload form - see resizeImageForUpload.ts for
  // why (body size limits, HEIC support, consistency). The original file
  // is only used for ImageDropzone's live preview.
  async function handleFileSelected(original: File) {
    setUploadError(null);
    setIsProcessingImage(true);
    try {
      const processed = await resizeImageForUpload(original);
      setFile(processed);
    } catch (err) {
      setFile(null);
      setUploadError(err instanceof ImageProcessingError ? err.message : "לא ניתן היה לעבד את התמונה. נסו קובץ אחר.");
    } finally {
      setIsProcessingImage(false);
    }
  }

  const [scanState, formAction, scanPending] = useActionState(scanStickerBacksAction, scanInitialState);

  // React's documented "adjust state during render" pattern (comparing
  // against the last-handled result) rather than a useEffect, so a fresh
  // scan result is reflected in the very same render.
  const [handledResult, setHandledResult] = useState(scanState.result);
  if (scanState.result !== handledResult) {
    setHandledResult(scanState.result);
    if (scanState.result) {
      setRows(
        scanState.result.detected.map((d, i) => ({
          id: `d-${i}-${d.teamCode}-${d.number}`,
          teamCode: d.teamCode,
          number: d.number,
          confidence: d.confidence,
          included: true,
        }))
      );
      setSaveState(null);
    }
  }

  function updateRow(id: string, patch: Partial<ReviewRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function addManualRow() {
    const normalized = normalizeStickerCode(manualCode);
    if (!normalized) return;
    const [teamCode, numberStr] = normalized.split("-");
    setRows((prev) => [
      ...prev,
      { id: `manual-${Date.now()}`, teamCode, number: Number(numberStr), confidence: 1, included: true },
    ]);
    setManualCode("");
  }

  function handleSave() {
    const included = rows.filter((r) => r.included);
    if (included.length === 0) {
      setSaveState({ error: "לא נבחרו מדבקות לשמירה" });
      return;
    }

    startSaving(async () => {
      const codes = included.map((r) => `${r.teamCode.toUpperCase()}-${r.number}`);
      const result = await saveScannedStickersAsOwnedAction(codes);
      if (result.error) {
        setSaveState({ error: result.error });
      } else {
        setSaveState({ success: `${result.addedCount ?? included.length} מדבקות סומנו כברשותך! 🎉` });
        setRows([]);
        setFile(null);
      }
    });
  }

  return (
    <div>
      <Card>
        <p className="mb-3 text-sm text-foreground/70">
          צלמו את <strong>הגב</strong> של כמה מדבקות יחד - המספר הייחודי (קוד נבחרת + מספר, למשל{" "}
          <span dir="ltr" className="font-bold">
            GER 2
          </span>
          ) מופיע בפינה הימנית-עליונה של כל מדבקה. המערכת תזהה את כולן ותסמן אותן כברשותכם.
        </p>

        <form
          action={formAction}
          onSubmit={(e) => {
            if (!file) {
              e.preventDefault();
              setUploadError("נא לבחור תמונה קודם");
            }
          }}
        >
          <ImageDropzone
            onFileSelected={(f) => {
              if (f) handleFileSelected(f);
              else {
                setUploadError(null);
                setFile(null);
              }
            }}
            onError={(message) => {
              setUploadError(message);
              setFile(null);
            }}
            disabled={scanPending || isProcessingImage}
          />
          {file && <input type="file" name="image" hidden ref={(el) => setFileOnInput(el, file)} />}

          <Button type="submit" disabled={!file || scanPending || isProcessingImage} className="mt-4 w-full">
            {isProcessingImage ? "מעבד תמונה..." : scanPending ? "סורק..." : "🔍 סרוק תמונה"}
          </Button>
        </form>

        <ErrorMessage message={uploadError ?? undefined} />
        <ErrorMessage message={scanState.error} />

        {scanState.providerName && (
          <p className="mt-2 text-xs text-foreground/40">מנוע זיהוי: {scanState.providerName}</p>
        )}
        {scanState.result?.notes && <p className="mt-1 text-xs text-amber-700">{scanState.result.notes}</p>}
        {scanState.result && scanState.result.detected.length === 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            לא זוהו מדבקות בתמונה הזו. נסו לצלם מקרוב יותר, בתאורה טובה, כשהגב של כל מדבקה גלוי בבירור - או
            הוסיפו קודים ידנית למטה.
          </p>
        )}
      </Card>

      {(rows.length > 0 || (scanState.result && scanState.result.detected.length === 0)) && (
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
                <input
                  type="text"
                  value={row.teamCode}
                  onChange={(e) => updateRow(row.id, { teamCode: e.target.value.toUpperCase().slice(0, 3) })}
                  className="w-14 rounded-lg border border-black/10 px-2 py-1 text-center text-sm font-bold uppercase"
                  dir="ltr"
                />
                <span className="text-sm font-bold text-foreground/40">-</span>
                <input
                  type="number"
                  value={row.number}
                  onChange={(e) => updateRow(row.id, { number: Number(e.target.value) })}
                  min={1}
                  max={20}
                  className="w-16 rounded-lg border border-black/10 px-2 py-1 text-sm font-bold"
                />
                <ConfidenceBadge confidence={row.confidence} />

                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="mr-auto rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              placeholder="הוספה ידנית: GER-2"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              dir="ltr"
              className="w-40 rounded-lg border border-black/10 px-3 py-1.5 text-sm"
            />
            <Button type="button" variant="outline" size="sm" onClick={addManualRow}>
              הוספה
            </Button>
          </div>

          <Button className="mt-4 w-full" disabled={isSaving} onClick={handleSave}>
            {isSaving ? "שומר..." : "💾 סמן הכל כברשותי"}
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
