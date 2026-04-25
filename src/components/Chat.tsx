"use client";

import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

type Props = {
  oracleName: string;
  language: "en" | "es";
};

const COPY = {
  en: {
    placeholder: (name: string) => `Message ${name}…`,
    send: "Send",
    sending: "…",
    error: "Something went wrong. Try again?",
    empty: (name: string) => `Say something to ${name}.`,
  },
  es: {
    placeholder: (name: string) => `Escribirle a ${name}…`,
    send: "Enviar",
    sending: "…",
    error: "Algo salió mal. ¿Lo intentas de nuevo?",
    empty: (name: string) => `Dile algo a ${name}.`,
  },
};

export function Chat({ oracleName, language }: Props) {
  const t = COPY[language];
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setError(null);
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: messages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.error);
      setMessages([...next, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="w-full max-w-2xl flex flex-col h-[70svh]">
      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto px-1 py-6 space-y-6"
      >
        {messages.length === 0 && !sending && (
          <p className="text-center text-warm-400 text-sm font-light italic">
            {t.empty(oracleName)}
          </p>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "flex justify-end"
                : "flex justify-start"
            }
          >
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
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="text-warm-300 italic">{t.sending}</div>
          </div>
        )}
      </div>

      {error && (
        <p className="px-1 pb-2 text-sm text-red-300/80 text-center">
          {error}
        </p>
      )}

      <form onSubmit={send} className="flex gap-2 pt-3 border-t border-warm-700/60">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.placeholder(oracleName)}
          aria-label={t.placeholder(oracleName)}
          autoFocus
          className="flex-1 h-12 rounded-full bg-warm-700/30 border border-warm-400/30 px-5 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors"
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
  );
}
