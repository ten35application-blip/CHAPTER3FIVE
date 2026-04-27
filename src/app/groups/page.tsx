import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GroupCreator } from "@/components/GroupCreator";

export const metadata = {
  title: "Group chats — chapter3five",
};

export default async function GroupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin?next=/groups");

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language")
    .eq("id", user.id)
    .single();
  const language = (profile?.preferred_language ?? "en") as "en" | "es";
  const t = COPY[language];

  // The user's OWN identities — only these can be in a group.
  // Inherited / shared archives stay 1:1.
  const { data: ownOracles } = await supabase
    .from("oracles")
    .select("id, name, avatar_url")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const { data: rooms } = await supabase
    .from("group_rooms")
    .select("id, name, language, created_at, last_message_at")
    .eq("owner_user_id", user.id)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const roomIds = (rooms ?? []).map((r) => r.id);
  const { data: memberRows } = roomIds.length
    ? await supabase
        .from("group_room_members")
        .select("room_id, oracle_id, left_at, oracles(name, avatar_url)")
        .in("room_id", roomIds)
    : { data: [] };

  type OracleStub = { name: string | null; avatar_url: string | null };
  type MemberRow = {
    room_id: string;
    oracle_id: string;
    left_at: string | null;
    oracles: OracleStub | OracleStub[] | null;
  };
  const membersByRoom = new Map<
    string,
    { name: string; avatarUrl: string | null; left: boolean }[]
  >();
  for (const m of (memberRows ?? []) as unknown as MemberRow[]) {
    const o = Array.isArray(m.oracles) ? m.oracles[0] : m.oracles;
    const list = membersByRoom.get(m.room_id) ?? [];
    list.push({
      name: o?.name ?? "—",
      avatarUrl: o?.avatar_url ?? null,
      left: !!m.left_at,
    });
    membersByRoom.set(m.room_id, list);
  }

  const eligibleOracles = (ownOracles ?? []).map((o) => ({
    id: o.id,
    name: o.name ?? "untitled",
    avatarUrl: o.avatar_url,
  }));

  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <header className="mb-12 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors"
          >
            ← chapter3five
          </Link>
          <span className="text-xs uppercase tracking-[0.25em] text-warm-300">
            {t.heading}
          </span>
        </header>

        <h1 className="font-serif text-4xl text-warm-50 mb-3">
          <span className="italic font-light">{t.title}</span>
        </h1>
        <p className="text-warm-300 leading-relaxed mb-10 max-w-xl">
          {t.intro}
        </p>

        <GroupCreator
          eligibleOracles={eligibleOracles}
          language={language}
        />

        <div className="space-y-3 mt-12">
          {(rooms ?? []).map((r) => {
            const members = membersByRoom.get(r.id) ?? [];
            const activeMembers = members.filter((m) => !m.left);
            return (
              <Link
                key={r.id}
                href={`/groups/${r.id}`}
                className="block rounded-2xl border border-warm-700/60 bg-warm-700/15 px-5 py-4 hover:bg-warm-700/30 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-serif text-lg text-warm-50 truncate">
                      {r.name}
                    </p>
                    <p className="text-xs text-warm-300 truncate mt-0.5">
                      {activeMembers.map((m) => m.name).join(", ")}
                      {members.length > activeMembers.length
                        ? ` · ${members.length - activeMembers.length} ${t.left}`
                        : ""}
                    </p>
                  </div>
                  <span className="text-xs text-warm-400 flex-shrink-0">
                    {r.last_message_at
                      ? new Date(r.last_message_at).toLocaleDateString(
                          language === "es" ? "es" : "en",
                          { month: "short", day: "numeric" },
                        )
                      : t.justMade}
                  </span>
                </div>
              </Link>
            );
          })}

          {(!rooms || rooms.length === 0) && (
            <p className="text-warm-300 italic text-center py-8">
              {t.empty}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

const COPY = {
  en: {
    heading: "Group chats",
    title: "All your people in one room.",
    intro:
      "Put two or more of your identities in a chat together. They talk to you and to each other — the way real group chats work, where most people stay quiet most of the time and the right person jumps in when something hits. Only identities you created can be in a group.",
    empty: "No group chats yet. Make one above.",
    left: "left",
    justMade: "new",
  },
  es: {
    heading: "Chats grupales",
    title: "Toda tu gente en un cuarto.",
    intro:
      "Pon dos o más de tus identidades en un chat juntas. Te hablan a ti y entre ellas — como funcionan los chats grupales reales, donde la mayoría está callada y la persona correcta salta cuando algo pega. Solo identidades que creaste pueden estar en un grupo.",
    empty: "Aún no hay chats grupales. Crea uno arriba.",
    left: "se fue",
    justMade: "nuevo",
  },
};
