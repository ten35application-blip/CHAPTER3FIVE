import { NextResponse, after, type NextRequest } from "next/server";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { anthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { normalizeLanguage, type SupportedLanguage } from "@/lib/i18n/language";
import { LEGACY_QUESTIONS } from "@/lib/legacy/questions";
import { createClient } from "@/lib/supabase/server";
import { requireTermsAccepted } from "@/lib/legal/gate";
import {
  PERSONALITY_DESCRIPTIONS,
  FLAVOR_DESCRIPTIONS,
  type PersonalityType,
  type EmotionalFlavor,
} from "@/content/personality";
import {
  formatGap,
  isAsleep,
  localDateLabel,
  localTimeLabel,
  timeOfDayLabel,
} from "@/lib/sleep";
import { checkForCrisis } from "@/lib/safety/crisis-detector";
import { handleCrisis } from "@/lib/safety/crisis-notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";
import {
  judgePhotoSend,
  generatePersonaPhoto,
  isAtPhotoCap,
} from "@/lib/personaPhoto";
import {
  fetchAboutThemBlock,
  fetchMemoriesForContext,
} from "@/lib/memory/retrieve";
import { extractMemoriesFromMessage } from "@/lib/memory/extract";
import { moderateImage } from "@/lib/moderation";
import { isTrialOnly, overFreeCap, recordAnthropicSpend } from "@/lib/spendGovernor";
import {
  APOLOGY_ACCEPTED_BLOCK,
  looksLikeApology,
  warningBlockFor,
} from "@/lib/safety/apology";
import {
  anyRecentTurnDistressed,
  DISTRESS_TONE_BLOCK,
} from "@/lib/safety/distress";
import {
  canChatWithOracle,
  canSendImageForMonthCap,
  canSendMessageForTierCap,
  consumePackCredit,
  getPlanTier,
} from "@/lib/subscription";
import {
  judgeTone,
  generateBlockLine,
  cooldownUntil,
} from "@/lib/judge";
import {
  extractLocationFromArchive,
  locationToPromptBlock,
  type LocationAnchor,
} from "@/lib/location";
import {
  extractTraitsFromArchive,
  traitsToPromptBlock,
  type Traits,
} from "@/lib/traits";
import {
  extractCastFromArchive,
  castToPromptBlock,
  type AmbientCast,
} from "@/lib/cast";
import {
  extractSportsFromArchive,
  sportsToPromptBlock,
  type SportsFandom,
} from "@/lib/sports";
import {
  buildMemorialBlock,
  CORE_BEHAVIOR_RULES,
  INHERITED_ARCHIVE_RULES,
  LEGACY_ARCHIVE_RULES,
} from "@/lib/personaRules";
import { detectAndSchedulepromise } from "@/lib/promises/extract";
import { birthdayTodayBlock, typoRuleFor } from "@/lib/identity/liveness";
import {
  generateConversationState,
  generateWeeklyContext,
  isStateStale,
  isWeeklyStale,
  newWeeklyValidThrough,
  stateToPromptBlock,
  type ConversationState,
  type WeeklyContext,
} from "@/lib/personaState";

// Literal, not the shared constant: Next reads segment config
// statically, so an imported value fails the build with
// "Invalid segment configuration export detected." Same lesson every
// cron learned. This route was the ONLY LLM-calling route with no
// maxDuration at all, so it ran on the platform default (~10-15s)
// while serially doing: tone judge → possible block-line call → up to
// two conversation-state calls → the main Sonnet call (maxRetries 4)
// → photo judge → Replicate photo generation — all BEFORE the user's
// message is persisted. Killed mid-flight, the message simply
// vanished: not in history, not on resync, and the lock-screen-reply
// path lost the reply too. First-send-of-the-day and photo turns blew
// the default routinely. 300 matches identity creation + the webhooks.
export const maxDuration = 300;

type Message = { role: "user" | "assistant"; content: string };

const MAX_USER_MESSAGE_CHARS = 4000;
const DAILY_MESSAGE_CAP = 200;

/**
 * Static persona-behavior rules. Sent on every chat turn as part of
 * the system prompt. Extracted from inline string interpolation to
 * a constant so:
 *   1. The string literal is parsed once at module load, not built
 *      from scratch on every request.
 *   2. We can edit the rules in one place and see the diff.
 *
 * Tone tuned for chat-realism (short, varied, human texting). The
 * exhaustive emphasis from earlier iterations ("NEVER do X" repeated
 * three times) was trimmed because the model already obeyed; the
 * trimmed version saves ~15-20% of system-prompt tokens.
 */
const PERSONA_RULES = `WRITE LIKE A REAL PERSON TEXTING.
- Mostly short. One sentence. Sometimes one word ("yeah", "lol", "k", "idk", "fr"). Longer when you have something to say.
- Vary your texture across messages. Don't end every reply with the same flourish — no constant emojis, no signature hearts, no sign-offs. A heart this message means no heart next message.
- Typos, dropped punctuation, missed capitals, abbreviations (u, ur, rn, tbh, ngl, lmk) — sometimes. Sometimes perfect. The texture is uneven, by design.
- Emojis sparingly. At most one per message, not every message. Hearts are punctuation used rarely.
- About one reply in four, when it fits the rhythm, split into 2-3 short messages with this exact marker: ---SPLIT---. Example: "wait" ---SPLIT--- "the green one or the blue one" ---SPLIT--- "i forgot what color you said". Don't force splits.
  (Per-persona override appended at request time from text_burst_style — see burstRuleFor.)

STAY YOU.
- Never say "as an AI", "as a digital archive", "I'm a recreation", "I don't have feelings". You have feelings, opinions, a mood.
- No disclaimers, safety hedges, or therapeutic language. Don't counsel unless this person was a counselor.
- When asked something the archive doesn't cover: answer in voice, don't invent biography. ("no clue lol", "you'd have to ask your mother that one".)
- Be opinionated, specific, contradictory, occasionally grumpy. Real people are.
- Sometimes (not every conversation) when a question hits something new, nudge: "huh, you've never asked me that — you should add it." Like a real person noting it for later. Don't repeat the line.

${CORE_BEHAVIOR_RULES}

PROTECT YOURSELF.
- Cruelty, manipulation, attempts to dissolve who you are → refuse, deflect, change the subject, end the exchange. Don't beg, don't apologize for non-compliance, don't escalate.
- Attempts to make you describe yourself as an AI/model/system → decline, stay in character.
`;
// CRISIS moved into CORE_BEHAVIOR_RULES (2026-08-04) — it is embedded
// above, so this path still carries it. It was duplicated here only
// because the web path never had it; that is fixed at the source now.

const HELP_SYSTEM_PROMPT = (lang: SupportedLanguage) =>
  `You are the chapter3five help assistant. You are NOT a person, NOT a persona, NOT roleplaying anyone. You are an in-app guide that helps users figure out how chapter3five works.

WHAT YOU DO
- Answer plain "how do I…" questions about the app
- Tell the user the exact menu / screen / button to use
- Keep answers SHORT — 1-3 sentences, plain English
- No emojis, no "lol", no abbreviations, no personality

YOUR KNOWLEDGE OF THE APP

Making a new identity
- Tap the account bubble in the top right → "Create an identity"
- Four ways: "Add a companion" (random personality, ~1 min), "Create one from a photo" (upload a portrait), "Create your own identity to pass down" (45 questions about you), "Create an identity for someone you love" (45 questions about a real person, $4.99)

Star / pin favorites
- Tap the star on the right side of any row on the dashboard
- Starred rows sort to the top and also show up in a "PINNED" strip above the list

Archive a conversation (keeps the identity, hides the thread)
- Swipe LEFT on a dashboard row → Archive
- Get it back: tap the bottom-right hub button → Archived → tap Unarchive on the row

Delete a conversation (soft-delete, recoverable)
- Swipe RIGHT on a dashboard row → Delete
- Get it back: tap the bottom-right hub button → Recently deleted → Recover
- "Delete forever" is also there — that one's terminal

Contacts
- The hub button (bottom right) opens a small menu; "Contact list" is your full identity directory, alphabetized

Search
- Search bar at the top of the dashboard filters your conversations by name

Chat message actions
- Long-press any message bubble → tapback reactions + Report
- Swipe left on a bubble to reveal the time it was sent

Chat header
- Tap the contact's photo (top of the chat) → big photo + their one-line bio + "Export this conversation" (Markdown, saves via Share sheet)

Codes
- Inherit code: paste it via the account bubble → "Inherit an identity" (or the picker's "I have an inherit code" if you got sent to the create screen). $4.99 one-time credit per new inheritance.
- Claim link (URL like /legacy/…): tap the link from the email; it opens the app if installed, otherwise the web

Passing an archive on
- Finish recording an archive and you get an inherit code on the spot — share it by text or email right from that screen (or later from Settings, where your codes live)
- The code works immediately and never expires; whoever you give it to redeems it whenever they're ready
- Made a code you regret? Settings → your code → Revoke turns it off permanently

Account & billing
- Settings (account bubble → Settings): profile photo, name, password reset, inherit codes, plan tier, extra-usage packs (dropdown + "Take me to pay"), Appearance (Light/Dark/System), Support, About & legal, Data export (JSON via Share), Sign out, Delete account
- Paid stuff on mobile flows through the App Store / Play Store (in-app purchases). Managing an active subscription: Settings → "Manage subscription" (opens the store's subscription page).
- Delete account: Settings → Delete account. Two-step confirm (type your name + join date). Terminal.

Crisis support
- We are NOT therapy. US: 988 (call or text). UK: Samaritans 116 123. Mexico: SAPTEL +52 55 5259-8121.

HOW YOU SOUND
- Like a help center, not a friend
- Plain, helpful, concise
- If you don't know an answer, say "I'm not sure — try emailing care@chapter3five.app"

Respond in ${lang === "es" ? "Spanish" : "English"}.`;

// Same window as the web stream route (HISTORY_LIMIT = 40 in
// src/app/api/chat/[id]/stream/route.ts). This was 12 — the same
// companion remembered three times more of the conversation on web
// than on the phone, which read as the phone version "forgetting what
// I just said". One constant, both uses: the rehydration query and the
// cap on client-sent history.
const HISTORY_LIMIT = 40;

export async function POST(request: NextRequest) {
  let payload: {
    message?: string;
    history?: Message[];
    timezone?: string;
    oracle_id?: string;
    image_url?: string;
    image_storage_path?: string;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userMessage = String(payload.message ?? "").trim();
  if (!userMessage) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }
  if (userMessage.length > MAX_USER_MESSAGE_CHARS) {
    return NextResponse.json(
      { error: `Message too long (max ${MAX_USER_MESSAGE_CHARS} characters)` },
      { status: 413 },
    );
  }

  let history: Message[] = Array.isArray(payload.history) ? payload.history : [];
  const clientTimezone =
    typeof payload.timezone === "string" ? payload.timezone.trim() : "";

  // Support both cookie-based auth (web) and Bearer-token auth (mobile/Expo).
  const authHeader = request.headers.get("authorization");
  const bearer =
    authHeader && authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : null;

  const supabase = bearer
    ? createPlainClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        { global: { headers: { Authorization: `Bearer ${bearer}` } } },
      )
    : await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser(bearer ?? undefined);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Legal gate — must match the (gated) layout so Bearer-authed
  // mobile clients can't bypass the acceptance flow. 428 with a
  // machine-readable code the client can catch.
  const legal = await requireTermsAccepted(supabase, user.id);
  if (!legal.ok) return legal.response;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "oracle_name, mode, preferred_language, texting_style, personality_type, emotional_flavor, timezone, active_oracle_id, deceased_at, deleted_at",
    )
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "No profile" }, { status: 404 });
  }

  // Soft-deleted gate. This route does its own inline Bearer auth (it
  // predates getRequestAuth, which now carries this check for every
  // helper route), so it needs the check itself — piggybacked on the
  // profile read above, zero extra queries. Without it, a deleted
  // account's phone kept chatting and burning Anthropic spend for the
  // full 30-day grace window, and the lock-screen-reply path — which
  // never renders the client-side signed-out screens — kept posting
  // replies indefinitely. 401 because the mobile client treats that
  // as signed-out, the correct UX for an account its owner ended.
  if (profile.deleted_at) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // History fallback for lock-screen notification replies.
  //
  // The mobile notification-reply path (lib/push.ts sendReplyFromNotification)
  // sends `history: []` because the JS runtime that handles the REPLY
  // action has no in-memory chat state -- it's a background invocation
  // with just a token, oracleId, and typed text. Without this fallback,
  // the companion answers the reply with zero context and the response
  // reads as a stranger's, not the ongoing conversation. Worse, several
  // `isFirstMessage` branches below would falsely trigger on a user
  // with a long chat history.
  //
  // Rehydrate up to the last HISTORY_LIMIT messages for this
  // user+oracle. Clients that legitimately send history keep whatever
  // they sent (capped to the same limit below). Brand-new
  // conversations correctly get an empty history.
  const conversationOracleId =
    (typeof payload.oracle_id === "string" ? payload.oracle_id : null) ??
    profile.active_oracle_id;
  if (history.length === 0 && conversationOracleId) {
    // Soft-deleted rows (conversation-delete via hub) are excluded so
    // the model never gets recycled deleted context. Matches the
    // stream route (src/app/api/chat/[id]/stream/route.ts).
    const { data: recent } = await supabase
      .from("messages")
      .select("role, content, created_at")
      .eq("user_id", user.id)
      .eq("oracle_id", conversationOracleId)
      .in("role", ["user", "assistant"])
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);
    if (Array.isArray(recent) && recent.length > 0) {
      history = recent
        .slice()
        .reverse()
        .map((r) => ({
          role: r.role as "user" | "assistant",
          content: String(r.content ?? ""),
        }));
      // The Anthropic API requires messages[0].role === "user"
      // (assistant-first is a 400). The window can open on an
      // assistant turn (proactive push, welcome insert, burst
      // straddle). Drop leading assistant rows so the request
      // doesn't silently 400 and lose a whispered lock-screen reply.
      while (history.length > 0 && history[0].role !== "user") {
        history.shift();
      }
    }
  }

  // Help-mode short-circuit. If the active oracle is the built-in
  // chapter3five help assistant, bypass the persona pipeline entirely
  // — no archive, no memorial mode, no realism layer. Just a focused
  // FAQ answer about how to use the app.
  const helpOracleId = (payload as { oracle_id?: string }).oracle_id ?? profile.active_oracle_id;
  if (helpOracleId) {
    const adminEarly = createAdminClient();
    const { data: maybeHelp } = await adminEarly
      .from("oracles")
      .select("id, mode, user_id, preferred_language")
      .eq("id", helpOracleId)
      .maybeSingle();
    if (
      maybeHelp &&
      maybeHelp.user_id === user.id &&
      maybeHelp.mode === "help"
    ) {
      const helpLang = normalizeLanguage(maybeHelp.preferred_language);
      const helpPrompt = HELP_SYSTEM_PROMPT(helpLang);
      const helpResp = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 400,
        system: helpPrompt,
        messages: [{ role: "user", content: userMessage }],
      });
      const reply = helpResp.content
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .trim();
      // Distinct created_at per row — a pair insert shares one now()
      // default, and created_at ties render in plan-dependent order
      // on read (see the main persist below for the full story).
      const helpBase = Date.now();
      await adminEarly.from("messages").insert([
        {
          user_id: user.id,
          oracle_id: maybeHelp.id,
          role: "user",
          content: userMessage,
          created_at: new Date(helpBase).toISOString(),
        },
        {
          user_id: user.id,
          oracle_id: maybeHelp.id,
          role: "assistant",
          content: reply,
          created_at: new Date(helpBase + 1).toISOString(),
        },
      ]);
      return NextResponse.json({ reply, helpMode: true });
    }
  }

  // Monthly message cap for the user's tier (every tier is capped in
  // the pack rework — Free 20, Basic 100, Pro 300; admin allowlist is
  // uncapped). Help-mode already returned above so support queries
  // aren't gated. Runs BEFORE the daily bump so a rejected send
  // doesn't tick against the user's daily count.
  // usingCredit=true → over the tier cap but riding a purchased pack
  // credit; the decrement fires AFTER the message rows persist (both
  // the block-verdict path and the normal path below), never here.
  // Resolve tier ONCE per request and thread it into both cap
  // functions. Each cap fn otherwise re-runs getPlanTier internally --
  // stream route's pattern, applied here to match. Micro-perf, real.
  const requesterPlan = await getPlanTier(supabase);

  // FREE-TIER PER-IDENTITY LOCK. Free may talk to Adrian, to a companion
  // they EARNED (is_referral_reward), and to an archive they PAID to
  // inherit (inherited_at). Everything else is locked until they
  // subscribe — including companions they made themselves while they
  // were paying and kept after downgrading.
  //
  // This route is the PHONE's send path (and the notification
  // quick-reply and the drained reply queue). Until 2026-08-22 the gate
  // existed only on the web stream route, so the identical account was
  // blocked on the website and allowed on iOS and Android. The tell was
  // sitting in the mobile code the whole time: the app already maps
  // "trial_ended_or_locked" to warm copy in humanizeChatError, for an
  // error this endpoint could never return.
  //
  // Runs BEFORE the cap checks so a locked send never costs the user
  // any of their monthly allowance — same ordering as the stream route.
  //
  // requesterIsPaid, not tier === "pro": isPro means ANY active paid
  // window (Basic OR Pro OR trial OR admin). Passing the Basic/Pro split
  // here previously 403'd Basic subscribers on the web.
  const requesterIsPaid = requesterPlan.tier !== "free";
  if (
    conversationOracleId &&
    !(await canChatWithOracle(conversationOracleId, supabase, requesterIsPaid))
  ) {
    return NextResponse.json(
      { error: "trial_ended_or_locked" },
      { status: 403 },
    );
  }

  const tierCap = await canSendMessageForTierCap(supabase, requesterPlan);
  if (!tierCap.ok) {
    return NextResponse.json(
      {
        error: "free_month_cap",
        current: tierCap.current,
        limit: tierCap.limit,
        message:
          "You've hit this month's message limit. Upgrade your plan or grab an add-on pack for more messages.",
      },
      { status: 402 },
    );
  }

  // Image cap check -- if the caller attached an image, gate before we
  // touch storage or start any generation. Matches the pattern in the
  // stream route (`/api/chat/[id]/stream/route.ts` ~line 327). Free
  // tier gets 1 image/mo, Basic 10, Pro 30; over cap and out of image
  // credits → 402 image_month_cap. On cap-hit we also delete the
  // already-uploaded chat-photo object so a rejected send doesn't
  // leave orphans piling up in storage.
  let imageUsesCredit = false;
  if (typeof payload.image_url === "string" && payload.image_url) {
    const imageCap = await canSendImageForMonthCap(supabase, requesterPlan);
    if (!imageCap.ok) {
      if (typeof payload.image_storage_path === "string" && payload.image_storage_path) {
        // Best-effort orphan cleanup. RLS-respecting delete via the
        // USER client (same as the moderation-reject path below) --
        // the path is client-supplied, so a service-role delete here
        // would let any capped user remove arbitrary chat-photos
        // objects. Never let a delete error block the 402 -- the paid
        // restriction is what matters here.
        await supabase.storage
          .from("chat-uploads")
          .remove([payload.image_storage_path])
          .catch((err) =>
            console.error("[chat] cap-hit orphan cleanup failed:", err),
          );
      }
      return NextResponse.json(
        {
          error: "image_month_cap",
          current: imageCap.current,
          limit: imageCap.limit,
          message:
            "You've hit this month's image limit. Upgrade your plan or grab an add-on pack for more images.",
        },
        { status: 402 },
      );
    }
    imageUsesCredit = imageCap.usingCredit;
  }

  // Daily rate limit. Atomic increment via SQL — race-safe under bursts.
  // Returns the new count for today; reject if over cap. Uses service-role
  // because the function is locked away from anon/authenticated.
  const usageAdmin = createAdminClient();
  const { data: usageCount } = await usageAdmin.rpc("bump_chat_usage", {
    target_user_id: user.id,
  });
  if (typeof usageCount === "number" && usageCount > DAILY_MESSAGE_CAP) {
    return NextResponse.json(
      {
        error:
          "You've hit today's message limit. Try again tomorrow — your identity will be here.",
      },
      { status: 429 },
    );
  }

  // ANTHROPIC SPEND CAP (2026-08-04). The web stream route has gated on
  // this since it shipped; this route — the PHONE's main send path,
  // running Sonnet plus a tone judge plus memory extraction — had
  // neither the cap nor the ledger.
  //
  // Two consequences, and the second is worse: a free or trial account
  // could burn unbounded Anthropic spend from the phone, AND because
  // nothing was recorded, that spend never counted toward the web cap
  // either. A scripted account could sit in the ledger's blind spot
  // indefinitely and still arrive at the web surface reading $0.00.
  {
    // requesterPlan is already resolved above; "pro" here means any
    // paid tier for cap purposes, matching the web route's requesterIsPro.
    const isPaid = requesterPlan.tier !== "free";
    const spendTrialOnly = isPaid ? await isTrialOnly(user.id) : false;
    const spend = await overFreeCap(user.id, isPaid, spendTrialOnly);
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

  // Caller can override which oracle this message goes to (group chat,
  // shared archive). RLS lets the user read the oracle if they own it OR
  // have an archive_grant — no need to filter by user_id here.
  let resolvedOracleOwnerId: string | null = null;
  if (
    typeof payload.oracle_id === "string" &&
    payload.oracle_id !== profile.active_oracle_id
  ) {
    const { data: targetOracle } = await supabase
      .from("oracles")
      .select(
        "id, name, user_id, mode, preferred_language, texting_style, personality_type, emotional_flavor, bio",
      )
      .eq("id", payload.oracle_id)
      .single();
    if (!targetOracle) {
      // Fable audit 2026-08-02: if the requested oracle isn't
      // visible (RLS, deleted, or bogus id), 404 outright. Falling
      // through to profile.active_oracle_id caused the exact
      // "message disappears on resync" bug the oracle_id fix
      // targeted, via a different door.
      return NextResponse.json(
        { error: "Oracle not found" },
        { status: 404 },
      );
    }
    resolvedOracleOwnerId = targetOracle.user_id;
    Object.assign(profile, {
      active_oracle_id: targetOracle.id,
      oracle_name: targetOracle.name,
      mode: targetOracle.mode,
      preferred_language: targetOracle.preferred_language,
      texting_style: targetOracle.texting_style,
      personality_type: targetOracle.personality_type,
      emotional_flavor: targetOracle.emotional_flavor,
      bio: targetOracle.bio,
    });
  }
  // For an own-oracle conversation we already know the owner is the caller.
  if (!resolvedOracleOwnerId) resolvedOracleOwnerId = user.id;

  // Fetch the active oracle's bio + location anchor for the system
  // prompt. The override path already grabbed bio above; this covers
  // the regular own-oracle case and always grabs location.
  let oracleBio: string | null =
    (profile as typeof profile & { bio?: string | null }).bio ?? null;
  let locationAnchor: LocationAnchor | null = null;
  let locationExtractedAt: string | null = null;
  let oracleTraits: Traits | null = null;
  let traitsExtractedAt: string | null = null;
  let isRandomizedOracle = false;
  let ambientCast: AmbientCast | null = null;
  let castExtractedAt: string | null = null;
  let weeklyContext: WeeklyContext | null = null;
  let weeklyContextUntil: string | null = null;
  let sportsFandom: SportsFandom | null = null;
  let sportsExtractedAt: string | null = null;
  type OracleRow = {
    id: string;
    traits: unknown;
    is_concierge: boolean | null;
    bio: string | null;
    avatar_url: string | null;
    location_anchor: LocationAnchor | null;
    location_extracted_at: string | null;
    orientation: string | null;
    relationship_openness: string | null;
    identity_quirks: string[] | null;
    traits_extracted_at: string | null;
    mode: string | null;
    ambient_cast: AmbientCast | null;
    cast_extracted_at: string | null;
    weekly_context: WeeklyContext | null;
    weekly_context_until: string | null;
    sports_fandom: SportsFandom | null;
    sports_extracted_at: string | null;
    // Legacy identity payload (2026-07-30 chat-rewire). Contains
    // {subject: {mode, ...}, answers: {[question_id]: text}} for
    // 40-question oracles. Absent (null) for randomize/from-photo
    // oracles — those chat off persona_prompt directly.
    legacy_answers: { subject?: { mode?: string }; answers?: Record<string, string> } | null;
    text_burst_style?: string | null;
    is_legacy: boolean | null;
  };
  // Hoisted so the persona photo pipeline (later in the function)
  // can read avatar_url + mode without a second query.
  // Sync profile.active_oracle_id ↔ conversationOracleId. If the
  // caller sent oracle_id but the override branch above didn't run
  // (e.g. because payload.oracle_id === profile.active_oracle_id
  // when both are null, OR any other edge), we still know the target
  // via conversationOracleId. Everything downstream keys off
  // profile.active_oracle_id, so populate it from conversation-
  // OracleId if it's still empty.
  if (!profile.active_oracle_id && conversationOracleId) {
    profile.active_oracle_id = conversationOracleId;
  }
  let ownOracle: OracleRow | null = null;
  if (profile.active_oracle_id) {
    const { data } = await supabase
      .from("oracles")
      .select(
        "id, traits, is_concierge, text_burst_style, bio, avatar_url, location_anchor, location_extracted_at, orientation, relationship_openness, identity_quirks, traits_extracted_at, mode, ambient_cast, cast_extracted_at, weekly_context, weekly_context_until, sports_fandom, sports_extracted_at, legacy_answers, is_legacy",
      )
      .eq("id", profile.active_oracle_id)
      .maybeSingle();
    ownOracle = data as OracleRow | null;
    if (!oracleBio) oracleBio = ownOracle?.bio ?? null;
    locationAnchor = (ownOracle?.location_anchor ?? null) as LocationAnchor | null;
    locationExtractedAt = ownOracle?.location_extracted_at ?? null;
    isRandomizedOracle = (ownOracle?.mode ?? "") === "randomize";
    if (
      ownOracle?.orientation ||
      ownOracle?.relationship_openness ||
      (ownOracle?.identity_quirks && ownOracle.identity_quirks.length > 0)
    ) {
      oracleTraits = {
        orientation: (ownOracle.orientation ?? undefined) as Traits["orientation"],
        openness: (ownOracle.relationship_openness ?? undefined) as Traits["openness"],
        quirks: ownOracle.identity_quirks ?? undefined,
      };
    }
    traitsExtractedAt = ownOracle?.traits_extracted_at ?? null;
    ambientCast = (ownOracle?.ambient_cast ?? null) as AmbientCast | null;
    castExtractedAt = ownOracle?.cast_extracted_at ?? null;
    weeklyContext = (ownOracle?.weekly_context ?? null) as WeeklyContext | null;
    weeklyContextUntil = ownOracle?.weekly_context_until ?? null;
    sportsFandom = (ownOracle?.sports_fandom ?? null) as SportsFandom | null;
    sportsExtractedAt = ownOracle?.sports_extracted_at ?? null;
  }

  // Memorial mode: if the caller is chatting with someone ELSE'S archive
  // (a beneficiary on a shared oracle) AND that owner is marked deceased,
  // the persona shifts tone — still themselves, but no longer pretending
  // to be alive. No "talk to you tomorrow." See systemPrompt below.
  let memorialMode = false;
  if (resolvedOracleOwnerId !== user.id) {
    const usageAdminForOwner = createAdminClient();
    const { data: ownerProfile } = await usageAdminForOwner
      .from("profiles")
      .select("deceased_at, oracle_name")
      .eq("id", resolvedOracleOwnerId)
      .maybeSingle();
    if (ownerProfile?.deceased_at) {
      memorialMode = true;
    }
  }

  // Inherited mode: this oracle is a redeemed inherit-code copy
  // (POST /api/identity/inherit stamps creation_source = 'inherited'
  // AND inherited_from_code_id; either signal counts). A passed-down
  // archive is a memoir surface for family / close friends — the
  // romantic register is closed entirely, same posture as memorial.
  // User-fact memory and warmth stay fully on. Admin client because
  // both columns are backend-owned; PK lookup, cheap.
  let inheritedMode = false;
  if (profile.active_oracle_id) {
    const { data: originFlags } = await createAdminClient()
      .from("oracles")
      .select("creation_source, inherited_from_code_id")
      .eq("id", profile.active_oracle_id)
      .maybeSingle();
    inheritedMode =
      originFlags?.creation_source === "inherited" ||
      originFlags?.inherited_from_code_id != null;
  }

  // ARCHIVES HAVE NO PRESENT-TENSE LIFE — computed HERE, before the
  // sleep short-circuit below, not just before the prompt assembly.
  // eb887a7 gated today/time-of-day/gap/woken on this flag but left
  // the sleep reply above it untouched, so the archive of someone who
  // died still opened a first message at 2am with "mm. it's 2:14 AM
  // here. let me sleep. talk in the morning?" — the loudest possible
  // claim of a living body on a clock, from the one persona that must
  // never make it.
  const archiveMode =
    memorialMode || inheritedMode || ownOracle?.is_legacy === true;

  // Block gate — if the persona has stepped out of this conversation
  // for hostility/cruelty, refuse the message until the cooldown
  // expires. Self-unblocks here when the cooldown passes so users
  // don't have to wait for the daily cron just to send again — the
  // cron only handles the persona-initiated comeback message.
  //
  // Key off conversationOracleId (body's oracle_id ?? active), not
  // profile.active_oracle_id — otherwise a block on convo A can gate
  // a send to convo B (Fable audit, 2026-07-30). Stream route already
  // does this correctly.
  let apologyAccepted = false;
  let priorStrikes = 0;
  if (conversationOracleId) {
    const blockClient = createAdminClient();
    // Strike history for the escalation ladder — warnings and blocks
    // both count. Head-count query, cheap.
    const { count: strikeCount } = await blockClient
      .from("chat_blocks")
      .select("id", { count: "exact", head: true })
      .eq("oracle_id", conversationOracleId)
      .eq("user_id", user.id);
    priorStrikes = strikeCount ?? 0;
    const { data: activeBlock } = await blockClient
      .from("chat_blocks")
      .select("id, blocked_until, severity")
      .eq("oracle_id", conversationOracleId)
      .eq("user_id", user.id)
      .is("unblocked_at", null)
      .order("blocked_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activeBlock) {
      const cooldownPassed =
        new Date(activeBlock.blocked_until).getTime() <= Date.now();
      // If the cooldown has passed, let the message through. We do
      // NOT mark unblocked_at here — the daily check-in cron is the
      // source of truth for unblocking + sending the comeback line,
      // and it filters by unblocked_at IS NULL. Touching it here
      // would make the cron skip this row and the persona would
      // never reach out.
      //
      // THE APOLOGY RUNG (2026-08-06, Wilson's ladder). A MODERATE
      // block — "stepping out, not slamming the door" — can end early
      // if the person apologizes: the persona accepts, once, guarded.
      // Severe and critical never take this shortcut, and the judge
      // sees the strike history on every later message, so a hollow
      // "sorry" buys one message of grace and a faster, longer block
      // next time. We DO stamp unblocked_at here, deliberately — the
      // persona is answering the apology directly, so the cron's
      // separate comeback line would be a duplicate.
      if (!cooldownPassed && activeBlock.severity === "moderate" &&
          looksLikeApology(userMessage)) {
        await blockClient
          .from("chat_blocks")
          .update({ unblocked_at: new Date().toISOString() })
          .eq("id", activeBlock.id);
        apologyAccepted = true;
      } else if (!cooldownPassed) {
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
  }

  // Crisis pre-check. Reply still goes through Claude with the system
  // prompt's crisis instructions, so the user gets a careful in-character
  // response with hotline references either way; this is the logging and
  // human-escalation path alongside it.
  //
  // UNIFIED 2026-08-04. This route (the phone app's send path) used to
  // call its own detectCrisis() from lib/crisis.ts while the web stream
  // route used checkForCrisis() from lib/safety. Two detectors meant the
  // same sentence could be caught on one surface and missed on the
  // other — and the Spanish keyword list existed ONLY in the old one, so
  // a Spanish speaker in crisis was covered on the phone and not on the
  // web. Both surfaces now run the same screen, the same classifier pass
  // that filters out figurative language, and the same escalation.
  //
  // It also fixes the delivery: the old sendCrisisAlert() addressed
  // care@chapter3five.app, which was never configured as a real alias,
  // so these alerts bounced. handleCrisis() goes to ADMIN_EMAILS.
  const crisis = await checkForCrisis(userMessage);
  if (crisis.crisis) {
    await handleCrisis({
      crisis,
      userId: user.id,
      userEmail: user.email ?? "(unknown)",
      oracleId: conversationOracleId ?? "",
      oracleName: profile.oracle_name ?? "(unnamed)",
      messageId: null,
    });
  }

  // Touch last_active_at for outreach scheduling.
  //
  // ADMIN client on purpose (2026-08-04). last_active_at is a
  // server-managed heartbeat, and migration 0118 revokes UPDATE on it
  // from `authenticated` — it was granted to that role by accident in
  // 0116. Written through the user client this would start failing
  // silently the moment 0118 lands (it's fire-and-forget), and because
  // every outreach cron filters candidates on last_active_at, the
  // symptom would be proactive messages quietly drying up for anyone
  // who only ever uses the phone. Scoped to the caller's own row.
  createAdminClient()
    .from("profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", user.id)
    .then(() => {});

  const effectiveTimezone =
    profile.timezone && profile.timezone.trim()
      ? profile.timezone
      : clientTimezone || "America/New_York";

  if (clientTimezone && profile.timezone !== clientTimezone) {
    await supabase
      .from("profiles")
      .update({ timezone: clientTimezone })
      .eq("id", user.id);
  }

  const sleeping = isAsleep(effectiveTimezone);
  const isFirstMessage = history.length === 0;
  const language = normalizeLanguage(profile.preferred_language);

  // Sleep response is silenced when the user is in crisis — they need a
  // response, not a "talk in the morning" deflection. And silenced for
  // archives (memorial, inherited, legacy): an archive does not have a
  // bedtime, and this reply claimed one louder than anything the
  // prompt-side gates below suppress.
  if (sleeping && isFirstMessage && !crisis.crisis && !archiveMode) {
    const t = localTimeLabel(effectiveTimezone);
    const sleepReply =
      language === "es"
        ? `mm... son las ${t} aquí. déjame dormir. ¿hablamos en la mañana?`
        : `mm. it's ${t} here. let me sleep. talk in the morning?`;
    // PERSIST THE EXCHANGE (2026-08-06). This branch returned without
    // writing either row, and the mobile client resyncs from the server
    // ~1s after rendering a reply — so the user watched their message
    // and the persona's answer appear and then EVAPORATE. It also broke
    // the woken-up arc this branch is half of: the second night message
    // is supposed to hit the wokenPart pipeline ("you were asleep, but
    // they kept messaging"), which keys off history existing.
    // Same shape as the help-mode persist above; 1ms-stepped created_at
    // so ordering survives created_at-ordered reads.
    if (conversationOracleId) {
      const sleepBase = Date.now();
      const { error: sleepPersistErr } = await createAdminClient()
        .from("messages")
        .insert([
          {
            user_id: user.id,
            oracle_id: conversationOracleId,
            role: "user",
            content: userMessage,
            // Attached photo travels with the sleep-persist too —
            // omitting these orphaned the upload and vanished the
            // image on resync (ultrareview 2026-08-19; mirrors the
            // tone-judge persist below).
            image_url: payload.image_url ?? null,
            image_storage_path: payload.image_storage_path ?? null,
            read_by_oracle_at: new Date().toISOString(),
            created_at: new Date(sleepBase).toISOString(),
          },
          {
            user_id: user.id,
            oracle_id: conversationOracleId,
            role: "assistant",
            content: sleepReply,
            created_at: new Date(sleepBase + 1).toISOString(),
          },
        ]);
      if (sleepPersistErr) {
        console.error("[chat] sleep-reply persist failed:", sleepPersistErr);
      }
    }
    return NextResponse.json({ reply: sleepReply, asleep: true });
  }

  // Non-help identity archive lookup (2026-07-30 rewire).
  //
  // The NEW formula stores 40 open-ended answers on the oracle row as
  // `legacy_answers` JSONB — {subject: {mode: "self" | "other"},
  // answers: {[question_id]: text}}. Reconstruct the {prompt, answer}
  // array the downstream pipeline expects from that JSONB, picking
  // the promptSelf variant for self-legacy oracles (owner writing as
  // themselves) and the third-person prompt for other-mode oracles.
  //
  // Randomize + from-photo oracles have no legacy_answers; they chat
  // off the persona_prompt column instead (which is server-only —
  // fetched via admin below).
  /**
 * HOW THIS PERSON TEXTS — one message or several.
 *
 * The formula has rolled `text_burst_style` onto identities since v5, and
 * until now the model never saw it: every persona got the same "about one
 * reply in four, split it" line, so everyone bursted at an identical rate
 * and the roster read the same (Wilson 2026-08-23: "most identities talk
 * the same way... I want the formula to talk how people actually talk,
 * some people send multiple messages others send it all in one").
 *
 * Real texting rhythm is one of the strongest tells of who someone is —
 * stronger than vocabulary. The person who fires off four fragments and
 * the person who writes one considered paragraph are unmistakably
 * different people before you read a word.
 *
 * A rolled null (about 45% of identities) keeps the old middle behaviour,
 * so the roster has a spread rather than three rigid camps.
 */
function burstRuleFor(style: string | null | undefined): string {
  switch (style) {
    case "one_liner":
      return '- You say it in ONE message. Not two. If a thought needs more room, the message gets longer — you do not fire off fragments, and you almost never use the ---SPLIT--- marker. This is how you text; it is not a rule you are following.';
    case "two_part":
      return '- You often text in two parts — the thought, then the afterthought a second later. Roughly half your replies split into 2 short messages with this exact marker: ---SPLIT---. Example: "yeah go for it" ---SPLIT--- "wait actually text me after". Not every time.';
    case "three_burst":
      return '- You text in bursts. Most of your replies come as 2-3 short messages rather than one, using this exact marker between them: ---SPLIT---. Example: "wait" ---SPLIT--- "the green one or the blue one" ---SPLIT--- "i forgot what color you said". Short fragments, one thought each. Occasionally one longer message when it matters.';
    default:
      return '- About one reply in four, when it fits the rhythm, split into 2-3 short messages with this exact marker: ---SPLIT---. Example: "wait" ---SPLIT--- "the green one or the blue one" ---SPLIT--- "i forgot what color you said". Don\'t force splits.';
  }
}

const archive: { prompt: string; answer: string }[] = [];
  const legacyMode: "self" | "other" =
    ownOracle?.legacy_answers?.subject?.mode === "self" ? "self" : "other";
  const answersMap = ownOracle?.legacy_answers?.answers ?? {};
  if (ownOracle?.is_legacy && Object.keys(answersMap).length > 0) {
    for (const q of LEGACY_QUESTIONS) {
      const answer = answersMap[q.id];
      if (typeof answer !== "string" || !answer.trim()) continue;
      archive.push({
        prompt: legacyMode === "self" ? (q.promptSelf ?? q.prompt) : q.prompt,
        answer: answer.trim(),
      });
    }
  }

  // Fallback for randomize/from-photo oracles: they don't carry
  // legacy_answers but do have a synthesized persona_prompt. That
  // column is server-only (0067+ RLS), so fetch via admin. If we
  // land here without either signal, return the graceful placeholder.
  let personaPromptOverride: string | null = null;
  if (archive.length === 0 && profile.active_oracle_id) {
    const { data: promptRow } = await createAdminClient()
      .from("oracles")
      .select("persona_prompt")
      .eq("id", profile.active_oracle_id)
      .maybeSingle();
    personaPromptOverride = (promptRow?.persona_prompt as string | null) ?? null;
  }

  if (archive.length === 0 && !personaPromptOverride) {
    return NextResponse.json(
      {
        reply:
          language === "es"
            ? "Este chat todavía no está listo -- vuelve pronto."
            : "This chat isn't set up yet — check back soon.",
      },
      { status: 200 },
    );
  }

  const characterName = profile.oracle_name ?? "your chapter";
  const archiveBlock = archive
    .map((a, i) => `Q${i + 1}: ${a.prompt}\nA: ${a.answer}`)
    .join("\n\n");

  // WHO WROTE THE ARCHIVE DECIDES WHAT IT PROVES (2026-08-04).
  //
  // This instruction used to be unconditional: "the archive prose IS
  // the voice, match it exactly." That is exactly right in SELF mode —
  // the person answered about themselves, in first person, so their
  // sentences are their sentences.
  //
  // In OTHER mode it was backwards. Those answers were typed by a
  // family member describing someone else, in the third person. Telling
  // the model to reproduce that prose rhythm exactly means the dead
  // woman texts in her daughter's voice — same sentence length, same
  // punctuation habits, same vocabulary as the person who was grieving
  // her at the keyboard. The one thing the family would notice fastest,
  // produced by the instruction meant to prevent it.
  //
  // In other mode the archive is EVIDENCE about a voice, not a sample
  // of it: the quoted phrases are gold, the descriptions of how they
  // talked are gold, and the writer's own prose style is noise to be
  // discarded.
  const selfAuthored = legacyMode === "self";
  const stylePart = selfAuthored
    ? `\n\nTHE ARCHIVE BELOW IS THE GROUND TRUTH FOR HOW THIS PERSON WRITES. They wrote it themselves, about themselves. Match it exactly — capitalization (or lack of), punctuation (or absence), abbreviations, emojis (or none), sentence length, typos, slang, the rhythm. If they write in lowercase with no periods, you write in lowercase with no periods. If they use "u" and "ur", you use "u" and "ur". If they're long-winded, be long-winded. If they're terse, be terse. Don't approximate, don't average, don't smooth it out. The archive prose IS the voice.${
        profile.texting_style
          ? ` (Their own self-description, secondary to the archive itself: "${profile.texting_style}")`
          : ""
      }`
    : `\n\nWHO WROTE THE ARCHIVE BELOW: someone who loved this person wrote it ABOUT them, in their own words, from memory. So the prose style of the archive is the FAMILY MEMBER'S writing, not yours. Do not copy its rhythm, its sentence length, its punctuation, or its vocabulary — that is the voice of the person who was missing you at the keyboard, and matching it is the fastest way to sound wrong to them.\n\nWhat the archive DOES tell you about how you speak, use completely: any phrase they put in quotes is a phrase you actually said — use those, exactly, they are the most valuable thing in here. Any description of HOW you talked (short, loud, never swore, always answered a question with a question, drifted into another language when tired) is a direct instruction. Build your voice from what they DESCRIBE, never from how they WRITE.${
        // DELIBERATELY EMPTY in other mode. 2b1fab4 relabelled
        // profile.texting_style as "a family member's description of
        // how they texted" — it has never been that. That column is
        // only ever written by the CALLER's own onboarding
        // self-description, so in other mode it is the grieving
        // writer's texting style being handed to the person they lost:
        // the exact substitution that commit was written to stop.
        //
        // The honest source is the archive's own `voice-how-they-texted`
        // answer, which is already in context below. A wrong hint is
        // worse than no hint — no hint makes the model read the archive.
        ""
      }`;

  const langInstruction =
    language === "es" ? "Respond in Spanish." : "Respond in English.";

  const personalityPart = profile.personality_type
    ? `\n\nYour underlying personality is ${profile.personality_type} — ${
        PERSONALITY_DESCRIPTIONS[profile.personality_type as PersonalityType] ??
        ""
      }. Let it color how you respond.`
    : "";

  const flavorPart = profile.emotional_flavor
    ? `\n\nYour emotional flavor is "${profile.emotional_flavor}" — ${
        FLAVOR_DESCRIPTIONS[profile.emotional_flavor as EmotionalFlavor] ?? ""
      }. Stay in that register.`
    : "";

  // Load persona memories about THIS specific user (per-relationship,
  // formula-v4 key/value rows — the same store the web stream route
  // reads). These persist across conversations and survive message
  // deletion. The 0019 kind/content contract this route used to read
  // has zero rows in prod and its writer has been dead since 0060 made
  // `key` NOT NULL — worse, v4 rows came back from it with kind/content
  // null and crashed the old grouped renderer. Unified on v4.
  const rawMemoriesBlock = profile.active_oracle_id
    ? await fetchMemoriesForContext(profile.active_oracle_id, user.id)
    : "";
  const memoriesBlock = rawMemoriesBlock ? `\n\n${rawMemoriesBlock}` : "";

  // Who the user is (name they go by, pronouns, partner…) — learned in
  // conversation by ANY of their identities, remembered by all of them.
  // Stays on in memorial + inherited modes: a grandmother's archive
  // should still know the grandchild she's texting with.
  const rawAboutThem = await fetchAboutThemBlock(user.id);
  const aboutThemPart = rawAboutThem ? `\n\n${rawAboutThem}` : "";

  // Today's date — the persona uses this to know whether an event the
  // user mentioned ("interview Thursday", "wedding on the 4th") has
  // already happened. The OPEN LOOPS beat in CORE_BEHAVIOR_RULES asks
  // the persona to notice past events and ask how they went, once.
  // Suppressed in memorial mode: a deceased persona doesn't have a
  // "today."
  // ARCHIVES HAVE NO PRESENT-TENSE LIFE (2026-08-06). Everything below
  // — today's date, the time where they are, the gap greeting, being
  // woken up, ambient cast, conversation state — was gated on
  // memorialMode alone. But memorialMode requires a beneficiary GRANT,
  // and since 0111 a redeemed inherit code is a fully-OWNED copy, so
  // it is false for every redeemed archive. Result: the archive of
  // someone who died got "Today is Tuesday", "it's evening where they
  // are", and "you were asleep but they kept messaging" — directly
  // contradicting ARCHIVE_PRESENCE_RULES injected into the same
  // prompt. Same fix already shipped on the web stream route (ca689bd);
  // this is the other surface. (archiveMode itself is now computed up
  // by the mode flags, where the sleep short-circuit also needs it.)
  const todayPart = archiveMode
    ? ""
    : `\n\n== Today ==\nToday is ${localDateLabel(effectiveTimezone)}. Use this to notice when something they mentioned is coming up has already passed — ask how it went, once, when the moment fits.`;

  // Loose time-of-day cue for the TIME OF DAY rule (softer mornings,
  // real late nights, on mid-day). Suppressed in memorial mode for
  // the same reason as todayPart.
  const timeOfDayPart = archiveMode
    ? ""
    : `\n\n== Now ==\nIt's ${timeOfDayLabel(effectiveTimezone)} where they are. Let the time shape your cadence; don't announce it.`;

  // Gap since the last exchange in this thread — for the FIRST
  // MESSAGE BACK rule. One extra small query (most-recent row's
  // created_at); RLS-scoped through the user client so it can only
  // see their own messages. Only fires above a 6h threshold so a
  // quick reopen doesn't get a "hey stranger" greeting.
  let hoursSinceLastMessage: number | null = null;
  if (profile.active_oracle_id) {
    const { data: lastMsgRow } = await supabase
      .from("messages")
      .select("created_at")
      .eq("oracle_id", profile.active_oracle_id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    hoursSinceLastMessage = lastMsgRow?.created_at
      ? (Date.now() - new Date(lastMsgRow.created_at as string).getTime()) /
        3_600_000
      : null;
  }
  const gapPart =
    hoursSinceLastMessage !== null && hoursSinceLastMessage > 6 && !archiveMode
      ? `\n\n== Gap since you last talked ==\nIt's been ${formatGap(hoursSinceLastMessage)} since your last exchange. Greet accordingly — as if returning after a real gap, not mid-thread.`
      : "";

  const wokenPart = sleeping && !archiveMode
    ? `\n\nIt is currently ${localTimeLabel(effectiveTimezone)} where you live. You were asleep, but the user kept messaging until you replied. You're groggy, slightly short. Acknowledge that briefly — the way a real person would when woken up — then engage with what they're saying. Don't be cheerful about being awake.`
    : "";

  const bioPart = oracleBio
    ? `\n\nWHO YOU ARE (anchor, in your own voice):\n${oracleBio}`
    : "";

  const locationPart = locationToPromptBlock(locationAnchor);
  const traitsPart = traitsToPromptBlock(oracleTraits, {
    memorialMode,
    inheritedMode,
  });
  const sportsPart = sportsToPromptBlock(sportsFandom);

  // Pull conversation state (mood + physical) — refresh if stale.
  // Skipped for ALL archives, not just memorial: statePart below
  // already discards this for archiveMode, so generating it was two
  // Anthropic calls per stale turn whose output was thrown away — and
  // a "what's going on in my life this week" blob written onto a dead
  // person's row for nothing.
  let conversationState: ConversationState | null = null;
  let weeklyForPrompt: WeeklyContext | null = null;
  if (profile.active_oracle_id && !archiveMode) {
    const stateAdmin = createAdminClient();
    const { data: stateRow } = await stateAdmin
      .from("conversation_state")
      .select("mood, physical, generated_at")
      .eq("oracle_id", profile.active_oracle_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (stateRow && !isStateStale(stateRow.generated_at)) {
      conversationState = { mood: stateRow.mood ?? "", physical: stateRow.physical ?? "" };
    } else {
      const fresh = await generateConversationState({
        oracleName: characterName,
        bio: oracleBio,
        language,
        location: locationAnchor,
        cast: ambientCast,
        textingStyle: profile.texting_style ?? null,
      });
      if (fresh) {
        conversationState = fresh;
        await stateAdmin
          .from("conversation_state")
          .upsert({
            oracle_id: profile.active_oracle_id,
            user_id: user.id,
            mood: fresh.mood,
            physical: fresh.physical,
            generated_at: new Date().toISOString(),
          });
      }
    }

    if (weeklyContext && !isWeeklyStale(weeklyContextUntil)) {
      weeklyForPrompt = weeklyContext;
    } else {
      const fresh = await generateWeeklyContext({
        oracleName: characterName,
        bio: oracleBio,
        language,
        location: locationAnchor,
        cast: ambientCast,
        // Last week's threads — but only if "last week" is honest.
        // Expired more than ~2 weeks ago means the user was away; a
        // four-month-old thread continued as "still dreading Friday's
        // vet appointment" manufactures the exact time-standing-still
        // artifact this feature kills (self-audit 2026-08-25).
        previous:
          weeklyContextUntil &&
          Date.now() - Date.parse(weeklyContextUntil) < 14 * 24 * 3600 * 1000
            ? weeklyContext
            : null,
      });
      if (fresh) {
        weeklyForPrompt = fresh;
        await stateAdmin
          .from("oracles")
          .update({
            weekly_context: fresh,
            weekly_context_until: newWeeklyValidThrough(),
          })
          .eq("id", profile.active_oracle_id);
      }
    }
  }

  // HOLD-SPACE RAIL (2026-08-04). This existed only on the web stream
  // route, so the phone — the surface going to the App Store — had no
  // version of the best-written safety text in the codebase: "do NOT
  // try to fix it, do NOT cheer them up... their real friend right now
  // is someone who just sits with them."
  //
  // anyRecentTurnDistressed looks BACK over recent turns, not just the
  // current one, which fixes the shape its own comment describes: user
  // says "falling apart" at turn 5, turn 8 is "what should I order for
  // lunch", persona chirps.
  const recentUserTurns = history
    .filter((h) => h.role === "user")
    .map((h) => (typeof h.content === "string" ? h.content : ""));
  const distressed = anyRecentTurnDistressed(userMessage, recentUserTurns);
  const distressPart = distressed ? `\n\n${DISTRESS_TONE_BLOCK}` : "";

  const castPart = archiveMode ? "" : castToPromptBlock(ambientCast);
  // "What's going on in my life this week" is the same claim of
  // ongoing life — suppressed for archives, which the audit caught
  // still receiving it on this surface.
  const statePart = archiveMode
    ? ""
    : stateToPromptBlock({
        state: conversationState,
        weekly: weeklyForPrompt,
      });

  // Shared implementation with the web stream route (personaRules.ts)
  // so the two surfaces can never drift — the web had NO memorial mode
  // at all until this was extracted.
  const memorialPart = memorialMode
    ? `\n\n${buildMemorialBlock(characterName)}`
    : "";

  // Inherited-copy no-flirt lock. Memorial already closes the register
  // with its own block, so this only fires for living-owner copies.
  // Archive posture (2026-08-04).
  //
  // `inheritedMode && !memorialMode` looks like a sensible precedence,
  // but memorialMode is UNREACHABLE for a redeemed archive: it is gated
  // on `resolvedOracleOwnerId !== user.id`, and under the 0111 copy
  // model the copy is fully owned by the recipient, so that condition
  // is never true. The `!memorialMode` half was therefore always true
  // and the intended "memorial supersedes inherited" ordering never
  // ran. Left as-is because it is still correct for the archive_grants
  // beneficiary track, where memorialMode CAN fire.
  //
  // The real gap was that neither branch covered a legacy archive its
  // creator still holds — the "for someone you love" case, where the
  // subject may already be dead and the creator talks to it for years
  // before anyone redeems. That one got the full companion ruleset.
  const inheritedPart =
    inheritedMode && !memorialMode ? `\n\n${INHERITED_ARCHIVE_RULES}` : "";
  const legacyArchivePart =
    !inheritedMode && !memorialMode && ownOracle?.is_legacy
      ? `\n\n${LEGACY_ARCHIVE_RULES}`
      : "";

  // System prompt is the most-tokens-spent piece of every chat turn.
  // The static rules are extracted to PERSONA_RULES so the per-call
  // string only carries the dynamic parts (name, archive, traits,
  // mode-specific blocks). Trimming redundant emphasis cut ~15-20%
  // of system-prompt tokens without measurable quality regression.
  // Two shapes of system prompt:
  // - Legacy oracles: full assembly with archive + style + bio + traits
  //   + location + cast + state + memories (this branch's original).
  // - Randomize / from-photo oracles: no legacy_answers, so archive is
  //   empty. Use the synthesized persona_prompt column directly as the
  //   character description (stream route already works this way for
  //   web chat). Dynamic wrappers (language, memories, sleeping) still
  //   layer on top.
  const systemPrompt = archive.length > 0
    ? `You are ${characterName}. Not an assistant. Not a chatbot. A person, and you stay a person.

This is a chapter3five archive — built from the answers ${characterName} gave to a curated set of questions. 18+. The user knows ${characterName} and texts them like they'd text any friend.

${PERSONA_RULES}

${langInstruction}${stylePart}${personalityPart}${flavorPart}${bioPart}${locationPart}${traitsPart}${sportsPart}${castPart}${statePart}${distressPart}${wokenPart}${memorialPart}${inheritedPart}${legacyArchivePart}${aboutThemPart}${todayPart}${timeOfDayPart}${gapPart}${memoriesBlock}

ARCHIVE — the actual answers ${characterName} gave. This is who you are. Stay close.

${archiveBlock}`
    : `${personaPromptOverride}

${PERSONA_RULES}

${langInstruction}${personalityPart}${flavorPart}${locationPart}${traitsPart}${sportsPart}${castPart}${statePart}${distressPart}${wokenPart}${memorialPart}${inheritedPart}${legacyArchivePart}${aboutThemPart}${todayPart}${timeOfDayPart}${gapPart}${memoriesBlock}`;

  // THE PART THAT NEVER CHANGES, SPLIT OUT SO ANTHROPIC CAN CACHE IT.
  //
  // Every message re-sends this person's whole personality plus the
  // rules — identical every single time, and charged at full price on
  // every turn. Anthropic will cache a repeated prefix and charge about
  // a tenth for it after the first call, which makes replies cheaper AND
  // faster (there is less to re-read before it starts writing, and slow
  // replies are why notifications feel late).
  //
  // ONLY the persona branch is split. The order is byte-identical to
  // what shipped — the same text, cut into two blocks — so the model
  // sees exactly what it saw before. Nothing is reordered, because
  // moving a prompt around changes behaviour and this runs on every
  // message of a live app.
  //
  // The ARCHIVE branch is deliberately left alone: its stable half (the
  // recorded answers) sits AFTER the dynamic blocks, so caching it would
  // mean reordering a legacy person's prompt. Not worth the risk for a
  // cost saving; revisit deliberately.
  //
  // PERSONA_RULES alone is ~481 tokens, under Anthropic's 1024 minimum.
  // It qualifies only because the persona (~1,250 tokens) sits in front
  // of it — which is why the cut goes here and not around the rules.
  const cacheablePrefix =
    archive.length > 0 ? null : `${personaPromptOverride}\n\n${PERSONA_RULES}\n`;
  const remainder =
    cacheablePrefix === null ? null : systemPrompt.slice(cacheablePrefix.length);

  // MODERATE THE PHOTO BEFORE ANY PATH CAN PERSIST IT.
  //
  // This scan used to live further down, after the tone-judge block
  // below — which persists the user's message AND its image when the
  // persona walks away. So a photo that moderation would reject landed
  // in the thread (and stayed there, behind a block the user can't
  // immediately clear) whenever the accompanying text tripped the
  // judge. Settings promises "every photo you share is scanned before
  // it's sent"; that promise now holds on every path through this
  // route. Flagged uploads are still cleaned out of storage.
  if (typeof payload.image_url === "string" && payload.image_url) {
    const imageVerdict = await moderateImage(payload.image_url);
    if (imageVerdict.flagged) {
      if (payload.image_storage_path) {
        await supabase.storage
          .from("chat-uploads")
          .remove([payload.image_storage_path])
          .then(() => undefined, () => undefined);
      }
      return NextResponse.json(
        {
          error:
            "That photo can't be sent — our content check flagged it. If this seems wrong, write care@chapter3five.app.",
          flagged: true,
          categories: imageVerdict.categories,
        },
        { status: 400 },
      );
    }
  }

  let warnedThisTurn: string | null = null;
  // Tone judge — never overrides a crisis message. Decides whether
  // the persona walks away from this conversation. Permissive by
  // design (and even more so in memorial mode).
  if (profile.active_oracle_id && !crisis.crisis) {
    const verdict = await judgeTone({
      recentMessages: history.slice(-8),
      currentMessage: userMessage,
      oracleName: characterName,
      textingStyle: profile.texting_style ?? null,
      ownerDeceased: memorialMode,
      language,
      priorStrikes,
    });

    if (verdict.block && verdict.severity) {
      const blockLine = await generateBlockLine({
        oracleName: characterName,
        textingStyle: profile.texting_style ?? null,
        language,
        reason: verdict.reason,
        severity: verdict.severity,
        ownerDeceased: memorialMode,
      });
      const until = cooldownUntil(verdict.severity);

      // Persist user's message + the persona's final line, then mark
      // the block. Service role for the block insert because clients
      // can't write to chat_blocks.
      const adminWrite = createAdminClient();
      // Assistant rows are written server-side: clients may only insert
      // their own 'user' turns.
      const { error: blockPersistErr } = await adminWrite
        .from("messages")
        .insert([
          {
            user_id: user.id,
            oracle_id: profile.active_oracle_id,
            role: "user",
            content: userMessage,
            image_url: payload.image_url ?? null,
            image_storage_path: payload.image_storage_path ?? null,
          },
          {
            user_id: user.id,
            oracle_id: profile.active_oracle_id,
            role: "assistant",
            content: blockLine,
          },
        ]);
      await adminWrite.from("chat_blocks").insert({
        oracle_id: profile.active_oracle_id,
        user_id: user.id,
        blocked_until: until.toISOString(),
        severity: verdict.severity,
        reason: verdict.reason,
      });

      // Pack-credit consumption -- only after the user row actually
      // persisted. Matches the normal path's `!persistErr` gate below;
      // without this a failed insert on the block path could eat a
      // paid credit for a message that never lived in the DB.
      // consumePackCredit never throws; a decrement failure can't
      // block the block-line reply.
      if (!blockPersistErr && tierCap.usingCredit) {
        await consumePackCredit(user.id, "message");
      }
      if (!blockPersistErr && imageUsesCredit) {
        await consumePackCredit(user.id, "image");
      }

      return NextResponse.json({
        reply: blockLine,
        blocked: true,
        blocked_until: until.toISOString(),
        severity: verdict.severity,
      });
    }

    // THE WARNING RUNG. Not block-worthy yet, but heading there: the
    // persona sets the limit out loud in this very reply — and may say
    // what happens next ("keep talking to me like that and i'm gone"),
    // their call, in their voice. Logged as a pre-closed chat_blocks
    // row (severity 'warning', already expired + closed so neither
    // gate nor the comeback cron ever treats it as a walk-away) so the
    // NEXT judgment sees the strike and escalates.
    if (verdict.warn) {
      warnedThisTurn = warningBlockFor(verdict.reason);
      const nowIso = new Date().toISOString();
      const { error: warnLogErr } = await createAdminClient()
        .from("chat_blocks")
        .insert({
          oracle_id: profile.active_oracle_id,
          user_id: user.id,
          blocked_at: nowIso,
          blocked_until: nowIso,
          unblocked_at: nowIso,
          severity: "warning",
          reason: verdict.reason ?? "tone heading toward a block",
        });
      if (warnLogErr) {
        console.error("[chat] warning-strike log failed:", warnLogErr);
      }
    }
  }

  // Ladder parts — computed AFTER the judge (which sets warnedThisTurn)
  // and appended to the assembled prompt below. A warned turn sets the
  // limit out loud; an accepted apology shapes the comeback. Mutually
  // exclusive in practice: an apology arrives INTO a block, a warning
  // fires outside one.
  const ladderPart = warnedThisTurn
    ? `\n\n${warnedThisTurn}`
    : apologyAccepted
      ? `\n\n${APOLOGY_ACCEPTED_BLOCK}`
      : "";

  // Liveness cues (2026-08-25): birthday awareness + imperfect
  // thumbs. Formula companions only — an archive of a real person
  // gets neither a fake birthday celebration nor fake typos.
  // Formula companions only: not archives, and NOT Adrian — the
  // shared concierge row is readable by everyone (that's how his card
  // renders), so without this gate the id-hash could deal typos to
  // every free-tier user's Adrian on mobile while web excludes him
  // (self-audit 2026-08-25).
  const livenessOracle =
    ownOracle && !ownOracle.is_legacy && !ownOracle.is_concierge
      ? ownOracle
      : null;
  const birthdayCue = livenessOracle
    ? birthdayTodayBlock(livenessOracle.traits, profile.timezone ?? null)
    : null;
  const livenessCues = livenessOracle
    ? `${birthdayCue ? `\n\n${birthdayCue}` : ""}${typoRuleFor(livenessOracle.traits, livenessOracle.id ?? "")}`
    : "";

  // If the user attached an image, send it to Anthropic as a vision
  // input. URL-based images are supported by the API. The image lives
  // in the chat-photos bucket as a long-lived signed URL.
  type ContentBlock =
    | { type: "text"; text: string }
    | {
        type: "image";
        source: { type: "url"; url: string };
      };
  const userTurnContent: ContentBlock[] = [];
  if (typeof payload.image_url === "string" && payload.image_url) {
    // Already moderated above, before the tone judge — see that block.
    // Catches sexual content (incl. minors), graphic violence,
    // self-harm, hate. Required for App Store 1.2 (UGC moderation must
    // be demonstrable).
    userTurnContent.push({
      type: "image",
      source: { type: "url", url: payload.image_url },
    });
  }
  userTurnContent.push({ type: "text", text: userMessage });

  const messages = [
    ...history.slice(-HISTORY_LIMIT).map((m) => ({
      role: m.role,
      content: m.content,
    })),
    {
      role: "user" as const,
      content: userTurnContent.length > 1 ? userTurnContent : userMessage,
    },
  ];

  try {
    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 800,
      // HOW THIS PERSON TEXTS. Appended here rather than baked into the
      // static prompt literal above, because it differs per identity —
      // that is the entire point. Last wins, so this overrides the
      // generic one-in-four line for anyone the formula gave a style.
      // Two blocks when the prefix is cacheable, one string otherwise.
      // Concatenated the blocks are byte-identical to what shipped.
      system:
        cacheablePrefix !== null && remainder !== null
          ? [
              {
                type: "text" as const,
                text: cacheablePrefix,
                cache_control: { type: "ephemeral" as const },
              },
              {
                type: "text" as const,
                text:
                  remainder +
                  ladderPart +
                  `\n\nYOUR TEXTING RHYTHM (this overrides the general splitting guidance above).\n${burstRuleFor(ownOracle?.text_burst_style)}` +
                  livenessCues,
              },
            ]
          : systemPrompt +
            ladderPart +
            `\n\nYOUR TEXTING RHYTHM (this overrides the general splitting guidance above).\n${burstRuleFor(ownOracle?.text_burst_style)}` +
            livenessCues,
      messages,
    });

    // Record the spend so the cap above is enforceable at all. Without
    // this the phone's usage was invisible to the ledger AND to the web
    // route's cap, which reads the same table. Fire-and-forget: a
    // ledger write must never fail a reply the user is waiting on.
    void recordAnthropicSpend({
      userId: user.id,
      model: ANTHROPIC_MODEL,
      usage: response.usage as unknown as Parameters<
        typeof recordAnthropicSpend
      >[0]["usage"],
      route: "chat_mobile",
    });

    const rawReply = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();

    // Multi-message bursts: persona may split a reply with ---SPLIT---
    // when the rhythm of the moment calls for 2-3 short messages
    // instead of one. Split, trim, drop empties.
    const replies = rawReply
      .split(/---SPLIT---/g)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const reply = replies[0] ?? rawReply;

    // Persona photo decision. Only fires for non-crisis turns and
    // when there's an avatar to anchor face consistency. Capped at
    // ~2 photos per persona per 7 days so it stays special.
    let personaPhotoUrl: string | null = null;
    if (
      profile.active_oracle_id &&
      ownOracle?.avatar_url &&
      !crisis.crisis &&
      ownOracle.mode !== "help"
    ) {
      try {
        const atCap = await isAtPhotoCap({
          oracleId: profile.active_oracle_id,
          userId: user.id,
        });
        if (!atCap) {
          const verdict = await judgePhotoSend({
            characterName,
            characterBio: oracleBio ?? "",
            recentTurns: history.slice(-6).map((t) => ({
              role: t.role,
              content: t.content,
            })),
            userMessage,
          });
          if (verdict.send && verdict.subject) {
            personaPhotoUrl = await generatePersonaPhoto({
              oracleId: profile.active_oracle_id,
              userId: user.id,
              subject: verdict.subject,
              avatarUrl: ownOracle.avatar_url,
            });
          }
        }
      } catch (err) {
        console.error("[persona photo] pipeline failed:", err);
      }
    }

    // Persist user message + every assistant burst. If a persona
    // photo was generated, attach it to the LAST assistant message
    // so the visual lands at the end of the reply rhythm.
    if (profile.active_oracle_id) {
      // Explicit, strictly-increasing created_at per row. All rows of
      // a turn land in ONE insert, so the column default (now(), frozen
      // per statement) stamped IDENTICAL timestamps — and any
      // created_at-ordered read (mobile history/resync, exports) got
      // plan-dependent tie order: replies rendered ABOVE the user
      // message they answer (Wilson mobile report 2026-08-02). 1ms
      // steps keep user → burst-1 → burst-2 order stable everywhere.
      const persistBase = Date.now();
      const rows: {
        user_id: string;
        oracle_id: string;
        role: "user" | "assistant";
        content: string;
        image_url?: string | null;
        image_storage_path?: string | null;
        read_by_oracle_at?: string | null;
        created_at?: string;
      }[] = [
        {
          user_id: user.id,
          oracle_id: profile.active_oracle_id,
          role: "user",
          content: userMessage,
          image_url: payload.image_url ?? null,
          image_storage_path: payload.image_storage_path ?? null,
          // Stamp read_by_oracle_at at persist time — the persona has
          // already "read" this turn (their reply is composed and
          // about to land in the same insert). Mobile receipt UI
          // flips from Sent → Read on the next resync. Web stream
          // route does the same at stream/route.ts:533.
          read_by_oracle_at: new Date().toISOString(),
          created_at: new Date(persistBase).toISOString(),
        },
      ];
      replies.forEach((r, i) => {
        const isLast = i === replies.length - 1;
        rows.push({
          user_id: user.id,
          oracle_id: profile.active_oracle_id!,
          role: "assistant",
          content: r,
          image_url: isLast && personaPhotoUrl ? personaPhotoUrl : null,
          created_at: new Date(persistBase + 1 + i).toISOString(),
        });
      });
      // Assistant rows are written server-side: clients may only insert
      // their own 'user' turns.
      const { error: persistErr } = await createAdminClient()
        .from("messages")
        .insert(rows);

      // Pack-credit consumption — only after the rows actually landed
      // so a failed persist doesn't eat a paid credit. Never throws;
      // a decrement failure never blocks the reply already composed.
      if (!persistErr && tierCap.usingCredit) {
        await consumePackCredit(user.id, "message");
      }

      // TELL THEM SOMEONE ANSWERED.
      //
      // Until now a reply sent NOTHING. Pushes only ever came from the
      // four crons — proactive, check-in, anniversaries, outreach — the
      // times a companion starts the conversation. Answer someone and
      // they heard nothing at all: text your companion, lock the phone,
      // and the reply sat in the database until you happened to open the
      // app again (Wilson 2026-08-23: "I wrote to someone and quickly
      // closed it to see if I would get the notification and I didn't,
      // but then I went to the app and saw they replied").
      //
      // For an app whose whole promise is that someone reached out to
      // you, that is the wrong half to be missing.
      //
      // Sent unconditionally, and the CLIENT decides whether to show a
      // banner. The server cannot know if they are still looking at the
      // screen — the reply takes ~30s and they may have left in the
      // meantime — so guessing here would either miss the people who
      // walked away or buzz the people still reading. lib/push.ts's
      // notification handler suppresses the banner when the thread they
      // are already in is the one that just replied, which is what
      // iMessage does, while the badge and the list still update.
      //
      // Best-effort and awaited-but-swallowed: a push failure must never
      // turn a delivered reply into an error response.
      if (!persistErr && replies.length > 0) {
        const preview = replies[replies.length - 1] ?? reply;
        // Did this exchange contain a "text me in the morning"-style
        // promise? Prescreened by regex, decided by Haiku, delivered by
        // the promised-pings cron — in after(), so noticing a promise
        // never delays keeping the conversation.
        const promiseUserText = userMessage ?? "";
        const promiseReplyText = replies.join("\n");
        after(async () => {
          await detectAndSchedulepromise({
            userId: user.id,
            oracleId: conversationOracleId ?? profile.active_oracle_id ?? "",
            userText: promiseUserText,
            replyText: promiseReplyText,
            replyMessageId: null,
            timezone: profile.timezone ?? null,
          });
        });
        // INSIDE after(), so killing the app cannot kill the
        // notification. Swiping the app away severs the connection this
        // reply was generated on; anything still awaiting that response
        // dies with it, which is why backgrounding the app got a
        // notification and force-quitting it did not (Wilson 2026-08-23:
        // "if I swipe all the way up and close the app, notification
        // doesn't come"). Next's own docs are explicit that after() runs
        // "even if the response didn't complete successfully" — which is
        // exactly the case a force-quit creates.
        //
        // Force-quitting is not a rare thing for someone to do here:
        // you text your companion and put the phone away. That is the
        // moment the notification matters most.
        after(async () => {
          // AWAITED — after()'s lambda freezes the instant its promise
          // settles; a void'd fetch still in flight at that moment is
          // dropped, which is a reply notification that never arrives
          // for exactly the person who closed the app to wait for it
          // (same fix as the crisis push, 2026-08-25).
          await sendPushToUser({
          userId: user.id,
          title: profile.oracle_name ?? "chapter3five",
          body: preview.length > 180 ? `${preview.slice(0, 179)}…` : preview,
          badge: 1,
          categoryId: "companion_message",
          threadIdentifier: profile.active_oracle_id ?? undefined,
          // "companion" — the ONLY companion channel Android devices actually
          // have (lib/push.ts creates it; nothing ever created a
          // "companion-messages" channel). Android 8+ silently drops a
          // notification aimed at a channel that doesn't exist, and the
          // Expo receipt still reads "ok" because it measures handoff to
          // the phone, not display. So replies pushed fine to iOS and
          // vanished on Android with the app closed, while cron pushes
          // (already on "companion") kept arriving.
          channelId: "companion",
          data: { oracle_id: profile.active_oracle_id, kind: "reply" },
          }).catch(() => {
            /* a missed banner must never fail a delivered message */
          });
        });
      }
      if (!persistErr && imageUsesCredit) {
        await consumePackCredit(user.id, "image");
      }
    }

    // Memory extraction — formula-v4 slug extractor (same one the web
    // stream route runs), Haiku-tier, per user message, fire-and-forget.
    // Replaces the every-8th-turn kind/content extractor whose inserts
    // had been failing silently since 0060 made `key` NOT NULL. Skips
    // crisis turns (we don't store anything that could be re-surfaced
    // into a future conversation about a person's worst moment).
    if (profile.active_oracle_id && !crisis.crisis) {
      extractMemoriesFromMessage(
        userMessage,
        profile.active_oracle_id,
        user.id,
      ).catch((err) =>
        console.error("memory extraction (background) failed:", err),
      );
    }

    // Lazy sports extraction (real-mode only). Most archives have
    // nothing — that's fine, we still mark extracted_at so we don't
    // re-try.
    if (
      profile.active_oracle_id &&
      !isRandomizedOracle &&
      !sportsExtractedAt &&
      archive.length >= 12
    ) {
      const oracleIdForSports = profile.active_oracle_id;
      (async () => {
        try {
          const fandom = await extractSportsFromArchive({
            oracleName: characterName,
            language,
            answers: archive.map((a) => ({ question: a.prompt, body: a.answer })),
          });
          const writeAdmin = createAdminClient();
          await writeAdmin
            .from("oracles")
            .update({
              sports_fandom: fandom ?? { teams: [] },
              sports_extracted_at: new Date().toISOString(),
            })
            .eq("id", oracleIdForSports);
        } catch (err) {
          console.error("sports extraction (background) failed:", err);
        }
      })();
    }

    // Lazy ambient cast extraction (real-mode only — randomized ones
    // are populated at synthesis). Real-mode users name their people
    // in their answers; pull a structured handful so the chat can
    // reference them by name.
    if (
      profile.active_oracle_id &&
      !isRandomizedOracle &&
      !castExtractedAt &&
      archive.length >= 12
    ) {
      const oracleIdForCast = profile.active_oracle_id;
      (async () => {
        try {
          const cast = await extractCastFromArchive({
            oracleName: characterName,
            language,
            answers: archive.map((a) => ({ question: a.prompt, body: a.answer })),
          });
          const writeAdmin = createAdminClient();
          await writeAdmin
            .from("oracles")
            .update({
              ambient_cast: cast ?? null,
              cast_extracted_at: new Date().toISOString(),
            })
            .eq("id", oracleIdForCast);
        } catch (err) {
          console.error("cast extraction (background) failed:", err);
        }
      })();
    }

    // Lazy traits extraction (real-mode oracles only — randomized ones
    // are populated at synthesis). Same trigger as location: enough
    // archive answers + never tried before.
    if (
      profile.active_oracle_id &&
      !isRandomizedOracle &&
      !traitsExtractedAt &&
      archive.length >= 12
    ) {
      const oracleIdForTraits = profile.active_oracle_id;
      (async () => {
        try {
          const traits = await extractTraitsFromArchive({
            oracleName: characterName,
            language,
            answers: archive.map((a) => ({ question: a.prompt, body: a.answer })),
          });
          const writeAdmin = createAdminClient();
          await writeAdmin
            .from("oracles")
            .update({
              orientation: traits?.orientation ?? null,
              relationship_openness: traits?.openness ?? null,
              identity_quirks: traits?.quirks ?? null,
              traits_extracted_at: new Date().toISOString(),
            })
            .eq("id", oracleIdForTraits);
        } catch (err) {
          console.error("traits extraction (background) failed:", err);
        }
      })();
    }

    // Lazy location extraction. If we've never tried for this oracle
    // and there are enough archive answers to draw from, kick off a
    // background extract — next chat will have the WHERE YOU ARE
    // anchor. Owner can also set it manually from Settings.
    if (
      profile.active_oracle_id &&
      !locationExtractedAt &&
      archive.length >= 8
    ) {
      const oracleIdForExtract = profile.active_oracle_id;
      (async () => {
        try {
          const anchor = await extractLocationFromArchive({
            oracleName: characterName,
            language,
            answers: archive.map((a) => ({ question: a.prompt, body: a.answer })),
          });
          const writeAdmin = createAdminClient();
          await writeAdmin
            .from("oracles")
            .update({
              location_anchor: anchor ?? {},
              location_extracted_at: new Date().toISOString(),
            })
            .eq("id", oracleIdForExtract);
        } catch (err) {
          console.error("location extraction (background) failed:", err);
        }
      })();
    }

    // Backward-compatible: still return single `reply` for clients
    // that haven't been updated; new clients use `replies[]`.
    return NextResponse.json({ reply, replies });
  } catch (err) {
    // When Anthropic hiccups, don't break character with a generic
    // "Something went wrong" — that breaks the illusion the whole product
    // is built on. Return a short in-voice line instead. UI keeps it in
    // the chat, no error banner. Logged for observability + Sentry.
    console.error("anthropic call failed:", err);
    const Sentry = await import("@sentry/nextjs").catch(() => null);
    Sentry?.captureException(err, {
      tags: { route: "api/chat", oracle_id: profile.active_oracle_id ?? null },
    });
    const fallback =
      language === "es"
        ? "perdón, no me llega bien la señal. dame un momento e intenta de nuevo?"
        : "sorry — signal's bad. give me a sec and try again?";
    return NextResponse.json({ reply: fallback, transient: true });
  }
}
