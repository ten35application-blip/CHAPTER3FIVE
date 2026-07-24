import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/allowlist";
import { ComposeSheet } from "./_components/ComposeSheet";
import { DashboardContent, type Identity } from "./_components/DashboardContent";
import { StarredBubbles } from "./_components/StarredBubbles";
import { UserMenu } from "./_components/UserMenu";
import { signOut } from "./actions";

export const metadata = {
  title: "chapter3five",
};

/**
 * Dashboard v3 layout (iMessage-inspired):
 *
 *   ┌ Trash                       [★][★][★] [You] ┐  ← top bar
 *   │                                              │
 *   │        [Marisol]  [Dez]  [June]              │  ← favorites row
 *   │                                              │
 *   │   ─ Search ───────────────────────────────   │  ← search bar
 *   │   [ Pedro Infante                        ★ ] │  ← swipe rows
 *   │   [ PLAYER HATERS BALL                   ☆ ] │
 *   │                                          [+] │  ← FAB
 *
 * The right chrome slot holds the pinned-avatar strip (left of the
 * user avatar) so favorites are always one tap away, and the user
 * avatar itself opens the account menu — including an Admin link for
 * allowlisted emails only.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  // RLS restricts to auth.uid() = user_id; still filter soft-deleted.
  // Order: starred first (so favorites stay at the visual top of the
  // list too), then newest.
  const { data: identitiesRaw } = await supabase
    .from("oracles")
    .select(
      "id, name, avatar_url, is_starred, manually_unread, created_at",
    )
    .is("deleted_at", null)
    .order("is_starred", { ascending: false })
    .order("created_at", { ascending: false });

  const identities: Identity[] = (identitiesRaw ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    avatar_url: r.avatar_url ?? null,
    is_starred: Boolean(r.is_starred),
    manually_unread: Boolean(r.manually_unread),
  }));
  const starred = identities.filter((i) => i.is_starred);
  const email = user.email ?? "";
  const admin = isAdmin(email);

  return (
    <main className="relative min-h-dvh flex-1">
      {/* Top bar — spans the full width, three slots: trash on the
          left, wordmark centered, starred bubbles + user avatar on
          the right. */}
      <div className="fixed inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-4 pb-3 pt-4 backdrop-blur">
        {/* Left slot — trash */}
        <div className="flex flex-1 items-center">
          <Link
            href="/trash"
            aria-label="Recently deleted"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-soft/90 text-warm-200 shadow-[0_4px_12px_-2px_rgba(232,138,118,0.15)] ring-1 ring-warm-700/70 transition-all hover:-translate-y-px hover:text-coral-strong hover:ring-coral/40"
          >
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
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          </Link>
        </div>

        {/* Center — wordmark */}
        <p className="text-base font-bold tracking-tight text-warm-50">
          chapter<span className="text-gradient-cta font-black">3</span>five
        </p>

        {/* Right slot — starred bubbles + user avatar */}
        <div className="flex flex-1 items-center justify-end gap-3">
          <StarredBubbles items={starred} />
          <UserMenu email={email} isAdmin={admin} signOutAction={signOut} />
        </div>
      </div>

      {/* Middle — favorites row + search + swipeable list */}
      <DashboardContent identities={identities} />

      {/* Bottom-right — + FAB with two-step compose */}
      <ComposeSheet
        identities={identities.map(({ id, name, avatar_url }) => ({
          id,
          name,
          avatar_url,
        }))}
      />
    </main>
  );
}
