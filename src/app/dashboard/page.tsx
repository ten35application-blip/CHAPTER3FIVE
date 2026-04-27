import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  title: "Conversations — chapter3five",
};

type ConvRow = {
  href: string;
  title: string;
  subtitle: string;
  avatarUrl: string | null;
  badge: string | null;
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
      badge: o.mode === "randomize" ? t.randomized : null,
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
      badge: t.shared,
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
      badge: t.group,
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
      badge: t.together,
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

      <div className="max-w-2xl mx-auto px-4 py-6">
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
                {r.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.avatarUrl}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover flex-shrink-0 border border-warm-700/60"
                  />
                ) : (
                  <span className="w-12 h-12 rounded-full bg-warm-700/40 border border-warm-700/60 flex-shrink-0 inline-flex items-center justify-center font-serif text-warm-200 text-lg">
                    {r.title.slice(0, 1).toUpperCase()}
                  </span>
                )}
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
                  <div className="flex items-center gap-2">
                    {r.badge && (
                      <span className="text-[10px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded-full border border-warm-400/40 text-warm-300 flex-shrink-0">
                        {r.badge}
                      </span>
                    )}
                    <p className="text-sm text-warm-300 truncate">
                      {r.subtitle}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

const COPY = {
  en: {
    title: "Conversations.",
    empty: "No conversations yet. Tap + New identity to start.",
    unnamed: "(unnamed)",
    you: "you",
    randomized: "Randomized",
    shared: "Shared",
    group: "Group",
    together: "Together",
    groupChat: "Group chat",
    beneficiaryGroup: (oracle: string) => `with ${oracle}`,
    startConversation: "Tap to start",
  },
  es: {
    title: "Conversaciones.",
    empty: "Aún no hay conversaciones. Toca + Nueva identidad para empezar.",
    unnamed: "(sin nombre)",
    you: "tú",
    randomized: "Aleatoria",
    shared: "Compartido",
    group: "Grupo",
    together: "Juntos",
    groupChat: "Chat grupal",
    beneficiaryGroup: (oracle: string) => `con ${oracle}`,
    startConversation: "Toca para empezar",
  },
};
