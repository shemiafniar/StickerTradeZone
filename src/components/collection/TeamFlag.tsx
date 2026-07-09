import { cn } from "@/lib/cn";

/**
 * Renders a team's real national flag via the `flag-icons` SVG library
 * (reliable, consistent rendering on every OS/browser - Unicode flag emoji
 * fall back to showing plain two-letter text on many systems, e.g. Windows
 * without the latest fonts, or most Linux desktops). Falls back to the
 * stored `flag_emoji` for teams without a known ISO flag code (currently
 * only custom teams an admin adds beyond the official 48 via the admin
 * catalog page, which has no reliable way to pick an ISO code).
 */
export function TeamFlag({
  flagIcon,
  flagEmoji,
  size = "md",
  className,
}: {
  flagIcon: string | null;
  flagEmoji: string;
  size?: "md" | "lg";
  className?: string;
}) {
  if (flagIcon) {
    return (
      <span
        className={cn("fi", `fi-${flagIcon}`, size === "lg" ? "team-flag-lg" : "team-flag", className)}
        role="img"
        aria-label="דגל הנבחרת"
      />
    );
  }

  return (
    <span
      className={cn(size === "lg" ? "text-4xl" : "text-3xl", "leading-none", className)}
      role="img"
      aria-label="דגל הנבחרת"
    >
      {flagEmoji}
    </span>
  );
}
