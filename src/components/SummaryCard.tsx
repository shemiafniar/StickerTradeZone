import Link from "next/link";
import { Card } from "@/components/ui/Card";

export function SummaryCard({
  icon,
  label,
  value,
  href,
  accent,
}: {
  icon: string;
  label: string;
  value: number;
  href: string;
  accent: "green" | "orange" | "blue";
}) {
  const accentClasses = {
    green: "bg-brand/10 text-brand-dark",
    orange: "bg-accent/20 text-orange-700",
    blue: "bg-blue-100 text-blue-700",
  }[accent];

  return (
    <Link href={href}>
      <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground/60">{label}</p>
            <p className="mt-1 text-3xl font-extrabold">{value}</p>
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${accentClasses}`}>
            {icon}
          </div>
        </div>
      </Card>
    </Link>
  );
}
