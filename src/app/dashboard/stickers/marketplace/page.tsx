import Link from "next/link";
import { getCurrentProfile } from "@/lib/data/profile";
import { getUserDuplicateListings } from "@/lib/data/collection";
import { Card } from "@/components/ui/Card";
import { DuplicateListingChip } from "@/components/collection/DuplicateListingChip";

export const metadata = { title: "הכפולים שלי | Shashot" };

export default async function MarketplacePage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const listings = await getUserDuplicateListings(profile.id);

  return (
    <div>
      <Link
        href="/dashboard/stickers"
        className="mb-3 inline-block text-sm font-bold text-foreground/50 transition hover:text-foreground"
      >
        ← חזרה לאוסף שלי
      </Link>
      <h1 className="text-2xl font-extrabold">הכפולים שלי להחלפה/מכירה 🔁</h1>
      <p className="mb-6 text-sm text-foreground/60">
        סימנתם מדבקה בכחול (כפולה) בעמוד הנבחרת? כאן אפשר להגדיר איך להציג אותה, מחיר, והערה.
      </p>

      <Card>
        {listings.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-foreground/50">
            אין לך עדיין מדבקות כפולות מסומנות. לכו ל
            <Link href="/dashboard/stickers" className="mx-1 font-bold text-brand-dark underline">
              האוסף שלי
            </Link>
            וסמנו מדבקה בכחול כדי שתופיע כאן.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {listings.map((item) => (
              <DuplicateListingChip key={item.id} item={item} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
