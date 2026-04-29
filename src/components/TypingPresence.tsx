"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  /** Stable key — "owned:<id>" / "group:<id>" / etc. The dashboard
      uses this to show a typing indicator on the matching row. */
  conversationKey: string;
  /** Optional renderer — if omitted, renders nothing. */
  children?: (typing: boolean) => React.ReactNode;
};

const CHANNEL = "conversation-typing";

/**
 * Subscribes to a shared "typing" broadcast channel. Whenever
 * another tab on the same Supabase session broadcasts a
 * "typing-start" / "typing-stop" event with our conversationKey,
 * we flip local state. Used by the dashboard rows to show a small
 * three-dot animation while a persona is mid-reply.
 *
 * The broadcasting end (Chat / GroupRoom) is in
 * useTypingBroadcaster below — pair the two.
 */
export function TypingPresence({ conversationKey, children }: Props) {
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(CHANNEL, { config: { broadcast: { self: true } } })
      .on("broadcast", { event: "typing-start" }, (payload) => {
        if ((payload.payload as { key?: string })?.key === conversationKey) {
          setTyping(true);
        }
      })
      .on("broadcast", { event: "typing-stop" }, (payload) => {
        if ((payload.payload as { key?: string })?.key === conversationKey) {
          setTyping(false);
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversationKey]);

  // Auto-clear after 25s — defensive, in case the stop broadcast is
  // missed (closed tab, network drop). The default API timeout is
  // shorter than this, so anything longer is almost certainly stale.
  useEffect(() => {
    if (!typing) return;
    const id = setTimeout(() => setTyping(false), 25_000);
    return () => clearTimeout(id);
  }, [typing]);

  if (!children) return null;
  return <>{children(typing)}</>;
}

/**
 * Imperative helper for the chat client side. Call start() when
 * the user submits a message; call stop() when the API resolves.
 * The matching TypingPresence in the dashboard receives the
 * broadcast and flips its local state.
 */
export function useTypingBroadcaster(conversationKey: string) {
  return {
    start: async () => {
      const supabase = createClient();
      const ch = supabase.channel(CHANNEL);
      await ch.subscribe();
      await ch.send({
        type: "broadcast",
        event: "typing-start",
        payload: { key: conversationKey },
      });
      await supabase.removeChannel(ch);
    },
    stop: async () => {
      const supabase = createClient();
      const ch = supabase.channel(CHANNEL);
      await ch.subscribe();
      await ch.send({
        type: "broadcast",
        event: "typing-stop",
        payload: { key: conversationKey },
      });
      await supabase.removeChannel(ch);
    },
  };
}

/**
 * Small three-dot pulse — chapter3five twist on the iMessage
 * typing indicator. Amber instead of gray, slightly slower
 * cadence so it reads as breathing instead of impatient.
 */
export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="typing">
      <span
        className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse"
        style={{ animationDelay: "0ms", animationDuration: "1200ms" }}
      />
      <span
        className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse"
        style={{ animationDelay: "200ms", animationDuration: "1200ms" }}
      />
      <span
        className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse"
        style={{ animationDelay: "400ms", animationDuration: "1200ms" }}
      />
    </span>
  );
}
