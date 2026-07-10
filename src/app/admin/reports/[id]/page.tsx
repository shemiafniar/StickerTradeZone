import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getAdminReportById, getReportAttachmentSignedUrl } from "@/lib/data/support";
import { Card } from "@/components/ui/Card";
import { SupportReportStatusBadge } from "@/components/ui/Badge";
import { UpdateReportStatusForm } from "@/components/admin/UpdateReportStatusForm";
import { SUPPORT_CATEGORY_LABELS } from "@/lib/supportCategories";

export const metadata = { title: "דיווח תקלה" };

export default async function AdminReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getAdminReportById(id);
  if (!report) notFound();

  const attachmentUrl = report.attachment_url ? await getReportAttachmentSignedUrl(report.attachment_url) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/reports" className="mb-3 inline-block text-sm font-bold text-foreground/50 hover:text-foreground">
        ← חזרה לדיווחי תקלות
      </Link>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold">{report.subject}</h1>
            <SupportReportStatusBadge status={report.status} />
          </div>
          <p className="text-sm text-foreground/60">{SUPPORT_CATEGORY_LABELS[report.category] ?? report.category}</p>
        </div>
      </div>

      <Card className="mb-4">
        <h2 className="mb-3 text-lg font-bold">פרטי הדיווח</h2>
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Detail label="דיווח מאת" value={report.reporter?.full_name || "אספן"} />
          <Detail label="אימייל" value={report.reporterEmail ?? "-"} dir="ltr" />
          <Detail label="תאריך דיווח" value={new Date(report.created_at).toLocaleString("he-IL")} />
          <Detail label="עמוד" value={report.page_url ?? "-"} dir="ltr" />
        </div>

        <div className="mt-4">
          <p className="mb-1 text-xs font-bold text-foreground/50">תיאור</p>
          <p className="whitespace-pre-wrap rounded-lg bg-black/[0.03] p-3 text-sm">{report.description}</p>
        </div>

        {attachmentUrl && (
          <div className="mt-4">
            <p className="mb-1 text-xs font-bold text-foreground/50">צילום מסך מצורף</p>
            <a href={attachmentUrl} target="_blank" rel="noreferrer">
              <Image
                src={attachmentUrl}
                alt="צילום מסך מצורף לדיווח"
                width={480}
                height={320}
                unoptimized
                className="max-h-80 w-auto rounded-lg border border-black/10 object-contain"
              />
            </a>
          </div>
        )}

        {report.user_agent && (
          <p className="mt-4 text-xs text-foreground/40" dir="ltr">
            {report.user_agent}
          </p>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-bold">טיפול</h2>
        <UpdateReportStatusForm report={report} />
      </Card>
    </div>
  );
}

function Detail({ label, value, dir }: { label: string; value: string; dir?: "ltr" | "rtl" }) {
  return (
    <div>
      <p className="text-xs font-bold text-foreground/50">{label}</p>
      <p dir={dir}>{value}</p>
    </div>
  );
}
