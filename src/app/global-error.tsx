"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="he" dir="rtl">
      <body className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center">
        <span className="mb-4 text-5xl">😕</span>
        <h1 className="mb-2 text-2xl font-extrabold text-foreground">משהו השתבש באתר</h1>
        <p className="mb-6 max-w-sm text-sm text-foreground/60">
          קרתה תקלה לא צפויה בטעינת האתר. נסו לרענן את הדף.
        </p>
        <button
          onClick={() => reset()}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark"
        >
          נסה/י שוב
        </button>
      </body>
    </html>
  );
}
