import { createClient } from "@/lib/supabase/server";
import type { Profile, SupportReport, SupportReportCategory, SupportReportStatus } from "@/types/database";

export interface SupportReportWithReporter extends SupportReport {
  reporter: Pick<Profile, "id" | "full_name"> | null;
  reporterEmail: string | null;
}

/** Admin-only: every report in the system, optionally filtered - RLS still applies (support_reports_select requires is_admin() for rows that aren't the caller's own). */
export async function getAdminReports(filters?: {
  status?: SupportReportStatus;
  category?: SupportReportCategory;
  search?: string;
}): Promise<SupportReportWithReporter[]> {
  const supabase = await createClient();

  let query = supabase.from("support_reports").select("*").order("created_at", { ascending: false });
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.category) query = query.eq("category", filters.category);

  const [{ data: reports }, { data: emailRows }] = await Promise.all([
    query,
    supabase.rpc("admin_get_user_emails"),
  ]);

  const reportRows = (reports as SupportReport[]) ?? [];
  if (reportRows.length === 0) return [];

  const userIds = Array.from(new Set(reportRows.map((r) => r.user_id)));
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
  const profileMap = new Map((profiles as Pick<Profile, "id" | "full_name">[] | null)?.map((p) => [p.id, p]) ?? []);
  const emailMap = new Map(((emailRows as { id: string; email: string | null }[]) ?? []).map((r) => [r.id, r.email]));

  let rows: SupportReportWithReporter[] = reportRows.map((r) => ({
    ...r,
    reporter: profileMap.get(r.user_id) ?? null,
    reporterEmail: emailMap.get(r.user_id) ?? null,
  }));

  const term = filters?.search?.trim().toLowerCase();
  if (term) {
    rows = rows.filter(
      (r) =>
        r.subject.toLowerCase().includes(term) ||
        (r.reporter?.full_name ?? "").toLowerCase().includes(term) ||
        (r.reporterEmail ?? "").toLowerCase().includes(term)
    );
  }

  return rows;
}

/** Admin-only detail view (a normal user should use their own report data instead, if that's ever surfaced). */
export async function getAdminReportById(reportId: string): Promise<SupportReportWithReporter | null> {
  const supabase = await createClient();
  const { data: report } = await supabase.from("support_reports").select("*").eq("id", reportId).maybeSingle();
  if (!report) return null;

  const row = report as SupportReport;
  const [{ data: profile }, { data: emailRows }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("id", row.user_id).maybeSingle(),
    supabase.rpc("admin_get_user_emails"),
  ]);

  const email = ((emailRows as { id: string; email: string | null }[]) ?? []).find((e) => e.id === row.user_id)?.email ?? null;

  return { ...row, reporter: (profile as Pick<Profile, "id" | "full_name"> | null) ?? null, reporterEmail: email };
}

/**
 * A short-lived signed URL for a report's attachment - the
 * `support-attachments` bucket is private, so there is never a plain
 * public URL to hand out; RLS on `storage.objects` still gates who this
 * call can actually generate a URL for (the report's owner, or an admin).
 */
export async function getReportAttachmentSignedUrl(attachmentPath: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("support-attachments").createSignedUrl(attachmentPath, 60 * 10);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export interface AdminReportCounts {
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  total: number;
}

export async function getAdminReportCounts(): Promise<AdminReportCounts> {
  const supabase = await createClient();
  const { data } = await supabase.from("support_reports").select("status");
  const rows = (data as Pick<SupportReport, "status">[]) ?? [];

  return {
    open: rows.filter((r) => r.status === "open").length,
    inProgress: rows.filter((r) => r.status === "in_progress").length,
    resolved: rows.filter((r) => r.status === "resolved").length,
    closed: rows.filter((r) => r.status === "closed").length,
    total: rows.length,
  };
}
