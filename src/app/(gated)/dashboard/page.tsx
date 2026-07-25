import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/allowlist";
import { getFreeIdentityId, isPro } from "@/lib/subscription";
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

  // Trial / Free-tier state. Pro (paid, admin, or in-trial) sees no
  // chips; past the trial, every identity except the free one gets a
  // "Pro" chip and its row routes to /upgrade instead of the chat.
  const pro = await isPro(supabase);
  const freeIdentityId = pro ? null : await getFreeIdentityId(supabase);

  return (
    <main className="relative min-h-dvh flex-1">
      {/* Top bar — wordmark centered, starred bubbles + user avatar on
          the right. (Trash moved into the user menu per Wilson: opening
          the avatar reveals "Recently deleted" above Settings.) */}
      <div className="fixed inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-4 pb-3 pt-4 backdrop-blur">
        {/* Left slot — intentionally empty; keeps the wordmark centered
            without shifting when starred bubbles appear on the right. */}
        <div className="flex flex-1" />

        <p className="text-base font-bold tracking-tight text-warm-50">
          chapter<span className="text-gradient-cta font-black">3</span>five
        </p>

        <div className="flex flex-1 items-center justify-end gap-3">
          <StarredBubbles items={starred} />
          <UserMenu email={email} isAdmin={admin} signOutAction={signOut} />
        </div>
      </div>

      {/* Middle — favorites row + search + swipeable list */}
      <DashboardContent
        identities={identities}
        isPro={pro}
        freeIdentityId={freeIdentityId}
      />

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
