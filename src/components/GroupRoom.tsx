"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Member = {
  oracleId: string;
  name: string;
  avatarUrl: string | null;
  left: boolean;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  senderOracleId: string | null;
  createdAt: string;
};

type Props = {
  roomId: string;
  language: "en" | "es";
  members: Member[];
  initialMessages: Message[];
};

const COPY = {
  en: {
    placeholder: "Say something to the group…",
    send: "Send",
    sending: "…",
    error: "Couldn't send. Try again?",
    empty: "Empty room. Start the chat.",
    waiting: "someone might be typing…",
    left: "left the chat",
  },
  es: {
    placeholder: "Dile algo al grupo…",
    send: "Enviar",
    sending: "…",
    error: "No se pudo enviar. ¿Intentas de nuevo?",
    empty: "Cuarto vacío. Empieza el chat.",
    waiting: "alguien podría estar escribiendo…",
    left: "se fue del chat",
  },
};

export function GroupRoom({ roomId, language, members: initialMembers, initialMessages }: Props) {
  const t = COPY[language];
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const memberById = useMemo(() => {
    const m = new Map<string, Member>();
    for (const x of members) m.set(x.oracleId, x);
    return m;
  }, [members]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  // Realtime subscription so persona replies stream in as the
  // orchestration API posts them.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`group_messages:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            role: "user" | "assistant";
            content: string;
            sender_oracle_id: string | null;
            created_at: string;
          };
          if (row.role !== "assistant") return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [
              ...prev,
              {
                id: row.id,
                role: row.role,
                content: row.content,
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

  // Realtime: when a persona walks out, group_room_members.left_at
  // flips. Mark them in the local state so the chip strikes through
  // without a refresh.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`group_members:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "group_room_members",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.new as {
            oracle_id: string;
            left_at: string | null;
          };
          if (!row.left_at) return;
          setMembers((prev) =>
            prev.map((m) =>
              m.oracleId === row.oracle_id ? { ...m, left: true } : m,
            ),
          );
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

    const tempId = `local-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: "user",
        content: text,
        senderOracleId: null,
        createdAt: new Date().toISOString(),
      },
    ]);
    setInput("");

    try {
      const res = await fetch("/api/chat/group", {
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
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {members.map((m) => (
          <div
            key={m.oracleId}
            className={
              m.left
                ? "flex items-center gap-2 opacity-40"
                : "flex items-center gap-2"
            }
            title={m.left ? `${m.name} ${t.left}` : m.name}
          >
            {m.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.avatarUrl}
                alt=""
                className="w-9 h-9 rounded-full object-cover border border-warm-300/30"
              />
            ) : (
              <span className="w-9 h-9 rounded-full bg-warm-700/40 border border-warm-300/30 inline-block" />
            )}
            <span className="text-sm text-warm-100">{m.name}</span>
            {m.left && (
              <span className="text-xs text-warm-400 italic">· {t.left}</span>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col h-[60svh]">
        <div
          ref={scrollerRef}
          className="flex-1 overflow-y-auto px-1 py-2 space-y-5"
        >
          {messages.length === 0 && (
            <p className="text-center text-warm-400 text-sm font-light italic mt-8">
              {t.empty}
            </p>
          )}

          {messages.map((m) => {
            const isUser = m.role === "user";
            const sender = m.senderOracleId
              ? memberById.get(m.senderOracleId)
              : null;
            return (
              <div
                key={m.id}
                className={isUser ? "flex justify-end" : "flex justify-start"}
              >
                <div className="flex items-start gap-2 max-w-[85%]">
                  {!isUser && (
                    <>
                      {sender?.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={sender.avatarUrl}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-1"
                        />
                      ) : (
                        <span className="w-7 h-7 rounded-full bg-warm-700/40 flex-shrink-0 mt-1" />
                      )}
                    </>
                  )}
                  <div>
                    {!isUser && (
                      <p className="text-xs text-warm-300 mb-1 ml-1">
                        {sender?.name ?? "—"}
                      </p>
                    )}
                    <div
                      className={
                        isUser
                          ? "rounded-2xl bg-warm-700/40 text-warm-50 px-4 py-3 leading-relaxed"
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
            placeholder={t.placeholder}
            aria-label={t.placeholder}
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
