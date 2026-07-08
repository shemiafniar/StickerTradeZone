import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">
      {profile.status === "suspended" && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          החשבון שלך הושהה על ידי הנהלת המערכת. לא ניתן לבצע פעולות עד לביטול ההשעיה. לפרטים ניתן
          לפנות לתמיכה.
        </div>
      )}
      {children}
    </div>
  );
}
