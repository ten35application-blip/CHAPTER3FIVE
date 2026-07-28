"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CollapsibleSection } from "@/components/collapsible-section";
import { RESTORE_IDENTITY_PRICE_LABEL } from "@/lib/pricing";
import {
  permanentDeleteIdentity,
  purgeConversation,
  recoverConversation,
  softDeleteIdentity,
  unarchiveIdentity,
} from "../actions";
import { SwipeRow } from "./SwipeRow";

type Contact = {
  id: string;
  name: string;
  avatar_url: string | null;
};

type ArchivedIdentity = {
  id: string;
  name: string;
  avatar_url: string | null;
  conversation_archived_at: string;
};

type DeletedIdentity = {
  id: string;
  name: string;
  avatar_url: string | null;
  deleted_at: string;
  restore_price_cents: number;
};

type DeletedConversation = {
  oracle_id: string;
  name: string;
  avatar_url: string | null;
  count: number;
  latest: string;
};

type Props = {
  contacts: Contact[];
  archived: ArchivedIdentity[];
  deletedIdentities: DeletedIdentity[];
  deletedConversations: DeletedConversation[];
};

type Panel = "menu" | "contacts" | "archived" | "deleted";

/**
 * Bottom-right FAB and the three-panel hub that opens from it.
 *
 * Mental model (per Wilson):
 *   Dashboard = Messages app — conversations only.
 *   Contacts (hub slot) = the identity directory.
 *
 * FAB is a grid-of-squares icon, not a plus — plus reads as "compose"
 * and the sheet is a menu of options, not a single action. Sub-panels
 * navigate INSIDE the sheet; the backdrop still closes it.
 */
export function HubSheet({
  contacts,
  archived,
  deletedIdentities,
  deletedConversations,
}: Props) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("menu");

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (panel !== "menu") setPanel("menu");
        else setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    // Only lock body scroll for the full sheet — the compact popover
    // is transient and shouldn't jank the dashboard behind it. Any
    // outside interaction closes it via the backdrop click-catch.
    const shouldLockScroll = panel !== "menu";
    if (shouldLockScroll) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      if (shouldLockScroll) {
        document.body.style.overflow = "";
      }
    };
  }, [open, panel]);

  function closeAll() {
    setOpen(false);
    // Defer so the panel doesn't visibly reset while the sheet is
    // animating out.
    setTimeout(() => setPanel("menu"), 200);
  }

  const totalDeleted = deletedIdentities.length + deletedConversations.length;

  // FAB is hidden whenever a sub-panel is showing: the bottom sheet
  // pushes buttons (Unarchive, Recover, etc.) close to the bottom edge,
  // and a z-50 FAB was overlapping them. Popover-menu state keeps the
  // FAB visible so a second tap can toggle it closed; sub-panels use
  // their own Back button + backdrop tap to dismiss.
  const fabHidden = open && panel !== "menu";

  return (
    <>
      {!fabHidden ? (
        <button
          type="button"
          onClick={() => {
            // Toggle: tap to open, tap again to close. On close, defer the
            // panel reset so the exit animation doesn't visibly flicker back
            // to the menu — same pattern closeAll() uses.
            if (open) {
              setOpen(false);
              setTimeout(() => setPanel("menu"), 200);
            } else {
              setOpen(true);
            }
          }}
          aria-label={open ? "Close hub" : "Open hub"}
          aria-expanded={open}
          className="fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-ink-soft shadow-[0_20px_48px_-10px_rgba(232,138,118,0.5),_0_10px_28px_-6px_rgba(126,196,196,0.45)] ring-2 ring-warm-700/50 transition-all hover:-translate-y-0.5 active:scale-95"
        >
          <InfinityIcon />
        </button>
      ) : null}

      {open && panel === "menu" ? (
        /* Compact popover — anchored above the FAB, scales in from
           the button corner. NO dim/blur backdrop: the whole point of
           the two-tier hub is that the menu doesn't cover the
           dashboard behind it. Full-viewport transparent button just
           catches taps-outside to close. */
        <div
          className="fixed inset-0 z-40"
          role="dialog"
          aria-modal="true"
          aria-label="Hub menu"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={closeAll}
            className="absolute inset-0"
          />
          <div className="animate-popover-in absolute bottom-24 right-6 z-10 w-64 rounded-2xl bg-ink-soft p-2 shadow-[0_20px_48px_-10px_rgba(28,28,26,0.18),_0_8px_24px_-6px_rgba(232,138,118,0.15)] ring-1 ring-warm-700/60">
            <div className="flex items-center justify-center py-2">
              <InfinityIcon />
            </div>
            <ul>
              <MenuRow
                compact
                onClick={() => setPanel("contacts")}
                icon={<PeopleIcon />}
                label="Contact list"
                count={contacts.length}
              />
              <MenuRow
                compact
                onClick={() => setPanel("archived")}
                icon={<ArchiveIcon />}
                label="Archived"
                count={archived.length}
              />
              <MenuRow
                compact
                onClick={() => setPanel("deleted")}
                icon={<TrashIcon />}
                label="Recently deleted"
                count={totalDeleted}
              />
            </ul>
          </div>
        </div>
      ) : null}

      {open && panel !== "menu" ? (
        /* Full sheet — the sub-panels contain scrollable lists so
           they need real vertical space. Backdrop dims because the
           user is now actively reading, not just browsing options. */
        <div
          className="fixed inset-0 z-40 flex items-end justify-center sm:justify-end sm:pr-6"
          role="dialog"
          aria-modal="true"
          aria-label="Hub"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={closeAll}
            className="absolute inset-0 bg-warm-50/30 backdrop-blur-sm"
          />

          {/* Sheet — springs up out of the FAB corner (bottom-right).
              Edge-to-edge on mobile so it reads as a real bottom sheet
              (not a floating card); right-anchored on sm+ so the scale
              origin (bottom right) still matches where the FAB sits. */}
          <div className="animate-hub-in relative z-10 flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-ink-soft pb-8 shadow-[0_-24px_60px_-20px_rgba(28,28,26,0.2),_0_-8px_24px_rgba(232,138,118,0.1)] sm:rounded-3xl">
            <div className="flex justify-center pt-3">
              <span className="bg-gradient-cta h-1.5 w-12 rounded-full opacity-60" />
            </div>

            {panel === "contacts" ? (
              <ContactsPanel
                contacts={contacts}
                onBack={() => setPanel("menu")}
                onClose={closeAll}
              />
            ) : panel === "archived" ? (
              <ArchivedPanel
                items={archived}
                onBack={() => setPanel("menu")}
              />
            ) : (
              <DeletedPanel
                identities={deletedIdentities}
                conversations={deletedConversations}
                onBack={() => setPanel("menu")}
              />
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ================================================================== */
/* Menu row — one tappable option inside the popover. Compact prop      */
/* trims sizing for the floating card container; the "full" variant     */
/* is retained in the type in case a future callsite wants it, but      */
/* today only compact is rendered.                                      */
/* ================================================================== */

function MenuRow({
  onClick,
  icon,
  label,
  count,
  compact,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  compact?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={
          compact
            ? "flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-coral/5"
            : "flex w-full items-center gap-4 rounded-xl px-4 py-4 text-left transition-colors hover:bg-coral/5"
        }
      >
        <span
          className={
            compact
              ? "bg-coral/10 text-gradient-cta flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
              : "bg-coral/10 text-gradient-cta flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full"
          }
        >
          {icon}
        </span>
        <span className="flex flex-1 items-center justify-between gap-3">
          <span
            className={
              compact
                ? "text-sm font-semibold text-warm-50"
                : "text-base font-semibold text-warm-50"
            }
          >
            {label}
          </span>
          <span
            className={
              compact
                ? "flex items-center gap-1.5 text-xs text-warm-400"
                : "flex items-center gap-2 text-sm text-warm-400"
            }
          >
            {count > 0 ? <span>{count}</span> : null}
            <ChevronIcon />
          </span>
        </span>
      </button>
    </li>
  );
}

/* ================================================================== */
/* Contacts panel — iOS Contacts styling.                              */
/* Swipe-left row = Delete identity (Trail B — $5 restore paywall).    */
/* ================================================================== */

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

function ContactsPanel({
  contacts,
  onBack,
  onClose,
}: {
  contacts: Contact[];
  onBack: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => c.name.toLowerCase().includes(q));
  }, [contacts, query]);

  const grouped = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    const map = new Map<string, Contact[]>();
    for (const c of sorted) {
      const first = (c.name[0] ?? "#").toUpperCase();
      const key = /[A-Z]/.test(first) ? first : "#";
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    return map;
  }, [filtered]);

  const usedLetters = useMemo(() => new Set(grouped.keys()), [grouped]);

  function scrollToLetter(letter: string) {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-letter="${letter}"]`,
    );
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SubHeader
        title="Contacts"
        onBack={onBack}
        right={
          <div className="relative">
            <button
              type="button"
              onClick={() => setCreateOpen((v) => !v)}
              aria-label="Create new"
              aria-expanded={createOpen}
              className="bg-gradient-cta flex h-9 w-9 items-center justify-center rounded-full text-white shadow-[0_4px_12px_-2px_rgba(232,138,118,0.35)] transition-transform hover:-translate-y-px active:scale-95"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            {createOpen ? (
              <CreateMenu
                onClose={() => setCreateOpen(false)}
                onNavigate={onClose}
              />
            ) : null}
          </div>
        }
      />

      <div className="px-4 pb-3">
        <label className="relative block">
          <span className="sr-only">Search contacts</span>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-warm-400"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
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
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="h-10 w-full rounded-full bg-warm-700/40 pl-10 pr-4 text-sm text-warm-50 placeholder:text-warm-400 ring-1 ring-warm-700/60 focus:outline-none focus:ring-2 focus:ring-coral/40"
          />
        </label>
      </div>

      <div className="relative flex min-h-0 flex-1">
        <div ref={listRef} className="flex-1 overflow-y-auto pb-4 pr-6">
          {contacts.length === 0 ? (
            <EmptyContacts />
          ) : filtered.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-warm-300">
              No one matches &ldquo;
              <span className="font-semibold text-warm-100">{query}</span>
              &rdquo;.
            </p>
          ) : (
            [...grouped.entries()].map(([letter, group]) => (
              <section key={letter} data-letter={letter}>
                <div className="sticky top-0 z-[1] bg-ink-soft/95 px-6 py-1 text-xs font-bold uppercase tracking-widest text-warm-400 backdrop-blur">
                  {letter}
                </div>
                <ul>
                  {group.map((p) => (
                    <li key={p.id}>
                      <SwipeRow
                        leftAction={{
                          icon: (
                            <svg
                              viewBox="0 0 24 24"
                              width="16"
                              height="16"
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
                          onCommit: () => softDeleteIdentity(p.id),
                        }}
                        confirmLeft={() =>
                          window.confirm(
                            `Delete ${p.name}? Restoring later is a one-time ${RESTORE_IDENTITY_PRICE_LABEL} — the conversation is preserved either way.`,
                          )
                        }
                      >
                        <Link
                          href={`/chat/${p.id}`}
                          onClick={onClose}
                          className="flex items-center gap-3 bg-ink-soft px-6 py-2.5 transition-colors hover:bg-coral/5"
                        >
                          <Avatar name={p.name} url={p.avatar_url} />
                          <span className="text-base text-warm-50">
                            {p.name}
                          </span>
                        </Link>
                      </SwipeRow>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        {/* Jump-letter rail. */}
        <nav
          aria-label="Jump to letter"
          className="absolute inset-y-0 right-1 flex flex-col justify-center gap-[1px] py-2 text-[10px] font-semibold text-warm-400"
        >
          {LETTERS.map((L) => {
            const active = usedLetters.has(L);
            return (
              <button
                key={L}
                type="button"
                disabled={!active}
                onClick={() => scrollToLetter(L)}
                className={
                  active
                    ? "px-1 leading-none text-coral-strong transition-colors hover:text-coral"
                    : "px-1 leading-none text-warm-700"
                }
                aria-label={`Jump to ${L}`}
              >
                {L}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function CreateMenu({
  onClose,
  onNavigate,
}: {
  onClose: () => void;
  onNavigate: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);

  return (
    <div
      ref={rootRef}
      role="menu"
      className="animate-menu-in absolute right-0 top-11 z-40 w-64 overflow-hidden rounded-2xl bg-ink-soft shadow-[0_20px_44px_-14px_rgba(28,28,26,0.25),_0_8px_20px_rgba(232,138,118,0.15)] ring-1 ring-warm-700"
    >
      <CreateMenuItem
        href="/identity/new"
        label="New identity"
        onClick={() => {
          onClose();
          onNavigate();
        }}
      />
      <CreateMenuItem
        href="/identity/from-photo"
        label="Identity from a photo"
        onClick={() => {
          onClose();
          onNavigate();
        }}
      />
      <CreateMenuItem
        href="/identity/legacy/new"
        label="Personal identity"
        onClick={() => {
          onClose();
          onNavigate();
        }}
      />
      <CreateMenuItem
        href="/identity/inherit"
        label="Inherit an identity code"
        onClick={() => {
          onClose();
          onNavigate();
        }}
      />
    </div>
  );
}

function CreateMenuItem({
  href,
  label,
  onClick,
}: {
  href: string;
  label: string;
  onClick: () => void;
}) {
  // No paid badge on any item — every creation path here (including
  // the legacy "Personal identity" flow) is open to every tier since
  // the July 2026 flat-fee rework.
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-warm-50 transition-colors hover:bg-coral/5"
    >
      <span>{label}</span>
    </Link>
  );
}

function EmptyContacts() {
  return (
    <div className="px-6 py-10 text-center">
      <p className="text-sm text-warm-300">
        No one yet. Tap{" "}
        <span className="font-semibold text-warm-100">+</span> above to bring
        someone in.
      </p>
    </div>
  );
}

/* ================================================================== */
/* Archived sub-panel.                                                 */
/* ================================================================== */

function ArchivedPanel({
  items,
  onBack,
}: {
  items: ArchivedIdentity[];
  onBack: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SubHeader title="Archived" onBack={onBack} />
      {items.length === 0 ? (
        <EmptyState
          headline="Nothing archived."
          sub="Swipe left on a row on your dashboard to archive the conversation — the identity stays in Contacts."
        />
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {items.map((p) => (
            <ArchivedRow key={p.id} item={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ArchivedRow({ item }: { item: ArchivedIdentity }) {
  const [pending, setPending] = useState(false);
  async function onUnarchive() {
    setPending(true);
    const res = await unarchiveIdentity(item.id);
    if (!res.ok) setPending(false);
  }
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <Link
        href={`/chat/${item.id}`}
        className="flex flex-1 items-center gap-3"
      >
        <Avatar name={item.name} url={item.avatar_url} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-base font-semibold text-warm-50">
            {item.name}
          </span>
          <span className="text-xs text-warm-400">
            Archived {relativeDate(item.conversation_archived_at)}
          </span>
        </span>
      </Link>
      <button
        type="button"
        disabled={pending}
        onClick={onUnarchive}
        className="rounded-full bg-warm-700/60 px-3 py-1.5 text-xs font-semibold text-warm-50 ring-1 ring-warm-700/60 transition-colors hover:bg-warm-700 disabled:opacity-50"
      >
        {pending ? "Unarchiving…" : "Unarchive"}
      </button>
    </li>
  );
}

/* ================================================================== */
/* Recently-deleted — TWO sections: conversations (free) + identities   */
/* ($5 restore paywall).                                                */
/* ================================================================== */

function DeletedPanel({
  identities,
  conversations,
  onBack,
}: {
  identities: DeletedIdentity[];
  conversations: DeletedConversation[];
  onBack: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SubHeader title="Recently deleted" onBack={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        <CollapsibleSection
          storageKey="hub.deleted.messages"
          label="Recently deleted messages"
          count={conversations.length}
          sticky
        >
          {conversations.length > 0 ? (
            <ul className="px-2">
              {conversations.map((c) => (
                <DeletedConversationRow key={c.oracle_id} item={c} />
              ))}
            </ul>
          ) : (
            <p className="px-6 pb-4 pt-2 text-sm text-warm-400">
              No deleted messages yet. Delete a conversation from your
              dashboard and it lands here — free to recover.
            </p>
          )}
        </CollapsibleSection>
        <CollapsibleSection
          storageKey="hub.deleted.identities"
          label="Recently deleted identities"
          count={identities.length}
          sticky
        >
          {identities.length > 0 ? (
            <ul className="px-2">
              {identities.map((i) => (
                <DeletedIdentityRow key={i.id} item={i} />
              ))}
            </ul>
          ) : (
            <p className="px-6 pb-4 pt-2 text-sm text-warm-400">
              No deleted identities. When you delete an identity from
              Contacts it lands here — bringing them back costs{" "}
              {RESTORE_IDENTITY_PRICE_LABEL}.
            </p>
          )}
        </CollapsibleSection>
      </div>
    </div>
  );
}

function DeletedConversationRow({ item }: { item: DeletedConversation }) {
  const [pending, setPending] = useState<null | "recover" | "purge">(null);
  const [error, setError] = useState<string | null>(null);

  async function onRecover() {
    setPending("recover");
    setError(null);
    const res = await recoverConversation(item.oracle_id);
    if (!res.ok) {
      setError(res.error ?? "Couldn't recover.");
      setPending(null);
    }
  }
  async function onPurge() {
    if (
      !window.confirm(
        `Permanently delete ${item.count} message${item.count === 1 ? "" : "s"} with ${item.name}? This cannot be undone.`,
      )
    ) {
      return;
    }
    setPending("purge");
    setError(null);
    const res = await purgeConversation(item.oracle_id);
    if (!res.ok) {
      setError(res.error ?? "Couldn't purge.");
      setPending(null);
    }
  }

  return (
    <li className="flex flex-col gap-1 px-4 py-2.5">
      <div className="flex items-center gap-3">
        <Avatar name={item.name} url={item.avatar_url} dim />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold text-warm-50">
            Chat with {item.name}
          </span>
          <span className="text-xs text-warm-400">
            {item.count} message{item.count === 1 ? "" : "s"} ·{" "}
            {relativeDate(item.latest)}
          </span>
        </span>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <button
            type="button"
            disabled={pending !== null}
            onClick={onRecover}
            className="rounded-full bg-warm-700/60 px-3 py-1.5 text-xs font-semibold text-warm-50 ring-1 ring-warm-700/60 transition-colors hover:bg-warm-700 disabled:opacity-50"
          >
            {pending === "recover" ? "Recovering…" : "Recover"}
          </button>
          <button
            type="button"
            disabled={pending !== null}
            onClick={onPurge}
            className="rounded-full px-2 py-1 text-xs font-medium text-coral-strong/80 transition-colors hover:text-coral-strong disabled:opacity-50"
          >
            {pending === "purge" ? "…" : "Delete forever"}
          </button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="pl-14 pr-2 text-xs text-coral-strong">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function DeletedIdentityRow({ item }: { item: DeletedIdentity }) {
  const [pending, setPending] = useState<null | "restore" | "purge">(null);
  const [error, setError] = useState<string | null>(null);
  // Double-tap-to-confirm state for the paid restore: first tap arms
  // the button (text flips to "Tap again to pay $X" in coral); second
  // tap within the 3s window actually fires. Guards against an
  // accidental $5 charge from a stray tap while browsing the trash.
  const [armed, setArmed] = useState(false);
  const armTimerRef = useRef<number | null>(null);
  const priceLabel =
    typeof item.restore_price_cents === "number"
      ? `$${item.restore_price_cents / 100}`
      : RESTORE_IDENTITY_PRICE_LABEL;

  useEffect(
    () => () => {
      if (armTimerRef.current !== null) {
        window.clearTimeout(armTimerRef.current);
      }
    },
    [],
  );

  function disarm() {
    setArmed(false);
    if (armTimerRef.current !== null) {
      window.clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
  }

  function onBringBackTap() {
    if (pending !== null) return;
    if (!armed) {
      setError(null);
      setArmed(true);
      if (armTimerRef.current !== null) {
        window.clearTimeout(armTimerRef.current);
      }
      // Revert if the second tap doesn't land within 3s.
      armTimerRef.current = window.setTimeout(() => {
        setArmed(false);
        armTimerRef.current = null;
      }, 3000);
      return;
    }
    // Armed → second tap: fire checkout.
    disarm();
    void onRestore();
  }

  async function onRestore() {
    setPending("restore");
    setError(null);
    try {
      const res = await fetch("/api/billing/restore-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oracle_id: item.id }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        url?: string;
        message?: string;
        error?: string;
      };
      if (res.ok && body.url) {
        window.location.href = body.url;
        return;
      }
      if (res.status === 501) {
        setError(body.message ?? "Restore payments are being set up.");
      } else {
        setError(body.error ?? "Couldn't start checkout. Try again.");
      }
    } catch {
      setError("Couldn't reach checkout. Try again.");
    }
    setPending(null);
  }

  async function onPurge() {
    if (
      !window.confirm(
        `Permanently delete ${item.name}? This cannot be undone.`,
      )
    ) {
      return;
    }
    disarm();
    setPending("purge");
    setError(null);
    const res = await permanentDeleteIdentity(item.id);
    if (!res.ok) {
      setError(res.error ?? "Couldn't delete.");
      setPending(null);
    }
  }

  const bringBackLabel =
    pending === "restore"
      ? "Loading…"
      : armed
        ? `Tap again to pay ${priceLabel}`
        : `Bring back ${priceLabel}`;

  return (
    <li className="flex flex-col gap-1 px-4 py-2.5">
      <div className="flex items-center gap-3">
        <Avatar name={item.name} url={item.avatar_url} dim />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold text-warm-50">
            {item.name}
          </span>
          <span className="text-xs text-warm-400">
            Deleted {relativeDate(item.deleted_at)}
          </span>
        </span>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <button
            type="button"
            disabled={pending !== null}
            onClick={onBringBackTap}
            aria-live="polite"
            className={
              armed
                ? "rounded-full bg-coral-strong/15 px-3 py-1.5 text-xs font-bold text-coral-strong ring-1 ring-coral-strong/40 transition-transform active:scale-95 disabled:opacity-60"
                : "bg-gradient-cta hover:bg-gradient-cta-hover rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-[0_4px_12px_-2px_rgba(232,138,118,0.35)] transition-transform active:scale-95 disabled:opacity-60"
            }
          >
            {bringBackLabel}
          </button>
          <button
            type="button"
            disabled={pending !== null}
            onClick={onPurge}
            className="rounded-full px-2 py-1 text-xs font-medium text-coral-strong/80 transition-colors hover:text-coral-strong disabled:opacity-50"
          >
            {pending === "purge" ? "…" : "Delete forever"}
          </button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="pl-14 pr-2 text-xs text-coral-strong">
          {error}
        </p>
      ) : null}
    </li>
  );
}

/* ================================================================== */
/* Shared bits.                                                        */
/* ================================================================== */

function SubHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-2">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="flex h-9 items-center gap-1 rounded-full px-2 text-sm font-semibold text-warm-200 transition-colors hover:text-warm-50"
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
          aria-hidden
        >
          <path d="M15 6l-6 6 6 6" />
        </svg>
        <span>Back</span>
      </button>
      <h2 className="text-base font-bold tracking-tight text-warm-50">
        {title}
      </h2>
      <div className="flex h-9 min-w-[36px] items-center justify-end">
        {right}
      </div>
    </div>
  );
}

function EmptyState({
  headline,
  sub,
}: {
  headline: string;
  sub: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-8 py-16 text-center">
      <div>
        <p className="text-lg font-bold tracking-tight text-warm-50">
          {headline}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-warm-300">{sub}</p>
      </div>
    </div>
  );
}

function Avatar({
  name,
  url,
  dim,
}: {
  name: string;
  url: string | null;
  dim?: boolean;
}) {
  const initial = (name[0] ?? "?").toUpperCase();
  const dimClass = dim ? "opacity-70" : "";
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className={`h-10 w-10 flex-shrink-0 rounded-full object-cover shadow-[0_4px_10px_-2px_rgba(232,138,118,0.25)] ring-1 ring-coral/20 ${dimClass}`}
      />
    );
  }
  return (
    <span
      className={`bg-gradient-cta flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-[0_4px_10px_-2px_rgba(232,138,118,0.3)] ${dimClass}`}
    >
      {initial}
    </span>
  );
}

function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffMs = Date.now() - then;
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  if (diffMs < hour) return "just now";
  const hours = Math.floor(diffMs / hour);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diffMs / day);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/* ================================================================== */
/* Icons.                                                              */
/* ================================================================== */

function InfinityIcon() {
  // Infinity glyph, dual-color: left loop coral, right loop teal —
  // echoes the two-dots logo palette. Stroke drawn as one continuous
  // figure-8 path; two overlapping stroked paths give each loop its
  // own hue while sharing the center crossing.
  return (
    <svg viewBox="0 0 32 16" width="32" height="18" fill="none" aria-hidden>
      <path
        d="M16 8 C 16 2, 8 2, 8 8 C 8 14, 16 14, 16 8"
        stroke="#e88a76"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M16 8 C 16 2, 24 2, 24 8 C 24 14, 16 14, 16 8"
        stroke="#7ec4c4"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PeopleIcon() {
  return (
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
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
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
  );
}

function TrashIcon() {
  return (
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
  );
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
