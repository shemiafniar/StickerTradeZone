"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createSupportReportAction, type SupportReportActionState } from "@/lib/actions/support";
import { uploadSupportAttachment, AttachmentUploadError, MAX_ATTACHMENT_BYTES } from "@/lib/supportAttachmentUpload";
import { SUPPORT_CATEGORY_OPTIONS } from "@/lib/supportCategories";
import { FieldGroup, Input, Label, Select, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ErrorMessage, SuccessMessage } from "@/components/ui/FormMessage";

const initialState: SupportReportActionState = {};

export function SupportReportForm({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(createSupportReportAction, initialState);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [pageUrl, setPageUrl] = useState("");
  const [userAgent, setUserAgent] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Deliberate one-time client-only capture, deferred until after
    // hydration so the server-rendered markup (no `window`/`navigator`)
    // always matches the client's first paint - same SSR-safe pattern as
    // ShareButtons.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPageUrl(window.location.href);
    setUserAgent(navigator.userAgent);
  }, []);

  // Resetting the native form/file input is an imperative DOM operation via
  // refs, which (unlike a plain state update) isn't safe to do directly in
  // the render body - so this one specifically needs an effect, keyed off
  // the action result's identity.
  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      // Deliberate: clearing local attachment state to match the form's
      // own (ref-based) reset above, not a props/state sync loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [state]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAttachmentError(null);

    const formData = new FormData(e.currentTarget);

    if (attachment) {
      setIsUploadingAttachment(true);
      try {
        const path = await uploadSupportAttachment(userId, attachment);
        formData.set("attachmentPath", path);
      } catch (err) {
        setIsUploadingAttachment(false);
        setAttachmentError(
          err instanceof AttachmentUploadError ? err.message : "שגיאה בהעלאת הקובץ המצורף. אפשר לנסות שוב בלעדיו."
        );
        return;
      }
      setIsUploadingAttachment(false);
    }

    formAction(formData);
  }

  const isBusy = pending || isUploadingAttachment;

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <ErrorMessage message={state.error} />
      {state.success && (
        <SuccessMessage message="הדיווח נשלח בהצלחה! נבדוק אותו בהקדם ונחזור אליכם במידת הצורך. 🙏" />
      )}
      <ErrorMessage message={attachmentError} />

      <input type="hidden" name="attachmentPath" value="" />
      <input type="hidden" name="pageUrl" value={pageUrl} readOnly />
      <input type="hidden" name="userAgent" value={userAgent} readOnly />

      <FieldGroup>
        <Label htmlFor="subject">נושא</Label>
        <Input id="subject" name="subject" required maxLength={200} placeholder="תיאור קצר של הנושא" />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="category">קטגוריה</Label>
        <Select id="category" name="category" required defaultValue="">
          <option value="" disabled>
            בחרו קטגוריה
          </option>
          {SUPPORT_CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="description">תיאור מפורט</Label>
        <Textarea
          id="description"
          name="description"
          required
          maxLength={5000}
          className="min-h-32"
          placeholder="פרטו מה קרה, מה ציפיתם שיקרה, ובאילו שלבים ניתן לשחזר את הבעיה"
        />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="attachment">צילום מסך (אופציונלי)</Label>
        <input
          ref={fileInputRef}
          id="attachment"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-foreground/70 file:ml-3 file:rounded-lg file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:text-sm file:font-bold file:text-brand-dark"
        />
        <p className="mt-1.5 text-xs text-foreground/50">
          תמונת JPG, PNG, WEBP או HEIC, עד {(MAX_ATTACHMENT_BYTES / (1024 * 1024)).toFixed(0)}MB.
        </p>
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="pageUrlVisible">כתובת העמוד (אופציונלי)</Label>
        <Input
          id="pageUrlVisible"
          value={pageUrl}
          onChange={(e) => setPageUrl(e.target.value)}
          dir="ltr"
          placeholder="https://..."
        />
      </FieldGroup>

      <SubmitButton disabled={isBusy} className="w-full">
        {isUploadingAttachment ? "מעלה קובץ מצורף..." : pending ? "שולח דיווח..." : "שליחת דיווח"}
      </SubmitButton>
    </form>
  );
}
