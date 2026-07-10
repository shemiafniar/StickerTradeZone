import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUserById, getAdminUserCollectionDetail } from "@/lib/data/admin";
import { getRevealedContact } from "@/lib/data/profile";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SuspendUserButton } from "@/components/admin/SuspendUserButton";
import { EditUserForm } from "@/components/admin/EditUserForm";
import { DeleteUserButton } from "@/components/admin/DeleteUserButton";
import { AdminUserCollectionPanel } from "@/components/admin/AdminUserCollectionPanel";

export const metadata = { title: "פרופיל משתמש" };

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAdminUserById(id);
  if (!user) notFound();

  const [contact, collectionDetail] = await Promise.all([getRevealedContact(id), getAdminUserCollectionDetail(id)]);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/users" className="mb-3 inline-block text-sm font-bold text-foreground/50 hover:text-foreground">
        ← חזרה לניהול משתמשים
      </Link>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold">{user.full_name || "(ללא שם)"}</h1>
            {user.role === "admin" && <Badge className="bg-brand-navy/10 !text-brand-navy">מנהל</Badge>}
            {user.status === "suspended" ? (
              <Badge className="bg-red-100 text-red-700">מושעה</Badge>
            ) : (
              <Badge className="bg-green-100 text-green-700">פעיל</Badge>
            )}
          </div>
          <p className="text-sm text-foreground/60" dir="ltr">
            {user.email ?? "-"}
          </p>
        </div>
        {user.role !== "admin" && <SuspendUserButton userId={user.id} suspended={user.status === "suspended"} />}
      </div>

      <Card className="mb-4">
        <h2 className="mb-3 text-lg font-bold">סטטיסטיקות</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="גודל אוסף" value={user.collectionSize} />
          <Stat label="עם כפולות" value={user.duplicatesCount} />
          <Stat label="חסרות" value={user.missingCount} />
          <Stat label="עותקי כפולות" value={user.duplicateCopies} />
          <Stat label="בקשות טרייד" value={user.tradeRequestsCount} />
          <Stat label="התאמות פעילות" value={user.matchesCount} />
          <Stat label="מיקום מופעל" value={user.location_enabled ? "כן" : "לא"} />
          <Stat label="נרשם/ה" value={new Date(user.created_at).toLocaleDateString("he-IL")} />
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-3 text-lg font-bold">פרטי קשר</h2>
        <p className="text-sm text-foreground/70">
          טלפון: <span dir="ltr" className="font-bold">{contact?.phone ?? "לא הוזן"}</span>
        </p>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-3 text-lg font-bold">אוסף המדבקות (למנהלים בלבד) 🔒</h2>
        <AdminUserCollectionPanel detail={collectionDetail} />
      </Card>

      <Card className="mb-4">
        <h2 className="mb-3 text-lg font-bold">עריכת פרטי משתמש</h2>
        <EditUserForm user={user} />
      </Card>

      {user.role !== "admin" && (
        <Card className="border-red-200 bg-red-50">
          <h2 className="mb-2 text-lg font-bold text-red-800">אזור מסוכן</h2>
          <p className="mb-3 text-sm text-red-700">
            מחיקת משתמש היא פעולה בלתי הפיכה - כל האוסף, הטריידים וההודעות שלו/ה יימחקו לצמיתות.
          </p>
          <DeleteUserButton userId={user.id} fullName={user.full_name} />
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-black/[0.03] p-3 text-center">
      <p className="text-lg font-extrabold">{value}</p>
      <p className="text-xs font-medium text-foreground/60">{label}</p>
    </div>
  );
}
