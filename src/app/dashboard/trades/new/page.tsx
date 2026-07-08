import { notFound } from "next/navigation";
import { getProfileById } from "@/lib/data/profile";
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

  const targetProfile = await getProfileById(to);
  if (!targetProfile) notFound();

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
