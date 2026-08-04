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
  /** True when this user turn was refused by the server because the
   *  persona has blocked the caller. The row was NEVER persisted
   *  (403 dropped it) — this flag exists purely so the client can
   *  render the optimistic bubble as "Not delivered" instead of
   *  pulling it silently, giving the iMessage social signal that
   *  the message went into a void. Only ever set on user rows. */
  undelivered?: boolean;
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
  | {
      type: "done";
      messageId: string | null;
      /** Phase B multi-message replies: when the persona's text_burst_style
       *  is two_part or three_burst and they used the [NEXT] marker, the
       *  server splits and inserts N rows; parts here carries all of them
       *  so the client can render staggered bubbles. Absent for single-
       *  message replies (baseline). */
      parts?: { id: string; content: string }[];
    }
  /** Phase B.2 persona-side reaction: the persona tapped back on the
   *  user's just-landed message with `[react:KIND]` at the top of their
   *  reply. Server strips the marker + persists to message_reactions and
   *  streams this event so the badge renders on the user bubble in
   *  real time. */
  | { type: "reaction"; messageId: string; kind: ReactionKind }
  | { type: "error"; error: string };

/** Milliseconds between successive bubbles when a multi-message burst
 *  lands. Matches iMessage's read-time-between-sends feel. */
const BURST_STAGGER_MS = 650;

/** Strip persona-only markers ([NEXT] burst separator + [react:KIND]
 *  tap-back marker) from live-streaming text so the intermediate
 *  display never shows the literal. Applied during streaming and as a
 *  safety net on the single-part done branch. Server also strips
 *  before persist so DB rows are always clean regardless of what the
 *  client does. */
function stripPersonaMarkers(text: string): string {
  return text
    .replace(/^\s*\[NEXT\]\s*$/gim, "")
    .replace(/^\s*\[react:[a-z_]+\]\s*/i, "")
    .replace(/\n{3,}/g, "\n\n");
}

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
  isConcierge,
  isSelfArchive,
  inheritCode,
  initialMuted,
  initialAiAcked,
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
  /** True when this oracle is Adrian (the app's concierge / help
   *  surface). Block + Report affordances are suppressed for
   *  concierge — it's not a persona users interact with romantically
   *  or file conduct complaints about. */
  isConcierge: boolean;
  /** True when this oracle is the caller's Me identity
   *  (oracles.is_self_archive, 0125). Rewires the send handler to
   *  the echo endpoint (no LLM, no cost — the app repeats the user's
   *  message back at them, iOS/Android-parity behavior) and surfaces
   *  the inherit code prominently in the zoom modal. */
  isSelfArchive: boolean;
  /** Inherit code for this identity, when one exists (legacy identity
   *  the user minted). Rendered inside the zoom modal below the
   *  one-line bio with a copy affordance and a soft "share this with
   *  the person you're leaving it to" caption. Null for random /
   *  photo companions (they have no code) and inherited copies (the
   *  code belongs to the original creator). */
  inheritCode: string | null;
  /** Whether the user has already muted this identity
   *  (profiles.muted_conversations). Drives the initial Block/Unblock
   *  label in the header menu. */
  initialMuted: boolean;
  /** Whether the user has already acknowledged the one-time AI-nature
   *  disclosure (profiles.first_launch_ai_ack_at). Drives the
   *  first-launch modal on the concierge chat only. */
  initialAiAcked: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [rateLimited, setRateLimited] = useState(false);
  const [streamFailed, setStreamFailed] = useState(false);
  const [blocked, setBlocked] = useState(initialBlocked);
  // Bundle A: header menu (mirror of mobile zoom-modal actions). Muted
  // state drives Block/Unblock; identityReportOpen drives the reason
  // picker; menuOpen drives the "…" dropdown visibility.
  const [muted, setMuted] = useState(initialMuted);
  const [mutingBusy, setMutingBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [identityReportOpen, setIdentityReportOpen] = useState(false);
  const [identityReportBusy, setIdentityReportBusy] = useState(false);
  // Bundle C: first-launch AI-nature ack. Displayed as a blocking
  // overlay on the concierge chat when the user hasn't ack'd yet.
  // Once tapped, POSTs /api/user/ack-ai and hides forever.
  const [aiAcked, setAiAcked] = useState(initialAiAcked);
  const [aiAckBusy, setAiAckBusy] = useState(false);
  // Trial ended mid-session and this isn't the free identity — the
  // composer swaps for a warm upgrade nudge. (Fresh opens of a locked
  // chat never get here; the server page redirects to /upgrade first.)
  const [proLocked, setProLocked] = useState(false);
  // Free tier hit its monthly message cap. Same shape as proLocked but
  // a different message and copy — the user's plan didn't END, they
  // just hit this month's limit.
  // Two ceilings can trip a 402: monthly message count OR monthly
  // Anthropic-spend cap. Both funnel here; `kind` drives copy so the
  // upgrade banner reads correctly for each.
  const [capHit, setCapHit] = useState<
    | { kind: "messages"; current: number; limit: number }
    | { kind: "spend"; current: number; limit: number }
    | { kind: "images"; current: number; limit: number }
    | null
  >(null);
  // Tapback + report popover target — set on a bubble long-press,
  // anchored via the bubble's DOMRect so the popover positions itself
  // just above.
  const [actionsTarget, setActionsTarget] = useState<ActionsTarget>(null);

  // Full-screen zoom target — the avatar and attached photos share the
  // same modal.
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Multi-message burst cascade timers — tracked in a ref so we can
  // clear them if the user sends a new message mid-burst or navigates
  // away. Without cleanup, a persona sending 3 bubbles at 650ms
  // intervals could land bubble #3 AFTER the user's follow-up turn,
  // scrambling the visible order.
  const burstTimersRef = useRef<number[]>([]);
  const clearBurstTimers = useCallback(() => {
    for (const id of burstTimersRef.current) window.clearTimeout(id);
    burstTimersRef.current = [];
  }, []);
  useEffect(() => clearBurstTimers, [clearBurstTimers]);

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
  // now "seen". As of 2026-08-03 the read route clears manually_unread
  // too, so simply opening the thread (not only sending) restores a
  // marked-unread row to its normal color.
  //
  // NO unmount call. A 2026-08-03 pass added `return () => markRead()`
  // to catch a message arriving mid-visit. Removed for two reasons:
  //
  //   1. It couldn't work. The route's revalidatePath("/dashboard")
  //      runs after Next has already issued the RSC fetch for the
  //      in-flight back-navigation, so the dashboard renders the stale
  //      payload anyway and the router cache holds it.
  //   2. It was wrong even if it had worked. This surface has no
  //      realtime subscription, so a proactive message landing while
  //      the thread is open is never RENDERED — marking it read on the
  //      way out would bury a message the user genuinely never saw. In
  //      a grief app, silently hiding something a persona said is the
  //      worst available failure.
  //
  // Mount + post-reply is the honest set: both are moments the user
  // demonstrably had the content on screen. Mobile can afford the
  // unmount call because it DOES subscribe to realtime.
  useEffect(() => {
    markRead();
  }, [markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, streamText, isStreaming]);

  // Empty-thread welcome — POST to /api/chat/welcome so the persona
  // sends the first message rather than leaving the heir/user staring
  // at a blank thread. Idempotent on the server side (skips if any
  // messages exist), so a race between mount and re-render doesn't
  // double-send. When it succeeds, refresh the RSC layer to pull the
  // newly-inserted assistant message into `messages`.
  const welcomeTriedRef = useRef(false);
  useEffect(() => {
    if (welcomeTriedRef.current) return;
    if (initialMessages.length > 0) return;
    if (isStreaming) return;
    // Me identity is an echo, not a persona — no Anthropic welcome to
    // fire (Wilson: "you cannot talk to yourself"). Empty state stays
    // empty until the user types.
    if (isSelfArchive) return;
    welcomeTriedRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/chat/welcome", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oracle_id: oracleId }),
        });
        if (!res.ok) return;
        const body = (await res.json().catch(() => null)) as
          | { sent?: boolean }
          | null;
        if (body?.sent) {
          // Force the RSC segment to re-fetch the messages list.
          window.location.reload();
        }
      } catch {
        // Silent — the empty-thread state is still fine as a fallback.
      }
    })();
  }, [initialMessages.length, isSelfArchive, isStreaming, oracleId]);

  /** Core send/stream loop. `text === null` means retry: regenerate
   *  the reply for the already-persisted last user message. */
  const runStream = useCallback(
    async (text: string | null, image: OutgoingImage | null = null) => {
      setRateLimited(false);
      setStreamFailed(false);
      // Any prior in-flight burst cascade would land after this new
      // turn if left running — clear it now so the visible order
      // matches the true send order.
      clearBurstTimers();

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
        // Local hour-of-day for humanization #1 chronotype timing so
        // the persona's morning-peak fires in the USER'S rhythm, not
        // Vercel's UTC.
        const hourOfDay = new Date().getHours();
        const res = await fetch(`/api/chat/${oracleId}/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            text !== null
              ? {
                  user_message: text,
                  hour_of_day: hourOfDay,
                  ...(image ? { image_storage_path: image.storagePath } : {}),
                }
              : { retry: true, hour_of_day: hourOfDay },
          ),
        });

        if (!res.ok || !res.body) {
          setIsStreaming(false);
          if (res.status === 403) {
            // Blocked mid-session: swap the input row for the blocked
            // state without a reload. No retry option.
            const body = (await res.json().catch(() => null)) as {
              error?: string;
            } | null;
            if (body?.error === "blocked") {
              setBlocked(true);
              // Keep the optimistic bubble so it renders as
              // "Not delivered" (iMessage social signal). The row
              // never persisted server-side, but the user sees what
              // they tried to send fade into a dead-end.
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempId
                    ? { ...m, pending: false, undelivered: true }
                    : m,
                ),
              );
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
            // Free-tier ceiling hit — either the message cap or the
            // Anthropic-spend cap. Both surface as 402 with the same
            // upgrade CTA. Pull the optimistic bubble (nothing
            // persisted) and swap the input.
            const body = (await res.json().catch(() => null)) as {
              error?: string;
              current?: number;
              limit?: number;
              current_cents?: number;
              limit_cents?: number;
            } | null;
            if (body?.error === "free_month_spend_cap") {
              setCapHit({
                kind: "spend",
                current: body?.current_cents ?? 0,
                limit: body?.limit_cents ?? 0,
              });
            } else if (body?.error === "image_month_cap") {
              setCapHit({
                kind: "images",
                current: body?.current ?? 0,
                limit: body?.limit ?? 0,
              });
            } else {
              setCapHit({
                kind: "messages",
                current: body?.current ?? 0,
                limit: body?.limit ?? 0,
              });
            }
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
            // Display strips [NEXT] markers so a mid-stream split
            // doesn't flash the literal to the user.
            setStreamText(stripPersonaMarkers(acc));
          } else if (evt.type === "reaction") {
            // Persona tapped back on the user's just-landed message.
            // Server has already persisted; render the badge on the
            // matching bubble by setting theirReaction on it.
            setMessages((prev) =>
              prev.map((m) =>
                m.id === evt.messageId ? { ...m, theirReaction: evt.kind } : m,
              ),
            );
          } else if (evt.type === "done") {
            sawDone = true;
            // Multi-message burst: the server returns pre-split parts
            // with real DB ids. Render each as its own bubble with a
            // stagger so it feels like the persona sent them in
            // sequence, not all at once.
            if (evt.parts && evt.parts.length > 1) {
              // First part appears immediately (replaces the streaming
              // typing indicator), the rest cascade in. Fable
              // humanization #1: keep isStreaming true through the
              // cascade and blank streamText between bubbles so the
              // TypingDots indicator shows during each pause — the
              // "they're typing the next one" beat every real burst
              // reader looks for.
              const parts = evt.parts;
              const nowIso = new Date().toISOString();
              setMessages((prev) => [
                ...prev,
                {
                  id: parts[0].id,
                  role: "assistant",
                  content: parts[0].content,
                  createdAt: nowIso,
                  readByOracleAt: null,
                  pending: false,
                  imageUrl: null,
                  myReaction: null,
                  theirReaction: null,
                },
              ]);
              // Clear the streamed text bubble; isStreaming stays true
              // until the LAST part lands so TypingDots continue to
              // render between each staggered bubble.
              setStreamText("");
              for (let i = 1; i < parts.length; i++) {
                const offset = i * BURST_STAGGER_MS;
                const part = parts[i];
                const isLast = i === parts.length - 1;
                const timerId = window.setTimeout(() => {
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: part.id,
                      role: "assistant",
                      content: part.content,
                      createdAt: new Date().toISOString(),
                      readByOracleAt: null,
                      pending: false,
                      imageUrl: null,
                      myReaction: null,
                      theirReaction: null,
                    },
                  ]);
                  if (isLast) setIsStreaming(false);
                }, offset);
                burstTimersRef.current.push(timerId);
              }
              markRead();
            } else {
              // Single-message reply — baseline path unchanged.
              const reply = stripPersonaMarkers(acc).trim();
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
            }
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
    [clearBurstTimers, markRead, oracleId],
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
      // set locally. On failure we re-sync from whatever the server
      // says is stored — the endpoint returns { reaction } on both
      // success AND error paths, so we can't diverge on a broken
      // DELETE-then-INSERT race.
      const target = messages.find((m) => m.id === messageId);
      const optimisticReaction: ReactionKind | null =
        target?.myReaction === kind ? null : kind;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, myReaction: optimisticReaction } : m,
        ),
      );
      try {
        const res = await fetch("/api/reactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message_id: messageId, kind }),
        });
        const body = (await res.json().catch(() => null)) as {
          reaction?: ReactionKind | null;
        } | null;
        if (!res.ok) {
          // Re-sync to whatever the server actually has stored.
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId ? { ...m, myReaction: body?.reaction ?? null } : m,
            ),
          );
        }
      } catch {
        // Network error — roll back the optimistic tap.
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
        const code = body?.error;
        if (code === "already_reported") {
          throw new Error("You've already reported this message.");
        }
        if (code === "not_your_message") {
          throw new Error("You can only report messages in your own chats.");
        }
        throw new Error("Report failed. Try again.");
      }
    },
    [],
  );

  // Bundle C: acknowledge the AI-nature disclosure and dismiss the
  // overlay. Optimistic flip; rollback on failure.
  const ackAi = useCallback(async () => {
    if (aiAckBusy) return;
    setAiAckBusy(true);
    setAiAcked(true);
    try {
      const res = await fetch("/api/user/ack-ai", { method: "POST" });
      if (!res.ok) {
        setAiAcked(false);
        alert("Couldn't save. Please try again in a moment.");
      }
    } catch {
      setAiAcked(false);
      alert("Network hiccup. Please try again in a moment.");
    } finally {
      setAiAckBusy(false);
    }
  }, [aiAckBusy]);

  // Bundle A: Block/Unblock — same endpoint mobile hits. Optimistic
  // flip, rollback + alert on failure.
  const toggleMute = useCallback(async () => {
    if (mutingBusy) return;
    setMutingBusy(true);
    const wasMuted = muted;
    setMuted(!wasMuted);
    try {
      const res = await fetch("/api/user/mute-oracle", {
        method: wasMuted ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oracle_id: oracleId }),
      });
      if (!res.ok) {
        setMuted(wasMuted);
        alert(
          wasMuted
            ? "Couldn't unblock. Please try again in a moment."
            : "Couldn't block. Please try again in a moment.",
        );
      }
    } catch {
      setMuted(wasMuted);
      alert("Network hiccup. Please try again in a moment.");
    } finally {
      setMutingBusy(false);
      setMenuOpen(false);
    }
  }, [muted, mutingBusy, oracleId]);

  // Bundle A: identity-level report — sibling of submitReport (per
  // message). Skips the notes field; the reason alone satisfies App
  // Store 1.2's "actionable report" bar.
  const submitIdentityReport = useCallback(
    async (reason: ReportReason) => {
      if (identityReportBusy) return;
      setIdentityReportBusy(true);
      try {
        const res = await fetch("/api/reports/identity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oracle_id: oracleId, reason }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          if (body?.error === "already_reported") {
            alert("Already reported — thanks, we've got it.");
          } else {
            alert("Couldn't submit. Please try again in a moment.");
          }
        } else {
          alert(
            "Report received. A person reads every report — we aim to respond within 24 hours.",
          );
        }
      } catch {
        alert("Network hiccup. Please try again in a moment.");
      } finally {
        setIdentityReportBusy(false);
        setIdentityReportOpen(false);
        setMenuOpen(false);
      }
    },
    [identityReportBusy, oracleId],
  );

  /** Me-identity echo: POST /api/chat/echo. No streaming, no persona
   *  pipeline — the server inserts the user turn AND an identical
   *  assistant echo, both scoped to the caller. Optimistic bubbles
   *  land immediately; the response swaps them for real DB rows so
   *  long-press (reactions/report) attaches to real message_ids.
   *
   *  Wilson's Phase-2 lock: "You cannot talk to yourself — anything
   *  you said will repeat back to you, like iOS and Android do now." */
  const runEcho = useCallback(
    async (text: string, image: OutgoingImage | null) => {
      const nowIso = new Date().toISOString();
      const tempUserId = `optimistic-user-${Date.now()}`;
      const tempEchoId = `optimistic-echo-${Date.now()}`;
      // Land BOTH the user bubble AND the mirrored echo bubble in the
      // same setState so React doesn't stagger them across two paints
      // — the whole point of echo is that they feel simultaneous.
      setMessages((prev) => [
        ...prev,
        {
          id: tempUserId,
          role: "user",
          content: text,
          createdAt: nowIso,
          readByOracleAt: null,
          pending: true,
          imageUrl: image?.previewUrl ?? null,
          myReaction: null,
          theirReaction: null,
        },
        {
          id: tempEchoId,
          role: "assistant",
          content: text,
          createdAt: nowIso,
          readByOracleAt: null,
          pending: false,
          imageUrl: image?.previewUrl ?? null,
          myReaction: null,
          theirReaction: null,
        },
      ]);
      try {
        const res = await fetch("/api/chat/echo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            oracle_id: oracleId,
            message: text,
            ...(image ? { image_storage_path: image.storagePath } : {}),
          }),
        });
        if (!res.ok) {
          // Roll back both optimistic bubbles so the user can retry.
          setMessages((prev) =>
            prev.filter((m) => m.id !== tempUserId && m.id !== tempEchoId),
          );
          setStreamFailed(true);
          return;
        }
        const body = (await res.json().catch(() => null)) as {
          user?: { id?: string; created_at?: string };
          echo?: { id?: string; created_at?: string } | null;
        } | null;
        // Swap optimistic ids for the real DB ids so long-press
        // (reactions, report) attaches to something the server knows
        // about. Falls back to keeping the temp id if the response
        // shape ever drifts — the bubble still renders, just isn't
        // long-pressable until the next natural refresh.
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === tempUserId && body?.user?.id) {
              return {
                ...m,
                id: body.user.id,
                pending: false,
                createdAt: body.user.created_at ?? m.createdAt,
              };
            }
            if (m.id === tempEchoId && body?.echo?.id) {
              return {
                ...m,
                id: body.echo.id,
                createdAt: body.echo.created_at ?? m.createdAt,
              };
            }
            return m;
          }),
        );
      } catch {
        setMessages((prev) =>
          prev.filter((m) => m.id !== tempUserId && m.id !== tempEchoId),
        );
        setStreamFailed(true);
      }
    },
    [oracleId],
  );

  const handleSend = useCallback(
    (text: string, image: OutgoingImage | null) => {
      if (isStreaming || blocked) return;
      if (isSelfArchive) {
        void runEcho(text, image);
        return;
      }
      void runStream(text, image);
    },
    [blocked, isSelfArchive, isStreaming, runEcho, runStream],
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
      {/* Top bar. Outer sticky/blur stretches full viewport (so the
          backdrop-blur reads edge-to-edge on wide screens); inner grid
          is constrained to the same max-w-2xl the messages column
          uses, so avatar + back-arrow align with the conversation
          below instead of floating in a sea of empty header on iPad. */}
      <header className="sticky top-0 z-10 border-b border-warm-700 bg-ink/85 backdrop-blur">
        <div className="mx-auto grid w-full max-w-2xl grid-cols-[2.5rem_1fr_2.5rem] items-center px-2 py-2">
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
            {/* One-line bio surfaced in the header so a persona's
                identity is visible at a glance -- previously only shown
                inside the avatar zoom modal, which meant personas
                without a photo (Adrian in particular) had NO surface
                for their bio at all. Truncated to keep the sticky
                header compact; long bios wrap gracefully at wider
                widths via the same max-w bound as the name. */}
            {oneLineHook ? (
              <span className="max-w-[70vw] truncate text-[11px] leading-tight text-warm-400">
                {oneLineHook}
              </span>
            ) : null}
          </div>
          {/* Header menu — Block/Unblock + Report identity. Mirrors the
              mobile zoom-modal actions so both surfaces expose the
              same App Store 1.2 / Play UGC affordances in the same
              place per persona. Suppressed for the concierge oracle
              (Adrian) — he's the help surface, not a persona to
              block or report. Also suppressed for the Me identity:
              you can't block or report yourself; the actions read as
              nonsense on the echo-back surface. */}
          {isConcierge || isSelfArchive ? (
            <div />
          ) : (
            <div className="relative flex justify-end">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Conversation options"
                aria-expanded={menuOpen}
                className="flex h-10 w-10 items-center justify-center rounded-full text-warm-200 hover:bg-ink-soft"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <circle cx="4" cy="10" r="1.6" />
                  <circle cx="10" cy="10" r="1.6" />
                  <circle cx="16" cy="10" r="1.6" />
                </svg>
              </button>
              {menuOpen ? (
                <>
                  {/* Click-outside catcher */}
                  <button
                    type="button"
                    aria-hidden
                    tabIndex={-1}
                    onClick={() => setMenuOpen(false)}
                    className="fixed inset-0 z-20 cursor-default"
                  />
                  <div className="absolute right-0 top-11 z-30 flex min-w-[10rem] flex-col overflow-hidden rounded-2xl bg-ink-soft py-1 shadow-lg ring-1 ring-warm-700">
                    <button
                      type="button"
                      onClick={() => void toggleMute()}
                      disabled={mutingBusy}
                      className="flex items-center gap-2 px-4 py-2.5 text-left text-sm text-warm-100 hover:bg-warm-700/40 disabled:opacity-50"
                    >
                      {muted ? "Unblock" : "Block"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setIdentityReportOpen(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 text-left text-sm text-warm-100 hover:bg-warm-700/40"
                    >
                      Report this identity
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-3 py-4">
        {messages.length === 0 && !isStreaming ? (
          // Empty state — avatar already lives in the top bar, so the
          // middle stays deliberately empty to avoid the duplicate face.
          // Just a soft prompt line, low in the pane.
          <div className="flex h-full items-end justify-center pb-8">
            <p className="text-sm text-warm-400">
              {blocked
                ? ""
                : isSelfArchive
                  ? "Anything you write will echo back to you."
                  : `Say something to ${name}.`}
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
                            {...(m.pending || m.undelivered || m.id.startsWith("optimistic-")
                              ? {}
                              : bubbleHandlers(m.id))}
                            className={
                              m.undelivered
                                ? "rounded-2xl rounded-br-md bg-warm-700/60 px-3.5 py-2 text-[15px] leading-snug text-warm-300 whitespace-pre-wrap break-words select-none [-webkit-touch-callout:none] opacity-70"
                                : "rounded-2xl rounded-br-md bg-gradient-cta px-3.5 py-2 text-[15px] leading-snug text-white whitespace-pre-wrap break-words animate-message-pop-right select-none [-webkit-touch-callout:none]"
                            }
                          >
                            {m.content}
                          </div>
                          {m.theirReaction && !m.undelivered && (
                            <ReactionBadge
                              kind={m.theirReaction}
                              side="left"
                              tone="persona"
                            />
                          )}
                        </div>
                      )}
                      {/* Receipt strip. Show "Not delivered" on any
                          undelivered bubble (not just the last user
                          message) so a run of blocked sends all read
                          as dead-ends, matching iMessage. */}
                      {m.undelivered ? (
                        <span
                          aria-label="Not delivered"
                          className="pr-1 text-[11px] italic text-warm-400"
                        >
                          Not delivered
                        </span>
                      ) : i === lastUserIndex ? (
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
                      ) : null}
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
                        bubbleProps={
                          m.pending || m.id.startsWith("optimistic-") || m.id.startsWith("reply-")
                            ? undefined
                            : bubbleHandlers(m.id)
                        }
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
                {name} needed to step away from this conversation.
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
              {/* Mobile-parity cap copy (2026-08-03) — same strings as
                  chapter3five-app humanizeChatError. Kinds map:
                  spend → free_month_spend_cap,
                  images → image_month_cap,
                  messages → free_month_cap. */}
              <p className="text-[15px] leading-snug text-warm-200">
                {capHit.kind === "spend"
                  ? "You've hit this month's usage allowance. It resets on the 1st."
                  : capHit.kind === "images"
                    ? "That's this month's room for photos. Text still works, and more opens up on the 1st."
                    : "That's this month's room for messages. More opens up on the 1st — or grab a top-up from Settings → Extra usage."}
              </p>
              <Link
                href={`/upgrade?next=${encodeURIComponent(`/chat/${oracleId}`)}`}
                className="bg-gradient-cta flex h-12 w-full max-w-sm items-center justify-center rounded-full px-6 text-base font-bold tracking-tight text-white shadow-[0_10px_28px_-10px_rgba(232,138,118,0.6)] transition-all hover:-translate-y-px active:translate-y-0"
              >
                Upgrade to keep talking
              </Link>
              {/* Pack CTA — one-time top-ups live at /upgrade#packs.
                  Spend-cap hits are excluded: packs top up messages
                  and images, not the free-tier Anthropic-spend
                  governor. */}
              {capHit.kind !== "spend" && (
                <Link
                  href={`/upgrade?next=${encodeURIComponent(`/chat/${oracleId}`)}#packs`}
                  className="text-sm font-semibold text-teal-strong underline underline-offset-4 transition-colors hover:text-warm-200"
                >
                  Grab a pack &rarr;
                </Link>
              )}
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

      {/* First-launch AI-nature disclosure — one-time, concierge-only,
          non-dismissible until acknowledged. Blocks the chat below
          so the disclosure is unmissable (Google Play Generative AI
          expectation). Suppressed once first_launch_ai_ack_at is
          stamped. Mirrors the mobile Modal byte-for-byte in copy. */}
      {isConcierge && !aiAcked && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-6 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-3xl bg-ink-soft p-6 ring-1 ring-warm-700 shadow-2xl">
            <p className="text-xl font-extrabold tracking-tight text-warm-50">
              Before you say hi
            </p>
            <p className="mt-3 text-sm leading-relaxed text-warm-200">
              The person you&rsquo;re about to text is a companion,
              not a real person. Every message they send is generated
              by software. You know this; we&rsquo;re just making sure
              the first time you meet them, you meet them straight.
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-warm-300">
              Everything they say is scanned for unsafe content, and
              you can report or block anyone from their conversation
              menu. Full details in our{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-coral-strong hover:underline"
              >
                Privacy Policy
              </a>
              .
            </p>
            <button
              type="button"
              onClick={() => void ackAi()}
              disabled={aiAckBusy}
              className="bg-gradient-cta mt-6 flex h-12 w-full items-center justify-center rounded-full text-base font-bold tracking-tight text-white transition-all hover:-translate-y-px disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {aiAckBusy ? "Saving…" : "I understand"}
            </button>
          </div>
        </div>
      )}

      {/* Identity report picker — sibling of MessageActions's per-
          message report panel, minus the notes textarea. 5 reasons →
          POST /api/reports/identity → public.oracle_reports. Mirrors
          the mobile picker byte-for-byte in copy so both surfaces
          read identically. */}
      {identityReportOpen && (
        <button
          type="button"
          aria-label="Close report picker"
          onClick={() => setIdentityReportOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-ink-soft p-6 text-left ring-1 ring-warm-700 shadow-xl cursor-default"
          >
            <p className="text-lg font-semibold text-warm-50">
              Report {name}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-warm-300">
              What&rsquo;s wrong with this identity itself? A person
              reads every report &mdash; we aim to respond within 24
              hours.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {(
                [
                  { key: "inappropriate", label: "Inappropriate content" },
                  { key: "harmful", label: "Harmful or dangerous" },
                  { key: "off_character", label: "Out of character" },
                  { key: "spam", label: "Spam or misleading" },
                  { key: "other", label: "Something else" },
                ] as const
              ).map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => void submitIdentityReport(r.key)}
                  disabled={identityReportBusy}
                  className="rounded-xl border border-warm-700 px-4 py-3 text-left text-sm font-semibold text-warm-100 transition-colors hover:bg-warm-700/40 disabled:opacity-50"
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setIdentityReportOpen(false)}
                disabled={identityReportBusy}
                className="text-sm font-semibold text-warm-400 hover:text-warm-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </button>
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
              button that dismisses on click; the bio is decorative.
              Phase-4 (2026-08-03): for legacy identities the user
              minted, the inherit code lands here too so it lives WITH
              the identity, not just in Settings (parity between Me
              and "for someone you love"). The InheritCodeBlock is
              interactive (copy button); it stops propagation so a tap
              on the code doesn't dismiss the modal. */}
          {zoomUrl === avatarUrl && (
            <div className="max-w-md text-center">
              <p className="pointer-events-none text-lg font-semibold text-white">
                {name}
              </p>
              {oneLineHook ? (
                <p className="pointer-events-none mt-2 text-sm leading-relaxed text-white/80">
                  {oneLineHook}
                </p>
              ) : null}
              {inheritCode ? (
                <InheritCodeBlock
                  code={inheritCode}
                  name={name}
                  isSelfArchive={isSelfArchive}
                />
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
 * Inherit-code panel inside the avatar zoom modal. Renders the code
 * with a copy-to-clipboard button and a soft caption reminding the
 * user this is the code they share with the person they're leaving
 * the identity to. Copy for the Me identity is slightly different
 * from the "for someone you love" case — same code, different framing.
 *
 * Wilson's Phase-4 spec:
 *   "The zoom modal on the Me identity shows the inherit code — the
 *    same code that appears in Settings. Since Me shows the inherit
 *    code in the zoom modal, and the 'For someone you love' legacy
 *    path ALSO produces an inherit code, the code should be visible
 *    on those identity's zoom modals too."
 */
function InheritCodeBlock({
  code,
  name,
  isSelfArchive,
}: {
  code: string;
  name: string;
  isSelfArchive: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function onCopy(e: React.MouseEvent) {
    // The zoom modal is a full-viewport button that dismisses on
    // click; stop propagation so tapping Copy doesn't close the modal
    // out from under the user.
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable — the code is still visible above the
      // button so the user can hand-select.
    }
  }

  const caption = isSelfArchive
    ? "Share this with the people you're leaving it to. They'll meet you when they redeem it."
    : `Share this with the person you're leaving ${name} to. They'll meet them when they redeem it.`;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mt-5 rounded-2xl bg-white/10 p-4 text-left ring-1 ring-white/15 backdrop-blur"
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-coral-strong">
        Inherit code
      </p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="min-w-0 flex-1 truncate font-mono text-sm text-white">
          {code}
        </p>
        <button
          type="button"
          onClick={onCopy}
          className="bg-gradient-cta shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_4px_10px_-2px_rgba(232,138,118,0.35)] transition-transform hover:-translate-y-0.5"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-white/70">
        {caption}
      </p>
    </div>
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
