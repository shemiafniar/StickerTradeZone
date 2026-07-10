import type { SupportReportCategory } from "@/types/database";

export const SUPPORT_CATEGORY_LABELS: Record<SupportReportCategory, string> = {
  technical: "תקלה טכנית",
  trade: "בעיה בטרייד",
  matches: "בעיה בהתאמות",
  scanner: "בעיה בסורק",
  notifications: "בעיה בהתראות",
  suggestion: "הצעה לשיפור",
  other: "אחר",
};

export const SUPPORT_CATEGORY_OPTIONS: { value: SupportReportCategory; label: string }[] = (
  Object.entries(SUPPORT_CATEGORY_LABELS) as [SupportReportCategory, string][]
).map(([value, label]) => ({ value, label }));
