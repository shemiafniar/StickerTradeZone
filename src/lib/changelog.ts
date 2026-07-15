/**
 * "What's New" changelog content - a version-controlled source file, not a
 * database-backed CMS. Entries ship in the same commit as the feature(s)
 * they describe, so this file is the single source of truth for both the
 * dashboard "What's New" modal and the permanent /dashboard/changelog page.
 *
 * Ordering convention: newest release first (index 0). CURRENT_CHANGELOG_VERSION
 * is always derived from that first entry, never hand-duplicated - there is
 * exactly one place to bump when shipping a new entry.
 */
export interface ChangelogEntry {
  /** A short, unique release identifier shown to users, e.g. "1.1.0". Not required to match package.json's own version. */
  version: string;
  /** ISO date (YYYY-MM-DD) the entry was released. */
  date: string;
  /** A short, human-readable title for the release. */
  title: string;
  /** A short bullet list of what changed - features, fixes, or both. */
  items: string[];
}

/**
 * Newest first. Add new releases at the top - never mutate a past entry's
 * `version` once shipped (see changelog.test.ts for the invariants this
 * ordering/uniqueness relies on).
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.1.0",
    date: "2026-07-15",
    title: "ניווט התראות, סינון טריידים, ייצוא אוסף ותיקון FWC",
    items: [
      "תיקון בעיית ניווט מהתראות שגרמה לעמוד 404 - קליק על התראה מוביל כעת בבטחה לעמוד הרלוונטי, ואם הפריט לא זמין יותר, מוצגת הודעה ברורה במקום שגיאה",
      "סינון בקשות טרייד לפי סטטוס (הכל / ממתינות / פעילות / הושלמו / נדחו-בוטלו) ולפי כיוון (נשלחו/התקבלו)",
      "עמוד \"מה חדש\" חדש לצפייה בכל עדכוני המערכת, וחלון קופץ קצר בכניסה לדשבורד כשיש עדכון שלא נצפה",
      "ייצוא האוסף האישי לקובץ Excel, ODS או CSV, עם סינון לפי סטטוס ונבחרת",
      "תיקון מספור המדבקות המיוחדות של FWC כך שיתחיל מ-00 ויסתיים ב-019, בהתאם למוסכמה הרשמית",
    ],
  },
];

export const CURRENT_CHANGELOG_VERSION = CHANGELOG[0].version;

/** True whenever the user has not yet dismissed the modal for the current release - the only rule the "What's New" modal's visibility follows. */
export function shouldShowChangelogModal(lastSeenVersion: string | null): boolean {
  return lastSeenVersion !== CURRENT_CHANGELOG_VERSION;
}
