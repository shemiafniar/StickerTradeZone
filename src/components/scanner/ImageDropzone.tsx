"use client";

import { useRef, useState } from "react";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export function ImageDropzone({
  onFileSelected,
  onError,
  disabled,
}: {
  onFileSelected: (file: File | null) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function handleFile(file: File | null) {
    if (file) {
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        onError?.("פורמט קובץ לא נתמך. יש להעלות תמונת JPG, PNG, WEBP או HEIC.");
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        onError?.("התמונה גדולה מדי (מקסימום 8MB). נסו לצלם שוב או לדחוס את התמונה.");
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
    onFileSelected(file);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        className="hidden"
        disabled={disabled}
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      {previewUrl ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="תצוגה מקדימה" className="max-h-72 w-full rounded-2xl border border-black/10 object-contain bg-black/5" />
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              handleFile(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-black/15 bg-black/[0.02] py-10 text-center transition hover:border-brand/40 hover:bg-brand/5 disabled:opacity-50"
        >
          <span className="text-4xl">📸</span>
          <span className="text-sm font-bold text-foreground/70">לחצו לצילום או העלאת תמונה</span>
          <span className="text-xs text-foreground/40">JPG / PNG / WEBP / HEIC, עד 8MB</span>
        </button>
      )}
    </div>
  );
}
