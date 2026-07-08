"use client";

import { useEffect } from "react";
import { LinkButton } from "@/components/ui/Button";
import { Button } from "@/components/ui/Button";

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
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <span className="mb-4 text-5xl">😕</span>
      <h1 className="mb-2 text-2xl font-extrabold">משהו השתבש</h1>
      <p className="mb-6 max-w-sm text-sm text-foreground/60">
        קרתה תקלה לא צפויה. ניתן לנסות שוב, ואם זה ממשיך לקרות - צרו קשר עם התמיכה.
      </p>
      <div className="flex gap-3">
        <Button onClick={() => reset()}>נסה/י שוב</Button>
        <LinkButton href="/dashboard" variant="outline">
          חזרה ללוח הבקרה
        </LinkButton>
      </div>
    </div>
  );
}
