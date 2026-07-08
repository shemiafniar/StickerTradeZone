"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendTradeMessageAction, markTradeMessagesReadAction, type ChatActionState } from "@/lib/actions/chat";
import type { TradeMessage } from "@/types/database";

const initialState: ChatActionState = {};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

export function TradeChat({
  tradeRequestId,
  currentUserId,
  initialMessages,
  disabled,
}: {
  tradeRequestId: string;
  currentUserId: string;
  initialMessages: TradeMessage[];
  disabled?: boolean;
}) {
  // Keyed by tradeRequestId at the call site, so switching trades remounts
  // this component fresh instead of needing an effect to resync messages.
  const [messages, setMessages] = useState<TradeMessage[]>(initialMessages);
  const [state, formAction] = useActionState(sendTradeMessageAction, initialState);
  const listRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    markTradeMessagesReadAction(tradeRequestId);
  }, [tradeRequestId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`trade_messages:${tradeRequestId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "trade_messages", filter: `trade_request_id=eq.${tradeRequestId}` },
        (payload) => {
          const newMessage = payload.new as TradeMessage;
          setMessages((prev) => (prev.some((m) => m.id === newMessage.id) ? prev : [...prev, newMessage]));
          if (newMessage.sender_id !== currentUserId) {
            markTradeMessagesReadAction(tradeRequestId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tradeRequestId, currentUserId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!state.error) formRef.current?.reset();
  }, [state]);

  return (
    <div className="flex h-[28rem] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white">
      <div className="border-b border-black/5 bg-black/[0.02] px-4 py-2.5">
        <p className="text-sm font-bold">💬 צ׳אט הטרייד</p>
      </div>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <p className="mt-8 text-center text-sm text-foreground/40">
            אין עדיין הודעות. כתבו הודעה כדי לתאם את ההחלפה!
          </p>
        ) : (
          messages.map((message) => {
            const isMine = message.sender_id === currentUserId;
            return (
              <div key={message.id} className={`flex ${isMine ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                    isMine ? "bg-brand text-white" : "bg-black/5 text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  <p className={`mt-1 text-[10px] ${isMine ? "text-white/70" : "text-foreground/40"}`}>
                    {formatTime(message.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {disabled ? (
        <p className="border-t border-black/5 px-4 py-3 text-center text-xs text-foreground/40">
          לא ניתן לשלוח הודעות בבקשה שבוטלה/נדחתה
        </p>
      ) : (
        <form ref={formRef} action={formAction} className="flex items-end gap-2 border-t border-black/5 p-2.5">
          <input type="hidden" name="tradeRequestId" value={tradeRequestId} />
          <textarea
            name="body"
            required
            rows={1}
            maxLength={2000}
            placeholder="כתבו הודעה..."
            className="max-h-24 flex-1 resize-none rounded-xl border border-black/15 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          <button
            type="submit"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition hover:bg-brand-dark"
            aria-label="שליחה"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="-scale-x-100">
              <path d="M3 20l18-8L3 4v6l12 2-12 2z" />
            </svg>
          </button>
        </form>
      )}
      {state.error && <p className="px-3 pb-2 text-xs font-medium text-red-600">{state.error}</p>}
    </div>
  );
}
