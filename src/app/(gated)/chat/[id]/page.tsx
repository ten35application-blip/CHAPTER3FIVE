import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChatSurface, { type ChatMessage } from "./ChatSurface";

/**
 * /chat/[id] — the conversation with one persona.
 *
 * Server component: auth + ownership, then the initial payload for
 * ChatSurface. Deliberately does NOT select persona_prompt — that
 * string never leaves the server. The stream route fetches it fresh
 * on every send.
 *
 * Ownership is enforced by RLS (owner via 0002, shared via
 * oracle_shares in 0055): if the select returns no row, this chat
 * isn't the caller's to see → notFound().
 */
export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/signin");
  }

  const { data: oracle } = await supabase
    .from("oracles")
    .select("id, name, avatar_url")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!oracle) {
    notFound();
  }

  // Last 100 messages of this user's thread, oldest first for render.
  const { data: rows } = await supabase
    .from("messages")
    .select("id, role, content, created_at, read_by_oracle_at")
    .eq("oracle_id", oracle.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const initialMessages: ChatMessage[] = (rows ?? [])
    .reverse()
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      createdAt: m.created_at,
      readByOracleAt: m.read_by_oracle_at,
      pending: false,
    }));

  // Marking the persona's messages as read happens client-side on
  // mount via POST /api/chat/[id]/messages/read — not here, so a
  // prefetch of this route can't silently clear unread state.
  return (
    <ChatSurface
      oracleId={oracle.id}
      name={oracle.name}
      avatarUrl={oracle.avatar_url}
      initialMessages={initialMessages}
    />
  );
}
