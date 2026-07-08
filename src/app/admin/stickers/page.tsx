import { getAppSettings } from "@/lib/data/stickers";
import { getTeams } from "@/lib/data/teams";
import { Card } from "@/components/ui/Card";
import { AddTeamForm } from "@/components/admin/StickerCatalogForms";

export const metadata = { title: "קטלוג מדבקות | Shashot" };

export default async function AdminStickersPage() {
  const [settings, teams] = await Promise.all([getAppSettings(), getTeams()]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold">קטלוג מדבקות</h1>
      <p className="mb-6 text-sm text-foreground/60">
        {settings.set_name} · {teams.length} נבחרות · {settings.total_stickers} מדבקות בקטלוג
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-bold">הוספת נבחרת חדשה</h2>
          <AddTeamForm />
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-bold">נבחרות משתתפות ({teams.length})</h2>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-foreground/50">
                  <th className="pb-2">דגל</th>
                  <th className="pb-2">קוד</th>
                  <th className="pb-2">שם</th>
                  <th className="pb-2">מדבקות</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => (
                  <tr key={t.code} className="border-t border-black/5">
                    <td className="py-1.5 text-lg">{t.flag_emoji}</td>
                    <td className="py-1.5 font-bold">{t.code}</td>
                    <td className="py-1.5">{t.name_he}</td>
                    <td className="py-1.5 text-foreground/60">20</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
