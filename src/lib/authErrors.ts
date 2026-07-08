/**
 * Normalizes every Supabase Auth error into a safe, human-readable Hebrew
 * message - never the raw provider error text, and never a serialized
 * object/JSON dump.
 *
 * Root cause of the "{}" bug this replaces: supabase-js's internal
 * `_getErrorMessage()` (see @supabase/auth-js/src/lib/fetch.ts) falls back
 * to `JSON.stringify(rawResponseBody)` whenever a GoTrue error response
 * doesn't contain one of the expected `msg`/`message`/`error_description`/
 * `error` fields (this can happen for rate-limit responses, gateway/WAF
 * errors, or other edge-case response shapes). When that happens,
 * `error.message` becomes the literal string `"{}"` (or another JSON
 * fragment) - a perfectly normal *string*, which the old code then
 * displayed verbatim because it only mapped a few known messages and
 * otherwise returned whatever text it was given.
 *
 * The fix is a whitelist, not a blacklist: only messages we explicitly
 * recognize are ever shown to the user. Anything else - including "{}",
 * other JSON fragments, or genuinely unexpected exceptions - falls back to
 * a generic, friendly Hebrew message. The original error is always logged
 * server-side first (visible in `vercel logs` / the Vercel dashboard),
 * so the real cause is never actually hidden from whoever needs to debug it.
 */

export type AuthErrorContext = "signup" | "signin" | "oauth";

const FALLBACK_MESSAGES: Record<AuthErrorContext, string> = {
  signup: "אירעה שגיאה בהרשמה. נסה שוב בעוד רגע.",
  signin: "אירעה שגיאה בהתחברות. נסה שוב בעוד רגע.",
  oauth: "אירעה שגיאה בהתחברות עם Google. נסה שוב בעוד רגע.",
};

/** Exact-match known Supabase Auth error messages. */
const KNOWN_MESSAGES: Record<string, string> = {
  "Invalid login credentials": "אימייל או סיסמה שגויים",
  "User already registered": "המשתמש כבר רשום במערכת, נסה/י להתחבר",
  "Email not confirmed": "יש לאשר את כתובת המייל לפני ההתחברות",
  "Signup requires a valid password": "יש להזין סיסמה תקינה",
  "Unable to validate email address: invalid format": "כתובת המייל אינה תקינה",
  "Email address is invalid": "כתובת המייל אינה תקינה",
  "User not found": "משתמש לא נמצא",
  "Unsupported provider: provider is not enabled":
    "התחברות עם Google אינה מוגדרת כרגע במערכת. פנו למנהל האתר.",
};

/** Pattern-based categories for messages whose exact wording/parameters vary. */
const KNOWN_PATTERNS: { pattern: RegExp; hebrew: string }[] = [
  { pattern: /rate.?limit|too many requests|too many attempts/i, hebrew: "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות." },
  { pattern: /password.*(weak|at least|should be|length)/i, hebrew: "הסיסמה חלשה מדי. נסו סיסמה עם לפחות 6 תווים." },
  { pattern: /email.*(invalid|not valid|format)/i, hebrew: "כתובת המייל אינה תקינה." },
  { pattern: /already registered|already exists|already been registered/i, hebrew: "המשתמש כבר רשום במערכת, נסה/י להתחבר." },
  { pattern: /not confirmed/i, hebrew: "יש לאשר את כתובת המייל לפני ההתחברות." },
  { pattern: /network|fetch failed|timeout|ECONNRESET|ETIMEDOUT/i, hebrew: "בעיית תקשורת. בדקו את החיבור לאינטרנט ונסו שוב." },
  { pattern: /provider is not enabled|provider.*disabled/i, hebrew: "שיטת ההתחברות הזו אינה מוגדרת כרגע במערכת." },
];

function extractMessage(error: unknown): string | null {
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return null;
}

/**
 * Converts an unknown auth error into a safe Hebrew string for display, and
 * logs the original error server-side (console.error output is captured by
 * Vercel's function logs) before doing so.
 */
export function normalizeAuthError(error: unknown, context: AuthErrorContext): string {
  console.error(`[auth:${context}] error:`, error);

  const rawMessage = extractMessage(error);

  if (rawMessage) {
    if (KNOWN_MESSAGES[rawMessage]) return KNOWN_MESSAGES[rawMessage];
    for (const { pattern, hebrew } of KNOWN_PATTERNS) {
      if (pattern.test(rawMessage)) return hebrew;
    }
  }

  return FALLBACK_MESSAGES[context];
}
