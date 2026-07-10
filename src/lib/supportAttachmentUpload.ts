"use client";

import { createClient } from "@/lib/supabase/client";

export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8MB, matches the storage bucket's own file_size_limit
const ALLOWED_ATTACHMENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export class AttachmentUploadError extends Error {}

/**
 * Uploads a screenshot/image attachment directly from the browser to the
 * private `support-attachments` Supabase Storage bucket, using the
 * signed-in user's own session - never through a Server Action (which
 * would otherwise carry the file's bytes through Next.js's own request
 * body limit for no reason; storage RLS already scopes this upload to the
 * caller's own folder - see 0016_support_reports.sql).
 *
 * Returns the resulting object path (e.g. "<user_id>/171234-screenshot.png"),
 * to be submitted as a plain string alongside the rest of the report form -
 * never a public URL, since the bucket is private.
 */
export async function uploadSupportAttachment(userId: string, file: File): Promise<string> {
  if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
    throw new AttachmentUploadError("פורמט קובץ לא נתמך. יש להעלות תמונת JPG, PNG, WEBP או HEIC.");
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new AttachmentUploadError("הקובץ גדול מדי (מקסימום 8MB).");
  }

  const supabase = createClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-100);
  const path = `${userId}/${Date.now()}-${safeName || "attachment"}`;

  const { error } = await supabase.storage.from("support-attachments").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw new AttachmentUploadError("לא ניתן היה להעלות את הקובץ המצורף. אפשר לנסות לשלוח את הדיווח בלי קובץ מצורף.");
  }

  return path;
}
