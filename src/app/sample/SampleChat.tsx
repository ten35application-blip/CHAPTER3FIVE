"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Orb } from "@/components/Orb";

type Message = { role: "user" | "assistant"; content: string };

const SAMPLE_NAME = "Joaquín";
const STARTER =
  "hola. I'm joaquín. they tell me you're trying this out — go ahead, ask me something. or don't. I'm not in a rush";

export function SampleChat() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: STARTER },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hitLimit, setHitLimit] = useState(false);
  const [crisisShown, setCrisisShown] = useState(false);
  const [activityStage, setActivityStage] = useState<
    "reading" | "replying" | "typing"
  >("reading");
  const scrollerRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending || hitLimit) return;

    setError(null);
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/sample-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: messages }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setHitLimit(true);
        setError(data.error);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setMessages([...next, { role: "assistant", content: data.reply }]);
      // If the crisis check tripped server-side, surface resources inline.
      // Sticky once shown — better to over-display than miss someone in
      // crisis on a public, unauthenticated demo.
      if (data.crisis) setCrisisShown(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  const activityLabel =
    activityStage === "reading"
      ? "reading"
      : activityStage === "replying"
        ? "replying"
        : "typing";

  return (
    <div className="w-full max-w-2xl flex flex-col">
      <div className="flex flex-col items-center mb-6">
        <Orb size={140} intensity={sending ? "thinking" : "rest"} />
        <h2 className="font-serif text-3xl text-warm-50 mt-3">{SAMPLE_NAME}</h2>
        <p
          className="text-[11px] uppercase tracking-[0.25em] text-warm-300 italic min-h-[14px] mt-1"
        >
          {sending ? `${activityLabel}…` : ""}
        </p>
      </div>

      <div
        ref={scrollerRef}
        className="flex-1 max-h-[55vh] overflow-y-auto px-2 mb-3"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex my-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] bg-warm-700/70 text-warm-50 rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                  : "max-w-[85%] text-warm-50 font-serif text-lg leading-7 px-1"
              }
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      {crisisShown && (
        <div className="mb-3 rounded-2xl border border-amber-300/30 bg-amber-900/15 px-5 py-4 text-sm text-warm-100 leading-relaxed">
          <p className="font-serif italic text-base text-warm-50 mb-2">
            If you’re in a hard moment, please talk to someone real.
          </p>
          <ul className="space-y-1 text-warm-200">
            <li>
              <strong className="text-warm-50">US:</strong> 988 (call or text)
            </li>
            <li>
              <strong className="text-warm-50">UK:</strong> Samaritans 116 123
            </li>
            <li>
              <strong className="text-warm-50">México:</strong> SAPTEL +52 55
              5259-8121
            </li>
            <li>Or your local emergency services.</li>
          </ul>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-300/80 text-center mb-2">{error}</p>
      )}

      {hitLimit ? (
        <div className="text-center py-6">
          <p className="text-warm-200 text-sm leading-relaxed mb-4 max-w-md mx-auto">
            You&rsquo;ve used your sample messages. To keep talking — and to
            have a thirtyfive that actually <em>remembers</em> you — sign up.
          </p>
          <Link
            href="/auth/signup"
            className="inline-flex h-12 items-center justify-center rounded-full bg-warm-50 px-10 text-sm font-medium text-ink hover:bg-warm-100 transition-colors"
          >
            Make your own thirtyfive
          </Link>
        </div>
      ) : (
        <form
          onSubmit={send}
          className="flex gap-2 items-center pt-3 border-t border-warm-700/60"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
            placeholder={`Message ${SAMPLE_NAME}…`}
            maxLength={1000}
            className="flex-1 h-11 rounded-full bg-warm-700/30 border border-warm-400/30 px-5 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors text-sm"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="h-11 px-5 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors text-sm disabled:opacity-50"
          >
            {sending ? "…" : "Send"}
          </button>
        </form>
      )}
    </div>
  );
}
