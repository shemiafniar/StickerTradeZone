"use client";

import { useActionState } from "react";
import { updateSupportReportAction, type UpdateReportActionState } from "@/lib/actions/support";
import { FieldGroup, Label, Select, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ErrorMessage, SuccessMessage } from "@/components/ui/FormMessage";
import type { SupportReport } from "@/types/database";

const initialState: UpdateReportActionState = {};

export function UpdateReportStatusForm({ report }: { report: SupportReport }) {
  const [state, formAction] = useActionState(updateSupportReportAction, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="reportId" value={report.id} />
      <ErrorMessage message={state.error} />
      {state.success && <SuccessMessage message="הדיווח עודכן בהצלחה!" />}

      <FieldGroup>
        <Label htmlFor="status">סטטוס</Label>
        <Select id="status" name="status" defaultValue={report.status}>
          <option value="open">פתוח</option>
          <option value="in_progress">בטיפול</option>
          <option value="resolved">טופל</option>
          <option value="closed">סגור</option>
        </Select>
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="adminNote">הערה פנימית (לא גלויה למשתמש)</Label>
        <Textarea
          id="adminNote"
          name="adminNote"
          defaultValue={report.admin_note ?? ""}
          placeholder="הערות לצוות - סטטוס בדיקה, קישורים רלוונטיים וכו׳"
        />
      </FieldGroup>

      <SubmitButton>שמירת שינויים</SubmitButton>
    </form>
  );
}
