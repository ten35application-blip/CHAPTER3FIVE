"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SwipeRow } from "./SwipeRow";
import {
  archiveIdentity,
  deleteConversation,
  toggleStar,
} from "../actions";

export type Identity = {
  id: string;
  name: string;
  avatar_url: string | null;
  is_starred: boolean;
  manually_unread: boolean;
  /** Computed server-side from oracle_read_state: newest assistant
   *  message is newer than the caller's last_read_at. Distinct from
   *  manually_unread (explicit Mark-as-unread) — OR-ed only at render. */
  auto_unread: boolean;
  /** For legacy identities THIS user created, the inherit code so the
   *  dashboard row can show a "share" chip. Null for everything else
   *  (formula/photo identities, inherited-not-created legacy ones). */
  inherit_code?: string | null;
  /** Phase 3 (0126): a photo-companion slot the auto-populate helper
   *  created but the user hasn't uploaded a photo to yet. Renders with
   *  soft placeholder copy, no unread badge; tapping opens a chat
   *  surface that prompts the upload instead of showing composer. */
  is_photo_placeholder?: boolean;
  /** iMessage-style last-message preview + timestamp (mobile parity
   *  2026-08-03). Null on placeholder rows and never-messaged
   *  contacts; the row falls back to "Tap to start". */
  last_message_preview?: string | null;
  last_message_at?: string | null;
  /** True when the newest active message on this thread was from the
   *  caller — prefixes the preview with "You: " to match iMessage
   *  and mobile. */
  last_message_from_user?: boolean;
};

type Props = {
  identities: Identity[];
  /** Pro covers paid, admin, and in-trial users — no chips, no locks. */
  isPro: boolean;
  /** The ONE identity a post-trial Free user keeps chatting with. */
  freeIdentityId: string | null;
  /** When a user just inherited an identity, the redeem action redirects
   *  to /dashboard?welcomed={oracleId}. The server passes the newly-
   *  redeemed oracle's info here so this component renders the "X is
   *  now in your contacts" toast. Null for a normal dashboard load. */
  welcomed?: { oracleId: string; name: string } | null;
  /** Phase 3: subscribe-time auto-populate is currently building
   *  companions in the background. Shows a soft banner so a user who
   *  paid and immediately opens the app sees "they're coming" instead
   *  of a bare list. Server-computed from profiles.auto_populate_*. */
  autoPopulateInFlight?: boolean;
};

/**
 * The middle of the dashboard — mobile-parity pass (2026-08-03).
 *
 * Mirrors chapter3five-app/app/dashboard.tsx row-for-row:
 *   Search pill → auto-populate banner → PINNED horizontal strip →
 *   one white rounded card wrapping every conversation row (52px
 *   avatar, bold-when-unread name, star toggle, hairline separator
 *   between).
 *
 * The favorites row is now a horizontal-scrolling strip with a tiny
 * uppercase "PINNED" label above (was a responsive grid of larger
 * avatars) so pinned contacts read like an iMessage top strip on both
 * surfaces. Order matches mobile too: search first, then banner, then
 * pinned, then list — a small change that keeps the visual language
 * identical between web and app.
 */
export function DashboardContent({
  identities,
  isPro,
  freeIdentityId,
  welcomed,
  autoPopulateInFlight,
}: Props) {
  const [query, setQuery] = useState("");
  const [dismissedWelcome, setDismissedWelcome] = useState(false);

  // Strip ?welcomed= from the URL after first render so a refresh hours
  // later doesn't re-fire the "X is now in your contacts" banner. The
  // server-computed welcomed prop still drives the initial render; the
  // history swap is display-only cleanup.
  useEffect(() => {
    if (!welcomed) return;
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    let touched = false;
    if (url.searchParams.has("welcomed")) {
      url.searchParams.delete("welcomed");
      touched = true;
    }
    if (url.searchParams.has("claimed")) {
      url.searchParams.delete("claimed");
      touched = true;
    }
    if (touched) {
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, [welcomed]);

  const isLocked = (id: string) => !isPro && id !== freeIdentityId;

  const favorites = useMemo(
    () => identities.filter((i) => i.is_starred),
    [identities],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Starred rows render in the PINNED strip and are excluded from
      // the main list (Wilson 2026-08-04: "starred rows stay stuck in
      // the slots"). Search bypasses this — a user searching for
      // Adrian while Adrian is pinned should still find him.
      return identities.filter((i) => !i.is_starred);
    }
    return identities.filter((i) => i.name.toLowerCase().includes(q));
  }, [identities, query]);

  const searching = query.trim().length > 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-40 pt-24">
      {welcomed && !dismissedWelcome ? (
        <WelcomeBanner
          oracleId={welcomed.oracleId}
          name={welcomed.name}
          onDismiss={() => setDismissedWelcome(true)}
        />
      ) : null}

      {/* Search first (mobile parity), then banner, then pinned strip. */}
      <SearchBar query={query} onQueryChange={setQuery} />

      {autoPopulateInFlight ? <AutoPopulateBanner /> : null}

      {/* Pinned strip — horizontal scroll of starred contacts with a
          tiny uppercase "PINNED" label above (mobile parity, was a
          responsive grid). Hidden while searching so the strip doesn't
          double up with search-filtered results. */}
      {favorites.length > 0 && !searching ? (
        <PinnedStrip items={favorites} isLocked={isLocked} />
      ) : null}

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
/* Pinned strip — horizontal-scrolling row of starred contacts.        */
/* Mirrors mobile dashboard "PINNED" strip: uppercase label + 52px     */
/* avatars in a scroll strip with the name below.                      */
/* ------------------------------------------------------------------ */

function PinnedStrip({
  items,
  isLocked,
}: {
  items: Identity[];
  isLocked: (id: string) => boolean;
}) {
  return (
    <section aria-label="Pinned" className="mb-4">
      <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-warm-400">
        Pinned
      </p>
      <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="flex gap-3.5">
          {items.map((p) => {
            const locked = isLocked(p.id);
            const unread = !p.is_photo_placeholder && (p.manually_unread || p.auto_unread);
            return (
              <li key={p.id} className="flex-shrink-0">
                <Link
                  href={
                    locked
                      ? `/upgrade?next=${encodeURIComponent(`/chat/${p.id}`)}`
                      : `/chat/${p.id}`
                  }
                  className={`flex w-[68px] flex-col items-center rounded-2xl px-1.5 py-2 text-center transition-colors active:opacity-60 ${
                    unread ? "bg-unread-wash" : ""
                  }`}
                >
                  <PinnedAvatar name={p.name} url={p.avatar_url} />
                  <span
                    className={`mt-1.5 max-w-full truncate text-[11px] ${
                      unread
                        ? "font-bold text-warm-100"
                        : "font-medium text-warm-200"
                    }`}
                  >
                    {p.name}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Search bar — pill with magnifier, client-side filter                */
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
          className="h-12 w-full rounded-full bg-ink-soft pl-11 pr-4 text-base text-warm-50 placeholder:text-warm-400 ring-1 ring-warm-700 shadow-[0_2px_6px_-1px_rgba(232,138,118,0.10)] focus:outline-none focus:ring-2 focus:ring-coral/40"
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
    <ul className="overflow-hidden rounded-3xl bg-ink-soft shadow-[0_8px_24px_-12px_rgba(28,28,26,0.10)] ring-1 ring-warm-700">
      {items.map((p, index) => (
        <li key={p.id}>
          {index > 0 ? (
            <div className="mx-4 h-px bg-warm-700/70" />
          ) : null}
          <SwipeRow
            // Swipe LEFT = Archive (free, reversible). Mobile parity
            // (2026-07-25): left → archive, right → delete. The paid $5
            // "Delete identity" trail still lives on the Contacts panel,
            // NOT here — a dashboard swipe only deletes the CONVERSATION
            // (Trail A: free, recoverable from Recently deleted).
            leftAction={{
              icon: (
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
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
              bgClassName: "bg-teal-strong",
              onCommit: () => archiveIdentity(p.id),
            }}
            // Swipe RIGHT = Delete conversation. Bare swipe-commit; no
            // confirm dialog — undo is one tap away in the Recently
            // deleted sub-panel.
            rightAction={{
              icon: (
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
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
              bgClassName: "bg-coral-strong",
              onCommit: () => deleteConversation(p.id),
            }}
          >
            <div
              className={`relative flex items-center gap-3 pl-4 pr-1.5 py-3.5 transition-colors ${
                !p.is_photo_placeholder && (p.manually_unread || p.auto_unread)
                  ? "bg-unread-wash"
                  : ""
              }`}
            >
              {/* Unread edge bar (mobile ContactRow parity). Absolute
                  so an unread row keeps the exact same avatar/text grid
                  as a read one — the row must not shift sideways when
                  the wash clears. The list container clips it. */}
              {!p.is_photo_placeholder &&
              (p.manually_unread || p.auto_unread) ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 w-[3px] bg-unread-accent"
                />
              ) : null}
              <Link
                href={
                  isLocked(p.id)
                    ? `/upgrade?next=${encodeURIComponent(`/chat/${p.id}`)}`
                    : `/chat/${p.id}`
                }
                className="flex flex-1 items-center gap-3 min-w-0"
              >
                <Avatar
                  name={p.name}
                  url={p.avatar_url}
                  isPlaceholder={Boolean(p.is_photo_placeholder)}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2">
                    {/* Unread signal: name goes bold when unread instead
                        of showing a leading coral dot (Wilson 2026-07-29:
                        "no dots next to the name"). iMessage does the
                        same. aria-label preserves screen-reader signal.
                        Placeholder rows: NEVER bold, no unread signal —
                        there's nothing to be unread FROM. */}
                    <span
                      className={`truncate text-base tracking-tight ${
                        p.is_photo_placeholder
                          ? "font-medium italic text-warm-200"
                          : p.manually_unread || p.auto_unread
                            ? "font-extrabold text-warm-50"
                            : "font-semibold text-warm-50"
                      }`}
                      aria-label={
                        p.is_photo_placeholder
                          ? `${p.name} — tap to upload a photo`
                          : p.manually_unread || p.auto_unread
                            ? `${p.name} — unread`
                            : p.name
                      }
                    >
                      {p.name}
                    </span>
                    {isLocked(p.id) && !p.is_photo_placeholder ? (
                      <ProChip />
                    ) : null}
                    {/* iMessage-style timestamp — right-aligned within
                        the row header. Placeholder rows and never-
                        messaged contacts skip this (nothing to date). */}
                    {p.last_message_at && !p.is_photo_placeholder ? (
                      <span className="ml-auto flex-shrink-0 text-xs text-warm-400">
                        {formatRowTime(p.last_message_at)}
                      </span>
                    ) : null}
                  </span>
                  <span className="truncate text-sm leading-snug text-warm-300">
                    {p.is_photo_placeholder
                      ? "Tap the avatar to upload a photo"
                      : isLocked(p.id)
                        ? "Waiting behind Pro"
                        : renderPreview(p)}
                  </span>
                  {p.inherit_code ? (
                    <InheritCodeChip code={p.inherit_code} />
                  ) : null}
                </span>
              </Link>
              {/* Placeholder rows aren't pinnable — nothing behind the
                  row yet to earn a favorite spot. */}
              {p.is_photo_placeholder ? null : (
                <StarButton id={p.id} starred={p.is_starred} />
              )}
            </div>
          </SwipeRow>
        </li>
      ))}
    </ul>
  );
}

/** Small inline chip that renders on legacy-identity rows the user
 *  created — one-tap copy of the share code so a creator doesn't have
 *  to open the sub-page to grab it. Wilson's rule: the code should be
 *  findable from the dashboard itself. */
function InheritCodeChip({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        // Prevent the wrapping Link from navigating on chip tap.
        e.preventDefault();
        e.stopPropagation();
        void (async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          } catch {
            /* clipboard unavailable — quietly no-op */
          }
        })();
      }}
      aria-label={copied ? "Copied" : `Copy share code ${code}`}
      className="mt-1.5 flex w-fit items-center gap-1.5 rounded-full bg-coral/10 px-2.5 py-1 text-[11px] font-medium text-coral-strong ring-1 ring-coral/25 transition-colors hover:bg-coral/15"
    >
      <span aria-hidden>
        <ShareIcon />
      </span>
      <span className="font-mono">{copied ? "Copied" : code}</span>
    </button>
  );
}

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="11"
      height="11"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="6" y="2" width="10" height="12" rx="1.75" />
      <path d="M4 6v10a2 2 0 0 0 2 2h8" />
    </svg>
  );
}

/** Post-inherit welcome banner. Shows once when a redemption redirects
 *  back to /dashboard?welcomed={oracleId} — "such-and-such is now in
 *  your contacts" with a "Say hi" CTA that jumps straight into the chat. */
function WelcomeBanner({
  oracleId,
  name,
  onDismiss,
}: {
  oracleId: string;
  name: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className="mb-4 flex items-center gap-3 rounded-2xl bg-coral/10 px-4 py-3 ring-1 ring-coral/25"
    >
      <span className="flex-1 text-sm leading-relaxed text-warm-50">
        <strong className="text-gradient-cta font-semibold">{name}</strong>{" "}
        is now in your contacts.
      </span>
      <Link
        href={`/chat/${oracleId}`}
        className="bg-gradient-cta rounded-full px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_4px_10px_-2px_rgba(232,138,118,0.35)]"
      >
        Say hi
      </Link>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="flex h-6 w-6 items-center justify-center rounded-full text-warm-400 hover:text-warm-100"
      >
        <svg viewBox="0 0 20 20" width="12" height="12" fill="none" aria-hidden>
          <path
            d="M5 5l10 10M15 5 5 15"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

/** Phase-3 (0126) subscribe-time populate banner. Mobile-parity shape:
 *  teal-tint pill with an inline spinner and quiet reassurance copy.
 *  Auto-clears on the next refresh once the helper stamps completed_at.
 *
 *  Deliberately NOT dismissable: it's transient (<2 min) and the
 *  next page refresh removes it on its own once populate finishes. */
function AutoPopulateBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 flex items-center gap-3 rounded-2xl bg-teal/10 px-3.5 py-3 ring-1 ring-teal/25"
    >
      <span
        aria-hidden
        className="inline-flex h-5 w-5 flex-shrink-0 animate-spin rounded-full border-2 border-teal/30 border-t-teal-strong"
      />
      <span className="flex-1 text-[13px] leading-snug text-warm-100">
        Your companions are being created — they&rsquo;ll appear shortly.
      </span>
    </div>
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
/* Star toggle — per-row favorite icon (mobile parity: solid coral)     */
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
        className="flex h-11 w-11 items-center justify-center rounded-full transition-opacity active:opacity-50"
      >
        {starred ? (
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            aria-hidden
            className="text-coral-strong"
          >
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
            className="text-warm-400"
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
  // Mobile parity 2026-08-03: no gradient orb, no "It's quiet in here."
  // hero — mobile shows a single warm-400 body line while Adrian is
  // spun up in the background.
  return (
    <div className="pt-16 text-center sm:pt-24">
      <p className="mx-auto max-w-xs text-base leading-relaxed text-warm-400">
        No conversations yet. Adrian will show up in a moment.
      </p>
    </div>
  );
}

/** Preview line for a conversation row. Prefixes with "You: " when the
 *  newest message was from the caller (iMessage / mobile parity), and
 *  falls back to "Tap to start" for never-messaged rows or image-only
 *  turns where content is null. */
function renderPreview(p: Identity): string {
  const preview = p.last_message_preview?.trim();
  if (!preview) return "Tap to start";
  return p.last_message_from_user ? `You: ${preview}` : preview;
}

/** iMessage-shaped time labels: "3:14 PM" today, "Yesterday", weekday
 *  name within the last week, then "M/D/YY". Ported verbatim from
 *  chapter3five-app/app/dashboard.tsx:1484-1512 so both surfaces stamp
 *  the same relative time on every row. */
function formatRowTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const dayMs = 24 * 60 * 60 * 1000;
  if (d >= startOfToday) {
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  if (d >= new Date(startOfToday.getTime() - dayMs)) {
    return "Yesterday";
  }
  if (d >= new Date(startOfToday.getTime() - 6 * dayMs)) {
    return d.toLocaleDateString(undefined, { weekday: "short" });
  }
  return d.toLocaleDateString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  });
}

function NoMatchesState({ query }: { query: string }) {
  return (
    <div className="rounded-3xl bg-ink-soft py-12 text-center ring-1 ring-warm-700">
      <p className="text-base text-warm-300">
        No one matches “<span className="font-semibold text-warm-100">{query.trim()}</span>”.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Avatars — 52px conversation avatar, 56px pinned strip avatar        */
/* ------------------------------------------------------------------ */

function Avatar({
  name,
  url,
  isPlaceholder,
}: {
  name: string;
  url: string | null;
  isPlaceholder?: boolean;
}) {
  const initial = (name[0] ?? "?").toUpperCase();
  if (isPlaceholder) {
    // Photo-placeholder avatar (0126): dashed ring + camera glyph.
    // Reads "there's a slot here, tap to fill it" without leaning on
    // a real face or the coral-CTA gradient a live identity carries.
    return (
      <span
        aria-hidden
        className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-full border-2 border-dashed border-coral/45 bg-ink text-coral-strong"
      >
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 8h3l2-2h6l2 2h3v10H4z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
      </span>
    );
  }
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-[52px] w-[52px] flex-shrink-0 rounded-full object-cover ring-2 ring-coral/25"
      />
    );
  }
  return (
    <span className="bg-coral flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-full text-xl font-bold text-white ring-2 ring-coral/25">
      {initial}
    </span>
  );
}

function PinnedAvatar({ name, url }: { name: string; url: string | null }) {
  const initial = (name[0] ?? "?").toUpperCase();
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-[52px] w-[52px] rounded-full object-cover ring-2 ring-coral/25"
      />
    );
  }
  return (
    <span className="bg-coral flex h-[52px] w-[52px] items-center justify-center rounded-full text-xl font-bold text-white ring-2 ring-coral/25">
      {initial}
    </span>
  );
}
