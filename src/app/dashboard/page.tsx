import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NewConversationMenu } from "@/components/NewConversationMenu";
import { FavoriteTile } from "@/components/FavoriteTile";
import { ConversationRow } from "@/components/ConversationRow";
import { ConversationSearch } from "@/components/ConversationSearch";
import { DashboardHeader } from "@/components/DashboardHeader";
import { PullToRefresh } from "@/components/PullToRefresh";
import {
  TypingPresence,
  TypingDots,
} from "@/components/TypingPresence";
import { EditModeProvider } from "@/components/EditMode";
import { relativeTime } from "@/lib/relativeTime";

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
  /** New activity since the user last opened this conversation. */
  unread: boolean;
  /** Hide Alerts / muted — proactive crons skip + UI shows bell-slash. */
  muted: boolean;
};


export default async function DashboardPage() {
  try {
    return await renderDashboard();
  } catch (err) {
    // Re-throw Next.js redirect / notFound so they keep working.
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof (err as { digest?: string }).digest === "string" &&
      ((err as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
        (err as { digest: string }).digest.startsWith("NEXT_NOT_FOUND"))
    ) {
      throw err;
    }

    // Render the actual error inline. Next.js strips error messages
    // in production builds when they're THROWN — but rendered JSX
    // is fine. Diagnostic only.
    const message =
      err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack ?? "" : "";
    console.error("[dashboard] render failed:", err);
    return (
      <main className="flex-1 px-6 py-12 max-w-2xl mx-auto">
        <h1 className="font-serif text-3xl text-warm-50 mb-4">
          Dashboard render error (diagnostic)
        </h1>
        <p className="text-sm text-warm-300 mb-4">
          The actual exception text from the server, surfaced here so we
          can stop guessing.
        </p>
        <div className="rounded-2xl bg-warm-700/30 border border-warm-700/60 p-5 mb-6 space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-warm-400">
            Message
          </p>
          <pre className="font-mono text-sm text-warm-50 whitespace-pre-wrap break-all">
            {message || "(no message)"}
          </pre>
          {stack && (
            <>
              <p className="text-xs uppercase tracking-[0.2em] text-warm-400 pt-2">
                Stack
              </p>
              <pre className="font-mono text-[11px] text-warm-200 whitespace-pre-wrap break-all max-h-[400px] overflow-auto">
                {stack}
              </pre>
            </>
          )}
        </div>
      </main>
    );
  }
}

async function renderDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select(
      "preferred_language, onboarding_completed, favorites, last_read",
    )
    .eq("id", user.id)
    .single();
  if (profileErr) {
    console.error("[dashboard] profile select failed:", profileErr);
    throw new Error(`profile select: ${profileErr.message}`);
  }

  // muted_conversations may not exist yet in older deployments. Read
  // it separately and default to [] so the page never hard-crashes
  // on a missing column.
  let mutedRaw: unknown = [];
  try {
    const { data: mutedRow } = await supabase
      .from("profiles")
      .select("muted_conversations")
      .eq("id", user.id)
      .maybeSingle();
    if (
      mutedRow &&
      typeof mutedRow === "object" &&
      "muted_conversations" in mutedRow
    ) {
      mutedRaw = (mutedRow as { muted_conversations: unknown })
        .muted_conversations;
    }
  } catch {
    mutedRaw = [];
  }

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

  // Map of "kind:id" → ISO timestamp the user last opened that
  // conversation. Used to decide which rows are unread.
  const lastReadMap =
    profile.last_read && typeof profile.last_read === "object"
      ? (profile.last_read as Record<string, string>)
      : {};
  const lastReadAt = (kind: FavoriteKind, id: string): number => {
    const v = lastReadMap[`${kind}:${id}`];
    return v ? new Date(v).getTime() : 0;
  };

  // Muted conversations — same shape as favorites.
  const mutedEntries = Array.isArray(mutedRaw)
    ? (mutedRaw as FavEntry[])
    : [];
  const mutedKeys = new Set(mutedEntries.map((m) => `${m.kind}:${m.id}`));
  const isMuted = (kind: FavoriteKind, id: string) =>
    mutedKeys.has(`${kind}:${id}`);

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
    const lastMessageAt = last
      ? new Date(last.created_at).getTime()
      : new Date(o.created_at).getTime();
    // Unread iff the latest message is from the assistant (the persona
    // reaching out) AND it's newer than the last time the user opened
    // this conversation.
    const isAssistantLast = last?.role === "assistant";
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
      lastMessageAt,
      unread: isAssistantLast && lastMessageAt > lastReadAt("owned", o.id),
      muted: isMuted("owned", o.id),
    });
  }

  for (const o of sharedOracles ?? []) {
    const last = lastBySharedOracle.get(o.id);
    const lastMessageAt = last ? new Date(last.created_at).getTime() : 0;
    const isAssistantLast = last?.role === "assistant";
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
      lastMessageAt,
      unread: isAssistantLast && lastMessageAt > lastReadAt("shared", o.id),
      muted: isMuted("shared", o.id),
    });
  }

  for (const r of groupRoomsRaw ?? []) {
    const lastMessageAt = r.last_message_at
      ? new Date(r.last_message_at).getTime()
      : new Date(r.created_at).getTime();
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
      lastMessageAt,
      unread:
        r.last_message_at !== null && lastMessageAt > lastReadAt("group", r.id),
      muted: isMuted("group", r.id),
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
    const lastMessageAt = r.last_message_at
      ? new Date(r.last_message_at).getTime()
      : new Date(r.created_at).getTime();
    rows.push({
      href: `/beneficiary-groups/${r.id}`,
      title: r.name,
      subtitle: t.beneficiaryGroup(o?.name ?? t.unnamed),
      avatarUrl: o?.avatar_url ?? null,
      kind: "together",
      favoriteId: r.id,
      favoriteKind: "together",
      isFavorite: isFav("together", r.id),
      lastMessageAt,
      unread:
        r.last_message_at !== null &&
        lastMessageAt > lastReadAt("together", r.id),
      muted: isMuted("together", r.id),
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

  // DIAGNOSTIC MODE — strip the JSX to bare HTML so we can see what
  // breaks. If this renders, the bug is in one of the client
  // components we wrap (PullToRefresh, DashboardHeader,
  // ConversationRow, EditModeProvider, etc.).
  // Reference imports we still need for compile (will go back when
  // we restore the full render).
  void NewConversationMenu;
  void FavoriteTile;
  void ConversationRow;
  void ConversationSearch;
  void DashboardHeader;
  void PullToRefresh;
  void TypingPresence;
  void TypingDots;
  void EditModeProvider;
  void GroupCollage;
  void FavoriteCollage;
  void FavStar;
  void KindIcon;
  void KIND_LABELS;
  void BellSlash;
  void favoriteRows;
  void listRows;
  void oracles;

  return (
    <main className="flex-1">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-32">
        <h1 className="font-serif text-3xl text-warm-50 mb-4">
          {t.title}{" "}
          <span className="text-sm text-warm-400 font-sans">
            (diagnostic)
          </span>
        </h1>
        <p className="text-sm text-warm-300 mb-6">
          Stripped render mode. {rows.length} conversations loaded
          successfully. If you see this, the data layer is fine — the
          original page render is the problem.
        </p>
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li
              key={r.href + i}
              className="px-3 py-2 rounded-lg border border-warm-700/40 bg-warm-700/20"
            >
              <p className="text-sm text-warm-50">{r.title}</p>
              <p className="text-xs text-warm-400 truncate">
                {r.subtitle}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

/**
 * iMessage-style overlapping cluster for group rooms — one bigger
 * avatar with smaller ones nested behind/beside it. Asymmetric on
 * purpose: matches the clustered-avatar look of Apple's Messages
 * group rows. Falls back to a monogram bubble for members without
 * a photo.
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

  function Bubble({
    src,
    size,
    className,
  }: {
    src: string | null | undefined;
    size: number;
    className: string;
  }) {
    const fontSize = size <= 18 ? "text-[9px]" : "text-[11px]";
    if (src) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          style={{ width: size, height: size }}
          className={`rounded-full object-cover border border-ink-soft ${className}`}
        />
      );
    }
    return (
      <span
        style={{ width: size, height: size }}
        className={`rounded-full bg-warm-700/60 border border-ink-soft inline-flex items-center justify-center font-serif text-warm-200 ${fontSize} ${className}`}
      >
        {fallbackChar}
      </span>
    );
  }

  // 1 member → full-size single circle.
  if (visible.length <= 1) {
    return (
      <div className="w-12 h-12 inline-flex items-center justify-center">
        <Bubble src={visible[0]} size={48} className="border-warm-700/60" />
      </div>
    );
  }

  // 2 members → two bubbles overlapping diagonally.
  if (visible.length === 2) {
    return (
      <div className="relative w-12 h-12">
        <Bubble
          src={visible[0]}
          size={32}
          className="absolute top-0 left-0"
        />
        <Bubble
          src={visible[1]}
          size={32}
          className="absolute bottom-0 right-0"
        />
      </div>
    );
  }

  // 3 members → one big top-left, two smaller stacked bottom-right.
  if (visible.length === 3) {
    return (
      <div className="relative w-12 h-12">
        <Bubble
          src={visible[0]}
          size={30}
          className="absolute top-0 left-0"
        />
        <Bubble
          src={visible[1]}
          size={22}
          className="absolute bottom-0 right-3"
        />
        <Bubble
          src={visible[2]}
          size={22}
          className="absolute bottom-0 right-0"
        />
      </div>
    );
  }

  // 4 members → big primary + three smaller clustered bottom-right.
  return (
    <div className="relative w-12 h-12">
      <Bubble
        src={visible[0]}
        size={28}
        className="absolute top-0 left-0"
      />
      <Bubble
        src={visible[1]}
        size={20}
        className="absolute top-0 right-0"
      />
      <Bubble
        src={visible[2]}
        size={20}
        className="absolute bottom-0 left-3"
      />
      <Bubble
        src={visible[3]}
        size={20}
        className="absolute bottom-0 right-0"
      />
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

/** Small bell-with-slash icon shown next to the timestamp on muted rows. */
function BellSlash() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="w-3 h-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 8a5 5 0 0 1 8.5-3.5" />
      <path d="M15 9v3l1.5 2H10" />
      <path d="M8.5 14a1.5 1.5 0 0 0 3 0" />
      <line x1="3" y1="3" x2="17" y2="17" />
    </svg>
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
