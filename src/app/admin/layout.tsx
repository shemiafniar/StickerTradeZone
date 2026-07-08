import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { AdminTabs } from "@/components/admin/AdminTabs";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/dashboard");

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">
      <div className="mb-6 flex items-center gap-2 rounded-xl bg-foreground px-4 py-3 text-white">
        <span>🛡️</span>
        <p className="text-sm font-bold">אזור ניהול - גישה למנהלי המערכת בלבד</p>
      </div>

      <AdminTabs />

      {children}
    </div>
  );
}
