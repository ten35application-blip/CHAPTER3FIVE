"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SwipeRow } from "./SwipeRow";
import {
  archiveIdentity,
  deleteConversation,
  markUnread,
  toggleStar,
} from "../actions";

export type Identity = {
  id: string;
  name: string;
  avatar_url: string | null;
  is_starred: boolean;
  manually_unread: boolean;
};

type Props = {
  identities: Identity[];
  /** Pro covers paid, admin, and in-trial users — no chips, no locks. */
  isPro: boolean;
  /** The ONE identity a post-trial Free user keeps chatting with. */
  freeIdentityId: string | null;
};

/**
 * The middle of the dashboard: favorites grid, search input, and the
 * swipeable conversation list. All in one client tree because the
 * search filter is shared state.
 *
 * Favorites are ALWAYS shown (not filtered by search) — they're the
 * pinned quick-access row. The main list is what search filters.
 *
 * Post-trial Free tier: every identity except the free one stays
 * visible but carries a "Pro" chip, and its link routes to /upgrade
 * instead of the chat (starred ones included).
 */
export function DashboardContent({ identities, isPro, freeIdentityId }: Props) {
  const [query, setQuery] = useState("");

  const isLocked = (id: string) => !isPro && id !== freeIdentityId;

  const favorites = useMemo(
    () => identities.filter((i) => i.is_starred),
    [identities],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return identities;
    return identities.filter((i) => i.name.toLowerCase().includes(q));
  }, [identities, query]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-32 pt-24">
      {favorites.length > 0 ? (
        <FavoritesRow items={favorites} isLocked={isLocked} />
      ) : null}

      {/* Search bar — always rendered; visually recedes when empty.
          Placed above the list per Wilson's revision ("search on top,
          favorites above search"). */}
      <SearchBar query={query} onQueryChange={setQuery} />

      {identities.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <NoMatchesState query={query} />
      ) : (
        <ConversationList items={filtered} isLocked={isLocked} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Favorites row — larger circular pinned avatars in a grid.           */
/* Matches the iMessage-style pinned contacts pattern.                 */
/* ------------------------------------------------------------------ */

function FavoritesRow({
  items,
  isLocked,
}: {
  items: Identity[];
  isLocked: (id: string) => boolean;
}) {
  return (
    <section aria-label="Favorites" className="mb-6">
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5">
        {items.map((p) => {
          const locked = isLocked(p.id);
          return (
            <Link
              key={p.id}
              href={
                locked
                  ? `/upgrade?next=${encodeURIComponent(`/chat/${p.id}`)}`
                  : `/chat/${p.id}`
              }
              className="group flex flex-col items-center text-center"
            >
              <BigAvatar name={p.name} url={p.avatar_url} />
              <span className="mt-2 flex max-w-full items-center gap-1.5">
                <span className="truncate text-xs font-semibold text-warm-200 group-hover:text-warm-50">
                  {p.name}
                </span>
                {locked ? <ProChip /> : null}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Search bar                                                          */
/* ------------------------------------------------------------------ */

function SearchBar({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (q: string) => void;
}) {
  return (
    <div className="mb-4">
      <label className="relative block">
        <span className="sr-only">Search your identities</span>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-warm-400"
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3-3" />
          </svg>
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search"
          className="h-11 w-full rounded-full bg-ink-soft pl-11 pr-4 text-base text-warm-50 placeholder:text-warm-400 ring-1 ring-warm-700/70 shadow-[0_2px_8px_-2px_rgba(232,138,118,0.1)] focus:outline-none focus:ring-2 focus:ring-coral/40"
        />
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Conversation list — swipeable rows                                   */
/* ------------------------------------------------------------------ */

function ConversationList({
  items,
  isLocked,
}: {
  items: Identity[];
  isLocked: (id: string) => boolean;
}) {
  return (
    <ul className="overflow-hidden rounded-3xl bg-ink-soft shadow-[0_8px_28px_-16px_rgba(28,28,26,0.12),_0_2px_8px_-2px_rgba(232,138,118,0.08)] ring-1 ring-warm-700/60">
      {items.map((p, index) => (
        <li key={p.id}>
          {index > 0 ? (
            <div className="mx-4 h-px bg-gradient-to-r from-transparent via-coral/20 to-transparent" />
          ) : null}
          <SwipeRow
            // Primary swipe-left commit = Archive (free, reversible,
            // safer default now that Delete costs $5 to reverse).
            leftAction={{
              icon: (
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M21 8v13H3V8" />
                  <path d="M1 3h22v5H1z" />
                  <path d="M10 12h4" />
                </svg>
              ),
              label: "Archive",
              bgClassName: "bg-gradient-to-r from-teal-strong to-teal-strong/90",
              onCommit: () => archiveIdentity(p.id),
            }}
            // Secondary = Delete conversation (Trail A). Requires an
            // explicit tap on the panel button. Free to invoke, free to
            // recover — the identity stays in Contacts either way. The
            // paid $5 "Delete identity" trail lives on the Contacts
            // panel, NOT here, so a fast dashboard swipe never invokes
            // the paywall path.
            leftSecondaryAction={{
              icon: (
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                </svg>
              ),
              label: "Delete",
              bgClassName:
                "bg-gradient-to-r from-coral-strong/90 to-coral-strong",
              onCommit: () => deleteConversation(p.id),
            }}
            rightAction={{
              icon: (
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M4 6h16v10a2 2 0 0 1-2 2H8l-4 4V6z" />
                </svg>
              ),
              label: p.manually_unread ? "Read" : "Unread",
              bgClassName: "bg-gradient-to-r from-teal-strong to-teal-strong/90",
              onCommit: () => markUnread(p.id, !p.manually_unread),
              // Mark-unread keeps the row in the list — snap it back
              // into view after the action succeeds.
              restoreOnSuccess: true,
            }}
          >
            <div className="flex items-center gap-4 px-5 py-4">
              <Link
                href={
                  isLocked(p.id)
                    ? `/upgrade?next=${encodeURIComponent(`/chat/${p.id}`)}`
                    : `/chat/${p.id}`
                }
                className="flex flex-1 items-center gap-4"
              >
                <Avatar name={p.name} url={p.avatar_url} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2">
                    {p.manually_unread ? (
                      <span
                        aria-label="Unread"
                        className="h-2 w-2 flex-shrink-0 rounded-full bg-coral"
                      />
                    ) : null}
                    <span className="truncate text-base font-semibold text-warm-50">
                      {p.name}
                    </span>
                    {isLocked(p.id) ? <ProChip /> : null}
                  </span>
                  <span className="truncate text-sm text-warm-300">
                    {isLocked(p.id) ? "Waiting behind Pro" : "Tap to start"}
                  </span>
                </span>
              </Link>
              <StarButton
                id={p.id}
                starred={p.is_starred}
              />
            </div>
          </SwipeRow>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Pro chip — marks identities waiting behind the plan                  */
/* ------------------------------------------------------------------ */

function ProChip() {
  return (
    <span className="bg-gradient-cta flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] leading-tight text-white">
      Pro
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Star toggle — per-row favorite icon                                  */
/* ------------------------------------------------------------------ */

function StarButton({ id, starred }: { id: string; starred: boolean }) {
  // Wrap the action so the form-action signature is Promise<void> — the
  // action's return payload is used only for its rollback side-effects
  // in SwipeRow, not here.
  async function submit() {
    await toggleStar(id, !starred);
  }
  return (
    <form action={submit}>
      <button
        type="submit"
        aria-label={starred ? "Unpin from favorites" : "Pin to favorites"}
        className="flex h-9 w-9 items-center justify-center rounded-full text-warm-400 transition-colors hover:bg-coral/5 hover:text-coral-strong"
      >
        {starred ? (
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="url(#starred-grad)"
            stroke="url(#starred-grad)"
            strokeWidth="1.5"
            strokeLinejoin="round"
            aria-hidden
          >
            <defs>
              <linearGradient id="starred-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#e88a76" />
                <stop offset="100%" stopColor="#4fa5a5" />
              </linearGradient>
            </defs>
            <path d="M12 2l2.9 6.9L22 10l-5.5 5 1.6 7.5L12 18.6 5.9 22.5 7.5 15 2 10l7.1-1.1L12 2z" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 2l2.9 6.9L22 10l-5.5 5 1.6 7.5L12 18.6 5.9 22.5 7.5 15 2 10l7.1-1.1L12 2z" />
          </svg>
        )}
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* States                                                              */
/* ------------------------------------------------------------------ */

function EmptyState() {
  return (
    <div className="hero-orb hero-orb-drift flex flex-col items-center pt-16 text-center sm:pt-24">
      <p className="mt-10 text-3xl font-bold tracking-tight text-warm-50">
        It&apos;s <span className="text-gradient-cta">quiet</span> in here.
      </p>
      <p className="mt-4 max-w-xs text-base leading-relaxed text-warm-300">
        Tap the menu below, open{" "}
        <span className="font-semibold text-warm-100">Contact list</span>, then
        the <span className="font-semibold text-warm-100">+</span> to bring
        someone in.
      </p>
    </div>
  );
}

function NoMatchesState({ query }: { query: string }) {
  return (
    <div className="rounded-3xl bg-ink-soft py-12 text-center ring-1 ring-warm-700/60">
      <p className="text-base text-warm-300">
        No one matches “<span className="font-semibold text-warm-100">{query}</span>”.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Avatars                                                             */
/* ------------------------------------------------------------------ */

function Avatar({ name, url }: { name: string; url: string | null }) {
  const initial = (name[0] ?? "?").toUpperCase();
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-12 w-12 rounded-full object-cover shadow-[0_4px_12px_-2px_rgba(232,138,118,0.25)] ring-2 ring-coral/20"
      />
    );
  }
  return (
    <span className="bg-gradient-cta flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white shadow-[0_4px_12px_-2px_rgba(232,138,118,0.3)]">
      {initial}
    </span>
  );
}

function BigAvatar({ name, url }: { name: string; url: string | null }) {
  const initial = (name[0] ?? "?").toUpperCase();
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-16 w-16 rounded-full object-cover shadow-[0_8px_20px_-4px_rgba(232,138,118,0.35)] ring-2 ring-coral/30 sm:h-20 sm:w-20"
      />
    );
  }
  return (
    <span className="bg-gradient-cta flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white shadow-[0_8px_20px_-4px_rgba(232,138,118,0.35)] sm:h-20 sm:w-20">
      {initial}
    </span>
  );
}
