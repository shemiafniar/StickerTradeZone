import Link from "next/link";
import { CHANGELOG } from "@/lib/changelog";
import { Card } from "@/components/ui/Card";

export const metadata = { title: "מה חדש" };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", { year: "numeric", month: "long", day: "numeric" });
}

/** Permanent history of every changelog entry - always accessible, regardless of whether the "What's New" modal has already been dismissed. */
export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-lg">
      <Link href="/dashboard" className="mb-3 inline-block text-sm font-bold text-foreground/50 hover:text-foreground">
        ← חזרה ללוח הבקרה
      </Link>

      <h1 className="mb-1 text-2xl font-extrabold">מה חדש 🆕</h1>
      <p className="mb-6 text-sm text-foreground/60">כל העדכונים, השיפורים והתיקונים במערכת</p>

      <div className="flex flex-col gap-4">
        {CHANGELOG.map((entry) => (
          <Card key={entry.version}>
            <p className="text-xs font-bold uppercase tracking-wide text-brand-dark">
              גרסה {entry.version} · {formatDate(entry.date)}
            </p>
            <h2 className="mt-1 text-lg font-extrabold">{entry.title}</h2>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm text-foreground/80">
              {entry.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-0.5 shrink-0 text-brand">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
