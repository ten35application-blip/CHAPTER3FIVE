import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TrashList, type TrashItem } from "./_components/TrashList";

export const metadata = {
  title: "Recently deleted — chapter3five",
};

/**
 * Recently deleted identities. Rows here have deleted_at IS NOT NULL.
 *
 *   swipe RIGHT → restore (clears deleted_at, back on the dashboard)
 *   swipe LEFT  → permanent delete (with confirm)
 *
 * Mirrors the dashboard swipe convention (right = positive/undo,
 * left = destructive) so the muscle memory stays consistent.
 */
export default async function TrashPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  const { data: rowsRaw } = await supabase
    .from("oracles")
    .select("id, name, avatar_url, deleted_at")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  const items: TrashItem[] = (rowsRaw ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    avatar_url: r.avatar_url ?? null,
    deleted_at: r.deleted_at as string,
  }));

  return (
    <main className="relative min-h-dvh flex-1">
      {/* Top bar — mirrors dashboard chrome but with a back arrow on
          the left instead of trash icon. */}
      <div className="fixed inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex flex-1 items-center">
          <Link
            href="/dashboard"
            aria-label="Back to dashboard"
            className="flex h-11 items-center gap-2 rounded-full bg-ink-soft/90 pl-3 pr-4 text-sm font-semibold text-warm-100 shadow-[0_4px_12px_-2px_rgba(232,138,118,0.15)] ring-1 ring-warm-700/70 transition-all hover:-translate-y-px hover:ring-coral/40"
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
            Back
          </Link>
        </div>
        <p className="text-base font-bold tracking-tight text-warm-50">
          Recently <span className="text-gradient-cta font-black">deleted</span>
        </p>
        <div className="flex flex-1 items-center justify-end">
          {items.length > 0 ? (
            <span className="text-xs text-warm-400">
              {items.length} item{items.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 pt-24 pb-16">
        {items.length === 0 ? <EmptyTrash /> : <TrashList items={items} />}
      </div>
    </main>
  );
}

function EmptyTrash() {
  return (
    <div className="hero-orb flex flex-col items-center pt-16 text-center sm:pt-24">
      <p className="mt-10 text-3xl font-bold tracking-tight text-warm-50">
        Nothing to <span className="text-gradient-cta">unbury</span>.
      </p>
      <p className="mt-4 max-w-xs text-base leading-relaxed text-warm-300">
        Deleted identities land here so you can bring them back if you change
        your mind.
      </p>
    </div>
  );
}
