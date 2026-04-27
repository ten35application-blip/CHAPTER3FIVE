import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Chat } from "@/components/Chat";
import { markConversationRead } from "@/app/settings/actions";

export const metadata = {
  title: "Chat — chapter3five",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 1:1 chat with one of the user's owned identities, URL-keyed.
 * The dashboard's old "single conversation" view, just routed by id
 * instead of profile.active_oracle_id. The dashboard itself is now a
 * conversation list; this is what each row navigates to.
 */
export default async function ChatPage({
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
  if (!user) redirect(`/auth/signin?next=${encodeURIComponent(`/chat/${id}`)}`);

  // Owner-only. Inherited / shared archives go through /shared/[id].
  const { data: oracle } = await supabase
    .from("oracles")
    .select("id, name, preferred_language, avatar_url, user_id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!oracle || oracle.user_id !== user.id) {
    redirect("/dashboard?error=No%20access%20to%20that%20identity");
  }

  // Side-effect: bump active_oracle_id so the rest of the app
  // (chat route, group chat, settings) uses this identity by
  // default until the user opens a different one.
  await supabase
    .from("profiles")
    .update({ active_oracle_id: oracle.id })
    .eq("id", user.id);

  // Stamp the read cursor so the dashboard clears the unread mark.
  await markConversationRead("owned", oracle.id);

  const language = (oracle.preferred_language ?? "en") as "en" | "es";
  const oracleName = oracle.name ?? "your identity";

  const { data: messageRows } = await supabase
    .from("messages")
    .select("role, content, image_url, created_at")
    .eq("oracle_id", oracle.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const initialHistory = (messageRows ?? [])
    .reverse()
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      imageUrl: m.image_url ?? null,
    }));

  return (
    <main className="flex-1 flex flex-col px-6 py-4 relative overflow-hidden h-[100dvh]">
      <header className="max-w-2xl w-full mx-auto flex items-center justify-between mb-4 flex-shrink-0">
        <Link
          href="/dashboard"
          className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors"
        >
          chapter3five
        </Link>
        <Link
          href="/dashboard"
          className="text-xs uppercase tracking-[0.2em] text-warm-300 hover:text-warm-100 transition-colors"
        >
          {language === "es" ? "Conversaciones" : "Conversations"}
        </Link>
      </header>

      <div className="flex-1 flex justify-center">
        <Chat
          oracleName={oracleName}
          language={language}
          initialHistory={initialHistory}
          avatarUrl={oracle.avatar_url}
          oracleId={oracle.id}
        />
      </div>
    </main>
  );
}
