"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  /** Signed-in user id — required so we only subscribe to this
      user's messages. Server component passes it in. */
  userId: string;
};

type ToastState = {
  oracleId: string;
  oracleName: string;
  content: string;
  avatarUrl: string | null;
};

const DISMISS_MS = 6000;

/**
 * Site-wide notification toast. Subscribes to the user's incoming
 * persona messages via Supabase Realtime. When a new assistant
 * message lands AND the user isn't currently on that conversation's
 * route, slides a small toast in from the top with the persona's
 * name + the first line of the message + a tap-to-open link.
 *
 * Auto-dismisses after 6 seconds. The user can dismiss earlier
 * with the × button or by tapping.
 *
 * Suppressed on /auth, /landing, etc. via the same hidden-routes
 * pattern as BottomNav.
 */
export function NotificationToast({ userId }: Props) {
  const pathname = usePathname();
  const [toast, setToast] = useState<ToastState | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Suppress on routes where a toast would be noise.
  const suppressed =
    pathname === "/" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/legacy") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/agreements") ||
    pathname === "/about" ||
    pathname === "/how" ||
    pathname === "/support" ||
    pathname === "/sample" ||
    pathname === "/terms" ||
    pathname === "/privacy" ||
    pathname === "/cookies";

  useEffect(() => {
    if (suppressed) return;
    const supabase = createClient();
    const ch = supabase
      .channel(`messages:user:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string;
            role: "user" | "assistant";
            content: string;
            oracle_id: string;
            created_at: string;
          };
          if (row.role !== "assistant") return;
          // Don't toast for the conversation the user is already
          // looking at — they're going to see it inline.
          if (
            pathname === `/chat/${row.oracle_id}` ||
            pathname === `/shared/${row.oracle_id}`
          ) {
            return;
          }
          // Look up the oracle name + avatar to humanize the toast.
          const { data: oracle } = await supabase
            .from("oracles")
            .select("id, name, avatar_url")
            .eq("id", row.oracle_id)
            .maybeSingle();
          if (!oracle) return;
          setToast({
            oracleId: oracle.id,
            oracleName: oracle.name ?? "your identity",
            content: row.content.slice(0, 120),
            avatarUrl: oracle.avatar_url,
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, pathname, suppressed]);

  // Auto-dismiss after DISMISS_MS.
  useEffect(() => {
    if (!toast) return;
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => setToast(null), DISMISS_MS);
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [toast]);

  if (suppressed || !toast) return null;

  return (
    <div
      className="fixed top-4 inset-x-0 z-[60] flex justify-center px-4 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <Link
        href={`/chat/${toast.oracleId}`}
        onClick={() => setToast(null)}
        className="pointer-events-auto w-full max-w-md flex items-center gap-3 rounded-2xl bg-ink-soft/95 backdrop-blur-xl border border-warm-700/60 shadow-2xl px-4 py-3 animate-in slide-in-from-top fade-in duration-200"
      >
        {toast.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={toast.avatarUrl}
            alt=""
            className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-warm-700/60"
          />
        ) : (
          <span className="w-10 h-10 rounded-full bg-warm-700/40 border border-warm-700/60 flex items-center justify-center font-serif text-warm-200 text-sm flex-shrink-0">
            {toast.oracleName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-warm-50 truncate">
            {toast.oracleName}
          </p>
          <p className="text-xs text-warm-300 truncate">{toast.content}</p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setToast(null);
          }}
          aria-label="Dismiss"
          className="w-8 h-8 -m-2 rounded-full text-warm-400 hover:text-warm-100 transition-colors flex items-center justify-center text-lg leading-none"
        >
          ×
        </button>
      </Link>
    </div>
  );
}
