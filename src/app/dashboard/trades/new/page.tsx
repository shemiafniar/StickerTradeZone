import { notFound } from "next/navigation";
import { getCurrentProfile, getProfileById } from "@/lib/data/profile";
import { Card } from "@/components/ui/Card";
import { NewTradeForm } from "@/components/trades/NewTradeForm";

export const metadata = { title: "בקשת טרייד חדשה | Sticker Trade IL" };

export default async function NewTradePage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string; give?: string; receive?: string }>;
}) {
  const { to, give, receive } = await searchParams;
  if (!to) notFound();

  const [myProfile, targetProfile] = await Promise.all([getCurrentProfile(), getProfileById(to)]);
  if (!targetProfile) notFound();

  if (myProfile?.status === "suspended") {
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="mb-6 text-2xl font-extrabold">שליחת בקשת טרייד</h1>
        <Card className="border-red-200 bg-red-50">
          <p className="text-sm font-medium text-red-700">
            החשבון שלך מושהה, ולכן לא ניתן לשלוח בקשות טרייד כרגע. לפרטים ניתן לפנות לתמיכה.
          </p>
        </Card>
      </div>
    );
  }

  if (targetProfile.status !== "active") {
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="mb-6 text-2xl font-extrabold">שליחת בקשת טרייד</h1>
        <Card>
          <p className="text-sm text-foreground/60">לא ניתן לשלוח בקשת טרייד לאספן/ית זה/זו כרגע.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-extrabold">שליחת בקשת טרייד</h1>
      <p className="mb-6 text-sm text-foreground/60">
        אל <span className="font-bold">{targetProfile.full_name}</span> · {targetProfile.city}
      </p>

      <Card>
        <NewTradeForm
          toUserId={targetProfile.id}
          defaultGive={give ?? ""}
          defaultReceive={receive ?? ""}
        />
      </Card>
    </div>
  );
}
