import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/allowlist";
import { getFreeIdentityId, isPro } from "@/lib/subscription";
import { HubSheet } from "./_components/HubSheet";
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

  // RLS restricts to auth.uid() = user_id; still filter soft-deleted +
  // archived. Archived rows live in the hub's archive sub-panel;
  // deleted-identity rows live in the trash sub-panel.
  // Order: starred first (so favorites stay at the visual top of the
  // list too), then newest.
  const { data: contactsRaw } = await supabase
    .from("oracles")
    .select(
      "id, name, avatar_url, is_starred, manually_unread, created_at",
    )
    .is("deleted_at", null)
    .is("archived_at", null)
    .order("is_starred", { ascending: false })
    .order("created_at", { ascending: false });

  // Full contact directory (Trail A leaves the identity in place). The
  // Contacts hub panel lists these; the dashboard "Messages" view is a
  // subset filtered below by "has non-deleted messages OR never
  // messaged."
  const contacts = (contactsRaw ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    avatar_url: r.avatar_url ?? null,
    is_starred: Boolean(r.is_starred),
    manually_unread: Boolean(r.manually_unread),
  }));

  // Which contacts have "all messages soft-deleted"? Those disappear
  // from the dashboard Messages view (Trail A) while staying in
  // Contacts. Two thin queries — cheap and index-friendly under the new
  // messages_user_oracle_deleted_idx.
  const [{ data: activeMsgOracleRows }, { data: anyMsgOracleRows }] =
    await Promise.all([
      supabase
        .from("messages")
        .select("oracle_id")
        .eq("user_id", user.id)
        .is("deleted_at", null),
      supabase
        .from("messages")
        .select("oracle_id")
        .eq("user_id", user.id),
    ]);
  const activeThreadOracleIds = new Set(
    (activeMsgOracleRows ?? [])
      .map((r) => r.oracle_id as string | null)
      .filter((v): v is string => !!v),
  );
  const anyThreadOracleIds = new Set(
    (anyMsgOracleRows ?? [])
      .map((r) => r.oracle_id as string | null)
      .filter((v): v is string => !!v),
  );

  // Dashboard = messages inbox: hide contacts whose thread is fully
  // soft-deleted (has messages, none active). Never-messaged contacts
  // stay visible; they're the "start a conversation" surface.
  const identities: Identity[] = contacts.filter((c) => {
    const hasAny = anyThreadOracleIds.has(c.id);
    const hasActive = activeThreadOracleIds.has(c.id);
    return !hasAny || hasActive;
  });
  const starred = identities.filter((i) => i.is_starred);

  // Archived contacts — for the archive sub-panel. Not a mutex with
  // deleted: if a user archives then deletes, the row is under
  // Deleted identities and gone from here.
  const { data: archivedRaw } = await supabase
    .from("oracles")
    .select("id, name, avatar_url, archived_at")
    .is("deleted_at", null)
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });

  // Deleted identities section (Trail B).
  const { data: deletedIdentityRaw } = await supabase
    .from("oracles")
    .select("id, name, avatar_url, deleted_at, restore_price_cents")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  // Deleted conversations section (Trail A). One row per oracle whose
  // messages carry any deleted_at, excluding oracles whose identity is
  // itself deleted (those live in the identities section — identity
  // supersedes conversation, per the coordinator's spec).
  const deletedIdentityIds = new Set(
    (deletedIdentityRaw ?? []).map((r) => r.id as string),
  );
  const { data: deletedMsgRaw } = await supabase
    .from("messages")
    .select("oracle_id, created_at")
    .eq("user_id", user.id)
    .not("deleted_at", "is", null);

  type ConvAgg = { count: number; latest: string };
  const convByOracle = new Map<string, ConvAgg>();
  for (const row of deletedMsgRaw ?? []) {
    const oid = row.oracle_id as string | null;
    if (!oid || deletedIdentityIds.has(oid)) continue;
    const prev = convByOracle.get(oid);
    const created = row.created_at as string;
    if (!prev) {
      convByOracle.set(oid, { count: 1, latest: created });
    } else {
      prev.count += 1;
      if (created > prev.latest) prev.latest = created;
    }
  }

  const contactsById = new Map(contacts.map((c) => [c.id, c]));

  const archived = (archivedRaw ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    avatar_url: r.avatar_url ?? null,
    archived_at: r.archived_at as string,
  }));

  const deletedIdentities = (deletedIdentityRaw ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    avatar_url: r.avatar_url ?? null,
    deleted_at: r.deleted_at as string,
    restore_price_cents: r.restore_price_cents ?? 500,
  }));

  const deletedConversations = [...convByOracle.entries()]
    .map(([oracleId, agg]) => {
      const contact = contactsById.get(oracleId);
      return {
        oracle_id: oracleId,
        name: contact?.name ?? "Unknown",
        avatar_url: contact?.avatar_url ?? null,
        count: agg.count,
        latest: agg.latest,
      };
    })
    .sort((a, b) => (b.latest > a.latest ? 1 : -1));
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

      {/* Bottom-right — hub FAB. Menu-of-options icon that opens a
          bottom sheet with contacts, archived, and recently-deleted.
          Contacts uses the FULL directory (Trail A doesn't drop the
          identity from Contacts, only from the Messages view). */}
      <HubSheet
        contacts={contacts.map(({ id, name, avatar_url }) => ({
          id,
          name,
          avatar_url,
        }))}
        archived={archived}
        deletedIdentities={deletedIdentities}
        deletedConversations={deletedConversations}
      />
    </main>
  );
}
