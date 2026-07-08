export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const className =
    pct >= 85
      ? "bg-green-100 text-green-700"
      : pct >= 60
        ? "bg-amber-100 text-amber-700"
        : "bg-red-100 text-red-700";

  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${className}`}>{pct}%</span>;
}
