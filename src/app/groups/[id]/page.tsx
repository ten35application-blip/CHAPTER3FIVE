import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GroupRoom } from "@/components/GroupRoom";
import { markConversationRead } from "@/app/settings/actions";

export const metadata = {
  title: "Group chat — chapter3five",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function GroupRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/signin?next=/groups/${id}`);

  const { data: room } = await supabase
    .from("group_rooms")
    .select("id, name, language, owner_user_id")
    .eq("id", id)
    .maybeSingle();
  if (!room) redirect("/groups?error=Room%20not%20found");

  const { data: memberRows } = await supabase
    .from("group_room_members")
    .select("oracle_id, left_at, oracles(id, name, avatar_url)")
    .eq("room_id", id);

  type OracleStub = {
    id: string;
    name: string | null;
    avatar_url: string | null;
  };
  type MemberRow = {
    oracle_id: string;
    left_at: string | null;
    oracles: OracleStub | OracleStub[] | null;
  };
  const members = ((memberRows ?? []) as unknown as MemberRow[])
    .map((m) => {
      const o = Array.isArray(m.oracles) ? m.oracles[0] : m.oracles;
      if (!o) return null;
      return {
        oracleId: o.id,
        name: o.name ?? "—",
        avatarUrl: o.avatar_url,
        left: !!m.left_at,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const memberOracleIds = new Set(members.map((m) => m.oracleId));
  const { data: otherOracleRows } = await supabase
    .from("oracles")
    .select("id, name, avatar_url")
    .eq("user_id", user.id)
    .is("deleted_at", null);
  const addable = (otherOracleRows ?? [])
    .filter((o) => !memberOracleIds.has(o.id))
    .map((o) => ({
      id: o.id,
      name: o.name ?? "—",
      avatarUrl: o.avatar_url,
    }));

  const isOwner = room.owner_user_id === user.id;

  await markConversationRead("group", id);

  const { data: messageRows } = await supabase
    .from("group_messages")
    .select("id, role, content, sender_oracle_id, sender_user_id, created_at")
    .eq("room_id", id)
    .order("created_at", { ascending: false })
    .limit(80);

  const initialMessages = (messageRows ?? []).reverse().map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    senderOracleId: m.sender_oracle_id ?? null,
    createdAt: m.created_at,
  }));

  const language = (room.language ?? "en") as "en" | "es";

  return (
    <main className="flex-1 flex flex-col px-6 py-6">
      <header className="max-w-3xl w-full mx-auto flex items-center justify-between mb-8">
        <Link
          href="/groups"
          className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors"
        >
          {room.name}
        </Link>
        <span className="text-xs uppercase tracking-[0.2em] text-warm-300">
          {language === "es" ? "Grupo" : "Group"}
        </span>
      </header>

      <div className="flex-1 flex justify-center">
        <GroupRoom
          roomId={id}
          language={language}
          members={members}
          initialMessages={initialMessages}
          isOwner={isOwner}
          addableOracles={addable}
        />
      </div>
    </main>
  );
}
