export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-black/5 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-6 text-center text-sm text-foreground/60 space-y-2">
        <p className="font-medium text-foreground/70">
          זהו פלטפורמת קהילה עצמאית ואינה קשורה ל-Panini, FIFA, או כל מותג מדבקות רשמי אחר.
        </p>
        <p className="text-xs text-foreground/40" dir="ltr">
          This is an independent community platform and is not affiliated with Panini, FIFA, or
          any official sticker brand.
        </p>
        <p className="text-xs text-foreground/40">
          © {new Date().getFullYear()} Sticker Trade IL - קהילת אספני מדבקות כדורגל בישראל
        </p>
      </div>
    </footer>
  );
}
