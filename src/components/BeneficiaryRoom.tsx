"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Member = {
  userId: string;
  displayName: string;
  isMe: boolean;
};

type Oracle = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  senderUserId: string | null;
  senderOracleId: string | null;
  createdAt: string;
};

type Props = {
  roomId: string;
  language: "en" | "es";
  oracle: Oracle;
  members: Member[];
  initialMessages: Message[];
};

const COPY = {
  en: {
    placeholder: (name: string) => `Say something to ${name}…`,
    send: "Send",
    sending: "…",
    error: "Couldn't send. Try again?",
    empty: (name: string) => `Sit with ${name}. Whoever wants to start, can.`,
    waiting: "they might be replying…",
    you: "you",
  },
  es: {
    placeholder: (name: string) => `Dile algo a ${name}…`,
    send: "Enviar",
    sending: "…",
    error: "No se pudo enviar. ¿Intentas de nuevo?",
    empty: (name: string) =>
      `Estén con ${name}. Quien quiera empezar, puede.`,
    waiting: "podrían estar contestando…",
    you: "tú",
  },
};

export function BeneficiaryRoom({
  roomId,
  language,
  oracle,
  members,
  initialMessages,
}: Props) {
  const t = COPY[language];
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const memberById = useMemo(() => {
    const m = new Map<string, Member>();
    for (const x of members) m.set(x.userId, x);
    return m;
  }, [members]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  // Realtime: any new message in this room (from any beneficiary OR
  // the persona) lands live.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`beneficiary_room:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "beneficiary_room_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            role: "user" | "assistant";
            content: string;
            sender_user_id: string | null;
            sender_oracle_id: string | null;
            created_at: string;
          };
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [
              ...prev,
              {
                id: row.id,
                role: row.role,
                content: row.content,
                senderUserId: row.sender_user_id,
                senderOracleId: row.sender_oracle_id,
                createdAt: row.created_at,
              },
            ];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);

    // Optimistic insert as our own message.
    const tempId = `local-${Date.now()}`;
    const me = members.find((m) => m.isMe);
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: "user",
        content: text,
        senderUserId: me?.userId ?? null,
        senderOracleId: null,
        createdAt: new Date().toISOString(),
      },
    ]);
    setInput("");

    try {
      const res = await fetch("/api/chat/beneficiary-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: roomId, message: text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? t.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="w-full max-w-3xl flex flex-col">
      <div className="flex items-center gap-3 mb-6 flex-wrap justify-center">
        <div className="flex items-center gap-2">
          {oracle.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={oracle.avatarUrl}
              alt=""
              className="w-12 h-12 rounded-full object-cover border border-warm-300/30"
            />
          ) : (
            <span className="w-12 h-12 rounded-full bg-warm-700/40 border border-warm-300/30 inline-block" />
          )}
          <span className="font-serif text-xl text-warm-50">{oracle.name}</span>
        </div>
      </div>

      <p className="text-xs uppercase tracking-[0.2em] text-warm-300 text-center mb-6">
        {language === "es" ? "con" : "with"}{" "}
        {members.map((m, i) => (
          <span key={m.userId}>
            {i > 0 && ", "}
            {m.isMe ? t.you : m.displayName}
          </span>
        ))}
      </p>

      <div className="flex flex-col h-[60svh]">
        <div
          ref={scrollerRef}
          className="flex-1 overflow-y-auto px-1 py-2 space-y-5"
        >
          {messages.length === 0 && (
            <p className="text-center text-warm-400 text-sm font-light italic mt-8">
              {t.empty(oracle.name)}
            </p>
          )}

          {messages.map((m) => {
            const isUser = m.role === "user";
            const senderUser = m.senderUserId
              ? memberById.get(m.senderUserId)
              : null;
            const isMine = senderUser?.isMe;
            return (
              <div
                key={m.id}
                className={isMine ? "flex justify-end" : "flex justify-start"}
              >
                <div className="flex items-start gap-2 max-w-[85%]">
                  {!isMine && (
                    <>
                      {isUser ? (
                        <span className="w-7 h-7 rounded-full bg-warm-700/40 flex-shrink-0 mt-1" />
                      ) : oracle.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={oracle.avatarUrl}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-1"
                        />
                      ) : (
                        <span className="w-7 h-7 rounded-full bg-warm-700/40 flex-shrink-0 mt-1" />
                      )}
                    </>
                  )}
                  <div>
                    {!isMine && (
                      <p className="text-xs text-warm-300 mb-1 ml-1">
                        {isUser ? senderUser?.displayName ?? "—" : oracle.name}
                      </p>
                    )}
                    <div
                      className={
                        isMine
                          ? "rounded-2xl bg-warm-700/40 text-warm-50 px-4 py-3 leading-relaxed"
                          : isUser
                            ? "rounded-2xl bg-warm-700/20 text-warm-100 px-4 py-3 leading-relaxed border border-warm-700/40"
                            : "text-warm-50 leading-relaxed font-serif text-lg"
                      }
                    >
                      {m.content}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {sending && (
            <p className="text-xs text-warm-400 italic text-center pt-2">
              {t.waiting}
            </p>
          )}
        </div>

        {error && (
          <p className="px-1 pb-2 text-sm text-red-300/80 text-center">
            {error}
          </p>
        )}

        <form
          onSubmit={send}
          className="flex gap-2 pt-3 border-t border-warm-700/60"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.placeholder(oracle.name)}
            aria-label={t.placeholder(oracle.name)}
            disabled={sending}
            className="flex-1 h-12 rounded-full bg-warm-700/30 border border-warm-400/30 px-5 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="h-12 px-6 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? t.sending : t.send}
          </button>
        </form>
      </div>
    </div>
  );
}
