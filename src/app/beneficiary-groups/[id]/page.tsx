import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BeneficiaryRoom } from "@/components/BeneficiaryRoom";
import { markConversationRead } from "@/app/settings/actions";

export const metadata = {
  title: "Group room — chapter3five",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BeneficiaryRoomPage({
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
  if (!user) redirect(`/auth/signin?next=/beneficiary-groups/${id}`);

  const admin = createAdminClient();

  // Membership + room.
  const { data: membership } = await admin
    .from("beneficiary_room_members")
    .select("user_id, left_at")
    .eq("room_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || membership.left_at) {
    redirect("/beneficiary-groups?error=Not%20a%20member%20of%20this%20room");
  }

  const { data: room } = await admin
    .from("beneficiary_rooms")
    .select("id, oracle_id, name, language, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!room) redirect("/beneficiary-groups?error=Room%20not%20found");

  const { data: oracle } = await admin
    .from("oracles")
    .select("id, name, avatar_url")
    .eq("id", room.oracle_id)
    .maybeSingle();
  if (!oracle) redirect("/beneficiary-groups?error=Archive%20not%20found");

  await markConversationRead("together", id);

  // Active members.
  const { data: memberRows } = await admin
    .from("beneficiary_room_members")
    .select("user_id, joined_at, left_at")
    .eq("room_id", id);

  const activeMemberIds = (memberRows ?? [])
    .filter((m) => !m.left_at)
    .map((m) => m.user_id);

  const { data: memberProfiles } = activeMemberIds.length
    ? await admin
        .from("profiles")
        .select("id, oracle_name")
        .in("id", activeMemberIds)
    : { data: [] };
  const profileMap = new Map(
    (memberProfiles ?? []).map((p) => [p.id, p.oracle_name]),
  );
  const memberDisplay = await Promise.all(
    activeMemberIds.map(async (uid) => {
      const fb = profileMap.get(uid);
      if (fb) return { userId: uid, displayName: fb, isMe: uid === user.id };
      const { data } = await admin.auth.admin.getUserById(uid);
      return {
        userId: uid,
        displayName: data?.user?.email ?? "someone",
        isMe: uid === user.id,
      };
    }),
  );

  // Recent messages.
  const { data: messageRows } = await admin
    .from("beneficiary_room_messages")
    .select(
      "id, role, content, sender_user_id, sender_oracle_id, created_at",
    )
    .eq("room_id", id)
    .order("created_at", { ascending: false })
    .limit(80);

  const initialMessages = (messageRows ?? []).reverse().map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    senderUserId: m.sender_user_id ?? null,
    senderOracleId: m.sender_oracle_id ?? null,
    createdAt: m.created_at,
  }));

  const language = (room.language ?? "en") as "en" | "es";

  return (
    <main className="flex-1 flex flex-col px-6 py-6">
      <header className="max-w-3xl w-full mx-auto flex items-center justify-between mb-6">
        <Link
          href="/beneficiary-groups"
          className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors"
        >
          {room.name}
        </Link>
        <span className="text-xs uppercase tracking-[0.2em] text-warm-300">
          {language === "es" ? "Cuarto" : "Room"}
        </span>
      </header>

      <div className="flex-1 flex justify-center">
        <BeneficiaryRoom
          roomId={id}
          language={language}
          oracle={{
            id: oracle.id,
            name: oracle.name ?? (language === "es" ? "ellos" : "they"),
            avatarUrl: oracle.avatar_url,
          }}
          members={memberDisplay}
          initialMessages={initialMessages}
        />
      </div>
    </main>
  );
}
