import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { Card } from "@/components/ui/Card";
import { SupportReportForm } from "@/components/support/SupportReportForm";

export const metadata = { title: "תקלות ומשוב" };

export default async function SupportPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-extrabold">תקלות ומשוב</h1>
      <p className="mb-6 text-sm text-foreground/60">
        נתקלתם בתקלה, או שיש לכם הצעה לשיפור? נשמח לשמוע - נציגי הצוות יקבלו הודעה על הדיווח שלכם.
      </p>

      <Card>
        <SupportReportForm userId={profile.id} />
      </Card>
    </div>
  );
}
