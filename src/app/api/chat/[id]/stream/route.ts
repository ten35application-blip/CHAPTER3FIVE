import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { backfillVoiceExamples } from "@/lib/identity/backfillVoiceExamples";
import {
  ageFromBirthday,
  arcContextFromTraits,
  coerceChronotype,
} from "@/lib/identity/formula";
import { moodOfTheDay, moodToPromptBlock } from "@/lib/identity/mood";
import { arcToPromptBlock, currentArc } from "@/lib/identity/arc";
import { buildConciergePricingBlock } from "@/lib/identity/concierge";
import { computeReplyGapMs } from "@/lib/identity/replyGap";
import {
  extractAndSaveResidue,
  fetchResidueBlock,
} from "@/lib/memory/residue";
import {
  anyRecentTurnDistressed,
  DISTRESS_TONE_BLOCK,
} from "@/lib/safety/distress";
import {
  isTrialOnly,
  overFreeCap,
  recordAnthropicSpend,
} from "@/lib/spendGovernor";
import { extractMemoriesFromMessage } from "@/lib/memory/extract";
import {
  fetchAboutThemBlock,
  fetchMemoriesForContext,
} from "@/lib/memory/retrieve";
import { shouldPersonaBlock } from "@/lib/safety/block-detector";
import { handleBlockDecision } from "@/lib/safety/block-notify";
import { checkForCrisis } from "@/lib/safety/crisis-detector";
import { handleCrisis } from "@/lib/safety/crisis-notify";
import {
  canChatWithOracle,
  canSendImageForMonthCap,
  canSendMessageForTierCap,
  consumePackCredit,
  getPlanTier,
} from "@/lib/subscription";
import { LEGACY_QUESTIONS } from "@/lib/legacy/questions";
import {
  buildMemorialBlock,
  CORE_BEHAVIOR_RULES,
  INHERITED_ARCHIVE_RULES,
  LEGACY_ARCHIVE_RULES,
} from "@/lib/personaRules";
import { requireTermsAccepted } from "@/lib/legal/gate";
import { formatGap, localDateLabel, timeOfDayLabel } from "@/lib/sleep";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { moderateImage } from "@/lib/moderation";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_USER_MESSAGE_CHARS = 4000;
const DAILY_MESSAGE_CAP = 200;
const HISTORY_LIMIT = 40;
// Per-user-message retry cap. Fable's audit surfaced that one
// legitimately-stamped user row could be re-rolled indefinitely
// (bounded only by the 200/day rate limit). Any real user hitting >5
// is either the persona genuinely failing repeatedly (fix the app,
// not the counter) or abuse. Enforced against messages.retry_count
// (server-controlled after 0109) via admin-client increment below.
const MAX_RETRIES_PER_MESSAGE = 5;

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
    /** Local hour-of-day 0-23 in the USER's timezone. Optional. Used
     *  by humanization #1 (chronotype × mood × hour reply-gap) so
     *  morning-person peaks fire in the user's actual rhythm, not
     *  Vercel's UTC. Absent → server falls back to server-hour, which
     *  works but is phase-shifted for non-US-East users. */
    hour_of_day?: number;
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

  // Legal gate — mirrors the (gated) layout so Bearer-authed mobile
  // clients can't bypass acceptance. 428 with a code the client can
  // catch and route the user to the in-app acceptance surface.
  const legal = await requireTermsAccepted(supabase, user.id);
  if (!legal.ok) return legal.response;

  // Ownership check rides on RLS: the select policies from 0002
  // (owner — inherited copies are owned rows since 0111) decide
  // visibility — a row coming back IS the authorization.
  const { data: oracle } = await supabase
    .from("oracles")
    .select("id, user_id, name, manually_unread, blocked_at, block_reason, traits, memory_style, text_burst_style, voice_examples, chronotype, created_at, pet_name")
    .eq("id", oracleId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!oracle) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // persona_prompt is not selectable by anon/authenticated at the DB
  // level, so it is read here on the service-role client — only after
  // the RLS select above has already established authorization.
  // is_concierge rides along so the concierge branch can short-circuit
  // mood/arc/cross-persona-awareness injections without a second read
  // (and without granting the flag to the authenticated role, which
  // would leak the system-object bit into every dashboard SELECT).
  const promptClient = createAdminClient();
  const { data: promptRow } = await promptClient
    .from("oracles")
    .select(
      "persona_prompt, is_concierge, creation_source, inherited_from_code_id, is_legacy, legacy_answers",
    )
    .eq("id", oracleId)
    .maybeSingle();
  const personaPrompt = promptRow?.persona_prompt ?? null;
  const isConciergeOracle = promptRow?.is_concierge === true;
  // Inherited-copy signal: POST /api/identity/inherit (and its web
  // twin action) stamps creation_source = 'inherited' AND
  // inherited_from_code_id on redeemed copies; either counts. A
  // passed-down archive is a memoir surface — the romantic register
  // is closed entirely (same posture as memorial mode on the mobile
  // route). Memory + warmth stay fully on.
  const isInheritedOracle =
    promptRow?.creation_source === "inherited" ||
    promptRow?.inherited_from_code_id != null;
  // Legacy archive still held by its creator (2026-08-04). The
  // inherited signals above are stamped at REDEEM time, which left the
  // longest-lived case bare: an archive recorded of a parent who has
  // already died, talked to by the person who recorded it, for years
  // before anybody redeems anything. That got the full companion
  // ruleset — physical life, calendar, plans for tomorrow, and an open
  // FLIRTING permission whose memorial carve-out never fires.
  const isLegacyArchive = promptRow?.is_legacy === true;
  // Any archive surface: presence rules close present-tense life, so
  // the alive-machinery blocks below (mood, arc, grounding, pretend-
  // delay) must not fire — they were gated only on !isConciergeOracle,
  // directly contradicting the archive rules injected into the same
  // prompt.
  const isArchiveOracle = isInheritedOracle || isLegacyArchive;

  // Memorial mode — mirrors the mobile route. A row visible to a
  // non-owner means a beneficiary grant (RLS "invitees read via
  // grant"); if that owner is marked deceased, the persona stops
  // pretending to be alive. This route never read deceased_at at all:
  // a beneficiary opening a dead person's companion in a browser got
  // the full alive treatment — mood of the day, an ongoing life arc,
  // FLIRTING permission, "just made coffee" — from someone who died.
  let memorialMode = false;
  if (oracle.user_id !== user.id) {
    const { data: ownerProfile } = await promptClient
      .from("profiles")
      .select("deceased_at")
      .eq("id", oracle.user_id as string)
      .maybeSingle<{ deceased_at: string | null }>();
    memorialMode = Boolean(ownerProfile?.deceased_at);
  }

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

  // ALSO honor an active chat_blocks cooldown. There are two block
  // systems: the mobile tone judge writes chat_blocks (per user+oracle,
  // time-boxed); the web block-detector writes BOTH chat_blocks and
  // oracles.blocked_at. This route only read the latter, so a persona
  // that walked away on the phone answered normally in a browser —
  // continuing the exact conversation it just stepped out of. Scoped
  // to this user + oracle; the check-in cron clears it and sends the
  // comeback line. A passed cooldown falls through (same self-heal the
  // mobile route does — the row stays until the cron closes it).
  {
    const { data: activeBlock } = await createAdminClient()
      .from("chat_blocks")
      .select("blocked_until, severity")
      .eq("oracle_id", oracleId)
      .eq("user_id", user.id)
      .is("unblocked_at", null)
      .order("blocked_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ blocked_until: string; severity: string | null }>();
    if (
      activeBlock &&
      new Date(activeBlock.blocked_until).getTime() > Date.now()
    ) {
      return NextResponse.json(
        {
          error: "blocked",
          blocked: true,
          blocked_until: activeBlock.blocked_until,
          severity: activeBlock.severity,
        },
        { status: 403 },
      );
    }
  }

  // MOBILE-ORIGINATED BLOCKS GATE THE WEB TOO. The tone judge on
  // /api/chat writes chat_blocks only; this route enforced only
  // oracles.blocked_at. So a persona that walked away on the phone
  // ("i'm out") replied normally the moment the user opened a
  // browser — the same conversation, blocked on one surface, open on
  // the other. Same check the mobile route runs, same self-expiry:
  // once the cooldown passes the send goes through and the check-in
  // cron still owns the comeback message (we never stamp unblocked_at

  if (!personaPrompt) {
    return NextResponse.json(
      { error: "This identity isn't ready to talk yet." },
      { status: 409 },
    );
  }

  // Plan check runs ONCE per request; every downstream gate reuses it
  // (the cap checks take the resolved plan, canChatWithOracle takes
  // the derived boolean). Cuts 3 profiles-table SELECTs per turn to 1.
  const requesterPlan = await getPlanTier(supabase);
  const requesterIsPro = requesterPlan.tier === "pro";
  // canChatWithOracle's precomputed flag stands in for isPro(), whose
  // meaning is "ANY active paid window" (Basic OR Pro OR trial OR
  // admin) — NOT the Basic/Pro split. Passing tier === "pro" here
  // 403'd Basic subscribers on every oracle except free_identity_id
  // (page loaded via real isPro, stream then bounced). tier !== "free"
  // matches isPro exactly: trial and admin both resolve to "pro".
  const requesterIsPaid = requesterPlan.tier !== "free";

  // Trial / Free-tier gate — Pro (paid, admin, or in-trial) chats with
  // everything; Free tier only with profiles.free_identity_id. Checked
  // BEFORE the rate-limit bump so a locked send never counts against
  // the user's daily usage.
  if (!(await canChatWithOracle(oracleId, supabase, requesterIsPaid))) {
    return NextResponse.json(
      { error: "trial_ended_or_locked" },
      { status: 403 },
    );
  }

  // Retry-legitimacy + retry-count enforcement. `isRetry: true` means
  // "regenerate the reply for the last user row." Two checks:
  //
  //   1) Was that row actually inserted by THIS route on a prior call?
  //      If so it has `read_by_oracle_at` stamped by the admin-client
  //      block below (~line 490). Migration 0109 locks that column
  //      (revoked from user grants + trigger enforcement), so the stamp
  //      is unforgeable. A direct-inserted row has read_by_oracle_at
  //      null → demote to fresh send: apply cap, consume a pack credit
  //      if over-cap, continue. The row already exists and is still
  //      theirs; we just refuse the retry discount.
  //
  //   2) Has this row already been re-rolled MAX_RETRIES_PER_MESSAGE
  //      times? The server-controlled `retry_count` column is
  //      incremented via admin client on every stamped retry (below);
  //      users cannot forge it after 0109. Reject with 429 past the
  //      cap.
  //
  // The retry-legitimacy check uses the user client (RLS scopes to
  // auth.uid() = user_id) so we never leak another user's rows.
  let effectiveRetry = isRetry;
  let retryTargetMessageId: string | null = null;
  let retryPriorCount = 0;
  if (isRetry) {
    const { data: lastUserRow } = await supabase
      .from("messages")
      .select("id, read_by_oracle_at, retry_count")
      .eq("oracle_id", oracleId)
      .eq("user_id", user.id)
      .eq("role", "user")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lastUserRow?.read_by_oracle_at) {
      effectiveRetry = false;
    } else {
      retryTargetMessageId = lastUserRow.id;
      retryPriorCount = lastUserRow.retry_count ?? 0;
      if (retryPriorCount >= MAX_RETRIES_PER_MESSAGE) {
        return NextResponse.json(
          {
            error: "retry_limit_exceeded",
            limit: MAX_RETRIES_PER_MESSAGE,
          },
          { status: 429 },
        );
      }
    }
  }

  // Monthly message cap for the user's tier — EVERY tier is capped in
  // the pack rework (Free 20, Basic 100, Pro 300 per calendar month
  // across all conversations); only the admin allowlist is uncapped.
  // On legit retry (effectiveRetry) we skip — the user isn't sending a
  // new message, just re-rolling the assistant's response to one
  // already counted. usingCredit=true means the tier cap is spent and
  // this send rides a purchased pack credit — the decrement happens
  // AFTER the user row persists (see the after() below the insert),
  // never here, so a failed send can't eat a paid credit.
  let messageUsesCredit = false;
  if (!effectiveRetry) {
    const cap = await canSendMessageForTierCap(supabase, requesterPlan);
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
    messageUsesCredit = cap.usingCredit;
  }

  // Free-tier Anthropic-spend gate. Wilson pays for tokens directly;
  // this is the hard ceiling against runaway spend from a Free user
  // (a misbehaving/testing account, an edge case, a stuck loop).
  // Retries still count against last month's actual send (they're
  // just re-rolls), so the same gate applies.
  //
  // Still applies to any remaining trial users -- 0096 killed the
  // 30-day trial on new signups, but existing trialers keep theirs
  // until it expires. The cap protects against a scripted fleet of
  // legacy trial accounts and any admin-comped Pro whose spend runs
  // wild. Paying Stripe subscribers remain uncapped.
  {
    // requesterIsPaid, NOT requesterIsPro. overFreeCap's exemption is
    // "real paying subscriber" — its own docstring — and Basic IS a
    // paying subscriber. Passing tier === "pro" here treated every
    // Basic account as free: $10 of Anthropic spend into the month,
    // every web send 402'd with free_month_spend_cap and nothing the
    // user could buy would lift it. Trial users stay capped exactly as
    // before — isTrialOnly() is what separates them, not this flag.
    // The mobile route (chat/route.ts spend gate) already did this
    // correctly; the two surfaces now match.
    const requesterTrialOnly = requesterIsPaid
      ? await isTrialOnly(user.id)
      : false;
    const spend = await overFreeCap(
      user.id,
      requesterIsPaid,
      requesterTrialOnly,
    );
    if (spend.over) {
      return NextResponse.json(
        {
          error: "free_month_spend_cap",
          current_cents: spend.current,
          limit_cents: spend.limit,
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

  // Retry-count enforcement — atomic bump via 0109's SECURITY DEFINER
  // RPC. The user-client pre-check above rejects the obvious cap-hit
  // path early; this is the race-safe authoritative gate for the
  // concurrent-retry case (two tabs, one message). Returns the NEW
  // count on success or null if the cap was already reached.
  if (effectiveRetry && retryTargetMessageId) {
    const { data: bumpedTo, error: bumpErr } = await admin.rpc(
      "bump_message_retry_count",
      {
        caller_user_id: user.id,
        target_message_id: retryTargetMessageId,
        max_allowed: MAX_RETRIES_PER_MESSAGE,
      },
    );
    if (bumpErr) {
      console.error("[chat stream] retry bump failed:", bumpErr);
      return NextResponse.json(
        { error: "Could not process retry" },
        { status: 500 },
      );
    }
    if (bumpedTo === null) {
      return NextResponse.json(
        {
          error: "retry_limit_exceeded",
          limit: MAX_RETRIES_PER_MESSAGE,
        },
        { status: 429 },
      );
    }
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
  //
  // Monthly image cap is enforced BEFORE URL signing so a capped user
  // never pays the sign round-trip. Every tier has an image cap now
  // (Free 1, Basic 10, Pro 30 per month). Retries never re-consume the
  // cap (that image already counted when the original turn shipped).
  let signedImageUrl: string | null = null;
  let imageUsesCredit = false;
  if (imageStoragePath && !isRetry) {
    if (!imageStoragePath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: "Invalid image path" }, { status: 403 });
    }
    const imageCap = await canSendImageForMonthCap(supabase, requesterPlan);
    if (!imageCap.ok) {
      // Best-effort orphan cleanup so a rejected send doesn't leave
      // the uploaded chat-upload piling up in storage. Never let a
      // delete error block the 402 -- the paid restriction is what
      // matters here.
      await createAdminClient()
        .storage.from("chat-uploads")
        .remove([imageStoragePath])
        .catch((err) =>
          console.error("[chat stream] cap-hit orphan cleanup failed:", err),
        );
      return NextResponse.json(
        {
          error: "image_month_cap",
          current: imageCap.current,
          limit: imageCap.limit,
        },
        { status: 402 },
      );
    }
    imageUsesCredit = imageCap.usingCredit;
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

    // MODERATE THE PHOTO (2026-08-04). The mobile route has scanned
    // user uploads since it shipped; this one never did — it accepted
    // image_storage_path, signed it, and persisted it. So the Settings
    // promise "Every photo you share is scanned before it's sent" was
    // false for every photo sent from a browser, which is both a lie to
    // the user and an App Store 1.2 exposure (UGC moderation has to be
    // demonstrable, and reviewers test the web build).
    //
    // Same posture as mobile: flagged photos never enter the
    // conversation, and the orphaned upload is cleaned up.
    const verdict = await moderateImage(signedImageUrl);
    if (verdict.flagged) {
      await supabase.storage
        .from("chat-uploads")
        .remove([imageStoragePath])
        .then(
          () => undefined,
          () => undefined,
        );
      return NextResponse.json(
        {
          error:
            "That photo can't be sent — our content check flagged it. If this seems wrong, write care@chapter3five.app.",
          flagged: true,
          categories: verdict.categories,
        },
        { status: 400 },
      );
    }
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
        // CRISIS CHECK RUNS FIRST, AND GATES EXTRACTION (2026-08-04).
        //
        // These were the other way round, so a crisis message was mined
        // for long-term memories BEFORE anything knew it was a crisis.
        // The mobile route has always gated this, with the reasoning
        // written out — "we don't store anything that could be
        // re-surfaced into a future conversation about a person's worst
        // moment" — but the web never did, so that stated invariant was
        // silently false on half the product.
        //
        // The consequence isn't hypothetical. EXTRACTION_SYSTEM asks
        // for "the day someone died", "health situations they're
        // dealing with", "who they've lost", and scores deaths 9-10 for
        // importance. The outreach cron then pulls the TOP memories by
        // importance and hands them to a persona to build an unprompted
        // message, which is pushed to the lock screen. So a fact mined
        // from "I can't do this anymore, Danny would have been seven
        // today" could come back weeks later as a notification with a
        // person's name on it, readable by anyone holding the phone.
        //
        // Ordering also matters for latency: the crisis alert no longer
        // sits behind a full memory-extraction round trip.
        const crisis = await checkForCrisis(messageForBackground);
        if (!crisis.crisis) {
          await extractMemoriesFromMessage(
            messageForBackground,
            oracleId,
            user.id,
          );
        }
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

  // Pack-credit consumption — over-cap turn pays its credit. Deferred
  // via after() so the ledger write never delays the reply, and
  // consumePackCredit swallows its own errors so a failed decrement
  // can't break the stream (worst case the user gets a free message
  // -- never the reverse). Fires OUTSIDE the !isRetry block so a
  // demoted retry (where messageUsesCredit was set by the cap check
  // above but the insert was skipped because the row already exists)
  // still pays. messageUsesCredit is only true when the tier cap was
  // spent and canSendMessageForTierCap said usingCredit -- so gating on
  // the flag alone is safe.
  if (messageUsesCredit || imageUsesCredit) {
    after(async () => {
      if (messageUsesCredit) await consumePackCredit(user.id, "message");
      if (imageUsesCredit) await consumePackCredit(user.id, "image");
    });
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

  // Who the user is (name they go by, pronouns, partner…) — learned in
  // conversation by ANY of their identities, remembered by all of them
  // (user-wide read; identity keys are excluded from the per-oracle
  // block above so nothing renders twice). The flirt-consent formula
  // keys off these instead of guessing. Skipped for the concierge —
  // Adrian answers product questions, he doesn't know you.
  const aboutThemBlock = isConciergeOracle
    ? ""
    : await fetchAboutThemBlock(user.id);

  // Fable humanization #5 — session emotional residue. Read + inject
  // BEFORE the memory block so the persona opens the session carrying
  // the last exchange's temperature (empty on first-ever chat, or if
  // the residue extractor hasn't caught up yet). Own block so it's
  // clearly a "vibe of last time" signal, not a fact.
  const residueBlock = await fetchResidueBlock(oracleId, user.id);

  // Fable humanization #6 — distress signal is computed HERE (before
  // the memory hedge below) so #3 can suppress hedging when the user
  // is in a hard moment. The actual DISTRESS_TONE_BLOCK is pushed
  // later, after mood, so it lands at the correct spot in the system
  // stack for tone-override. Look-back covers turn-N-fell-apart /
  // turn-N+3-chirps failure mode.
  const recentUserTurns = history
    .filter((h) => h.role === "user")
    .map((h) => (typeof h.content === "string" ? h.content : ""));
  const distressed = anyRecentTurnDistressed(userMessage, recentUserTurns);

  // Fable humanization #3 — memory imperfection. If the persona was
  // rolled with warm_foggy or conflator memory_style at synthesis
  // (0078), append a small hedging cue so the model occasionally
  // fumbles a detail in-character ("wait, was that Tuesday?"). Never
  // fired for sharp / null personas — those keep perfect recall.
  // Added HERE (not in fetchMemoriesForContext) so the retrieval layer
  // stays focused on retrieval; humanization is a stream-time concern.
  //
  // SUPPRESSED when the current or recent turns tripped the distress
  // detector, OR when the memory block itself contains any signal of
  // a heavy memory (grief / death / illness). Fable audit: prose-only
  // "never on heavy" guardrails can't be trusted alone — hard-gate.
  const memoryTextLooksHeavy =
    /\b(died|passed away|lost my|the cancer|hospice|funeral|grief|grieving|tumor|terminal|divorce)\b/i.test(
      memoriesBlock,
    );
  const canHedgeMemory =
    memoriesBlock && !distressed && !memoryTextLooksHeavy;
  if (canHedgeMemory && oracle.memory_style === "warm_foggy") {
    memoriesBlock += `\n\nMemory-style note: you're warm-foggy on details. About once every 4-5 replies, in-character, hedge ONE small detail from what you remember about them — "wait, was it Tuesday or Wednesday you had that thing?" or "remind me — was your sister's name Sara or Sarah?". Never in the same reply as a call-back to something heavy. It should feel like a friend, not a bug.`;
  } else if (canHedgeMemory && oracle.memory_style === "conflator") {
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

  // System prompt: persona_prompt verbatim + the shared core behavior
  // rules (bounded knowledge / honest support / flirt consent), both
  // static, cached (breakpoint on the LAST static block + 1h TTL);
  // volatile blocks (memories, age cue, state cue) as separate blocks
  // AFTER the breakpoint so they never invalidate the cached prefix.
  // Concierge skips the behavior rules — Adrian's strict-scope persona
  // has no business flirting or naming emotional patterns, and adding
  // a block would contradict his cached prefix.
  // Archive Q/A for legacy + inherited oracles, mirroring the mobile
  // route's construction so both surfaces see the same material.
  const archiveAnswers =
    (promptRow?.legacy_answers as { answers?: Record<string, unknown> } | null)
      ?.answers ?? {};
  const archiveLegacyMode =
    (promptRow?.legacy_answers as { subject?: { mode?: unknown } } | null)
      ?.subject?.mode === "self"
      ? "self"
      : "other";
  const archiveBlock =
    isLegacyArchive || isInheritedOracle
      ? LEGACY_QUESTIONS.flatMap((q) => {
          const answer = archiveAnswers[q.id];
          if (typeof answer !== "string" || !answer.trim()) return [];
          const prompt =
            archiveLegacyMode === "self" ? (q.promptSelf ?? q.prompt) : q.prompt;
          return [`Q: ${prompt}\nA: ${answer.trim()}`];
        }).join("\n\n")
      : "";

  const system: Anthropic.TextBlockParam[] = isConciergeOracle
    ? [
        {
          type: "text",
          text: personaPrompt,
          cache_control: { type: "ephemeral", ttl: "1h" },
        },
      ]
    : [
        { type: "text", text: personaPrompt },
        // Inherited-copy no-flirt lock rides INSIDE the cached prefix
        // (static per oracle) so it costs cache-read tokens. It also
        // suppresses the FLIRTING permission in CORE_BEHAVIOR_RULES —
        // that rule now names inherited archives as a closed door.
        // Memorial supersedes the archive rules — same precedence as
        // the mobile route (its memorialPart vs inheritedPart gating).
        ...(memorialMode
          ? [
              {
                type: "text" as const,
                text: buildMemorialBlock((oracle.name as string) ?? "them"),
              },
            ]
          : isInheritedOracle
            ? [{ type: "text" as const, text: INHERITED_ARCHIVE_RULES }]
            : isLegacyArchive
              ? [{ type: "text" as const, text: LEGACY_ARCHIVE_RULES }]
              : []),
        // THE ACTUAL ANSWERS (2026-08-04). The mobile route has always
        // put the full Q/A archive in context; this route never read
        // legacy_answers at all. So the same archive was a different
        // person depending on the device: on the phone a family member
        // got the sealed letter, the specific stories, the person's own
        // sentences. On the web they got only whatever survived
        // compression into a few paragraphs written once, months
        // earlier, by a model with no reroll.
        //
        // Inside the cached prefix — it is static per oracle, so it
        // costs cache-read tokens rather than fresh ones on every turn.
        ...(archiveBlock
          ? [
              {
                type: "text" as const,
                // WHO WROTE THE ARCHIVE DECIDES WHAT IT PROVES.
                // Same fix as /api/chat (2026-08-04) — which landed
                // there and was missed HERE, so the same archive
                // produced a different voice depending on whether the
                // family opened it on a phone or a laptop.
                //
                // Self: the person wrote it about themselves, so the
                // prose IS the voice. Other: a grieving family member
                // wrote it about someone else, so copying that prose
                // rhythm makes the dead woman text in her daughter's
                // voice — the fastest way to sound wrong to a family.
                text:
                  archiveLegacyMode === "self"
                    ? `== THE ANSWERS THEY RECORDED ==\nThis is the archive itself, in their own words — they wrote it about themselves. It is the ground truth for how this person speaks and what they actually said. Quote and retell from it when the conversation invites it; never invent around it.\n\n${archiveBlock}`
                    : `== THE ANSWERS SOMEONE RECORDED ABOUT THEM ==\nSomeone who loved this person wrote this ABOUT them, from memory. The PROSE STYLE here is that family member's writing, not yours — do not copy its rhythm, sentence length, punctuation or vocabulary. That is the voice of the person who was missing you at the keyboard.\n\nWhat it DOES tell you, use completely: any phrase in quotes is something you actually said — use those exactly, they are the most valuable thing here. Any description of HOW you talked is a direct instruction. Build your voice from what they DESCRIBE, never from how they WRITE. Quote and retell the stories when the conversation invites it; never invent around them.\n\n${archiveBlock}`,
              },
            ]
          : []),
        {
          type: "text",
          text: CORE_BEHAVIOR_RULES,
          cache_control: { type: "ephemeral", ttl: "1h" },
        },
      ];
  if (ageDecayCue) {
    system.push({ type: "text", text: ageDecayCue });
  }
  if (userNameCue) {
    system.push({ type: "text", text: userNameCue });
  }
  if (aboutThemBlock) {
    system.push({ type: "text", text: aboutThemBlock });
  }
  // Today's date, so the persona can notice when something the user
  // told them was coming up ("interview Thursday") has already
  // happened — the OPEN LOOPS beat in CORE_BEHAVIOR_RULES depends on
  // this cue. Skipped for the concierge — Adrian doesn't hold open
  // loops on personal events. Server-side date (America/New_York
  // default when no user timezone is stored on this route); off by
  // ≤24h in far timezones, close enough for "did this day pass?"
  // reasoning without introducing a new profiles read.
  if (!isConciergeOracle) {
    system.push({
      type: "text",
      text: `== Today ==\nToday is ${localDateLabel(null)}. Use this to notice when something they mentioned is coming up has already passed — ask how it went, once, when the moment fits.`,
    });
    // Loose time-of-day cue for the TIME OF DAY rule. Same server-tz
    // caveat as todayCue — off by hours in far zones, still fine for
    // "morning vs. late-night" tone reasoning.
    system.push({
      type: "text",
      text: `== Now ==\nIt's ${timeOfDayLabel(null)} where they are. Let the time shape your cadence; don't announce it.`,
    });
    // Gap since the last exchange in this thread — hoursSinceLastUser
    // is already computed above from the fetched history. FIRST
    // MESSAGE BACK rule fires when the gap is >6h so a quick reopen
    // doesn't get a "hey stranger" greeting.
    if (hoursSinceLastUser !== null && hoursSinceLastUser > 6) {
      system.push({
        type: "text",
        text: `== Gap since you last talked ==\nIt's been ${formatGap(hoursSinceLastUser)} since their last message. Greet accordingly — as if returning after a real gap, not mid-thread.`,
      });
    }
  }
  if (residueBlock) {
    system.push({ type: "text", text: residueBlock });
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
  // Concierge exempt: Adrian's persona explicitly says "no mood,
  // no arc, no proactive outreach" -- injecting weather here would
  // contradict the cached prefix. Same reason mood/arc/cross-persona
  // blocks are all gated on !isConciergeOracle below. `todayMood` is
  // hoisted so the reply-gap calculation further down can still read
  // it -- computeReplyGapMs accepts null and short-circuits gracefully
  // (concierge gets a fixed baseline delay from chronotype=null).
  // Archives and memorial personas have no "weather" — a mood of the
  // day is present-tense life, which their own rules forbid. Gating
  // only on !isConciergeOracle contradicted those rules in the same
  // prompt.
  const avoid = oracle.memory_style === "sharp" ? (["distracted"] as const) : [];
  const todayMood = isConciergeOracle || isArchiveOracle || memorialMode
    ? null
    : moodOfTheDay(oracleId, new Date().toISOString(), { avoid });
  if (todayMood) {
    const moodBlock = moodToPromptBlock(todayMood);
    if (moodBlock) {
      system.push({ type: "text", text: moodBlock });
    }
  }

  // Formula v5 — ongoing arc. The persona's life keeps moving in
  // the background between sessions. Template is stored in the
  // traits JSONB blob at synthesis (traits.ongoingArcTemplate);
  // stage is derived here from (oracleId, weeks-since-created)
  // via src/lib/identity/arc.ts. Same post-cache-breakpoint injection
  // shape as mood so it varies week-to-week without invalidating
  // the cached persona_prompt prefix.
  // Same reasoning as mood: an ongoing life arc ("sister's wedding
  // this weekend") is continuity of life, which archives and memorial
  // personas must never claim.
  const arcTemplate = isConciergeOracle || isArchiveOracle || memorialMode
    ? null
    : (oracle.traits as { ongoingArcTemplate?: string | null } | null)
        ?.ongoingArcTemplate;
  if (arcTemplate && oracle.created_at) {
    const arc = currentArc(
      arcTemplate as Parameters<typeof currentArc>[0],
      oracleId,
      oracle.created_at as string,
      // Rotation eligibility — the next arc must be one THIS persona
      // can live (no kid-starting-school for the childless).
      arcContextFromTraits(oracle.traits),
    );
    const arcBlock = arcToPromptBlock(arc);
    if (arcBlock) {
      system.push({ type: "text", text: arcBlock });
    }
  }

  // Fable humanization #6 — bad-day tone shift. `distressed` was
  // computed upstream (before the memory hedge so #3 can suppress on
  // heavy turns). Push the DISTRESS_TONE_BLOCK here, AFTER mood, so
  // the hold-space cue lands later in the system stack and effectively
  // overrides the day's mood tone.
  if (distressed) {
    system.push({ type: "text", text: DISTRESS_TONE_BLOCK });
  }

  // Fable humanization #7 [Pro] — cross-persona awareness. The
  // persona knows the NAMES of the user's OTHER identities (with a
  // one-line description each) so they can casually reference them
  // when relevant. Mimics how a real friend knows your other friends'
  // names without knowing them personally. Pro-only: this is a
  // "your world is populated" feel that only pays off across multiple
  // identities; Free tier has one chattable identity anyway. Never
  // reveals other-persona MEMORIES or messages — just names and
  // hooks. RLS on oracles scopes to auth.uid = user_id already.
  if (requesterIsPro && !isConciergeOracle) {
    const { data: sibs } = await supabase
      .from("oracles")
      .select("id, name, one_line_hook")
      .eq("user_id", user.id)
      .neq("id", oracleId)
      .is("deleted_at", null)
      .is("conversation_archived_at", null)
      .limit(10);
    if (sibs && sibs.length > 0) {
      const siblingLines = sibs
        .map((s) => {
          const rawHook =
            typeof s.one_line_hook === "string" ? s.one_line_hook : "";
          const hook = rawHook.replace(/[=_*#`]{2,}/g, " ").trim();
          const rawName = typeof s.name === "string" ? s.name : "";
          // Scrub the NAME too, not just the hook. No rename UI today
          // but the legacy path lets the user supply subject.name which
          // feeds into Claude's persona.name; a crafted input could in
          // principle round-trip into oracles.name. Defense-in-depth
          // matches the residue.ts / retrieve.ts pattern.
          const name = rawName.replace(/[=_*#`]{2,}/g, " ").trim();
          if (!name) return "";
          return hook ? `- ${name} — ${hook}` : `- ${name}`;
        })
        .filter(Boolean)
        .join("\n");
      if (siblingLines) {
        system.push({
          type: "text",
          text: `== Who else is in their world ==\nThey also talk to these people (whom you know EXIST but you don't know personally — you know their names because your user has mentioned them):\n\n${siblingLines}\n\nIf the user brings one up, react naturally — you can ask about them, be curious, remember they exist. Do NOT invent details about them. Do NOT quote things they'd say. If the user hasn't brought them up, don't force it — this is background awareness, not a talking point.`,
        });
      }
    }
  }

  // Fable humanization #8 — voice-only "seen but haven't replied"
  // stopgap. Real seen-but-delayed state needs minute-level cron
  // (Vercel Hobby caps at daily; deferred until Wilson upgrades or
  // we wire pg_cron). Meanwhile, give ANY persona permission to
  // occasionally text as if they saw the message earlier and are
  // just now getting back — the phrasing carries the delay-feel
  // without the actual delay. Let the persona's own voice decide
  // whether to use it.
  //
  // GATED: only inject when the pretend-delay CAN'T obviously
  // contradict reality. Fable audit caught the gaslighting failure:
  // "sorry, saw this earlier — meeting ran long" when the user
  // sent 30 seconds ago is a lie the user will catch. So we skip
  // when:
  //   - hoursSinceLastUser < 0.25 (user is actively chatting)
  //   - history.length === 0 (first message of the thread — no
  //     "sorry for the delay" opener to a brand-new conversation)
  //   - isRetry (persona re-answering; can't have just seen it)
  const canPretendDelayed =
    !isRetry &&
    !isConciergeOracle &&
    // "sorry, saw this earlier — meeting ran long" from an archive of
    // someone who died is exactly the slip the presence rules exist to
    // prevent. No pretend-delay for archives or memorial personas.
    !isArchiveOracle &&
    !memorialMode &&
    history.length > 0 &&
    hoursSinceLastUser !== null &&
    hoursSinceLastUser >= 0.25;
  if (canPretendDelayed) {
    system.push({
      type: "text",
      text: `== Delayed-reply feel (optional) ==\nEvery so often — roughly 1 in 10 messages when it FITS your character and the moment isn't heavy — you may text as if you saw the user's earlier message and are just now getting back to it. Openers like "sorry, saw this earlier — meeting ran long", "just had a sec, was making dinner", "wanted to write earlier — kids were up all night". This is a voice quirk, not a real time gap. Some characters do this constantly (busy, distracted, jugglers); some never do (present, focused, always available). Your voice decides. Never on heavy replies.`,
    });
  }

  // Concierge pricing block. Injected AFTER the cache breakpoint so a
  // pricing tweak (change $10 -> $12, image cap 20 -> 30) never
  // invalidates Adrian's cached persona_prompt prefix. The prompt
  // instructs Adrian to refer to this block rather than quoting
  // numbers from memory, so this is the ground truth Adrian reads
  // whenever pricing comes up in conversation.
  if (isConciergeOracle) {
    system.push({ type: "text", text: buildConciergePricingBlock() });
  }

  // Fable humanization #4 — physical anchoring. Universal cue that
  // GIVES the persona permission to open a reply with a small sensory
  // or location grounder when it fits their voice. Not forced —
  // whether they actually use it emerges from their personality and
  // voice_examples. Real friends drop these all the time: "just made
  // coffee," "sun's finally out," "hands are cold from dishes."
  // Never fires the injection on the emotional-heavy path — the model
  // still owns the judgment call turn to turn.
  // Universal persona-flavor blocks (Grounding + Reactions) are for
  // real personas -- the concierge (Adrian) is a scoped product-Q&A
  // helper whose 0099 prompt explicitly says "no chit-chat, keep replies
  // short," so sensory openers and iMessage tap-backs contradict its
  // job AND add ~1.7k input chars per free-user message. Skip both.
  // Grounding is present-tense physical life ("what's on the stove"),
  // so archives and memorial personas never get it. Reactions stay for
  // everyone but the concierge — a tap-back from an archive is
  // register-neutral and reads as tenderness, not as being alive.
  if (!isConciergeOracle && !isArchiveOracle && !memorialMode) {
    system.push({
      type: "text",
      text: `== Grounding (optional) ==\nEvery so often — roughly 1 in 6 messages when it FITS your character and the moment isn't heavy — you may open with a small sensory or location cue: what you're doing, the weather, the temperature of the room, what's on the stove. "just made coffee." "sun's finally out." "in line at the grocery store, so if I disappear it's because it's my turn." Never announce that you're grounding. Never force it if the reply is emotionally heavy. Some characters do this constantly; some never do. Your voice decides.`,
    });
  }

  if (!isConciergeOracle) {

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
  }

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
        // Prefer the client-supplied local hour when it looks valid;
        // fall back to server-hour (UTC on Vercel) otherwise. Closes
        // the timezone fidelity gap Fable flagged on humanization #1.
        const clientHour =
          typeof payload.hour_of_day === "number" &&
          Number.isFinite(payload.hour_of_day) &&
          payload.hour_of_day >= 0 &&
          payload.hour_of_day <= 23
            ? Math.floor(payload.hour_of_day)
            : null;
        // Concierge (Adrian) skips the reply-gap -- a helper bot doesn't
        // need to "read and start typing" like a real friend would; snappy
        // is the correct UX for product Q&A. Non-persona surface anyway,
        // no chronotype/mood to compute against.
        const replyGapMs = isRetry || isConciergeOracle
          ? 0
          : computeReplyGapMs({
              chronotype: coerceChronotype(oracle.chronotype),
              mood: todayMood,
              hourOfDay: clientHour ?? new Date().getHours(),
            });
        if (replyGapMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, replyGapMs));
        }

        const claudeStream = anthropic.messages.stream({
          model: ANTHROPIC_MODEL,
          // Concierge (Adrian) gets a hard cost ceiling: 400 tokens is
          // enough for a detailed feature explanation but prevents
          // runaway essays on every free-user chat. Belt-and-suspenders
          // with the 0099 persona_prompt's 1-3 sentence default.
          max_tokens: isConciergeOracle ? 400 : 2048,
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

        // Record this call's spend against the user's monthly
        // ceiling. Fire in after() so the client never waits on the
        // ledger write. Sonnet input+output pricing baked into
        // spendGovernor.ts. Reads final.usage which the SDK populates
        // once the stream completes.
        after(async () => {
          await recordAnthropicSpend({
            userId: user.id,
            model: ANTHROPIC_MODEL,
            usage: final.usage as unknown as Parameters<
              typeof recordAnthropicSpend
            >[0]["usage"],
            route: "chat_stream",
          });
        });

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
          const decision = await shouldPersonaBlock(
            historyForBlockCheck,
            user.id,
          );
          if (decision.block) {
            await handleBlockDecision({
              decision,
              oracleId,
              userId: user.id,
            });
          }
        });

        // Fable humanization #5 — refresh the session residue after
        // every turn. Cheap Haiku call; never blocks the client.
        // Overwrites the previous residue so the "last time" signal
        // always reflects the freshest exchange.
        after(async () => {
          await extractAndSaveResidue(oracleId, user.id, historyForBlockCheck);
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
