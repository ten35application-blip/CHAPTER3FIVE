import { notFound, redirect } from "next/navigation";
import { canChatWithOracle } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { isReactionKind, type ReactionKind } from "@/lib/reactions";
import ChatSurface, { type ChatMessage } from "./ChatSurface";

/**
 * /chat/[id] — the conversation with one persona.
 *
 * Server component: auth + ownership, then the initial payload for
 * ChatSurface. Deliberately does NOT select persona_prompt — that
 * string never leaves the server. The stream route fetches it fresh
 * on every send.
 *
 * Ownership is enforced by RLS (owner via 0002; inherited copies are
 * owned rows since 0111, beneficiary grants via 0014): if the select
 * returns no row, this chat isn't the caller's to see → notFound().
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
    .select("id, name, avatar_url, one_line_hook, blocked_at, block_reason, is_concierge")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!oracle) {
    notFound();
  }

  // Whether the user has muted this identity (Bundle A "Block" —
  // profiles.muted_conversations, 0047). Drives the initial state of
  // the Block/Unblock toggle in the ChatSurface header menu.
  const { data: profile } = await supabase
    .from("profiles")
    .select("muted_conversations")
    .eq("id", user.id)
    .maybeSingle<{ muted_conversations: unknown }>();
  const initialMuted = Array.isArray(profile?.muted_conversations)
    ? (profile.muted_conversations as unknown[]).some(
        (e) =>
          typeof e === "object" &&
          e !== null &&
          (e as { kind?: unknown }).kind === "oracle" &&
          (e as { id?: unknown }).id === oracle.id,
      )
    : false;

  // Trial / Free-tier gate: after the trial, only the free identity
  // stays chattable. Locked identities remain on the dashboard but
  // opening them lands on the upgrade page. (The stream route enforces
  // the same rule server-side; this is the navigation half.)
  if (!(await canChatWithOracle(oracle.id, supabase))) {
    redirect(`/upgrade?next=${encodeURIComponent(`/chat/${oracle.id}`)}`);
  }

  // Last 100 messages of this user's thread, oldest first for render.
  // Soft-deleted messages (conversation delete via the dashboard hub)
  // stay in the DB for recovery but never re-hydrate here — otherwise
  // recovering later would double-up rows.
  const { data: rows } = await supabase
    .from("messages")
    .select(
      "id, role, content, created_at, read_by_oracle_at, image_storage_path",
    )
    .eq("oracle_id", oracle.id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  // The `chat-uploads` bucket is private and the persisted image_url is
  // a 15-minute signed URL minted at send time — long expired for
  // anything but the freshest rows. Re-sign every stored path here
  // (1h TTL, plenty for one page view) so history images always render.
  const imagePaths = (rows ?? [])
    .map((m) => m.image_storage_path)
    .filter((p): p is string => !!p);
  const signedByPath = new Map<string, string>();
  if (imagePaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("chat-uploads")
      .createSignedUrls(imagePaths, 60 * 60);
    for (const entry of signed ?? []) {
      if (entry.path && entry.signedUrl) {
        signedByPath.set(entry.path, entry.signedUrl);
      }
    }
  }

  // Reactions for these messages — this user's own reactions render as
  // "myReaction" on the bubble, persona reactions (server-side inserts
  // by the stream route in a follow-up commit) render as "theirReaction".
  // RLS gates SELECT to the caller's own thread already; single round-trip.
  const messageIds = (rows ?? []).map((m) => m.id);
  const reactionsByMessage = new Map<
    string,
    { mine: ReactionKind | null; theirs: ReactionKind | null }
  >();
  if (messageIds.length > 0) {
    const { data: reactionRows } = await supabase
      .from("message_reactions")
      .select("message_id, kind, user_id, oracle_id")
      .in("message_id", messageIds);
    for (const r of reactionRows ?? []) {
      const bucket = reactionsByMessage.get(r.message_id) ?? {
        mine: null,
        theirs: null,
      };
      const kind = isReactionKind(r.kind) ? r.kind : null;
      if (r.user_id === user.id) bucket.mine = kind;
      else if (r.oracle_id) bucket.theirs = kind;
      reactionsByMessage.set(r.message_id, bucket);
    }
  }

  const initialMessages: ChatMessage[] = (rows ?? [])
    .reverse()
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      createdAt: m.created_at,
      readByOracleAt: m.read_by_oracle_at,
      pending: false,
      imageUrl: m.image_storage_path
        ? (signedByPath.get(m.image_storage_path) ?? null)
        : null,
      myReaction: reactionsByMessage.get(m.id)?.mine ?? null,
      theirReaction: reactionsByMessage.get(m.id)?.theirs ?? null,
    }));

  // Marking the persona's messages as read happens client-side on
  // mount via POST /api/chat/[id]/messages/read — not here, so a
  // prefetch of this route can't silently clear unread state.
  return (
    <ChatSurface
      oracleId={oracle.id}
      name={oracle.name}
      avatarUrl={oracle.avatar_url}
      oneLineHook={oracle.one_line_hook ?? null}
      initialMessages={initialMessages}
      initialBlocked={!!oracle.blocked_at}
      blockReason={oracle.block_reason ?? null}
      isConcierge={!!oracle.is_concierge}
      initialMuted={initialMuted}
    />
  );
}
