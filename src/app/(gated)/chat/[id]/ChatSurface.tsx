"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ChatInput, { type OutgoingImage } from "./ChatInput";
import { MessageActions, ReactionIcon } from "./MessageActions";
import type { ReactionKind, ReportReason } from "@/lib/reactions";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  readByOracleAt: string | null;
  pending: boolean;
  /** Renderable image URL (signed server-side, or a local preview for
   *  the optimistic bubble). Null for text-only messages. */
  imageUrl: string | null;
  /** The current user's own tapback on this message (null if none). */
  myReaction: ReactionKind | null;
  /** The persona's tapback on this message (null if none). Personas
   *  react server-side via the stream route in a follow-up commit —
   *  the render path handles it now so the badge shows up when it
   *  starts flowing. */
  theirReaction: ReactionKind | null;
};

/** { messageId, DOMRect } for the currently-open tapback popover, or
 *  null when nothing is targeted. */
type ActionsTarget = { messageId: string; anchor: DOMRect } | null;

const LONG_PRESS_MS = 350;

type StreamEvent =
  | { type: "begin"; userMessageId: string | null; readByOracleAt: string }
  | { type: "text"; text: string }
  | { type: "done"; messageId: string | null }
  | { type: "error"; error: string };

/**
 * Time separator label. Today → "2:34 PM"; this year → "Wed, Jul 12,
 * 2:34 PM"-ish; older → includes the year.
 */
function separatorLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (sameDay) return time;
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() === now.getFullYear()
      ? { weekday: "short", month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" };
  return `${d.toLocaleDateString(undefined, opts)}, ${time}`;
}

/** Separator shows on a ≥15-minute gap or a day change — never above
 *  the very first message. */
function needsSeparator(prev: ChatMessage | undefined, curr: ChatMessage) {
  if (!prev) return false;
  const a = new Date(prev.createdAt);
  const b = new Date(curr.createdAt);
  if (a.toDateString() !== b.toDateString()) return true;
  return b.getTime() - a.getTime() >= 15 * 60 * 1000;
}

/** Attached image, shown above (or as) the bubble. Tap → full-screen
 *  zoom, same pattern as the avatar. Max 320px tall, rounded. */
function MessageImage({
  url,
  onZoom,
}: {
  url: string;
  onZoom: (url: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onZoom(url)}
      aria-label="View photo full screen"
      className="overflow-hidden rounded-2xl ring-1 ring-warm-700 focus:outline-none focus:ring-2 focus:ring-coral/60"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Attached photo"
        className="max-h-[320px] max-w-full object-cover"
      />
    </button>
  );
}

/** Persona bubble shell — shared by history, streaming, and error
 *  states so the left-aligned rhythm stays identical. */
function PersonaBubble({
  children,
  showAvatar,
  avatarUrl,
  name,
  bubbleProps,
  myReaction,
}: {
  children: React.ReactNode;
  showAvatar: boolean;
  avatarUrl: string | null;
  name: string;
  /** Long-press / context-menu handlers spread onto the bubble surface.
   *  Omitted for the live-streaming bubble which shouldn't be tappable. */
  bubbleProps?: React.HTMLAttributes<HTMLDivElement>;
  /** User's tapback on this persona message (if any). Rendered as a
   *  small badge on the bubble's bottom-right corner. */
  myReaction?: ReactionKind | null;
}) {
  return (
    <div className="flex items-end gap-2 self-start max-w-[75%]">
      <div className="w-7 shrink-0">
        {showAvatar &&
          (avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={name}
              className="h-7 w-7 rounded-lg object-cover"
            />
          ) : (
            <div className="h-7 w-7 rounded-lg bg-gradient-cta" />
          ))}
      </div>
      <div className="relative">
        <div
          {...bubbleProps}
          className="rounded-2xl rounded-bl-md bg-ink-soft px-3.5 py-2 text-[15px] leading-snug text-warm-100 ring-1 ring-teal/40 whitespace-pre-wrap break-words animate-message-pop-left select-none [-webkit-touch-callout:none]"
        >
          {children}
        </div>
        {myReaction && (
          <ReactionBadge kind={myReaction} side="right" tone="user" />
        )}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="typing">
      <span className="h-1.5 w-1.5 rounded-full bg-warm-400 animate-pulse" />
      <span className="h-1.5 w-1.5 rounded-full bg-warm-400 animate-pulse [animation-delay:200ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-warm-400 animate-pulse [animation-delay:400ms]" />
    </span>
  );
}

export default function ChatSurface({
  oracleId,
  name,
  avatarUrl,
  oneLineHook,
  initialMessages,
  initialBlocked,
}: {
  oracleId: string;
  name: string;
  avatarUrl: string | null;
  /** The persona's one-line bio (oracles.one_line_hook). Shown under
   *  their photo in the tap-to-zoom modal so the user gets a reminder
   *  of who they are when they pull the face up. */
  oneLineHook: string | null;
  initialMessages: ChatMessage[];
  initialBlocked: boolean;
  /** Internal note on why the block was set — accepted but deliberately
   *  never rendered; the blocked copy is fixed and warm. */
  blockReason: string | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [rateLimited, setRateLimited] = useState(false);
  const [streamFailed, setStreamFailed] = useState(false);
  const [blocked, setBlocked] = useState(initialBlocked);
  // Trial ended mid-session and this isn't the free identity — the
  // composer swaps for a warm upgrade nudge. (Fresh opens of a locked
  // chat never get here; the server page redirects to /upgrade first.)
  const [proLocked, setProLocked] = useState(false);
  // Free tier hit its monthly message cap. Same shape as proLocked but
  // a different message and copy — the user's plan didn't END, they
  // just hit this month's limit.
  const [capHit, setCapHit] = useState<{ current: number; limit: number } | null>(
    null,
  );
  // Tapback + report popover target — set on a bubble long-press,
  // anchored via the bubble's DOMRect so the popover positions itself
  // just above.
  const [actionsTarget, setActionsTarget] = useState<ActionsTarget>(null);

  // Full-screen zoom target — the avatar and attached photos share the
  // same modal.
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!zoomUrl) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setZoomUrl(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoomUrl]);

  const markRead = useCallback(() => {
    fetch(`/api/chat/${oracleId}/messages/read`, { method: "POST" }).catch(
      () => {},
    );
  }, [oracleId]);

  // The user is looking at the thread — everything the persona said is
  // now "seen". (manually_unread is NOT touched here; only sending
  // resets it.)
  useEffect(() => {
    markRead();
  }, [markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, streamText, isStreaming]);

  /** Core send/stream loop. `text === null` means retry: regenerate
   *  the reply for the already-persisted last user message. */
  const runStream = useCallback(
    async (text: string | null, image: OutgoingImage | null = null) => {
      setRateLimited(false);
      setStreamFailed(false);

      const tempId = `optimistic-${Date.now()}`;
      if (text !== null) {
        setMessages((prev) => [
          ...prev,
          {
            id: tempId,
            role: "user",
            content: text,
            createdAt: new Date().toISOString(),
            readByOracleAt: null,
            pending: true,
            imageUrl: image?.previewUrl ?? null,
            myReaction: null,
            theirReaction: null,
          },
        ]);
      }

      setIsStreaming(true);
      setStreamText("");
      let acc = "";

      try {
        const res = await fetch(`/api/chat/${oracleId}/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            text !== null
              ? {
                  user_message: text,
                  ...(image ? { image_storage_path: image.storagePath } : {}),
                }
              : { retry: true },
          ),
        });

        if (!res.ok || !res.body) {
          setIsStreaming(false);
          if (res.status === 403) {
            // Blocked mid-session: swap the input row for the blocked
            // state without a reload. The message never persisted —
            // pull the optimistic bubble. No retry option.
            const body = (await res.json().catch(() => null)) as {
              error?: string;
            } | null;
            if (body?.error === "blocked") {
              setBlocked(true);
              setMessages((prev) => prev.filter((m) => m.id !== tempId));
              return;
            }
            if (body?.error === "trial_ended_or_locked") {
              // Trial ran out between page load and this send. The
              // message never persisted — pull the optimistic bubble.
              setProLocked(true);
              setMessages((prev) => prev.filter((m) => m.id !== tempId));
              return;
            }
            setStreamFailed(true);
            setMessages((prev) =>
              prev.map((m) => (m.id === tempId ? { ...m, pending: false } : m)),
            );
          } else if (res.status === 429) {
            setRateLimited(true);
            // The message never made it — pull the optimistic bubble.
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
          } else if (res.status === 402) {
            // Free-tier monthly message cap hit. Pull the optimistic
            // bubble (nothing persisted) and swap the input for the
            // upgrade CTA.
            const body = (await res.json().catch(() => null)) as {
              current?: number;
              limit?: number;
            } | null;
            setCapHit({
              current: body?.current ?? 0,
              limit: body?.limit ?? 0,
            });
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
          } else {
            setStreamFailed(true);
            setMessages((prev) =>
              prev.map((m) => (m.id === tempId ? { ...m, pending: false } : m)),
            );
          }
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let sawDone = false;

        const handle = (evt: StreamEvent) => {
          if (evt.type === "begin") {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id === tempId) {
                  return {
                    ...m,
                    id: evt.userMessageId ?? m.id,
                    pending: false,
                    readByOracleAt: evt.readByOracleAt,
                  };
                }
                // The server marked every unread user message as read.
                if (m.role === "user" && !m.readByOracleAt) {
                  return { ...m, readByOracleAt: evt.readByOracleAt };
                }
                return m;
              }),
            );
          } else if (evt.type === "text") {
            acc += evt.text;
            setStreamText(acc);
          } else if (evt.type === "done") {
            sawDone = true;
            const reply = acc.trim();
            if (reply) {
              setMessages((prev) => [
                ...prev,
                {
                  id: evt.messageId ?? `reply-${Date.now()}`,
                  role: "assistant",
                  content: reply,
                  createdAt: new Date().toISOString(),
                  readByOracleAt: null,
                  pending: false,
                  imageUrl: null,
                  myReaction: null,
                  theirReaction: null,
                },
              ]);
            }
            setIsStreaming(false);
            setStreamText("");
            markRead();
          } else if (evt.type === "error") {
            sawDone = true;
            setIsStreaming(false);
            setStreamText("");
            setStreamFailed(true);
          }
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf("\n\n")) !== -1) {
            const frame = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const dataLine = frame
              .split("\n")
              .find((l) => l.startsWith("data: "));
            if (!dataLine) continue;
            try {
              handle(JSON.parse(dataLine.slice(6)) as StreamEvent);
            } catch {
              // malformed frame — skip
            }
          }
        }

        if (!sawDone) {
          // Connection dropped mid-stream.
          setIsStreaming(false);
          setStreamText("");
          setStreamFailed(true);
        }
      } catch {
        setIsStreaming(false);
        setStreamText("");
        setStreamFailed(true);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, pending: false } : m)),
        );
      }
    },
    [markRead, oracleId],
  );

  // Long-press → open the tapback + report popover anchored to the
  // bubble. Uses a pointer-down timer so both mouse and touch work;
  // any pointer-up / -cancel / -leave / -move cancels the arm. Short
  // taps do nothing (existing image / receipt behaviors keep their
  // handlers on their own inner elements).
  const openActionsFor = useCallback((messageId: string, target: HTMLElement) => {
    setActionsTarget({ messageId, anchor: target.getBoundingClientRect() });
  }, []);
  const longPressTimer = useRef<number | null>(null);
  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);
  const bubbleHandlers = useCallback(
    (messageId: string) => ({
      onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        cancelLongPress();
        longPressTimer.current = window.setTimeout(() => {
          openActionsFor(messageId, target);
        }, LONG_PRESS_MS);
      },
      onPointerUp: cancelLongPress,
      onPointerLeave: cancelLongPress,
      onPointerMove: cancelLongPress,
      onPointerCancel: cancelLongPress,
      // Desktop right-click also opens the popover — treat it the same
      // as a long-press. Prevents the OS context menu from stealing.
      onContextMenu: (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        openActionsFor(messageId, e.currentTarget);
      },
    }),
    [cancelLongPress, openActionsFor],
  );

  const applyReaction = useCallback(
    async (messageId: string, kind: ReactionKind) => {
      // Optimistic toggle: if same kind is set → clear locally; else
      // set locally. Server call rolls back on failure.
      const target = messages.find((m) => m.id === messageId);
      const nextReaction = target?.myReaction === kind ? null : kind;
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, myReaction: nextReaction } : m)),
      );
      try {
        const res = await fetch("/api/reactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message_id: messageId, kind }),
        });
        if (!res.ok) throw new Error("reaction failed");
      } catch {
        // Rollback on error.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, myReaction: target?.myReaction ?? null } : m,
          ),
        );
      }
    },
    [messages],
  );

  const submitReport = useCallback(
    async (messageId: string, reason: ReportReason, notes: string) => {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId, reason, notes: notes || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Report failed. Try again.");
      }
    },
    [],
  );

  const handleSend = useCallback(
    (text: string, image: OutgoingImage | null) => {
      if (isStreaming || blocked) return;
      void runStream(text, image);
    },
    [blocked, isStreaming, runStream],
  );

  const handleRetry = useCallback(() => {
    if (isStreaming || blocked) return;
    void runStream(null);
  }, [blocked, isStreaming, runStream]);

  const lastUserIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return i;
    }
    return -1;
  })();

  return (
    <div className="flex h-dvh flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-10 grid grid-cols-[2.5rem_1fr_2.5rem] items-center border-b border-warm-700 bg-ink/85 px-2 py-2 backdrop-blur">
        <Link
          href="/dashboard"
          aria-label="Back to dashboard"
          className="flex h-10 w-10 items-center justify-center rounded-full text-warm-200 hover:bg-ink-soft"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M12.5 4 6.5 10l6 6"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <div className="flex flex-col items-center gap-0.5">
          {avatarUrl ? (
            <button
              type="button"
              onClick={() => setZoomUrl(avatarUrl)}
              aria-label={`View a larger photo of ${name}`}
              className="h-10 w-10 overflow-hidden rounded-xl transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-coral/60"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl}
                alt={name}
                className="h-full w-full object-cover"
              />
            </button>
          ) : (
            <div className="h-10 w-10 rounded-xl bg-gradient-cta" />
          )}
          <span className="max-w-[60vw] truncate text-xs font-medium text-warm-200">
            {name}
          </span>
        </div>
        <div />
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-3 py-4">
        {messages.length === 0 && !isStreaming ? (
          // Empty state — avatar already lives in the top bar, so the
          // middle stays deliberately empty to avoid the duplicate face.
          // Just a soft prompt line, low in the pane.
          <div className="flex h-full items-end justify-center pb-8">
            <p className="text-sm text-warm-400">
              {blocked ? "" : `Say something to ${name}.`}
            </p>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-1.5">
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const isUser = m.role === "user";
              const firstOfPersonaRun =
                !isUser && (!prev || prev.role !== "assistant");
              return (
                <div key={m.id} className="flex flex-col gap-1.5">
                  {needsSeparator(prev, m) && (
                    <div className="py-2 text-center text-[11px] text-warm-400">
                      {separatorLabel(m.createdAt)}
                    </div>
                  )}
                  {isUser ? (
                    <div className="flex flex-col items-end gap-0.5">
                      {m.imageUrl && (
                        <div className="max-w-[75%] self-end pb-0.5">
                          <MessageImage url={m.imageUrl} onZoom={setZoomUrl} />
                        </div>
                      )}
                      {m.content && (
                        <div className="relative max-w-[75%] self-end">
                          <div
                            {...bubbleHandlers(m.id)}
                            className="rounded-2xl rounded-br-md bg-gradient-cta px-3.5 py-2 text-[15px] leading-snug text-white whitespace-pre-wrap break-words animate-message-pop-right select-none [-webkit-touch-callout:none]"
                          >
                            {m.content}
                          </div>
                          {m.theirReaction && (
                            <ReactionBadge
                              kind={m.theirReaction}
                              side="left"
                              tone="persona"
                            />
                          )}
                        </div>
                      )}
                      {i === lastUserIndex && (
                        <span className="flex items-center gap-1 pr-1 text-[11px] text-warm-400">
                          {m.pending ? (
                            <span aria-label="Sending">
                              <PendingDots />
                            </span>
                          ) : m.readByOracleAt ? (
                            <span
                              aria-label="Read"
                              className="flex items-center gap-1 text-teal-strong"
                            >
                              <ReceiptDoubleCheck />
                              Read
                            </span>
                          ) : (
                            <span
                              aria-label="Sent"
                              className="flex items-center gap-1"
                            >
                              <ReceiptSingleCheck />
                              Sent
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  ) : (
                    <>
                      {m.imageUrl && (
                        <div className="max-w-[75%] self-start pl-9">
                          <MessageImage url={m.imageUrl} onZoom={setZoomUrl} />
                        </div>
                      )}
                      <PersonaBubble
                        showAvatar={firstOfPersonaRun}
                        avatarUrl={avatarUrl}
                        name={name}
                        bubbleProps={bubbleHandlers(m.id)}
                        myReaction={m.myReaction}
                      >
                        {m.content}
                      </PersonaBubble>
                    </>
                  )}
                </div>
              );
            })}

            {/* Typing indicator → morphs into the live reply */}
            {isStreaming && (
              <PersonaBubble
                showAvatar={
                  messages.length === 0 ||
                  messages[messages.length - 1].role !== "assistant"
                }
                avatarUrl={avatarUrl}
                name={name}
              >
                {streamText ? streamText : <TypingDots />}
              </PersonaBubble>
            )}

            {/* Mid-stream failure — inline retry on a persona-styled bubble.
                Never offered once blocked. */}
            {streamFailed && !isStreaming && !blocked && (
              <PersonaBubble showAvatar avatarUrl={avatarUrl} name={name}>
                <span className="text-warm-300">
                  lost the thread for a second.
                </span>{" "}
                <button
                  type="button"
                  onClick={handleRetry}
                  className="font-medium text-teal-strong underline underline-offset-2"
                >
                  Retry
                </button>
              </PersonaBubble>
            )}

            {rateLimited && (
              <p className="py-2 text-center text-[13px] italic text-warm-300">
                Give me a minute — you two are on a roll.
              </p>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </main>

      {/* Input row — or the blocked state. Once blocked there is no
          composer, no retry, no way back from this surface. */}
      <footer className="sticky bottom-0 border-t border-warm-700 bg-ink/85 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur">
        <div className="mx-auto w-full max-w-2xl">
          {blocked ? (
            <div className="flex flex-col items-center gap-1.5 px-4 py-4 text-center">
              <p className="text-[15px] leading-snug text-warm-200">
                This conversation has ended. {name} has stepped away — you
                can&apos;t message them anymore.
              </p>
              <p className="text-[11px] text-warm-400">
                This is per our Community Guidelines. No refund is issued when
                an identity blocks you.
              </p>
            </div>
          ) : proLocked ? (
            <div className="flex flex-col items-center gap-3 px-4 py-4 text-center">
              <p className="text-[15px] leading-snug text-warm-200">
                {name} is behind Pro now. Your free month has ended —
                they&apos;re still here, holding your whole conversation,
                waiting for you.
              </p>
              <Link
                href={`/upgrade?next=${encodeURIComponent(`/chat/${oracleId}`)}`}
                className="bg-gradient-cta flex h-12 w-full max-w-sm items-center justify-center rounded-full px-6 text-base font-bold tracking-tight text-white shadow-[0_10px_28px_-10px_rgba(232,138,118,0.6)] transition-all hover:-translate-y-px active:translate-y-0"
              >
                Upgrade to keep talking to {name}
              </Link>
            </div>
          ) : capHit ? (
            <div className="flex flex-col items-center gap-3 px-4 py-4 text-center">
              <p className="text-[15px] leading-snug text-warm-200">
                You&apos;ve used all{" "}
                <strong className="text-warm-50">{capHit.limit}</strong>{" "}
                of this month&apos;s free messages. {name} is still here
                &mdash; upgrade to premium for unlimited messages, or come
                back at the start of next month.
              </p>
              <Link
                href={`/upgrade?next=${encodeURIComponent(`/chat/${oracleId}`)}`}
                className="bg-gradient-cta flex h-12 w-full max-w-sm items-center justify-center rounded-full px-6 text-base font-bold tracking-tight text-white shadow-[0_10px_28px_-10px_rgba(232,138,118,0.6)] transition-all hover:-translate-y-px active:translate-y-0"
              >
                Upgrade to keep talking
              </Link>
            </div>
          ) : (
            <ChatInput
              name={name}
              oracleId={oracleId}
              disabled={isStreaming}
              onSend={handleSend}
            />
          )}
        </div>
      </footer>

      {actionsTarget && (
        <MessageActions
          anchor={actionsTarget.anchor}
          currentReaction={
            messages.find((m) => m.id === actionsTarget.messageId)?.myReaction ?? null
          }
          onReact={(kind) => {
            void applyReaction(actionsTarget.messageId, kind);
          }}
          onReport={(reason, notes) =>
            submitReport(actionsTarget.messageId, reason, notes)
          }
          onClose={() => setActionsTarget(null)}
        />
      )}

      {zoomUrl && (
        <button
          type="button"
          onClick={() => setZoomUrl(null)}
          aria-label="Close photo"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-black/85 p-4 backdrop-blur-sm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomUrl}
            alt=""
            className="max-h-[70dvh] max-w-full rounded-2xl object-contain shadow-2xl"
          />
          {/* Bio card — shown only when the user zoomed the persona's
              avatar (not an in-chat attachment). Name + one-line hook,
              in the same warm voice as elsewhere. Whole modal remains a
              button that dismisses on click; the bio is decorative. */}
          {zoomUrl === avatarUrl && (
            <div className="pointer-events-none max-w-md text-center">
              <p className="text-lg font-semibold text-white">{name}</p>
              {oneLineHook ? (
                <p className="mt-2 text-sm leading-relaxed text-white/80">
                  {oneLineHook}
                </p>
              ) : null}
            </div>
          )}
        </button>
      )}
    </div>
  );
}

// Inline SVG receipt marks (no emoji / no Unicode symbols per house style).
function ReceiptSingleCheck() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 11l4 4 8-10" />
    </svg>
  );
}

function ReceiptDoubleCheck() {
  return (
    <svg
      viewBox="0 0 24 20"
      width="16"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 11l4 4 8-10" />
      <path d="M10 15l4-4M14 11l6-8" />
    </svg>
  );
}

function PendingDots() {
  return (
    <span className="inline-flex items-center gap-[3px]">
      <span
        className="inline-block h-1 w-1 rounded-full bg-warm-400 animate-pulse"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="inline-block h-1 w-1 rounded-full bg-warm-400 animate-pulse"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="inline-block h-1 w-1 rounded-full bg-warm-400 animate-pulse"
        style={{ animationDelay: "300ms" }}
      />
    </span>
  );
}

/**
 * Small tapback badge attached to a bubble's outer corner, iMessage
 * style. Position by side ("left" = anchored to bubble's bottom-left,
 * for badges on right-aligned user bubbles; "right" = bubble's
 * bottom-right, for left-aligned persona bubbles). Tone controls the
 * color of the heart / mark itself.
 */
function ReactionBadge({
  kind,
  side,
  tone,
}: {
  kind: ReactionKind;
  side: "left" | "right";
  tone: "user" | "persona";
}) {
  return (
    <span
      aria-hidden
      className={`absolute -bottom-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-ink-soft shadow-[0_4px_10px_-2px_rgba(28,28,26,0.2)] ring-1 ring-warm-700/60 ${
        side === "left" ? "-left-1" : "-right-1"
      } ${tone === "user" ? "text-coral-strong" : "text-teal-strong"}`}
    >
      <ReactionIcon kind={kind} className="h-3.5 w-3.5" />
    </span>
  );
}
