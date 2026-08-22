import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isReactionKind, type ReactionKind } from "@/lib/reactions";

/**
 * A page of conversation history OLDER than a given moment.
 *
 * The chat page server-renders the newest 100 messages and stopped
 * there — everything before that sat in the database with no way to
 * reach it. For an archive of someone who died, that is their earliest
 * words locked away. Mobile gained this first (the thread walks back 50
 * at a time); this is the web half of the same feature, and mobile is
 * the source of truth for behaviour.
 *
 * GET /api/chat/[id]/messages/older?before=<ISO timestamp>
 *   → { messages: ChatMessage[], reachedStart: boolean }
 *
 * `messages` comes back OLDEST-FIRST, ready to prepend. `reachedStart`
 * is true when this page was short, meaning there is nothing before it.
 *
 * Everything the server page does per row is done here too — re-signing
 * private image paths and attaching reactions — so scrolling back does
 * not quietly degrade to bare text with no tapbacks.
 *
 * Access is RLS: the messages table is scoped to auth.uid(), and the
 * explicit user_id filter is the belt. There is no oracle-ownership
 * check needed beyond that — you can only ever read your own rows.
 */
export const dynamic = "force-dynamic";

/** Matches the mobile page size, and the server page's own first load
 *  is 100; a page of 50 keeps each step quick on a slow connection. */
const PAGE_SIZE = 50;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: oracleId } = await ctx.params;
  const before = req.nextUrl.searchParams.get("before");

  if (!before || Number.isNaN(Date.parse(before))) {
    return NextResponse.json(
      { error: "A valid `before` timestamp is required." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: rows, error } = await supabase
    .from("messages")
    .select(
      "id, role, content, created_at, read_by_oracle_at, image_storage_path",
    )
    .eq("oracle_id", oracleId)
    .eq("user_id", user.id)
    // Soft-deleted rows stay recoverable but never re-hydrate, matching
    // the server page — otherwise recovering a conversation later would
    // double up rows.
    .is("deleted_at", null)
    .lt("created_at", before)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  // A FAILED QUERY IS NOT THE BEGINNING OF THE CONVERSATION. Returning
  // reachedStart on an error would tell someone they had reached their
  // mother's first message when the request simply failed, and the UI
  // would then refuse to try again.
  if (error) {
    return NextResponse.json(
      { error: "Couldn't load earlier messages." },
      { status: 500 },
    );
  }

  const found = rows ?? [];

  // Re-sign private image paths. The stored image_url is a 15-minute
  // signed URL minted at send time and is long dead for anything this
  // old; 1h TTL is plenty for a page view.
  const imagePaths = found
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

  const messageIds = found.map((m) => m.id);
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

  // Oldest-first, same shape the page builds, ready to prepend.
  const messages = found
    .slice()
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

  return NextResponse.json({
    messages,
    reachedStart: found.length < PAGE_SIZE,
  });
}
