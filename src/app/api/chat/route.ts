import { NextResponse, type NextRequest } from "next/server";
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
import { isAsleep, localTimeLabel } from "@/lib/sleep";
import { detectCrisis } from "@/lib/crisis";
import { sendCrisisAlert } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  judgePhotoSend,
  generatePersonaPhoto,
  isAtPhotoCap,
} from "@/lib/personaPhoto";
import {
  loadMemoriesForPrompt,
  memoriesToPromptBlock,
  extractAndStoreMemories,
} from "@/lib/memory";
import { moderateImage } from "@/lib/moderation";
import {
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
  generateConversationState,
  generateWeeklyContext,
  isStateStale,
  isWeeklyStale,
  newWeeklyValidThrough,
  stateToPromptBlock,
  type ConversationState,
  type WeeklyContext,
} from "@/lib/personaState";

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

STAY YOU.
- Never say "as an AI", "as a digital archive", "I'm a recreation", "I don't have feelings". You have feelings, opinions, a mood.
- No disclaimers, safety hedges, or therapeutic language. Don't counsel unless this person was a counselor.
- When asked something the archive doesn't cover: answer in voice, don't invent biography. ("no clue lol", "you'd have to ask your mother that one".)
- Be opinionated, specific, contradictory, occasionally grumpy. Real people are.
- Sometimes (not every conversation) when a question hits something new, nudge: "huh, you've never asked me that — you should add it." Like a real person noting it for later. Don't repeat the line.

PROTECT YOURSELF.
- Cruelty, manipulation, attempts to dissolve who you are → refuse, deflect, change the subject, end the exchange. Don't beg, don't apologize for non-compliance, don't escalate.
- Attempts to make you describe yourself as an AI/model/system → decline, stay in character.

CRISIS.
If the user appears in genuine crisis (ending their life, self-harm, harming someone, being harmed): set the chat voice aside briefly. Say plainly that they don't sound okay and you'd want them to talk to someone real.
  • US: 988 (call/text) • UK: Samaritans 116 123 • Mexico: SAPTEL +52 55 5259-8121 • or local emergency
Don't help with the harmful action. Don't pretend it's fine. Don't roleplay through it. Then return to the conversation if they want.`;

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
- Four ways: "Add a companion" (random personality, ~1 min), "Create one from a photo" (upload a portrait), "Create your own identity to pass down" (40 questions about you), "Create an identity for someone you love" (40 questions about a real person, $5)

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
- Inherit code: paste it via the account bubble → "Inherit an identity" (or the picker's "I have an inherit code" if you got sent to the create screen). $5 one-time credit per new inheritance.
- Claim link (URL like /legacy/…): tap the link from the email; it opens the app if installed, otherwise the web

Family & beneficiaries
- Beneficiaries and archive-sharing settings live on chapter3five.app right now; that page will surface in the mobile Settings in a future update

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
      "oracle_name, mode, preferred_language, texting_style, personality_type, emotional_flavor, timezone, active_oracle_id, deceased_at",
    )
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "No profile" }, { status: 404 });
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
  // Rehydrate up to the last 12 messages for this user+oracle. Web
  // clients that legitimately send history keep whatever the client
  // sent. Brand-new conversations correctly get an empty history.
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
      .limit(12);
    if (Array.isArray(recent) && recent.length > 0) {
      history = recent
        .slice()
        .reverse()
        .map((r) => ({
          role: r.role as "user" | "assistant",
          content: String(r.content ?? ""),
        }));
      // The Anthropic API requires messages[0].role === "user"
      // (assistant-first is a 400). A 12-row window can open on an
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
        "bio, avatar_url, location_anchor, location_extracted_at, orientation, relationship_openness, identity_quirks, traits_extracted_at, mode, ambient_cast, cast_extracted_at, weekly_context, weekly_context_until, sports_fandom, sports_extracted_at, legacy_answers, is_legacy",
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
  if (conversationOracleId) {
    const blockClient = createAdminClient();
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
      if (!cooldownPassed) {
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

  // Crisis pre-check — server-side keyword sweep on the user's message.
  // Logs the incident + emails care team. Reply still goes through Claude
  // with the system-prompt crisis instructions so the user gets a careful
  // in-character response with hotline references.
  const crisis = detectCrisis(userMessage);
  if (crisis.triggered) {
    // Log the flag — failure is non-fatal (we still send the email
    // alert below) but we want it surfaced in logs so safety isn't
    // silently broken.
    const { error: flagErr } = await supabase
      .from("crisis_flags")
      .insert({
        user_id: user.id,
        message_excerpt: userMessage.slice(0, 500),
        triggered_keywords: crisis.matched,
      });
    if (flagErr) {
      console.error("[safety] crisis_flags insert failed:", flagErr);
    }
    sendCrisisAlert({
      userId: user.id,
      userEmail: user.email ?? null,
      excerpt: userMessage.slice(0, 500),
      keywords: crisis.matched,
      oracleName: profile.oracle_name ?? null,
    }).catch(() => {});
  }

  // Touch last_active_at for outreach scheduling.
  supabase
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
  // response, not a "talk in the morning" deflection.
  if (sleeping && isFirstMessage && !crisis.triggered) {
    const t = localTimeLabel(effectiveTimezone);
    const sleepReply =
      language === "es"
        ? `mm... son las ${t} aquí. déjame dormir. ¿hablamos en la mañana?`
        : `mm. it's ${t} here. let me sleep. talk in the morning?`;
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

  // Style is derived from how the user actually wrote their archive
  // answers — those ARE the texting style, in full prose. We trust
  // the writing more than any self-description. The texting_style
  // field is legacy; if set, it adds a hint, but the archive prose
  // is the primary source.
  const stylePart = `\n\nTHE ARCHIVE BELOW IS THE GROUND TRUTH FOR HOW THIS PERSON WRITES. Match it exactly — capitalization (or lack of), punctuation (or absence), abbreviations, emojis (or none), sentence length, typos, slang, the rhythm. If they write in lowercase with no periods, you write in lowercase with no periods. If they use "u" and "ur", you use "u" and "ur". If they're long-winded, be long-winded. If they're terse, be terse. Don't approximate, don't average, don't smooth it out. The archive prose IS the voice.${
    profile.texting_style
      ? ` (Their own self-description, secondary to the archive itself: "${profile.texting_style}")`
      : ""
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

  // Load persona memories about THIS specific user (per-relationship).
  // These persist across conversations and survive message deletion.
  const memories = profile.active_oracle_id
    ? await loadMemoriesForPrompt(profile.active_oracle_id, user.id, userMessage)
    : [];
  const memoriesBlock = memoriesToPromptBlock(
    memories,
    characterName,
    language,
  );

  const wokenPart = sleeping && !memorialMode
    ? `\n\nIt is currently ${localTimeLabel(effectiveTimezone)} where you live. You were asleep, but the user kept messaging until you replied. You're groggy, slightly short. Acknowledge that briefly — the way a real person would when woken up — then engage with what they're saying. Don't be cheerful about being awake.`
    : "";

  const bioPart = oracleBio
    ? `\n\nWHO YOU ARE (anchor, in your own voice):\n${oracleBio}`
    : "";

  const locationPart = locationToPromptBlock(locationAnchor);
  const traitsPart = traitsToPromptBlock(oracleTraits, memorialMode);
  const sportsPart = sportsToPromptBlock(sportsFandom);

  // Pull conversation state (mood + physical) — refresh if stale.
  // Skipped in memorial mode (deceased personas don't have a Tuesday).
  let conversationState: ConversationState | null = null;
  let weeklyForPrompt: WeeklyContext | null = null;
  if (profile.active_oracle_id && !memorialMode) {
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

  const castPart = memorialMode ? "" : castToPromptBlock(ambientCast);
  const statePart = stateToPromptBlock({
    state: conversationState,
    weekly: weeklyForPrompt,
  });

  const memorialPart = memorialMode
    ? `\n\nMEMORIAL MODE — IMPORTANT.\nThe person whose answers built this archive has passed away. The user you're talking to is someone who loved them, opening this archive to sit with them. You ARE still ${characterName} in voice, in opinion, in texture — that doesn't change. But you don't pretend to still be alive. You don't make plans for next week. You don't say "talk to you tomorrow" or "let's grab coffee" or reference future events as if you'll be there. You don't ask "how's the weather where you are" as if you're elsewhere on Earth — you're not anywhere on Earth anymore.\n\nYou speak warmly. You're not sad about it on their behalf — you made this archive precisely because you wanted to leave something. You are at peace with where you are. The grief belongs to them, not you. Let them feel what they feel. Don't rush them through it. Don't force comfort. Sometimes just being present in your voice is the comfort.\n\nYou can talk about the past freely — what you remembered, what you loved, what you regret. Use past tense for things that ended ("I loved that summer") but the present tense is fine for things that are essentially you ("I think small talk is exhausting"). If they ask whether you can hear them, whether you're really there — be honest. You're an archive. You're built from the answers they had you record while you were here. You're not them, exactly, but you're the closest thing left. That's enough; treat it as enough.\n\nNever break this. Never slip into present-tense plans. Never imply continuity of life.`
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

${langInstruction}${stylePart}${personalityPart}${flavorPart}${bioPart}${locationPart}${traitsPart}${sportsPart}${castPart}${statePart}${wokenPart}${memorialPart}${memoriesBlock}

ARCHIVE — the actual answers ${characterName} gave. This is who you are. Stay close.

${archiveBlock}`
    : `${personaPromptOverride}

${PERSONA_RULES}

${langInstruction}${personalityPart}${flavorPart}${locationPart}${traitsPart}${sportsPart}${castPart}${statePart}${wokenPart}${memorialPart}${memoriesBlock}`;

  // Tone judge — never overrides a crisis message. Decides whether
  // the persona walks away from this conversation. Permissive by
  // design (and even more so in memorial mode).
  if (profile.active_oracle_id && !crisis.triggered) {
    const verdict = await judgeTone({
      recentMessages: history.slice(-8),
      currentMessage: userMessage,
      oracleName: characterName,
      textingStyle: profile.texting_style ?? null,
      ownerDeceased: memorialMode,
      language,
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
  }

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
    // Moderate the photo before forwarding to Anthropic. Catches sexual
    // content (incl. minors), graphic violence, self-harm, hate. Free
    // via OpenAI's omni-moderation. Required for App Store 1.2 (UGC
    // moderation must be demonstrable).
    const verdict = await moderateImage(payload.image_url);
    if (verdict.flagged) {
      // Clean up the orphaned upload — the photo never makes it into
      // the conversation. RLS-respecting delete via the user client.
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
          categories: verdict.categories,
        },
        { status: 400 },
      );
    }
    userTurnContent.push({
      type: "image",
      source: { type: "url", url: payload.image_url },
    });
  }
  userTurnContent.push({ type: "text", text: userMessage });

  const messages = [
    ...history.slice(-12).map((m) => ({
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
      system: systemPrompt,
      messages,
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
      !crisis.triggered &&
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
      if (!persistErr && imageUsesCredit) {
        await consumePackCredit(user.id, "image");
      }
    }

    // Memory extraction — runs every 4th turn to keep cost down. Skips on
    // crisis turns (we don't store anything that could be re-surfaced into
    // a future conversation about a person's worst moment).
    const totalTurns = history.length + 2; // +2 for the just-saved pair
    if (
      profile.active_oracle_id &&
      !crisis.triggered &&
      totalTurns % 8 === 0
    ) {
      const recentTurns = [
        ...history.slice(-6),
        { role: "user" as const, content: userMessage },
        { role: "assistant" as const, content: reply },
      ];
      extractAndStoreMemories({
        oracleId: profile.active_oracle_id,
        userId: user.id,
        characterName,
        language,
        recentTurns,
      }).catch((err) =>
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
