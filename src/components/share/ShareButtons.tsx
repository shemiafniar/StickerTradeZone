"use client";

import { useEffect, useState } from "react";

const SHARE_TEXT =
  "מצאתי מערכת חדשה לאספני קלפים בישראל.\nמסמנים אילו קלפים יש לכם כפולים ואילו חסרים לכם, והמערכת מוצאת אספנים קרובים לביצוע טריידים.\n\nבואו נסיים את האלבום ביחד!";

export function ShareButtons({ url, compact }: { url: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    // Deliberate one-time client-only capability check, deferred until after
    // hydration so the server-rendered markup (no `navigator`) always
    // matches the client's first paint - the standard SSR-safe "mounted"
    // pattern, not a props/state sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanNativeShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT}\n${url}`)}`;

  async function handleNativeShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Shashot", text: SHARE_TEXT, url });
      } catch {
        // user cancelled the share sheet - nothing to do
      }
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(`${SHARE_TEXT}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable - ignore silently
    }
  }

  const buttonClass =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition";

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "" : "w-full"}`}>
      {canNativeShare && (
        <button onClick={handleNativeShare} className={`${buttonClass} bg-brand text-white hover:bg-brand-dark`}>
          📤 שיתוף
        </button>
      )}
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className={`${buttonClass} bg-green-500 text-white hover:bg-green-600`}
      >
        💬 שיתוף בוואטסאפ
      </a>
      <button onClick={handleCopyLink} className={`${buttonClass} border border-black/15 bg-white text-foreground hover:bg-black/5`}>
        {copied ? "✅ הועתק!" : "🔗 העתקת קישור"}
      </button>
    </div>
  );
}
