"use client";

import { useState, useTransition } from "react";
import { updateLocationAction, disableLocationAction } from "@/lib/actions/location";
import { roundCoordinate } from "@/lib/distance";
import { Button } from "@/components/ui/Button";
import { ErrorMessage, SuccessMessage } from "@/components/ui/FormMessage";

export function LocationToggle({ enabled }: { enabled: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleEnable() {
    setError(null);
    setSuccess(null);

    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setError("הדפדפן שלך לא תומך באיתור מיקום");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = roundCoordinate(position.coords.latitude);
        const lng = roundCoordinate(position.coords.longitude);

        startTransition(async () => {
          const result = await updateLocationAction(
            (() => {
              const fd = new FormData();
              fd.set("lat", String(lat));
              fd.set("lng", String(lng));
              return fd;
            })()
          );
          if (result.error) setError(result.error);
          else setSuccess("מיקום מקורב הופעל! ההתאמות שלך יסודרו עכשיו גם לפי מרחק.");
        });
      },
      () => {
        setError("לא הצלחנו לקבל את המיקום שלך. ודא/י שאישרת גישה למיקום בדפדפן ונסה/י שוב.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  }

  function handleDisable() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await disableLocationAction();
      if (result.error) setError(result.error);
      else setSuccess("מיקום המקורב הוסר. ההתאמות יחזרו להתבסס על עיר בלבד.");
    });
  }

  return (
    <div>
      <ErrorMessage message={error ?? undefined} />
      <SuccessMessage message={success ?? undefined} />

      <div className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-black/[0.02] p-4">
        <div>
          <p className="text-sm font-bold">📍 מיקום מקורב</p>
          <p className="mt-0.5 text-xs text-foreground/60">
            {enabled
              ? "מופעל - התאמות ממוינות גם לפי מרחק אמיתי. המיקום המדויק שלך לעולם לא נחשף לאספנים אחרים."
              : "מכבה - ההתאמות מתבססות רק על עיר. הפעלה תבקש הרשאת מיקום מהדפדפן."}
          </p>
        </div>
        {enabled ? (
          <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={handleDisable}>
            {isPending ? "מכבה..." : "כיבוי"}
          </Button>
        ) : (
          <Button type="button" size="sm" disabled={isPending} onClick={handleEnable}>
            {isPending ? "מפעיל..." : "הפעלה"}
          </Button>
        )}
      </div>
    </div>
  );
}
