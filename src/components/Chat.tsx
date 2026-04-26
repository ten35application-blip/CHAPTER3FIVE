"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Orb } from "./Orb";
import { createClient } from "@/lib/supabase/client";

type Message = {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string | null;
};

type Props = {
  oracleName: string;
  language: "en" | "es";
  initialHistory?: Message[];
  avatarUrl?: string | null;
  oracleId?: string | null;
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

export function Chat({
  oracleName,
  language,
  initialHistory = [],
  avatarUrl = null,
  oracleId = null,
}: Props) {
  const t = COPY[language];
  const [messages, setMessages] = useState<Message[]>(initialHistory);
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
  const [pendingImage, setPendingImage] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Realtime: when the proactive cron (or any future system process)
  // inserts a message addressed to this user + oracle, push it into the
  // chat live without a refresh. Filtering on initiated_by_oracle=true
  // keeps us from double-rendering messages we just sent ourselves —
  // those come back via the /api/chat fetch response, not the realtime
  // stream.
  useEffect(() => {
    if (!oracleId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${oracleId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `oracle_id=eq.${oracleId}`,
        },
        (payload) => {
          const row = payload.new as {
            role: "user" | "assistant";
            content: string;
            initiated_by_oracle?: boolean;
          };
          if (!row.initiated_by_oracle) return;
          if (row.role !== "assistant") return;
          setMessages((prev) => {
            // Idempotency: if the last message is identical, skip.
            const last = prev[prev.length - 1];
            if (last && last.role === row.role && last.content === row.content) {
              return prev;
            }
            return [...prev, { role: row.role, content: row.content }];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [oracleId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (sending) return;
    // Allow sending a photo with no caption — but require at least one of
    // text or image.
    if (!text && !pendingImage) return;

    setError(null);
    setSending(true);

    // Upload the photo first so we have a URL to send with the message.
    let imageUrl: string | null = null;
    let imageStoragePath: string | null = null;
    const imageToSend = pendingImage;
    if (imageToSend && oracleId) {
      try {
        const supabase = createClient();
        const { data: session } = await supabase.auth.getSession();
        const userId = session.session?.user.id;
        if (!userId) throw new Error("not signed in");
        const ext = (imageToSend.file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${userId}/${oracleId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("chat-photos")
          .upload(path, imageToSend.file, {
            contentType: imageToSend.file.type || `image/${ext}`,
          });
        if (uploadErr) throw uploadErr;
        const { data: signed } = await supabase.storage
          .from("chat-photos")
          .createSignedUrl(path, 60 * 60 * 24 * 365); // 1y for chat history.
        imageUrl = signed?.signedUrl ?? null;
        imageStoragePath = path;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't upload photo");
        setSending(false);
        return;
      }
    }

    const next: Message[] = [
      ...messages,
      { role: "user", content: text, imageUrl: imageUrl ?? undefined },
    ];
    setMessages(next);
    setInput("");
    setPendingImage(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text || "(sent a photo)",
          history: messages,
          timezone,
          ...(oracleId ? { oracle_id: oracleId } : {}),
          ...(imageUrl
            ? { image_url: imageUrl, image_storage_path: imageStoragePath }
            : {}),
        }),
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

  function pickImage(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Only image files.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Image too large (max 8MB).");
      return;
    }
    setError(null);
    const previewUrl = URL.createObjectURL(file);
    setPendingImage({ file, previewUrl });
  }

  function clearPendingImage() {
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    setPendingImage(null);
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

      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          className="w-16 h-16 rounded-full object-cover mb-3 border border-warm-400/30"
        />
      ) : null}
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
                  {m.imageUrl && (
                    <img
                      src={m.imageUrl}
                      alt=""
                      className="rounded-xl max-w-full max-h-80 object-cover mb-2"
                    />
                  )}
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

        {pendingImage && (
          <div className="px-1 pb-2 flex items-center gap-2">
            <img
              src={pendingImage.previewUrl}
              alt=""
              className="w-12 h-12 rounded-lg object-cover border border-warm-300/30"
            />
            <span className="text-xs text-warm-300 flex-1 truncate">
              {pendingImage.file.name}
            </span>
            <button
              type="button"
              onClick={clearPendingImage}
              className="text-xs text-warm-400 hover:text-warm-200 transition-colors"
            >
              ×
            </button>
          </div>
        )}

        <form
          onSubmit={send}
          className="flex gap-2 pt-3 border-t border-warm-700/60"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickImage(f);
              e.target.value = ""; // allow re-selecting same file
            }}
          />
          <button
            type="button"
            disabled={sending || !oracleId}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach photo"
            title="Attach photo"
            className="h-12 w-12 rounded-full border border-warm-400/30 bg-warm-700/30 text-warm-200 hover:bg-warm-700/50 transition-colors disabled:opacity-50 flex items-center justify-center text-xl"
          >
            +
          </button>
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
            disabled={sending || (!input.trim() && !pendingImage)}
            className="h-12 px-6 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? t.sending : t.send}
          </button>
        </form>
      </div>
    </div>
  );
}
