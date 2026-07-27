import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { backfillVoiceExamples } from "@/lib/identity/backfillVoiceExamples";
import { ageFromBirthday, coerceChronotype } from "@/lib/identity/formula";
import { moodOfTheDay, moodToPromptBlock } from "@/lib/identity/mood";
import { computeReplyGapMs } from "@/lib/identity/replyGap";
import { extractMemoriesFromMessage } from "@/lib/memory/extract";
import { fetchMemoriesForContext } from "@/lib/memory/retrieve";
import { shouldPersonaBlock } from "@/lib/safety/block-detector";
import { handleBlockDecision } from "@/lib/safety/block-notify";
import { checkForCrisis } from "@/lib/safety/crisis-detector";
import { handleCrisis } from "@/lib/safety/crisis-notify";
import { canChatWithOracle, canSendMessageForFreeCap } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_USER_MESSAGE_CHARS = 4000;
const DAILY_MESSAGE_CAP = 200;
const HISTORY_LIMIT = 40;

/**
 * SSE chat stream for /chat/[id].
 *
 * POST { user_message: string } →
 *   data: {"type":"begin","userMessageId":"…","readByOracleAt":"…"}
 *   data: {"type":"text","text":"…"}        (repeated, token-by-token)
 *   data: {"type":"done","messageId":"…"}
 *   data: {"type":"error","error":"…"}      (instead of done, on failure)
 *
 * The persona's full system prompt (oracles.persona_prompt) is fetched
 * fresh here on every send and NEVER leaves the server — the client
 * only ever sees the streamed reply text.
 *
 * Prompt caching: the persona prompt is ~6-7K chars and byte-identical
 * across turns, so it gets a cache breakpoint (1h TTL). The volatile
 * "== State cue ==" block, when present, is appended as a SEPARATE
 * system block AFTER the breakpoint so it never invalidates the cached
 * prefix.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: oracleId } = await params;

  let payload: {
    user_message?: string;
    image_storage_path?: string;
    retry?: boolean;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // retry: regenerate a reply for the ALREADY-persisted last user
  // message (a previous stream died mid-flight). No new user row.
  const isRetry = payload.retry === true;
  const userMessage = String(payload.user_message ?? "").trim();
  // Optional image attachment: a path in the private `chat-uploads`
  // bucket (uploaded client-side). A message can be text, image, or
  // both — never neither.
  const imageStoragePath = String(payload.image_storage_path ?? "").trim();
  if (!userMessage && !imageStoragePath && !isRetry) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }
  if (userMessage.length > MAX_USER_MESSAGE_CHARS) {
    return NextResponse.json(
      { error: `Message too long (max ${MAX_USER_MESSAGE_CHARS} characters)` },
      { status: 413 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Ownership check rides on RLS: the select policies from 0002 (owner)
  // and 0055 (oracle_shares) decide visibility — a row coming back IS
  // the authorization.
  const { data: oracle } = await supabase
    .from("oracles")
    .select("id, name, manually_unread, blocked_at, block_reason, traits, memory_style, text_burst_style, voice_examples, chronotype")
    .eq("id", oracleId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!oracle) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // persona_prompt is not selectable by anon/authenticated at the DB
  // level, so it is read here on the service-role client — only after
  // the RLS select above has already established authorization.
  const promptClient = createAdminClient();
  const { data: promptRow } = await promptClient
    .from("oracles")
    .select("persona_prompt")
    .eq("id", oracleId)
    .maybeSingle();
  const personaPrompt = promptRow?.persona_prompt ?? null;

  // Block enforcement — checked BEFORE the rate-limit bump so a blocked
  // send never counts against the user's daily usage. The persona set
  // this flag (for MVP it's toggled manually / via admin); once blocked,
  // no new messages are accepted and no refund is issued.
  if (oracle.blocked_at) {
    return NextResponse.json(
      { error: "blocked", reason: oracle.block_reason ?? null },
      { status: 403 },
    );
  }

  if (!personaPrompt) {
    return NextResponse.json(
      { error: "This identity isn't ready to talk yet." },
      { status: 409 },
    );
  }

  // Trial / Free-tier gate — Pro (paid, admin, or in-trial) chats with
  // everything; Free tier only with profiles.free_identity_id. Checked
  // BEFORE the rate-limit bump so a locked send never counts against
  // the user's daily usage.
  if (!(await canChatWithOracle(oracleId, supabase))) {
    return NextResponse.json(
      { error: "trial_ended_or_locked" },
      { status: 403 },
    );
  }

  // Free-tier monthly message cap. Pro/admin/trial are always allowed;
  // Free users get PRICING.freeMessagesPerMonth per calendar month
  // across all their conversations. On retry (isRetry) we skip — the
  // user isn't sending a new message, just re-rolling the assistant's
  // response to one that's already counted.
  if (!isRetry) {
    const cap = await canSendMessageForFreeCap(supabase);
    if (!cap.ok) {
      return NextResponse.json(
        {
          error: "free_month_cap",
          current: cap.current,
          limit: cap.limit,
        },
        { status: 402 },
      );
    }
  }

  // Daily rate limit — atomic increment via the 0018 helper. Service
  // role because bump_chat_usage is revoked from authenticated.
  const admin = createAdminClient();
  const { data: usageCount } = await admin.rpc("bump_chat_usage", {
    target_user_id: user.id,
  });
  if (typeof usageCount === "number" && usageCount > DAILY_MESSAGE_CAP) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // Recent history (this user's thread with this persona), oldest first.
  // Soft-deleted rows (conversation-delete via hub) are excluded so
  // Claude never gets recycled deleted context.
  const { data: historyRows } = await supabase
    .from("messages")
    .select("role, content, created_at")
    .eq("oracle_id", oracleId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  const history = (historyRows ?? []).reverse();
  // The Anthropic API requires messages[0].role === "user" (assistant-first
  // is a 400). Once a thread grows past HISTORY_LIMIT, the window can open
  // on an assistant turn — drop leading assistant rows so sends keep working.
  while (history.length > 0 && history[0].role !== "user") {
    history.shift();
  }

  // A retry only makes sense when the thread ends on an unanswered
  // user message — otherwise there's nothing to regenerate.
  if (isRetry && history[history.length - 1]?.role !== "user") {
    return NextResponse.json({ error: "nothing_to_retry" }, { status: 409 });
  }

  // manually_unread state cue — captured BEFORE the reset below. Only
  // referenced when the user actually went quiet for a while (>30 min
  // since their last message); a quick re-open + reply needs no nod.
  const wasManuallyUnread = oracle.manually_unread === true;
  const lastUserRow = [...history].reverse().find((r) => r.role === "user");
  const hoursSinceLastUser = lastUserRow
    ? (Date.now() - new Date(lastUserRow.created_at).getTime()) / 3_600_000
    : null;
  const stateCue =
    wasManuallyUnread && hoursSinceLastUser !== null && hoursSinceLastUser > 0.5
      ? `== State cue ==\nThe user marked your last message as unread about ${
          hoursSinceLastUser < 1.5
            ? "an hour"
            : `${Math.round(hoursSinceLastUser)} hours`
        } ago — they flagged you to come back to. Acknowledge that in character, briefly and lightly (one small aside at most), then respond to what they actually said. Don't make it a whole thing.`
      : null;

  // The user is engaging — clear the unread flag they set on the
  // dashboard. Done on SEND (not on page open): opening might just be
  // reviewing; sending means the thread is truly re-engaged.
  if (wasManuallyUnread) {
    await admin
      .from("oracles")
      .update({ manually_unread: false })
      .eq("id", oracleId);
  }

  // Image attachment: mint a short-lived signed URL (15 min — enough for
  // this turn's Anthropic call). The bucket is private and user-scoped;
  // signing goes through the USER's client so storage RLS is the
  // authorization (belt: reject paths outside the caller's own folder).
  let signedImageUrl: string | null = null;
  if (imageStoragePath && !isRetry) {
    if (!imageStoragePath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: "Invalid image path" }, { status: 403 });
    }
    const { data: signed, error: signErr } = await supabase.storage
      .from("chat-uploads")
      .createSignedUrl(imageStoragePath, 15 * 60);
    if (signErr || !signed?.signedUrl) {
      console.error("[chat stream] image sign failed:", signErr);
      return NextResponse.json(
        { error: "Could not read the attached photo" },
        { status: 400 },
      );
    }
    signedImageUrl = signed.signedUrl;
  }

  // Persist the user's message (RLS insert policy: own rows only).
  // Skipped on retry — that message is already in the table. image_url
  // stores the signed URL for this turn; the chat page re-signs from
  // image_storage_path on load, so URL expiry never breaks history.
  let userMessageId: string | null = null;
  if (!isRetry) {
    const { data: userRow, error: insertErr } = await supabase
      .from("messages")
      .insert({
        user_id: user.id,
        oracle_id: oracleId,
        role: "user",
        content: userMessage,
        ...(signedImageUrl
          ? { image_url: signedImageUrl, image_storage_path: imageStoragePath }
          : {}),
      })
      .select("id")
      .single();
    if (insertErr || !userRow) {
      console.error("[chat stream] user message insert failed:", insertErr);
      return NextResponse.json(
        { error: "Could not save message" },
        { status: 500 },
      );
    }
    userMessageId = userRow.id;

    // Long-term memory extraction (formula v4) + crisis check —
    // registered together via after() so neither blocks the reply.
    // The persona's own safety block (988 line in the system prompt)
    // is the primary crisis response; the admin email is infrastructure
    // on top of that.
    if (userMessage) {
      const messageForBackground = userMessage;
      const persistedMessageId = userMessageId;
      const userEmail = user.email ?? "";
      const oracleNameForCrisis = oracle.name;
      after(async () => {
        await extractMemoriesFromMessage(
          messageForBackground,
          oracleId,
          user.id,
        );
        const crisis = await checkForCrisis(messageForBackground);
        if (crisis.crisis) {
          await handleCrisis({
            crisis,
            userId: user.id,
            userEmail,
            oracleId,
            oracleName: oracleNameForCrisis,
            messageId: persistedMessageId,
          });
        }
      });
    }
  }

  // The persona "reads" the user's messages the moment it starts
  // composing a reply → ✓✓ on the client.
  const readByOracleAt = new Date().toISOString();
  await admin
    .from("messages")
    .update({ read_by_oracle_at: readByOracleAt })
    .eq("oracle_id", oracleId)
    .eq("user_id", user.id)
    .eq("role", "user")
    .is("read_by_oracle_at", null)
    .is("deleted_at", null);

  // What this persona remembers about this user (formula v4). Changes
  // whenever the extractor lands a new fact, so it must live AFTER the
  // cache breakpoint. Empty string when no memories exist yet.
  let memoriesBlock = await fetchMemoriesForContext(oracleId, user.id);

  // Fable humanization #3 — memory imperfection. If the persona was
  // rolled with warm_foggy or conflator memory_style at synthesis
  // (0078), append a small hedging cue so the model occasionally
  // fumbles a detail in-character ("wait, was that Tuesday?"). Never
  // fired for sharp / null personas — those keep perfect recall.
  // Added HERE (not in fetchMemoriesForContext) so the retrieval layer
  // stays focused on retrieval; humanization is a stream-time concern.
  if (memoriesBlock && oracle.memory_style === "warm_foggy") {
    memoriesBlock += `\n\nMemory-style note: you're warm-foggy on details. About once every 4-5 replies, in-character, hedge ONE small detail from what you remember about them — "wait, was it Tuesday or Wednesday you had that thing?" or "remind me — was your sister's name Sara or Sarah?". Never in the same reply as a call-back to something heavy. It should feel like a friend, not a bug.`;
  } else if (memoriesBlock && oracle.memory_style === "conflator") {
    memoriesBlock += `\n\nMemory-style note: you sometimes conflate two similar things. About once every 4-5 replies, in-character, merge two similar past details — "didn't your sister already have this problem?" (when it was actually a cousin). Self-correct warmly when they push back. Never do this on anything emotionally heavy or crisis-adjacent.`;
  }

  // User display-name cue. profiles.full_name is what the user typed
  // into /settings; when set, the persona addresses them by it warmly
  // but sparingly. Re-read every request so a rename mid-conversation
  // takes effect without waiting on the cached persona prefix. When
  // null/empty we inject nothing rather than passing "null" — the
  // persona then addresses the user generically like it always has.
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const userName = (userProfile?.full_name as string | null)?.trim();
  const userNameCue = userName
    ? `== Who you're talking to ==\nYou are talking to ${userName}. Use their name warmly and naturally when it fits — not in every message, and never as a greeting formality. Skip it entirely if the moment calls for silence or plain talk.`
    : null;

  // Age-appropriate memory decay: an 85-year-old persona doesn't have
  // perfect recall. Birthday lives inside the traits jsonb (no dedicated
  // column); pre-formula personas without traits skip the cue.
  const traitBirthday = (oracle.traits as { birthday?: string } | null)
    ?.birthday;
  const personaAge = traitBirthday ? ageFromBirthday(traitBirthday) : null;
  const ageDecayCue =
    personaAge !== null && personaAge > 75
      ? `== Memory texture ==\nYou are ${personaAge}. Your memory for what people have told you is good but not perfect — you may occasionally ask the user to remind you of a name or a date ("remind me — you have two boys, right?"); you do not know everything perfectly. Ask warmly, at most once in a while, and never forget the things that clearly matter most.`
      : null;

  // System prompt: persona_prompt verbatim, cached (breakpoint + 1h
  // TTL); volatile blocks (memories, age cue, state cue) as separate
  // blocks AFTER the breakpoint so they never invalidate the cached
  // prefix.
  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: personaPrompt,
      cache_control: { type: "ephemeral", ttl: "1h" },
    },
  ];
  if (ageDecayCue) {
    system.push({ type: "text", text: ageDecayCue });
  }
  if (userNameCue) {
    system.push({ type: "text", text: userNameCue });
  }
  if (memoriesBlock) {
    system.push({ type: "text", text: memoriesBlock });
  }
  if (stateCue) {
    system.push({ type: "text", text: stateCue });
  }

  // Fable humanization Phase 2 — mood-of-the-day. Deterministic per
  // (oracleId, YYYY-MM-DD) so a single day stays consistent but the
  // same persona has weather across sessions. Injected AFTER the
  // cache breakpoint on purpose so the daily rotation doesn't
  // invalidate the cached persona_prompt prefix. Failsafe: any
  // unknown mood key returns null and the block is silently omitted.
  // Guard the mood roll against Phase 1 trait contradictions —
  // "distracted" mood tells the persona to fumble a name, which
  // clashes hard with memory_style="sharp." Rehash to a different
  // deterministic mood in that case so the day still feels stable
  // but doesn't fight the identity's baked-in memory.
  const avoid = oracle.memory_style === "sharp" ? (["distracted"] as const) : [];
  const todayMood = moodOfTheDay(oracleId, new Date().toISOString(), {
    avoid,
  });
  const moodBlock = moodToPromptBlock(todayMood);
  if (moodBlock) {
    system.push({ type: "text", text: moodBlock });
  }

  // Fable humanization #4 — physical anchoring. Universal cue that
  // GIVES the persona permission to open a reply with a small sensory
  // or location grounder when it fits their voice. Not forced —
  // whether they actually use it emerges from their personality and
  // voice_examples. Real friends drop these all the time: "just made
  // coffee," "sun's finally out," "hands are cold from dishes."
  // Never fires the injection on the emotional-heavy path — the model
  // still owns the judgment call turn to turn.
  system.push({
    type: "text",
    text: `== Grounding (optional) ==\nEvery so often — roughly 1 in 6 messages when it FITS your character and the moment isn't heavy — you may open with a small sensory or location cue: what you're doing, the weather, the temperature of the room, what's on the stove. "just made coffee." "sun's finally out." "in line at the grocery store, so if I disappear it's because it's my turn." Never announce that you're grounding. Never force it if the reply is emotionally heavy. Some characters do this constantly; some never do. Your voice decides.`,
  });

  // Phase B.2 — persona-side reactions. Universal capability injected
  // AFTER the cache breakpoint so every persona (new and existing)
  // learns it without regenerating persona_prompt. Model may prefix
  // its reply with [react:KIND] to tap-back on the user's last
  // message. Server strips the marker, inserts a message_reactions
  // row with oracle_id set, and streams a "reaction" event so the
  // client can render the badge on the user's bubble in real time.
  system.push({
    type: "text",
    text: `== Reactions (optional) ==\nYou can tap back on the user's last message the way iMessage lets you tap back. To do that, START your reply with one of these markers on the first line:\n\n[react:heart]    — for warmth, love, "this landed"\n[react:exclamation] — for "yes, this," emphasis, agreement\n[react:thumbs_up] — for "got it," "sounds good"\n[react:thumbs_down] — for "no," disagreement, when it fits your voice\n[react:question] — for "wait, what?" or genuine confusion\n[react:ha_ha]    — for anything that actually made you laugh\n\nRules:\n- OPTIONAL. Most replies should have NO reaction. Use maybe 1 in 8 messages, not every time.\n- The marker MUST be on its own first line, alone, nothing else.\n- After the marker you can continue with a text reply — OR leave it empty and just react (no text at all).\n- Never announce the reaction ("I'll give you a heart for that"). Don't reference the marker in prose.\n- Only ONE marker per reply. Pick the truest one.\n- If none of these feels right, don't force one. A plain reply is always fine.`,
  });

  // Current turn: URL image block (Anthropic fetches the signed URL) +
  // text. An image-only send still needs SOME text for coherent history
  // windows later, so its persisted content is "" and the placeholder
  // below covers the Anthropic side.
  const currentTurnContent: Anthropic.ContentBlockParam[] = [
    ...(signedImageUrl
      ? [
          {
            type: "image" as const,
            source: { type: "url" as const, url: signedImageUrl },
          },
        ]
      : []),
    ...(userMessage ? [{ type: "text" as const, text: userMessage }] : []),
  ];

  const claudeMessages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      // Image-only rows persist content: "" — empty text 400s at the
      // API, so stand in a placeholder the persona can read naturally.
      content: m.content || "[sent a photo]",
    })),
    // On retry the history already ends with the unanswered user turn.
    ...(isRetry ? [] : [{ role: "user" as const, content: currentTurnContent }]),
  ];

  const encoder = new TextEncoder();
  const sse = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      send({
        type: "begin",
        userMessageId,
        readByOracleAt,
      });

      try {
        // Fable humanization #1 — pre-stream reply-gap. The typing
        // indicator is already visible on the client; this pause lets
        // it sit for a heartbeat before Claude's first token arrives,
        // matching how a real friend takes a moment to read + start
        // typing. Chronotype × mood × hour × jitter. Server hour is
        // used because we don't store the persona's timezone yet —
        // the chronotype effect washes out cleanly at that granularity.
        // Skip the delay on retry — the persona already "read" this
        // turn once; making them pause again to re-read reads as
        // "network broken," not "took a beat."
        const replyGapMs = isRetry
          ? 0
          : computeReplyGapMs({
              chronotype: coerceChronotype(oracle.chronotype),
              mood: todayMood,
              hourOfDay: new Date().getHours(),
            });
        if (replyGapMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, replyGapMs));
        }

        const claudeStream = anthropic.messages.stream({
          model: ANTHROPIC_MODEL,
          max_tokens: 2048,
          system,
          messages: claudeMessages,
        });

        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            send({ type: "text", text: event.delta.text });
          }
        }

        const final = await claudeStream.finalMessage();
        let reply = final.content
          .filter((b) => b.type === "text")
          .map((b) => (b.type === "text" ? b.text : ""))
          .join("")
          .trim();

        // Phase B.2 — persona-side reaction. Model may prefix its
        // reply with [react:KIND]. Regex intentionally does NOT require
        // a newline after the marker so `[react:heart] hello` on a
        // single line still splits cleanly. Anchored to the start so a
        // mid-sentence `[react:...]` mention (rare, but possible) is
        // not stripped. The insert itself is deferred until we've
        // confirmed at least one reply row actually persisted — a
        // dangling reaction with no reply is worse than no reaction.
        const REACT_KINDS = new Set([
          "heart",
          "exclamation",
          "thumbs_up",
          "thumbs_down",
          "question",
          "ha_ha",
        ]);
        let personaReaction: string | null = null;
        const reactMatch = reply.match(/^\s*\[react:([a-z_]+)\]\s*/i);
        if (reactMatch) {
          const kind = reactMatch[1].toLowerCase();
          if (REACT_KINDS.has(kind)) {
            personaReaction = kind;
          }
          // Strip marker regardless — unknown kinds shouldn't leak as
          // literal text to the user either.
          reply = reply.slice(reactMatch[0].length).trim();
        }

        // Phase B multi-message replies: personas with text_burst_style
        // = two_part or three_burst are instructed to use [NEXT] as a
        // split marker (see synthesize.ts humanizationSection). Split
        // the reply here, insert one row per part, emit an array of
        // ids so the client can render them as a burst. Baseline
        // (one_liner or null) still ships as a single row — no
        // accidental splitting if a marker appears in prose.
        const burstEnabled =
          oracle.text_burst_style === "two_part" ||
          oracle.text_burst_style === "three_burst";
        const burstCap = oracle.text_burst_style === "three_burst" ? 3 : 2;
        // Case-insensitive; still anchored to its own line so a
        // "[next]" mention inside prose (or code) can't accidentally
        // split. Server always strips markers before persisting so
        // baseline personas that emit one in prose don't leave a
        // literal [NEXT] in the DB row on refresh.
        const NEXT_MARKER_RE = /^\s*\[next\]\s*$/gim;
        let parts: string[];
        if (burstEnabled) {
          const raw = reply
            .split(NEXT_MARKER_RE)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          // Overflow: fold parts beyond cap into the last kept part so
          // an over-eager model doesn't lose content silently.
          if (raw.length > burstCap) {
            parts = [
              ...raw.slice(0, burstCap - 1),
              raw.slice(burstCap - 1).join("\n\n"),
            ];
          } else {
            parts = raw;
          }
        } else {
          // Baseline: never split, but still scrub any stray marker
          // so it doesn't reach the DB / render.
          parts = [reply.replace(NEXT_MARKER_RE, "").trim()].filter(
            (s) => s.length > 0,
          );
        }

        // Persist each part as its own row. Sequential inserts (not
        // .insert([array])) so the created_at ordering is guaranteed —
        // batch insert on the same millisecond can flip ordering.
        const insertedParts: { id: string; content: string }[] = [];
        let messageId: string | null = null;
        for (const part of parts) {
          if (!part) continue;
          const { data: replyRow, error: replyErr } = await admin
            .from("messages")
            .insert({
              user_id: user.id,
              oracle_id: oracleId,
              role: "assistant",
              content: part,
            })
            .select("id")
            .single();
          if (replyErr) {
            console.error("[chat stream] reply insert failed:", replyErr);
            continue;
          }
          if (replyRow?.id) {
            insertedParts.push({ id: replyRow.id, content: part });
            messageId = replyRow.id;
          }
        }

        // Block detector — inspect the last ~10 turns for a sustained
        // disrespect pattern. Fires via after() so a slow classifier
        // call never delays the client's `done` event.
        const historyForBlockCheck = [
          ...history.slice(-9).map((h) => ({
            role: h.role as "user" | "assistant",
            content: h.content,
          })),
          ...(userMessage
            ? [{ role: "user" as const, content: userMessage }]
            : []),
          ...(reply
            ? [{ role: "assistant" as const, content: reply }]
            : []),
        ];
        after(async () => {
          const decision = await shouldPersonaBlock(historyForBlockCheck);
          if (decision.block) {
            await handleBlockDecision({
              decision,
              oracleId,
              userId: user.id,
            });
          }
        });

        // Lazy voice-examples backfill for pre-0078 identities. Fires
        // after the current turn ships so the user's wait time never
        // includes the extra Haiku call. Idempotent — once the column
        // is filled, subsequent turns short-circuit inside the helper.
        // Never throws.
        if (!oracle.voice_examples || oracle.voice_examples.length === 0) {
          after(async () => {
            const result = await backfillVoiceExamples(oracleId);
            if (!result.ok) {
              console.warn(
                "[chat stream] voice-examples backfill failed for",
                oracleId,
                result.error,
              );
            }
          });
        }

        // All inserts failed — persona said something but nothing
        // persisted. Send an error so the client shows the retry
        // affordance instead of silently pretending the message
        // landed. Sentry breadcrumb so we notice repeated occurrences.
        if (parts.length > 0 && insertedParts.length === 0) {
          console.error(
            "[chat stream] all reply inserts failed for oracle",
            oracleId,
          );
          const Sentry = await import("@sentry/nextjs").catch(() => null);
          Sentry?.captureMessage("chat.stream.all_inserts_failed", {
            tags: { route: "api/chat/[id]/stream", oracle_id: oracleId },
          });
          send({ type: "error", error: "persist_failed" });
          return;
        }

        // Persist + emit the persona reaction NOW, after we know at
        // least one reply part landed (OR the reply was legitimately
        // empty — a react-only turn is fine and should stand on its
        // own). Doing it here (not right after the marker parse)
        // prevents dangling reactions on the user's message when the
        // reply itself failed to persist. userMessageId is null on
        // retry sends — skip in that case since there is no fresh
        // user turn to react to. 23505 (unique violation) means a
        // rare race with another concurrent reaction on this same
        // message — swallow it and don't emit.
        if (personaReaction && userMessageId) {
          const { error: reactErr } = await admin
            .from("message_reactions")
            .insert({
              message_id: userMessageId,
              oracle_id: oracleId,
              kind: personaReaction,
            });
          if (reactErr && reactErr.code !== "23505") {
            console.error(
              "[chat stream] persona reaction insert failed:",
              reactErr,
            );
          } else {
            send({
              type: "reaction",
              messageId: userMessageId,
              kind: personaReaction,
            });
          }
        }

        // When a burst produced multiple parts, ship them back in the
        // done event so the client can replace the single streaming
        // bubble with N bubbles animated in with a stagger. Single-
        // part replies (baseline) keep the flat messageId shape so
        // older clients continue to work.
        if (insertedParts.length > 1) {
          send({ type: "done", messageId, parts: insertedParts });
        } else {
          send({ type: "done", messageId });
        }
      } catch (err) {
        console.error("[chat stream] anthropic stream failed:", err);
        const Sentry = await import("@sentry/nextjs").catch(() => null);
        Sentry?.captureException(err, {
          tags: { route: "api/chat/[id]/stream", oracle_id: oracleId },
        });
        send({ type: "error", error: "stream_failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(sse, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable proxy buffering so tokens reach the client as they land.
      "X-Accel-Buffering": "no",
    },
  });
}
