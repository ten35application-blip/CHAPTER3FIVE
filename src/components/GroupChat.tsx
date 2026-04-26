"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Orb } from "./Orb";

type Member = { id: string; name: string; avatar_url: string | null };
type GroupMessage = {
  role: "user" | "assistant";
  content: string;
  oracle_id?: string;
};

const COPY = {
  en: {
    placeholder: "Message everyone…",
    send: "Send",
    sending: "…",
    error: "Something went wrong. Try again?",
    empty: "Say something — they'll all hear you.",
    reading: "reading",
    replying: "replying",
  },
  es: {
    placeholder: "Mandarles un mensaje…",
    send: "Enviar",
    sending: "…",
    error: "Algo salió mal. ¿Lo intentas de nuevo?",
    empty: "Di algo — todos te van a escuchar.",
    reading: "leyendo",
    replying: "contestando",
  },
};

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

export function GroupChat({
  members,
  language,
}: {
  members: Member[];
  language: "en" | "es";
}) {
  const t = COPY[language];
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [input, setInput] = useState("");
  const [pendingFrom, setPendingFrom] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const timezone = useMemo(detectTimezone, []);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, pendingFrom]);

  const memberById = useMemo(() => {
    const m = new Map<string, Member>();
    members.forEach((x) => m.set(x.id, x));
    return m;
  }, [members]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || pendingFrom.size > 0) return;

    setError(null);
    const userMsg: GroupMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setPendingFrom(new Set(members.map((m) => m.id)));

    // Fan out: each member gets the conversation, replies independently.
    members.forEach(async (m) => {
      try {
        // Build the per-member history: only their own past replies + user msgs.
        const myHistory = messages.filter(
          (msg) => msg.role === "user" || msg.oracle_id === m.id,
        );

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history: myHistory,
            timezone,
            oracle_id: m.id,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? t.error);

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply, oracle_id: m.id },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : t.error);
      } finally {
        setPendingFrom((prev) => {
          const next = new Set(prev);
          next.delete(m.id);
          return next;
        });
      }
    });
  }

  return (
    <div className="max-w-2xl w-full mx-auto flex flex-col items-center">
      <div className="mb-4">
        <Orb size={180} intensity={pendingFrom.size > 0 ? "thinking" : "rest"} />
      </div>

      <div className="flex items-center gap-3 mb-2">
        {members.map((m, i) => (
          <div key={m.id} className="flex items-center gap-2">
            {i > 0 && <span className="text-warm-400 text-xs">·</span>}
            {m.avatar_url ? (
              <Image
                src={m.avatar_url}
                alt=""
                width={24}
                height={24}
                className="w-6 h-6 rounded-full object-cover"
                unoptimized
              />
            ) : null}
            <span className="font-serif text-warm-100 text-sm">{m.name}</span>
          </div>
        ))}
      </div>
      {pendingFrom.size > 0 && (
        <p className="text-xs uppercase tracking-[0.2em] text-warm-300 italic mb-6">
          {Array.from(pendingFrom).length === members.length
            ? t.reading
            : t.replying}
          …
        </p>
      )}
      {pendingFrom.size === 0 && <div className="mb-6" />}

      <div className="w-full flex flex-col h-[55svh]">
        <div
          ref={scrollerRef}
          className="flex-1 overflow-y-auto px-1 py-2 space-y-5"
        >
          {messages.length === 0 && pendingFrom.size === 0 && (
            <p className="text-center text-warm-400 text-sm font-light italic mt-8">
              {t.empty}
            </p>
          )}

          {messages.map((m, i) => {
            const sender = m.oracle_id ? memberById.get(m.oracle_id) : null;
            return (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "flex justify-end"
                    : "flex justify-start flex-col items-start"
                }
              >
                {sender && (
                  <div className="flex items-center gap-2 mb-1 px-1">
                    {sender.avatar_url && (
                      <Image
                        src={sender.avatar_url}
                        alt=""
                        width={16}
                        height={16}
                        className="w-4 h-4 rounded-full object-cover"
                        unoptimized
                      />
                    )}
                    <span className="font-serif text-warm-200 text-xs">
                      {sender.name}
                    </span>
                  </div>
                )}
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[80%] rounded-2xl bg-warm-700/40 text-warm-50 px-4 py-3 leading-relaxed"
                      : "max-w-[85%] text-warm-50 leading-relaxed font-serif text-lg"
                  }
                >
                  {m.content}
                </div>
              </div>
            );
          })}
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
            autoFocus
            disabled={pendingFrom.size > 0}
            className="flex-1 h-12 rounded-full bg-warm-700/30 border border-warm-400/30 px-5 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={pendingFrom.size > 0 || !input.trim()}
            className="h-12 px-6 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pendingFrom.size > 0 ? t.sending : t.send}
          </button>
        </form>
      </div>
    </div>
  );
}
