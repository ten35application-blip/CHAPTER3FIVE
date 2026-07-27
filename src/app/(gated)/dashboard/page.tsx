import { after } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/allowlist";
import { getFreeIdentityId, isPro } from "@/lib/subscription";
import { ensureAdrianAvatar } from "@/lib/faces/adrian";
import { HubSheet } from "./_components/HubSheet";
import { DashboardContent, type Identity } from "./_components/DashboardContent";
import { PushOptIn } from "./_components/PushOptIn";
import { UserMenu } from "./_components/UserMenu";
import { signOut } from "./actions";

export const metadata = {
  title: "chapter3five",
};

// Force a fresh render on every request so the user-menu avatar picks
// up a new signed URL immediately after upload — no waiting on cache.
export const dynamic = "force-dynamic";

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
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcomed?: string; claimed?: string }>;
}) {
  const { welcomed: welcomedId, claimed: claimedFlag } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  // Lazy-generate Adrian's avatar the first time anyone lands here
  // post-deploy. Idempotent (ensureAdrianAvatar short-circuits when
  // avatar_url is already set), fire-and-forget via after() so this
  // never blocks page render. First dashboard load after a fresh deploy
  // fires the ~15-30s Flux call in the background; the next refresh
  // has the image. Errors are swallowed inside the helper -- worst
  // case, Adrian keeps the letter fallback and we try again next load.
  after(async () => {
    await ensureAdrianAvatar();
  });

  // RLS restricts to auth.uid() = user_id; still filter soft-deleted.
  // NOTE: no conversation_archived_at filter here — per Wilson,
  // identities never leave Contacts on archive; only the dashboard
  // Messages inbox hides the archived threads (filtered below). The
  // only way an identity leaves Contacts is via explicit swipe-Delete
  // in the Contacts panel (Trail B → Deleted identities).
  // Order: starred first (so favorites stay at the visual top of the
  // list too), then newest.
  const { data: contactsRaw } = await supabase
    .from("oracles")
    .select(
      "id, name, avatar_url, is_starred, manually_unread, created_at, conversation_archived_at, is_legacy, user_id",
    )
    .is("deleted_at", null)
    .order("is_starred", { ascending: false })
    .order("created_at", { ascending: false });

  // Inherit codes for legacy identities THIS user created (not ones
  // they've merely redeemed). Small side query keyed to the ids we
  // just loaded. Wilson's rule: the code should be findable from the
  // dashboard so a creator can share it without hunting through
  // sub-pages.
  const ownedLegacyIds = (contactsRaw ?? [])
    .filter((r) => r.is_legacy && r.user_id === user.id)
    .map((r) => r.id as string);
  const codesByOracle = new Map<string, string>();
  if (ownedLegacyIds.length > 0) {
    const { data: codeRows } = await supabase
      .from("inherit_codes")
      .select("code, oracle_id")
      .in("oracle_id", ownedLegacyIds)
      .is("revoked_at", null);
    for (const c of codeRows ?? []) {
      if (typeof c.code === "string" && typeof c.oracle_id === "string") {
        codesByOracle.set(c.oracle_id, c.code);
      }
    }
  }

  // Full contact directory. Includes both active-thread and
  // conversation-archived identities — Contacts always shows every
  // non-deleted identity. The dashboard Messages inbox is a subset
  // (filtered below).
  const contacts = (contactsRaw ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    avatar_url: r.avatar_url ?? null,
    is_starred: Boolean(r.is_starred),
    manually_unread: Boolean(r.manually_unread),
    conversation_archived_at: (r.conversation_archived_at as string | null) ?? null,
    inherit_code: codesByOracle.get(r.id as string) ?? null,
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

  // Dashboard = messages inbox. Hide (1) conversation-archived threads
  // — they live in the Archived sub-panel until unarchived — and (2)
  // contacts whose thread is fully soft-deleted (has messages, none
  // active). Never-messaged, non-archived contacts stay visible;
  // they're the "start a conversation" surface.
  const identities: Identity[] = contacts
    .filter((c) => c.conversation_archived_at === null)
    .filter((c) => {
      const hasAny = anyThreadOracleIds.has(c.id);
      const hasActive = activeThreadOracleIds.has(c.id);
      return !hasAny || hasActive;
    });

  // Archived conversations — for the archive sub-panel. The identity
  // is still in Contacts; only the thread is hidden from the inbox.
  // Not a mutex with deleted: if a user archives then deletes, the
  // row is under Deleted identities and gone from here.
  const { data: archivedRaw } = await supabase
    .from("oracles")
    .select("id, name, avatar_url, conversation_archived_at")
    .is("deleted_at", null)
    .not("conversation_archived_at", "is", null)
    .order("conversation_archived_at", { ascending: false });

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
    conversation_archived_at: r.conversation_archived_at as string,
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

  // Post-inherit welcome banner. When the redeem action redirects to
  // /dashboard?welcomed={oracleId}, resolve the name here so
  // DashboardContent can render "X is now in your contacts" with a
  // "Say hi" CTA. RLS gates visibility — if the oracle isn't the
  // caller's (via ownership or oracle_shares) we silently omit.
  let welcomed: { oracleId: string; name: string } | null = null;
  if (welcomedId) {
    const match = contacts.find((c) => c.id === welcomedId);
    if (match) {
      welcomed = { oracleId: match.id, name: match.name };
    }
  } else if (claimedFlag === "1") {
    // /legacy/[token] claim just landed. Grants were inserted for
    // every is_legacy oracle the deceased owner built; pick the
    // most recently created legacy oracle NOT owned by the caller
    // (i.e. one they just inherited) as the welcome-banner target.
    // If they inherited multiple, the rest still appear in Contacts.
    const inheritedLegacy = (contactsRaw ?? [])
      .filter((r) => r.is_legacy && r.user_id !== user.id)
      .sort((a, b) =>
        (a.created_at as string) < (b.created_at as string) ? 1 : -1,
      )[0];
    if (inheritedLegacy) {
      welcomed = {
        oracleId: inheritedLegacy.id as string,
        name: (inheritedLegacy.name as string | null) ?? "your inherited identity",
      };
    }
  }

  // Web Push opt-in banner state + profile avatar. One query covers
  // both — push_subscription is a jsonb, avatar_url is the storage
  // path of the private profile photo (bucket profile-avatars).
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("push_subscription, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  const alreadySubscribed =
    !!profileRow?.push_subscription &&
    typeof profileRow.push_subscription === "object";
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  let userAvatarUrl: string | null = null;
  if (profileRow?.avatar_url) {
    const { data: signed } = await supabase.storage
      .from("profile-avatars")
      .createSignedUrl(profileRow.avatar_url, 60 * 60);
    userAvatarUrl = signed?.signedUrl ?? null;
  }

  return (
    <main className="relative min-h-dvh flex-1">
      {/* Top bar — centered wordmark with the user-avatar menu on the
          right. The starred-bubble strip was removed 2026-07-25 per
          Wilson (starred rows still sort to the top of the list; the
          top-bar strip read as noise next to the settings button). */}
      <div className="fixed inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-4 pb-3 pt-4 backdrop-blur">
        {/* Left slot — intentionally empty; keeps the wordmark
            visually centered against the user-avatar on the right. */}
        <div className="flex flex-1" />

        <p className="text-base font-bold tracking-tight text-warm-50">
          chapter<span className="text-gradient-cta font-black">3</span>five
        </p>

        <div className="flex flex-1 items-center justify-end gap-3">
          <UserMenu
            email={email}
            isAdmin={admin}
            signOutAction={signOut}
            avatarUrl={userAvatarUrl}
          />
        </div>
      </div>

      {/* Subtle first-visit banner — hides itself when unsupported,
          already granted, already dismissed, or push isn't configured
          yet (VAPID key absent). */}
      <PushOptIn
        vapidPublicKey={vapidPublicKey}
        alreadySubscribed={alreadySubscribed}
      />

      {/* Middle — favorites row + search + swipeable list */}
      <DashboardContent
        identities={identities}
        isPro={pro}
        freeIdentityId={freeIdentityId}
        welcomed={welcomed}
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
