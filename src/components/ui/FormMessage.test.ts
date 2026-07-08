import { describe, expect, it } from "vitest";
import { toDisplayText } from "@/components/ui/FormMessage";

describe("toDisplayText", () => {
  it("passes through plain strings", () => {
    expect(toDisplayText("אימייל או סיסמה שגויים")).toBe("אימייל או סיסמה שגויים");
  });

  it("treats empty/nullish values as 'nothing to show'", () => {
    expect(toDisplayText(undefined)).toBeNull();
    expect(toDisplayText(null)).toBeNull();
    expect(toDisplayText("")).toBeNull();
  });

  it("never returns a raw Error object as display text", () => {
    expect(toDisplayText(new Error("Invalid login credentials"))).toBe("אירעה שגיאה. נסה/י שוב.");
  });

  it("never returns a raw plain object as display text", () => {
    expect(toDisplayText({})).toBe("אירעה שגיאה. נסה/י שוב.");
    expect(toDisplayText({ message: "hello" })).toBe("אירעה שגיאה. נסה/י שוב.");
  });

  it("never returns a raw array as display text", () => {
    expect(toDisplayText(["a", "b"])).toBe("אירעה שגיאה. נסה/י שוב.");
  });

  it("coerces primitives other than strings safely", () => {
    expect(toDisplayText(404)).toBe("404");
    expect(toDisplayText(true)).toBe("true");
  });
});
