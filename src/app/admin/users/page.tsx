import Link from "next/link";
import { getAdminUsers } from "@/lib/data/admin";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export const metadata = { title: "ניהול משתמשים | Shashot" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const users = await getAdminUsers(q);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold">ניהול משתמשים</h1>
      <p className="mb-6 text-sm text-foreground/60">סה&quot;כ {users.length} משתמשים</p>

      <form className="mb-5 flex gap-2" method="get">
        <Input name="q" defaultValue={q ?? ""} placeholder="חיפוש לפי שם, אימייל או עיר..." className="max-w-sm" />
        <Button type="submit" variant="outline">
          חיפוש
        </Button>
      </form>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-black/5 text-right text-xs text-foreground/50">
              <th className="pb-2 pl-2">שם</th>
              <th className="pb-2 pl-2">אימייל</th>
              <th className="pb-2 pl-2">עיר</th>
              <th className="pb-2 pl-2">נרשם/ה</th>
              <th className="pb-2 pl-2">אוסף</th>
              <th className="pb-2 pl-2">טריידים</th>
              <th className="pb-2 pl-2">התאמות</th>
              <th className="pb-2 pl-2">מיקום</th>
              <th className="pb-2">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-black/5 last:border-0">
                <td className="py-2.5 pl-2">
                  <Link href={`/admin/users/${user.id}`} className="font-bold text-brand-dark hover:underline">
                    {user.full_name || "(ללא שם)"}
                  </Link>
                  {user.role === "admin" && (
                    <Badge className="mr-1.5 bg-purple-100 text-purple-700">מנהל</Badge>
                  )}
                </td>
                <td className="py-2.5 pl-2 text-foreground/70" dir="ltr">
                  {user.email ?? "-"}
                </td>
                <td className="py-2.5 pl-2 text-foreground/70">
                  {user.city}
                  {user.neighborhood ? ` · ${user.neighborhood}` : ""}
                </td>
                <td className="py-2.5 pl-2 text-foreground/50">
                  {new Date(user.created_at).toLocaleDateString("he-IL")}
                </td>
                <td className="py-2.5 pl-2 text-foreground/70">{user.collectionSize}</td>
                <td className="py-2.5 pl-2 text-foreground/70">{user.tradeRequestsCount}</td>
                <td className="py-2.5 pl-2 text-foreground/70">{user.matchesCount}</td>
                <td className="py-2.5 pl-2">{user.location_enabled ? "✅" : "—"}</td>
                <td className="py-2.5">
                  {user.status === "suspended" ? (
                    <Badge className="bg-red-100 text-red-700">מושעה</Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-700">פעיל</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <p className="py-6 text-center text-sm text-foreground/60">לא נמצאו משתמשים התואמים את החיפוש.</p>
        )}
      </Card>
    </div>
  );
}
