import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NewConversationMenu } from "@/components/NewConversationMenu";
import { FavoriteTile } from "@/components/FavoriteTile";
import { toggleFavorite } from "../settings/actions";

export const metadata = {
  title: "Conversations — chapter3five",
};

type ConvKind = "owned" | "randomized" | "shared" | "group" | "together";
/** Bucket used for favoriting; collapses 'randomized' into 'owned'. */
type FavoriteKind = "owned" | "shared" | "group" | "together";

type ConvRow = {
  href: string;
  title: string;
  subtitle: string;
  avatarUrl: string | null;
  /** For groups: up to 4 member avatars to collage. */
  collageAvatars?: (string | null)[];
  kind: ConvKind;
  /** Storage id used for favoriting. For "owned"/"randomized" this
      is the oracle id; for "group" the room id; etc. */
  favoriteId: string;
  /** Bucket the favorites store uses. */
  favoriteKind: FavoriteKind;
  isFavorite: boolean;
  lastMessageAt: number;
};

function relativeTime(iso: string | null, lang: "en" | "es"): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  const hour = Math.floor(ms / 3_600_000);
  const day = Math.floor(ms / 86_400_000);
  if (min < 1) return lang === "es" ? "ahora" : "now";
  if (min < 60) return lang === "es" ? `${min}m` : `${min}m`;
  if (hour < 24) return `${hour}h`;
  if (day < 7) return `${day}d`;
  return new Date(iso).toLocaleDateString(lang === "es" ? "es" : "en", {
    month: "short",
    day: "numeric",
  });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language, onboarding_completed, favorites")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_completed) redirect("/onboarding");

  const language = (profile.preferred_language ?? "en") as "en" | "es";
  const t = COPY[language];

  // Set of "kind:id" keys for fast favorite lookup.
  type FavEntry = { kind: string; id: string };
  const favorites = Array.isArray(profile.favorites)
    ? (profile.favorites as FavEntry[])
    : [];
  const favoriteKeys = new Set(favorites.map((f) => `${f.kind}:${f.id}`));
  const isFav = (kind: FavoriteKind, id: string) =>
    favoriteKeys.has(`${kind}:${id}`);

  const admin = createAdminClient();

  // 1) Owned identities (1:1 chats).
  const { data: oracles } = await supabase
    .from("oracles")
    .select("id, name, avatar_url, mode, created_at")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  // 2) Shared archives (where user has archive_grant).
  const { data: grantRows } = await supabase
    .from("archive_grants")
    .select("oracle_id")
    .eq("user_id", user.id);
  const sharedIds = (grantRows ?? []).map((r) => r.oracle_id);
  const { data: sharedOracles } = sharedIds.length
    ? await supabase
        .from("oracles")
        .select("id, name, avatar_url, user_id")
        .in("id", sharedIds)
        .is("deleted_at", null)
    : { data: [] };

  // 3) Group rooms (owned by user) + their member avatars for the
  // iMessage-style collage on each row.
  const { data: groupRoomsRaw } = await supabase
    .from("group_rooms")
    .select("id, name, last_message_at, created_at")
    .eq("owner_user_id", user.id)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  const groupRoomIds = (groupRoomsRaw ?? []).map((r) => r.id);
  const { data: groupMemberRows } = groupRoomIds.length
    ? await admin
        .from("group_room_members")
        .select("room_id, oracle_id, oracles(avatar_url)")
        .in("room_id", groupRoomIds)
        .is("left_at", null)
    : { data: [] };
  type GroupMemberRow = {
    room_id: string;
    oracle_id: string;
    oracles: { avatar_url: string | null } | { avatar_url: string | null }[] | null;
  };
  const avatarsByRoom = new Map<string, (string | null)[]>();
  for (const m of (groupMemberRows ?? []) as unknown as GroupMemberRow[]) {
    const o = Array.isArray(m.oracles) ? m.oracles[0] : m.oracles;
    const list = avatarsByRoom.get(m.room_id) ?? [];
    if (list.length < 4) list.push(o?.avatar_url ?? null);
    avatarsByRoom.set(m.room_id, list);
  }

  // 4) Beneficiary group rooms (user is member).
  const { data: benefMembership } = await admin
    .from("beneficiary_room_members")
    .select("room_id")
    .eq("user_id", user.id)
    .is("left_at", null);
  const benefRoomIds = (benefMembership ?? []).map((m) => m.room_id);
  const { data: benefRooms } = benefRoomIds.length
    ? await admin
        .from("beneficiary_rooms")
        .select("id, name, oracle_id, last_message_at, created_at")
        .in("id", benefRoomIds)
    : { data: [] };

  // Pull last messages for each conversation (one per source, batched).
  const ownedIds = (oracles ?? []).map((o) => o.id);
  const { data: ownedLast } = ownedIds.length
    ? await admin
        .from("messages")
        .select("oracle_id, content, role, created_at")
        .in("oracle_id", ownedIds)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [] };
  const lastByOwnedOracle = new Map<
    string,
    { content: string; role: string; created_at: string }
  >();
  for (const m of ownedLast ?? []) {
    if (!lastByOwnedOracle.has(m.oracle_id)) {
      lastByOwnedOracle.set(m.oracle_id, {
        content: m.content,
        role: m.role,
        created_at: m.created_at,
      });
    }
  }

  const sharedOracleIds = (sharedOracles ?? []).map((o) => o.id);
  const { data: sharedLast } = sharedOracleIds.length
    ? await admin
        .from("messages")
        .select("oracle_id, content, role, created_at")
        .in("oracle_id", sharedOracleIds)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [] };
  const lastBySharedOracle = new Map<
    string,
    { content: string; role: string; created_at: string }
  >();
  for (const m of sharedLast ?? []) {
    if (!lastBySharedOracle.has(m.oracle_id)) {
      lastBySharedOracle.set(m.oracle_id, {
        content: m.content,
        role: m.role,
        created_at: m.created_at,
      });
    }
  }

  // Assemble unified rows.
  const rows: ConvRow[] = [];

  for (const o of oracles ?? []) {
    const last = lastByOwnedOracle.get(o.id);
    rows.push({
      href: `/chat/${o.id}`,
      title: o.name?.trim() || t.unnamed,
      subtitle: last
        ? `${last.role === "user" ? `${t.you}: ` : ""}${last.content}`
        : t.startConversation,
      avatarUrl: o.avatar_url,
      kind: o.mode === "randomize" ? "randomized" : "owned",
      favoriteId: o.id,
      favoriteKind: "owned",
      isFavorite: isFav("owned", o.id),
      lastMessageAt: last
        ? new Date(last.created_at).getTime()
        : new Date(o.created_at).getTime(),
    });
  }

  for (const o of sharedOracles ?? []) {
    const last = lastBySharedOracle.get(o.id);
    rows.push({
      href: `/shared/${o.id}`,
      title: o.name?.trim() || t.unnamed,
      subtitle: last
        ? `${last.role === "user" ? `${t.you}: ` : ""}${last.content}`
        : t.startConversation,
      avatarUrl: o.avatar_url,
      kind: "shared",
      favoriteId: o.id,
      favoriteKind: "shared",
      isFavorite: isFav("shared", o.id),
      lastMessageAt: last
        ? new Date(last.created_at).getTime()
        : 0,
    });
  }

  for (const r of groupRoomsRaw ?? []) {
    rows.push({
      href: `/groups/${r.id}`,
      title: r.name,
      subtitle: t.groupChat,
      avatarUrl: null,
      collageAvatars: avatarsByRoom.get(r.id) ?? [],
      kind: "group",
      favoriteId: r.id,
      favoriteKind: "group",
      isFavorite: isFav("group", r.id),
      lastMessageAt: r.last_message_at
        ? new Date(r.last_message_at).getTime()
        : new Date(r.created_at).getTime(),
    });
  }

  // Beneficiary group rooms — show with the deceased oracle's name + avatar.
  const benefOracleIds = Array.from(
    new Set((benefRooms ?? []).map((r) => r.oracle_id)),
  );
  const { data: benefOracleRows } = benefOracleIds.length
    ? await admin
        .from("oracles")
        .select("id, name, avatar_url")
        .in("id", benefOracleIds)
    : { data: [] };
  const benefOracleMap = new Map(
    (benefOracleRows ?? []).map((o) => [o.id, o]),
  );
  for (const r of benefRooms ?? []) {
    const o = benefOracleMap.get(r.oracle_id);
    rows.push({
      href: `/beneficiary-groups/${r.id}`,
      title: r.name,
      subtitle: t.beneficiaryGroup(o?.name ?? t.unnamed),
      avatarUrl: o?.avatar_url ?? null,
      kind: "together",
      favoriteId: r.id,
      favoriteKind: "together",
      isFavorite: isFav("together", r.id),
      lastMessageAt: r.last_message_at
        ? new Date(r.last_message_at).getTime()
        : new Date(r.created_at).getTime(),
    });
  }

  rows.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

  // Favorites in the order the user pinned them (preserved by
  // appending to the array on toggle-on). Skip any that no longer
  // resolve to a row (the underlying conversation was deleted).
  const rowByKey = new Map<string, ConvRow>(
    rows.map((r) => [`${r.favoriteKind}:${r.favoriteId}`, r]),
  );
  const favoriteRows = favorites
    .map((f) => rowByKey.get(`${f.kind}:${f.id}`))
    .filter((r): r is ConvRow => r !== undefined);

  // Pinned conversations only appear in the favorites strip — pull
  // them out of the main list so they don't show up twice.
  const listRows = rows.filter((r) => !r.isFavorite);

  return (
    <main className="flex-1">
      <header className="border-b border-warm-700/40">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <Link
            href="/"
            className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors"
          >
            chapter3five
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-32">
        <div className="flex items-center justify-between mb-6 px-2 gap-3">
          <h1 className="font-serif text-3xl text-warm-50">{t.title}</h1>
          <NewConversationMenu
            language={language}
            ownedOracles={(oracles ?? []).map((o) => ({
              id: o.id,
              name: o.name?.trim() || t.unnamed,
              avatarUrl: o.avatar_url,
            }))}
          />
        </div>

        {/* Favorites row — pinned conversations as oval tiles
            (intentionally not circles, to be visually distinct from
            iMessage's pattern). Horizontal scroll if it overflows. */}
        {favoriteRows.length > 0 && (
          <div className="mb-6 -mx-4 px-4 pb-4 overflow-x-auto">
            <p className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-3 px-2">
              {t.favoritesLabel}
            </p>
            <div className="flex gap-3">
              {favoriteRows.map((r) => (
                <FavoriteTile
                  key={`fav-${r.favoriteKind}-${r.favoriteId}`}
                  href={r.href}
                  title={r.title}
                  favoriteId={r.favoriteId}
                  favoriteKind={r.favoriteKind}
                  language={language}
                >
                  <div className="w-16 h-20 rounded-[40%] overflow-hidden border border-warm-700/60 bg-warm-700/40 group-hover:border-warm-300/50 transition-colors mb-2">
                    {r.kind === "group" &&
                    r.collageAvatars &&
                    r.collageAvatars.length > 0 ? (
                      <FavoriteCollage
                        avatars={r.collageAvatars}
                        title={r.title}
                      />
                    ) : r.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.avatarUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center font-serif text-warm-200 text-2xl">
                        {r.title.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-warm-200 text-center truncate w-full leading-tight">
                    {r.title}
                  </span>
                </FavoriteTile>
              ))}
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <p className="text-warm-300 italic text-center py-12">
            {t.empty}
          </p>
        ) : (
          <div className="space-y-1">
            {listRows.map((r, i) => (
              <div
                key={r.href + i}
                className="flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-warm-700/20 active:bg-warm-700/40 transition-colors group/row"
              >
                <Link href={r.href} className="flex items-center gap-3 flex-1 min-w-0">
                <div className="relative flex-shrink-0">
                  {r.kind === "group" &&
                  r.collageAvatars &&
                  r.collageAvatars.length > 0 ? (
                    <GroupCollage avatars={r.collageAvatars} title={r.title} />
                  ) : r.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.avatarUrl}
                      alt=""
                      className="w-12 h-12 rounded-full object-cover border border-warm-700/60"
                    />
                  ) : (
                    <span className="w-12 h-12 rounded-full bg-warm-700/40 border border-warm-700/60 inline-flex items-center justify-center font-serif text-warm-200 text-lg">
                      {r.title.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  {r.kind !== "owned" && r.kind !== "group" && (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-ink-soft border border-warm-700/80 flex items-center justify-center"
                      title={KIND_LABELS[language][r.kind]}
                      aria-label={KIND_LABELS[language][r.kind]}
                    >
                      <KindIcon kind={r.kind} />
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <span className="font-serif text-warm-50 text-base truncate">
                      {r.title}
                    </span>
                    <span className="text-xs text-warm-400 flex-shrink-0">
                      {r.lastMessageAt > 0
                        ? relativeTime(
                            new Date(r.lastMessageAt).toISOString(),
                            language,
                          )
                        : ""}
                    </span>
                  </div>
                  <p className="text-sm text-warm-300 truncate">
                    {r.subtitle}
                  </p>
                </div>
                </Link>

                <form action={toggleFavorite} className="flex-shrink-0">
                  <input type="hidden" name="kind" value={r.favoriteKind} />
                  <input type="hidden" name="id" value={r.favoriteId} />
                  <button
                    type="submit"
                    aria-label={t.favorite}
                    title={t.favorite}
                    className="p-2 rounded-full text-warm-500 hover:text-warm-200 transition-colors"
                  >
                    <FavStar filled={false} />
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

/**
 * iMessage-style collage for group rooms — up to 4 avatars
 * arranged so each is visible. Falls back to monogram squares
 * for members without a photo.
 */
function GroupCollage({
  avatars,
  title,
}: {
  avatars: (string | null)[];
  title: string;
}) {
  const visible = avatars.slice(0, 4);
  const fallbackChar = title.slice(0, 1).toUpperCase();

  // 1 avatar: full-size circle.
  if (visible.length <= 1) {
    const a = visible[0] ?? null;
    return a ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={a}
        alt=""
        className="w-12 h-12 rounded-full object-cover border border-warm-700/60"
      />
    ) : (
      <span className="w-12 h-12 rounded-full bg-warm-700/40 border border-warm-700/60 inline-flex items-center justify-center font-serif text-warm-200 text-lg">
        {fallbackChar}
      </span>
    );
  }

  // 2-4 avatars: a 2x2 collage clipped to a circle.
  return (
    <div className="w-12 h-12 rounded-full overflow-hidden border border-warm-700/60 grid grid-cols-2 grid-rows-2 gap-0.5 bg-warm-700/40">
      {[0, 1, 2, 3].map((i) => {
        const a = visible[i];
        if (a === undefined && visible.length === 2 && i >= 2) {
          // Hide the bottom row for 2-avatar collages by extending
          // the top row — we render two halves stacked instead. But
          // with 2-cell layout, simplest is to just leave bottom
          // empty.
          return <span key={i} className="bg-warm-700/40" />;
        }
        if (a === undefined) {
          return <span key={i} className="bg-warm-700/40" />;
        }
        return a ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={a}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <span
            key={i}
            className="w-full h-full bg-warm-700/60 flex items-center justify-center text-warm-200 text-[10px] font-serif"
          >
            {fallbackChar}
          </span>
        );
      })}
    </div>
  );
}

/** Same shape as GroupCollage but sized for the favorite oval. */
function FavoriteCollage({
  avatars,
  title,
}: {
  avatars: (string | null)[];
  title: string;
}) {
  const visible = avatars.slice(0, 4);
  const fallbackChar = title.slice(0, 1).toUpperCase();
  if (visible.length <= 1) {
    const a = visible[0] ?? null;
    return a ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={a} alt="" className="w-full h-full object-cover" />
    ) : (
      <span className="w-full h-full flex items-center justify-center font-serif text-warm-200 text-2xl">
        {fallbackChar}
      </span>
    );
  }
  return (
    <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-px bg-warm-700/40">
      {[0, 1, 2, 3].map((i) => {
        const a = visible[i];
        if (a === undefined) return <span key={i} className="bg-warm-700/40" />;
        return a ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={a}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <span
            key={i}
            className="w-full h-full bg-warm-700/60 flex items-center justify-center text-warm-200 text-[10px] font-serif"
          >
            {fallbackChar}
          </span>
        );
      })}
    </div>
  );
}

function FavStar({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className="w-4 h-4"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="10 2 12.4 7.6 18.4 8.2 13.9 12.3 15.2 18.2 10 15 4.8 18.2 6.1 12.3 1.6 8.2 7.6 7.6" />
    </svg>
  );
}

function KindIcon({ kind }: { kind: ConvKind }) {
  const stroke = "currentColor";
  const className = "w-3 h-3 text-warm-200";
  if (kind === "randomized") {
    // Dice — a randomly-rolled identity.
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="10" height="10" rx="2" />
        <circle cx="6" cy="6" r="0.6" fill={stroke} />
        <circle cx="10" cy="10" r="0.6" fill={stroke} />
      </svg>
    );
  }
  if (kind === "shared") {
    // Inbox-arrow — an archive that came TO you (inherited / shared).
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2v8" />
        <polyline points="5 7 8 10 11 7" />
        <path d="M3 12v1.5a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V12" />
      </svg>
    );
  }
  if (kind === "group") {
    // Three small circles — group chat.
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none" stroke={stroke} strokeWidth="1.4">
        <circle cx="5" cy="6" r="1.6" />
        <circle cx="11" cy="6" r="1.6" />
        <circle cx="8" cy="11" r="1.6" />
      </svg>
    );
  }
  if (kind === "together") {
    // Two interlocking arcs — beneficiaries together with the deceased.
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round">
        <path d="M3 8a3 3 0 0 1 5.5 -1.7" />
        <path d="M13 8a3 3 0 0 0 -5.5 1.7" />
      </svg>
    );
  }
  return null;
}

const KIND_LABELS: Record<"en" | "es", Record<ConvKind, string>> = {
  en: {
    owned: "Identity",
    randomized: "Randomized identity",
    shared: "Inherited / shared",
    group: "Group chat",
    together: "Together with this archive",
  },
  es: {
    owned: "Identidad",
    randomized: "Identidad aleatoria",
    shared: "Heredado / compartido",
    group: "Chat grupal",
    together: "Juntos con este archivo",
  },
};

const COPY = {
  en: {
    title: "Conversations.",
    empty: "No conversations yet. Tap + New identity to start.",
    unnamed: "(unnamed)",
    you: "you",
    groupChat: "Group chat",
    beneficiaryGroup: (oracle: string) => `with ${oracle}`,
    startConversation: "Tap to start",
    favoritesLabel: "Favorites",
    favorite: "Add to favorites",
    unfavorite: "Remove from favorites",
  },
  es: {
    title: "Conversaciones.",
    empty: "Aún no hay conversaciones. Toca + Nueva identidad para empezar.",
    unnamed: "(sin nombre)",
    you: "tú",
    groupChat: "Chat grupal",
    beneficiaryGroup: (oracle: string) => `con ${oracle}`,
    startConversation: "Toca para empezar",
    favoritesLabel: "Favoritos",
    favorite: "Agregar a favoritos",
    unfavorite: "Quitar de favoritos",
  },
};
