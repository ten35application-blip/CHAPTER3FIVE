import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Chat } from "@/components/Chat";
import { UserMenu } from "@/components/UserMenu";
import { isAdmin } from "@/lib/admin";

export const metadata = {
  title: "Dashboard — chapter3five",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "oracle_name, preferred_language, onboarding_completed, active_oracle_id, avatar_url",
    )
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  const oracleName = profile.oracle_name ?? "your chapter";
  const language = (profile.preferred_language ?? "en") as "en" | "es";

  const { data: oracleRows } = await supabase
    .from("oracles")
    .select("id, name")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  const oracles = oracleRows ?? [];

  // Archives shared with this user (read-only).
  const { data: grantRows } = await supabase
    .from("archive_grants")
    .select("oracle_id")
    .eq("user_id", user.id);
  const sharedOracleIds = (grantRows ?? []).map((r) => r.oracle_id);
  const { data: sharedOracleRows } = sharedOracleIds.length
    ? await supabase
        .from("oracles")
        .select("id, name")
        .in("id", sharedOracleIds)
        .is("deleted_at", null)
    : { data: [] };
  const sharedOracles = sharedOracleRows ?? [];

  // Load last ~50 messages of the persistent conversation for the active oracle.
  const { data: messageRows } = profile.active_oracle_id
    ? await supabase
        .from("messages")
        .select("role, content, image_url, created_at")
        .eq("oracle_id", profile.active_oracle_id)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };
  const initialHistory = (messageRows ?? [])
    .reverse()
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      imageUrl: m.image_url ?? null,
    }));

  // Mark all messages as seen by bumping the timestamp NOW. This is fire-and-
  // forget; the badge is computed before the bump, so the user sees the count
  // for what was unseen before this load, then it resets.
  const { data: lastSeenRow } = await supabase
    .from("profiles")
    .select("last_message_seen_at")
    .eq("id", user.id)
    .single();
  const lastSeenAt = lastSeenRow?.last_message_seen_at ?? null;
  await supabase
    .from("profiles")
    .update({ last_message_seen_at: new Date().toISOString() })
    .eq("id", user.id);

  return (
    <main className="flex-1 flex flex-col px-6 py-6 relative overflow-hidden">
      <header className="max-w-2xl w-full mx-auto flex items-center justify-between mb-12">
        <Link
          href="/"
          className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors"
        >
          chapter3five
        </Link>
        <UserMenu
          oracleName={oracleName}
          language={language}
          oracles={oracles}
          sharedOracles={sharedOracles}
          activeOracleId={profile.active_oracle_id ?? null}
          lastSeenAt={lastSeenAt}
          isAdmin={isAdmin(user.email)}
        />
      </header>

      <div className="flex-1 flex justify-center">
        <Chat
          oracleName={oracleName}
          language={language}
          initialHistory={initialHistory}
          avatarUrl={profile.avatar_url ?? null}
          oracleId={profile.active_oracle_id ?? null}
        />
      </div>
    </main>
  );
}
