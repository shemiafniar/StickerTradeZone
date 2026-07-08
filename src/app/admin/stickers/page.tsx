import { getAppSettings, getStickerCatalog } from "@/lib/data/stickers";
import { Card } from "@/components/ui/Card";
import { TotalStickersForm, ImportStickerListForm } from "@/components/admin/StickerCatalogForms";

export const metadata = { title: "קטלוג מדבקות | Sticker Trade IL" };

export default async function AdminStickersPage() {
  const [settings, stickers] = await Promise.all([getAppSettings(), getStickerCatalog()]);
  const namedStickers = stickers.filter((s) => s.name);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold">קטלוג מדבקות</h1>
      <p className="mb-6 text-sm text-foreground/60">
        {settings.set_name} · {stickers.length} מדבקות בקטלוג
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-bold">כמות מדבקות כוללת</h2>
          <TotalStickersForm currentTotal={settings.total_stickers} />
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-bold">ייבוא רשימה מותאמת</h2>
          <ImportStickerListForm />
        </Card>
      </div>

      {namedStickers.length > 0 && (
        <Card className="mt-4">
          <h2 className="mb-3 text-lg font-bold">מדבקות עם שם ({namedStickers.length})</h2>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-foreground/50">
                  <th className="pb-2">מספר</th>
                  <th className="pb-2">שם</th>
                  <th className="pb-2">קבוצה</th>
                </tr>
              </thead>
              <tbody>
                {namedStickers.map((s) => (
                  <tr key={s.id} className="border-t border-black/5">
                    <td className="py-1.5 font-bold">#{s.number}</td>
                    <td className="py-1.5">{s.name}</td>
                    <td className="py-1.5 text-foreground/60">{s.team ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
