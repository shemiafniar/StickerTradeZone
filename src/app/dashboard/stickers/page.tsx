import Link from "next/link";
import { getCurrentProfile } from "@/lib/data/profile";
import { getUserDuplicates, getUserMissing } from "@/lib/data/collection";
import { getAppSettings } from "@/lib/data/stickers";
import { Card } from "@/components/ui/Card";
import { BulkStickerForm } from "@/components/stickers/BulkStickerForm";
import { DuplicateList } from "@/components/stickers/DuplicateList";
import { MissingList } from "@/components/stickers/MissingList";
import { bulkAddDuplicatesAction, bulkAddMissingAction } from "@/lib/actions/stickers";
import { cn } from "@/lib/cn";

export const metadata = { title: "המדבקות שלי | Sticker Trade IL" };

export default async function StickersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = tab === "missing" ? "missing" : "duplicates";

  const profile = await getCurrentProfile();
  if (!profile) return null;

  const [duplicates, missing, settings] = await Promise.all([
    getUserDuplicates(profile.id),
    getUserMissing(profile.id),
    getAppSettings(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-extrabold">המדבקות שלי</h1>
      <p className="mb-6 text-sm text-foreground/60">
        {settings.set_name} · {settings.total_stickers} מדבקות בסדרה
      </p>

      <div className="mb-5 flex gap-2 rounded-xl bg-black/5 p-1">
        <TabLink href="/dashboard/stickers?tab=duplicates" active={activeTab === "duplicates"}>
          🔁 הקלפים שיש לי להחלפה ({duplicates.length})
        </TabLink>
        <TabLink href="/dashboard/stickers?tab=missing" active={activeTab === "missing"}>
          📋 הקלפים שחסרים לי ({missing.length})
        </TabLink>
      </div>

      <Card>
        {activeTab === "duplicates" ? (
          <>
            <h2 className="mb-3 text-lg font-bold">הוספת מדבקות כפולות</h2>
            <BulkStickerForm
              action={bulkAddDuplicatesAction}
              showListingType
              placeholder="לדוגמה: 1-20, 34, 56-60"
            />
            <DuplicateList items={duplicates} />
          </>
        ) : (
          <>
            <h2 className="mb-3 text-lg font-bold">הוספת מדבקות חסרות</h2>
            <BulkStickerForm action={bulkAddMissingAction} placeholder="לדוגמה: 1-20, 34, 56-60" />
            <MissingList items={missing} />
          </>
        )}
      </Card>
    </div>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex-1 rounded-lg px-3 py-2.5 text-center text-sm font-bold transition",
        active ? "bg-white text-brand-dark shadow-sm" : "text-foreground/60 hover:text-foreground"
      )}
    >
      {children}
    </Link>
  );
}
