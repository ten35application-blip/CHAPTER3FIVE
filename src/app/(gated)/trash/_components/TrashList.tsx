"use client";

import { SwipeRow } from "../../dashboard/_components/SwipeRow";
import {
  permanentDeleteIdentity,
  restoreIdentity,
} from "../../dashboard/actions";

export type TrashItem = {
  id: string;
  name: string;
  avatar_url: string | null;
  deleted_at: string;
};

/**
 * Trash rows share the SwipeRow primitive with the dashboard, so the
 * gesture engine and reveal panels behave the same.
 *
 *   swipe RIGHT → restoreIdentity
 *   swipe LEFT  → permanentDeleteIdentity (guarded by confirm())
 */
export function TrashList({ items }: { items: TrashItem[] }) {
  return (
    <ul className="overflow-hidden rounded-3xl bg-ink-soft shadow-[0_8px_28px_-16px_rgba(28,28,26,0.12),_0_2px_8px_-2px_rgba(232,138,118,0.08)] ring-1 ring-warm-700/60">
      {items.map((p, index) => (
        <li key={p.id}>
          {index > 0 ? (
            <div className="mx-4 h-px bg-gradient-to-r from-transparent via-coral/20 to-transparent" />
          ) : null}
          <SwipeRow
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
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              ),
              label: "Delete forever",
              bgClassName:
                "bg-gradient-to-r from-coral-strong to-coral-strong/90",
              onCommit: () => permanentDeleteIdentity(p.id),
            }}
            confirmLeft={() =>
              window.confirm(
                `Permanently delete ${p.name}? This cannot be undone.`,
              )
            }
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
                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              ),
              label: "Restore",
              bgClassName: "bg-gradient-to-r from-teal-strong to-teal-strong/90",
              onCommit: () => restoreIdentity(p.id),
            }}
          >
            <div className="flex items-center gap-4 px-5 py-4">
              <Avatar name={p.name} url={p.avatar_url} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-base font-semibold text-warm-50">
                  {p.name}
                </span>
                <span className="truncate text-sm text-warm-300">
                  Swipe right to restore
                </span>
              </span>
            </div>
          </SwipeRow>
        </li>
      ))}
    </ul>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  const initial = (name[0] ?? "?").toUpperCase();
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-12 w-12 rounded-full object-cover opacity-70 shadow-[0_4px_12px_-2px_rgba(232,138,118,0.15)] ring-2 ring-warm-700/50"
      />
    );
  }
  return (
    <span className="bg-gradient-cta flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white opacity-70 shadow-[0_4px_12px_-2px_rgba(232,138,118,0.2)]">
      {initial}
    </span>
  );
}
