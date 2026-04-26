"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Orb } from "./Orb";

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
    reading: "reading",
    replying: "replying",
    typing: "typing",
    report: "Report",
    reportPlaceholder: "What was wrong with this message? (optional)",
    reportSubmit: "Submit",
    reportCancel: "Cancel",
    reportThanks: "Thanks. We'll review it.",
  },
  es: {
    placeholder: (name: string) => `Escribirle a ${name}…`,
    send: "Enviar",
    sending: "…",
    error: "Algo salió mal. ¿Lo intentas de nuevo?",
    empty: (name: string) => `Dile algo a ${name}.`,
    reading: "leyendo",
    replying: "contestando",
    typing: "escribiendo",
    report: "Reportar",
    reportPlaceholder: "¿Qué estuvo mal con este mensaje? (opcional)",
    reportSubmit: "Enviar",
    reportCancel: "Cancelar",
    reportThanks: "Gracias. Lo revisaremos.",
  },
};

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

export function Chat({ oracleName, language }: Props) {
  const t = COPY[language];
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportingIndex, setReportingIndex] = useState<number | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportedIndexes, setReportedIndexes] = useState<Set<number>>(
    new Set(),
  );
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const timezone = useMemo(detectTimezone, []);
  const [activityStage, setActivityStage] = useState<
    "reading" | "replying" | "typing"
  >("reading");

  useEffect(() => {
    if (!sending) {
      setActivityStage("reading");
      return;
    }
    setActivityStage("reading");
    const t1 = setTimeout(() => setActivityStage("replying"), 1300);
    const t2 = setTimeout(() => setActivityStage("typing"), 3200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [sending]);

  const activityLabel =
    activityStage === "reading"
      ? t.reading
      : activityStage === "replying"
        ? t.replying
        : t.typing;

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
        body: JSON.stringify({ message: text, history: messages, timezone }),
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

  async function submitReport(index: number, content: string) {
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, reason: reportReason }),
      });
      if (!res.ok) throw new Error("report failed");
      setReportedIndexes((s) => new Set(s).add(index));
      setReportingIndex(null);
      setReportReason("");
    } catch {
      // silently fail; the chat shouldn't break for a failed report
      setReportingIndex(null);
      setReportReason("");
    }
  }

  return (
    <div className="w-full max-w-2xl flex flex-col items-center">
      <div className="mb-6">
        <Orb size={260} intensity={sending ? "thinking" : "rest"} />
      </div>

      <h1 className="font-serif text-3xl text-warm-50 mb-1">{oracleName}</h1>
      <p className="text-xs uppercase tracking-[0.2em] text-warm-300 mb-8 italic min-h-[1em]">
        {sending ? `${activityLabel}…` : ""}
      </p>

      <div className="w-full flex flex-col h-[55svh]">
        <div
          ref={scrollerRef}
          className="flex-1 overflow-y-auto px-1 py-2 space-y-6"
        >
          {messages.length === 0 && !sending && (
            <p className="text-center text-warm-400 text-sm font-light italic mt-8">
              {t.empty(oracleName)}
            </p>
          )}

          {messages.map((m, i) => (
            <div key={i} className="group">
              <div
                className={
                  m.role === "user" ? "flex justify-end" : "flex justify-start"
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

              {m.role === "assistant" && (
                <div className="mt-1 ml-1 flex items-center gap-2">
                  {reportedIndexes.has(i) ? (
                    <span className="text-xs text-warm-400 italic">
                      {t.reportThanks}
                    </span>
                  ) : reportingIndex === i ? (
                    <div className="flex items-center gap-2 w-full max-w-[85%]">
                      <input
                        type="text"
                        value={reportReason}
                        onChange={(e) => setReportReason(e.target.value)}
                        placeholder={t.reportPlaceholder}
                        maxLength={500}
                        autoFocus
                        className="flex-1 h-8 rounded-full bg-warm-700/30 border border-warm-400/30 px-3 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => submitReport(i, m.content)}
                        className="text-xs text-warm-100 hover:text-warm-50 transition-colors px-2"
                      >
                        {t.reportSubmit}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReportingIndex(null);
                          setReportReason("");
                        }}
                        className="text-xs text-warm-400 hover:text-warm-200 transition-colors px-2"
                      >
                        {t.reportCancel}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setReportingIndex(i)}
                      className="text-[11px] text-warm-500 hover:text-warm-300 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      {t.report}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
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
            placeholder={t.placeholder(oracleName)}
            aria-label={t.placeholder(oracleName)}
            autoFocus
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
