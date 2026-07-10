import Link from "next/link";
import { getAdminReports } from "@/lib/data/support";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { SupportReportStatusBadge } from "@/components/ui/Badge";
import { SUPPORT_CATEGORY_OPTIONS, SUPPORT_CATEGORY_LABELS } from "@/lib/supportCategories";
import type { SupportReportCategory, SupportReportStatus } from "@/types/database";

export const metadata = { title: "דיווחי תקלות" };

const STATUS_OPTIONS: { value: SupportReportStatus; label: string }[] = [
  { value: "open", label: "פתוח" },
  { value: "in_progress", label: "בטיפול" },
  { value: "resolved", label: "טופל" },
  { value: "closed", label: "סגור" },
];

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; q?: string }>;
}) {
  const { status, category, q } = await searchParams;
  const reports = await getAdminReports({
    status: status as SupportReportStatus | undefined,
    category: category as SupportReportCategory | undefined,
    search: q,
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold">דיווחי תקלות</h1>
      <p className="mb-6 text-sm text-foreground/60">סה&quot;כ {reports.length} דיווחים</p>

      <form className="mb-5 flex flex-wrap gap-2" method="get">
        <Input name="q" defaultValue={q ?? ""} placeholder="חיפוש לפי נושא, שם או אימייל..." className="max-w-xs" />
        <Select name="status" defaultValue={status ?? ""} className="max-w-[160px]">
          <option value="">כל הסטטוסים</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <Select name="category" defaultValue={category ?? ""} className="max-w-[180px]">
          <option value="">כל הקטגוריות</option>
          {SUPPORT_CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline">
          סינון
        </Button>
      </form>

      <div className="flex flex-col gap-3">
        {reports.map((report) => (
          <Link key={report.id} href={`/admin/reports/${report.id}`}>
            <Card interactive>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold">{report.subject}</p>
                    <SupportReportStatusBadge status={report.status} />
                  </div>
                  <p className="mt-1 text-xs text-foreground/50">
                    {SUPPORT_CATEGORY_LABELS[report.category] ?? report.category} · מאת{" "}
                    {report.reporter?.full_name || "אספן"} · {new Date(report.created_at).toLocaleDateString("he-IL")}
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        ))}

        {reports.length === 0 && (
          <Card>
            <p className="text-sm text-foreground/60">לא נמצאו דיווחים התואמים את החיפוש.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
