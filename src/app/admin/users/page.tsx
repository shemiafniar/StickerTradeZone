import { getAdminUsers } from "@/lib/data/admin";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { setUserSuspendedAction } from "@/lib/actions/admin";

export const metadata = { title: "ניהול משתמשים | Sticker Trade IL" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const { city } = await searchParams;
  const users = await getAdminUsers(city);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold">ניהול משתמשים</h1>
      <p className="mb-6 text-sm text-foreground/60">סה&quot;כ {users.length} משתמשים</p>

      <form className="mb-5 flex gap-2" method="get">
        <Input name="city" defaultValue={city ?? ""} placeholder="חיפוש לפי עיר..." className="max-w-xs" />
        <Button type="submit" variant="outline">
          חיפוש
        </Button>
      </form>

      <div className="flex flex-col gap-3">
        {users.map((user) => (
          <Card key={user.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-extrabold">{user.full_name || "(ללא שם)"}</p>
                  {user.role === "admin" && <Badge className="bg-purple-100 text-purple-700">מנהל</Badge>}
                  {user.status === "suspended" && <Badge className="bg-red-100 text-red-700">מושעה</Badge>}
                </div>
                <p className="text-sm text-foreground/60">
                  {user.city}
                  {user.neighborhood ? ` · ${user.neighborhood}` : ""}
                </p>
                <div className="mt-2 flex gap-3 text-xs text-foreground/50">
                  <span>כפולות: {user.duplicatesCount}</span>
                  <span>חסרות: {user.missingCount}</span>
                  <span>בקשות טרייד: {user.tradeRequestsCount}</span>
                </div>
                <p className="mt-1 text-xs text-foreground/40">
                  נרשם/ה ב-{new Date(user.created_at).toLocaleDateString("he-IL")}
                </p>
              </div>

              {user.role !== "admin" && (
                <form action={setUserSuspendedAction}>
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="suspend" value={String(user.status !== "suspended")} />
                  <Button type="submit" variant={user.status === "suspended" ? "outline" : "danger"} size="sm">
                    {user.status === "suspended" ? "ביטול השעיה" : "השעיית משתמש"}
                  </Button>
                </form>
              )}
            </div>
          </Card>
        ))}

        {users.length === 0 && (
          <Card>
            <p className="text-sm text-foreground/60">לא נמצאו משתמשים התואמים את החיפוש.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
