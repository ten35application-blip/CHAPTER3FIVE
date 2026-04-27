import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  title: "Conversations — chapter3five",
};

type ConvKind = "owned" | "randomized" | "shared" | "group" | "together";

type ConvRow = {
  href: string;
  title: string;
  subtitle: string;
  avatarUrl: string | null;
  kind: ConvKind;
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
    .select("preferred_language, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_completed) redirect("/onboarding");

  const language = (profile.preferred_language ?? "en") as "en" | "es";
  const t = COPY[language];

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

  // 3) Group rooms (owned by user).
  const { data: groupRoomsRaw } = await supabase
    .from("group_rooms")
    .select("id, name, last_message_at, created_at")
    .eq("owner_user_id", user.id)
    .order("last_message_at", { ascending: false, nullsFirst: false });

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
      kind: "group",
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
      lastMessageAt: r.last_message_at
        ? new Date(r.last_message_at).getTime()
        : new Date(r.created_at).getTime(),
    });
  }

  rows.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

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
        <h1 className="font-serif text-3xl text-warm-50 mb-6 px-2">
          {t.title}
        </h1>

        {rows.length === 0 ? (
          <p className="text-warm-300 italic text-center py-12">
            {t.empty}
          </p>
        ) : (
          <div className="space-y-1">
            {rows.map((r, i) => (
              <Link
                key={r.href + i}
                href={r.href}
                className="flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-warm-700/20 active:bg-warm-700/40 transition-colors"
              >
                <div className="relative flex-shrink-0">
                  {r.avatarUrl ? (
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
                  {r.kind !== "owned" && (
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
            ))}
          </div>
        )}
      </div>
    </main>
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
  },
  es: {
    title: "Conversaciones.",
    empty: "Aún no hay conversaciones. Toca + Nueva identidad para empezar.",
    unnamed: "(sin nombre)",
    you: "tú",
    groupChat: "Chat grupal",
    beneficiaryGroup: (oracle: string) => `con ${oracle}`,
    startConversation: "Toca para empezar",
  },
};
