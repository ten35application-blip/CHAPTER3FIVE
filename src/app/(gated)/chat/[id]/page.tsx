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
    .select(
      "id, name, avatar_url, one_line_hook, blocked_at, block_reason, is_concierge, is_photo_placeholder",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!oracle) {
    notFound();
  }

  // Phase 3 (0126): the row IS a photo-companion slot but the user
  // hasn't uploaded a photo yet — the persona doesn't exist to chat
  // with. Show a soft placeholder screen that prompts the upload;
  // Phase 4 replaces this stub with the real photo-upload sheet.
  if (oracle.is_photo_placeholder) {
    return <PhotoPlaceholderScreen name={oracle.name as string} />;
  }

  // Whether the user has muted this identity (Bundle A "Block" —
  // profiles.muted_conversations, 0047). Drives the initial state of
  // the Block/Unblock toggle in the ChatSurface header menu.
  // Also carries first_launch_ai_ack_at (Bundle C, 0124): drives
  // whether the one-time AI-nature disclosure modal fires on the
  // concierge chat.
  const { data: profile } = await supabase
    .from("profiles")
    .select("muted_conversations, first_launch_ai_ack_at")
    .eq("id", user.id)
    .maybeSingle<{
      muted_conversations: unknown;
      first_launch_ai_ack_at: string | null;
    }>();
  const initialMuted = Array.isArray(profile?.muted_conversations)
    ? (profile.muted_conversations as unknown[]).some(
        (e) =>
          typeof e === "object" &&
          e !== null &&
          (e as { kind?: unknown }).kind === "oracle" &&
          (e as { id?: unknown }).id === oracle.id,
      )
    : false;
  const initialAiAcked = !!profile?.first_launch_ai_ack_at;

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
      initialAiAcked={initialAiAcked}
    />
  );
}

/** Phase-3 (0126) photo-placeholder chat surface. The user tapped a
 *  placeholder row on the dashboard — there's no persona to talk to
 *  yet, so instead of a broken composer we render a hint and the
 *  camera-glyph avatar. Phase 4 replaces this stub with the real
 *  upload sheet (file picker + generate-from-photo flow). */
function PhotoPlaceholderScreen({ name }: { name: string }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 py-24 text-center">
      <span
        aria-hidden
        className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-coral/40 bg-ink text-coral-strong"
      >
        <svg
          viewBox="0 0 24 24"
          width="36"
          height="36"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 8h3l2-2h6l2 2h3v10H4z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
      </span>
      <h1 className="text-lg font-semibold text-warm-50">{name}</h1>
      <p className="mt-3 text-sm leading-relaxed text-warm-300">
        Tap the avatar to upload a photo — this identity will be created once you do.
      </p>
    </main>
  );
}
