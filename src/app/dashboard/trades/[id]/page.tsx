import { notFound } from "next/navigation";
import { getTradeRequestById } from "@/lib/data/trades";
import { getCurrentProfile, getRevealedContact } from "@/lib/data/profile";
import { getTradeMessages } from "@/lib/data/chat";
import { Card } from "@/components/ui/Card";
import { TradeStatusBadge } from "@/components/ui/Badge";
import { TradeChat } from "@/components/trades/TradeChat";
import { TradeActionForm } from "@/components/trades/TradeActionForm";
import {
  acceptTradeAction,
  cancelTradeAction,
  completeTradeAction,
  declineTradeAction,
} from "@/lib/actions/trades";

export const metadata = { title: "פרטי טרייד" };

export default async function TradeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [trade, myProfile, messages] = await Promise.all([
    getTradeRequestById(id),
    getCurrentProfile(),
    getTradeMessages(id),
  ]);
  if (!trade || !myProfile) notFound();

  const isSuspended = myProfile.status === "suspended";
  const contactRevealed = trade.status === "accepted" || trade.status === "completed";
  const contact = contactRevealed && trade.otherUser ? await getRevealedContact(trade.otherUser.id) : null;

  const whatsappLink = contact?.whatsapp
    ? `https://wa.me/972${contact.whatsapp.replace(/^0/, "").replace(/\D/g, "")}`
    : null;

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">בקשת טרייד</h1>
        <TradeStatusBadge status={trade.status} />
      </div>

      <Card>
        <p className="text-sm text-foreground/60">
          {trade.isSender ? "נשלח אל" : "התקבל מאת"}
        </p>
        <p className="text-lg font-extrabold">{trade.otherUser?.full_name ?? "אספן"}</p>
        <p className="text-sm text-foreground/60">
          {trade.otherUser?.city}
          {trade.otherUser?.neighborhood ? ` · ${trade.otherUser.neighborhood}` : ""}
        </p>

        {trade.message && (
          <p className="mt-3 rounded-xl bg-black/5 p-3 text-sm text-foreground/80">
            &ldquo;{trade.message}&rdquo;
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-green-50 p-3">
            <p className="text-xs font-bold text-green-700">תקבל/י</p>
            <p className="mt-1 text-sm font-bold text-green-800" dir="ltr">
              {trade.itemsToReceive.map((i) => i.stickerCode).join(", ") || "-"}
            </p>
          </div>
          <div className="rounded-xl bg-blue-50 p-3">
            <p className="text-xs font-bold text-blue-700">תיתן/י</p>
            <p className="mt-1 text-sm font-bold text-blue-800" dir="ltr">
              {trade.itemsToGive.map((i) => i.stickerCode).join(", ") || "-"}
            </p>
          </div>
        </div>

        {isSuspended && (
          <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            החשבון שלך מושהה, ולכן לא ניתן לעדכן בקשות טרייד כרגע.
          </p>
        )}

        {!isSuspended && trade.status === "pending" && !trade.isSender && (
          <div className="mt-5 flex gap-3">
            <TradeActionForm tradeId={trade.id} action={acceptTradeAction} label="אישור בקשה" className="flex-1" />
            <TradeActionForm
              tradeId={trade.id}
              action={declineTradeAction}
              label="דחייה"
              variant="outline"
              className="flex-1"
            />
          </div>
        )}

        {!isSuspended && trade.status === "pending" && trade.isSender && (
          <TradeActionForm
            tradeId={trade.id}
            action={cancelTradeAction}
            label="ביטול הבקשה"
            variant="outline"
            className="mt-5"
          />
        )}

        {!isSuspended && trade.status === "accepted" && (
          <TradeActionForm tradeId={trade.id} action={completeTradeAction} label="סמן/י כהושלם" className="mt-5" />
        )}

        {contactRevealed && (
          <div className="mt-5 rounded-xl border border-brand/20 bg-brand/5 p-4">
            <p className="mb-2 text-sm font-bold text-brand-dark">
              🎉 פרטי הקשר נחשפו - אפשר לתאם החלפה!
            </p>
            {contact?.phone ? (
              <p className="text-sm">
                טלפון: <span dir="ltr" className="font-bold">{contact.phone}</span>
              </p>
            ) : (
              <p className="text-sm text-foreground/50">לא הוזן מספר טלפון</p>
            )}
            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-green-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-green-600"
              >
                💬 פתיחת שיחה בוואטסאפ
              </a>
            )}
          </div>
        )}
      </Card>

      <div className="mt-4">
        <TradeChat
          key={trade.id}
          tradeRequestId={trade.id}
          currentUserId={myProfile.id}
          initialMessages={messages}
          disabled={isSuspended || trade.status === "declined" || trade.status === "cancelled"}
        />
      </div>
    </div>
  );
}
