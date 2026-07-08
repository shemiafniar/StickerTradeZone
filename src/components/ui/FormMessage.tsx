/**
 * Never render a raw error/object in the UI, even if one somehow slips
 * through a type-system bypass upstream (e.g. an `as any` cast, or a future
 * server action that forgets to normalize its error) - this is the last
 * line of defense, not the primary fix (see src/lib/authErrors.ts for that).
 */
export function toDisplayText(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  // Anything else (Error instances, plain objects, arrays, ...) is not
  // safe/meaningful to show directly to a user.
  return "אירעה שגיאה. נסה/י שוב.";
}

export function ErrorMessage({ message }: { message?: unknown }) {
  const text = toDisplayText(message);
  if (!text) return null;
  return (
    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
      {text}
    </div>
  );
}

export function SuccessMessage({ message }: { message?: unknown }) {
  const text = toDisplayText(message);
  if (!text) return null;
  return (
    <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
      {text}
    </div>
  );
}
