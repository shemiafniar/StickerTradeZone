import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeAuthError } from "@/lib/authErrors";

describe("normalizeAuthError", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("maps known exact messages to Hebrew", () => {
    expect(normalizeAuthError(new Error("Invalid login credentials"), "signin")).toBe("אימייל או סיסמה שגויים");
    expect(normalizeAuthError({ message: "User already registered" }, "signup")).toBe(
      "המשתמש כבר רשום במערכת, נסה/י להתחבר"
    );
  });

  it("maps rate-limit-like messages via pattern", () => {
    expect(normalizeAuthError(new Error("Email rate limit exceeded"), "signup")).toBe(
      "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות."
    );
  });

  it("never renders the literal '{}' string some GoTrue error responses produce", () => {
    // This reproduces the real root cause: supabase-js's internal
    // _getErrorMessage() falls back to JSON.stringify(body) when a GoTrue
    // error response lacks msg/message/error_description/error fields,
    // producing an AuthError whose .message is literally "{}".
    expect(normalizeAuthError(new Error("{}"), "signup")).toBe("אירעה שגיאה בהרשמה. נסה שוב בעוד רגע.");
    expect(normalizeAuthError({ message: "{}" }, "signin")).toBe("אירעה שגיאה בהתחברות. נסה שוב בעוד רגע.");
  });

  it("falls back to the generic per-context Hebrew message for unrecognized errors", () => {
    expect(normalizeAuthError(new Error("Some new GoTrue message we've never seen"), "signup")).toBe(
      "אירעה שגיאה בהרשמה. נסה שוב בעוד רגע."
    );
    expect(normalizeAuthError(new Error("weird"), "signin")).toBe("אירעה שגיאה בהתחברות. נסה שוב בעוד רגע.");
    expect(normalizeAuthError(new Error("weird"), "oauth")).toBe("אירעה שגיאה בהתחברות עם Google. נסה שוב בעוד רגע.");
  });

  it("never throws or returns a non-string for completely unexpected input shapes", () => {
    expect(normalizeAuthError(undefined, "signup")).toBe("אירעה שגיאה בהרשמה. נסה שוב בעוד רגע.");
    expect(normalizeAuthError(null, "signup")).toBe("אירעה שגיאה בהרשמה. נסה שוב בעוד רגע.");
    expect(normalizeAuthError({}, "signup")).toBe("אירעה שגיאה בהרשמה. נסה שוב בעוד רגע.");
    expect(normalizeAuthError(42, "signup")).toBe("אירעה שגיאה בהרשמה. נסה שוב בעוד רגע.");
    expect(normalizeAuthError(["a", "b"], "signup")).toBe("אירעה שגיאה בהרשמה. נסה שוב בעוד רגע.");
  });

  it("always logs the original error server-side", () => {
    const err = new Error("Invalid login credentials");
    normalizeAuthError(err, "signin");
    expect(consoleErrorSpy).toHaveBeenCalledWith("[auth:signin] error:", err);
  });

  it("recognizes the Google provider-not-enabled setup error", () => {
    expect(normalizeAuthError(new Error("Unsupported provider: provider is not enabled"), "oauth")).toBe(
      "התחברות עם Google אינה מוגדרת כרגע במערכת. פנו למנהל האתר."
    );
  });
});
