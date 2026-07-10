"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeOnboardingAction } from "@/lib/actions/onboarding";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

interface Step {
  emoji: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    emoji: "📖",
    title: "עדכנו את האוסף שלכם",
    body: "המערכת לא יכולה למצוא לכם התאמות עד שתסמנו אילו מדבקות יש לכם, אילו חסרות, וכמה כפולות יש לכם מכל אחת. זה הבסיס לכל השאר!",
  },
  {
    emoji: "📍",
    title: "עברו לעמוד ההתאמות",
    body: "ברגע שתתחילו לסמן מדבקות, נמצא לכם אספנים קרובים שיש להם בדיוק מה שחסר לכם - ולהפך.",
  },
  {
    emoji: "🤝",
    title: "שלחו הצעת טרייד",
    body: "מצאתם התאמה טובה? אפשר לשלוח בקשת טרייד ישירות מכרטיס ההתאמה, ולתאם החלפה.",
  },
];

/** First-time, skippable 3-step walkthrough - shown once (profile.onboarding_completed_at is null) and never reopened automatically after that. */
export function OnboardingModal() {
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (dismissed) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  function finish(navigateTo?: string) {
    setDismissed(true);
    startTransition(async () => {
      await completeOnboardingAction();
      if (navigateTo) router.push(navigateTo);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="הסבר קצר על השימוש באפליקציה"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={cn("h-1.5 w-6 rounded-full transition-colors", i === step ? "bg-brand" : "bg-black/10")}
            />
          ))}
        </div>

        <div className="text-center">
          <div className="mb-3 text-5xl">{current.emoji}</div>
          <h2 className="text-lg font-extrabold">{current.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">{current.body}</p>
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => finish()}
            disabled={isPending}
            className="text-sm font-bold text-foreground/40 hover:text-foreground/60"
          >
            דלג
          </button>

          <div className="flex gap-2">
            {step > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
                הקודם
              </Button>
            )}
            {isLast ? (
              <Button type="button" size="sm" onClick={() => finish("/dashboard/stickers")} disabled={isPending}>
                בואו נתחיל! 🚀
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={() => setStep((s) => s + 1)}>
                הבא
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
