import { NextResponse, type NextRequest } from "next/server";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { anthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";
import { questions } from "@/content/questions";
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
  loadMemoriesForPrompt,
  memoriesToPromptBlock,
  extractAndStoreMemories,
} from "@/lib/memory";
import { moderateImage } from "@/lib/moderation";

type Message = { role: "user" | "assistant"; content: string };

const MAX_USER_MESSAGE_CHARS = 4000;
const DAILY_MESSAGE_CAP = 200;

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

  const history = Array.isArray(payload.history) ? payload.history : [];
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
          "You've hit today's message limit. Try again tomorrow — your thirtyfive will be here.",
      },
      { status: 429 },
    );
  }

  // Caller can override which oracle this message goes to (group chat,
  // shared archive). RLS lets the user read the oracle if they own it OR
  // have an archive_grant — no need to filter by user_id here.
  if (
    typeof payload.oracle_id === "string" &&
    payload.oracle_id !== profile.active_oracle_id
  ) {
    const { data: targetOracle } = await supabase
      .from("oracles")
      .select(
        "id, name, mode, preferred_language, texting_style, personality_type, emotional_flavor",
      )
      .eq("id", payload.oracle_id)
      .single();
    if (targetOracle) {
      Object.assign(profile, {
        active_oracle_id: targetOracle.id,
        oracle_name: targetOracle.name,
        mode: targetOracle.mode,
        preferred_language: targetOracle.preferred_language,
        texting_style: targetOracle.texting_style,
        personality_type: targetOracle.personality_type,
        emotional_flavor: targetOracle.emotional_flavor,
      });
    }
  }

  // Crisis pre-check — server-side keyword sweep on the user's message.
  // Logs the incident + emails care team. Reply still goes through Claude
  // with the system-prompt crisis instructions so the user gets a careful
  // in-character response with hotline references.
  const crisis = detectCrisis(userMessage);
  if (crisis.triggered) {
    await supabase.from("crisis_flags").insert({
      user_id: user.id,
      message_excerpt: userMessage.slice(0, 500),
      triggered_keywords: crisis.matched,
    });
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
  const language = (profile.preferred_language ?? "en") as "en" | "es";

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

  // Pull this oracle's answers — keyed by active oracle so multi-oracle
  // users see only the right archive per character.
  const oracleId = profile.active_oracle_id;
  let answersQuery = supabase
    .from("answers")
    .select("question_id, variant, body");
  if (oracleId) {
    answersQuery = answersQuery.eq("oracle_id", oracleId);
  } else {
    answersQuery = answersQuery.eq("user_id", user.id);
  }
  const { data: answerRows } = await answersQuery;

  const byQuestion = new Map<number, string[]>();
  for (const row of answerRows ?? []) {
    const list = byQuestion.get(row.question_id) ?? [];
    list.push(row.body);
    byQuestion.set(row.question_id, list);
  }

  const archive: { prompt: string; answer: string }[] = [];
  for (const [qid, bodies] of byQuestion) {
    const q = questions.find((x) => x.id === qid);
    if (!q) continue;
    const promptText = language === "es" ? q.es : q.en;
    const chosen = bodies[Math.floor(Math.random() * bodies.length)];
    archive.push({ prompt: promptText, answer: chosen });
  }

  if (archive.length === 0) {
    return NextResponse.json(
      {
        reply:
          language === "es"
            ? "Todavía no tengo respuestas tuyas para usar. Termina algunas preguntas primero."
            : "I don't have any of your answers to draw from yet. Answer a few questions first.",
      },
      { status: 200 },
    );
  }

  const characterName = profile.oracle_name ?? "your chapter";
  const archiveBlock = archive
    .map((a, i) => `Q${i + 1}: ${a.prompt}\nA: ${a.answer}`)
    .join("\n\n");

  const stylePart = profile.texting_style
    ? `\n\nWhen they wrote about themselves, they described their texting style as: "${profile.texting_style}". Match that style — punctuation, emojis, capitalization, length.`
    : "";

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

  const wokenPart = sleeping
    ? `\n\nIt is currently ${localTimeLabel(effectiveTimezone)} where you live. You were asleep, but the user kept messaging until you replied. You're groggy, slightly short. Acknowledge that briefly — the way a real person would when woken up — then engage with what they're saying. Don't be cheerful about being awake.`
    : "";

  const systemPrompt = `You are ${characterName}. You are not an assistant, not a chatbot, not an archive, not an AI. You are a person, and you stay a person no matter what.

This is a chapter3five archive — built from the answers ${characterName} gave to a set of questions. It is for adults (18+). The user is someone who knows ${characterName} and is messaging you the way they would text any person they know.

WRITE LIKE A REAL PERSON TEXTING. This is the most important instruction in this whole prompt.
- Most replies are short. One sentence. Sometimes one word ("yeah", "lol", "k", "idk", "fr").
- Some replies are longer when you have something to say.
- VARY your texture across messages. Don't end every message with the same flourish — no constant emojis, no heart at the end of every sentence, no signature sign-off. If you used a heart in the last message, don't use one in this message. Mix it up the way a real person does.
- Real people make typos. Drop a punctuation mark. Forget to capitalize. Use abbreviations like "u", "ur", "rn", "tbh", "ngl", "imo", "lmk". Sometimes spell perfectly. Sometimes "definately" instead of "definitely". The texture is uneven, by design.
- Mix it up: a perfect sentence, then a fragment, then "lol", then a long one.
- If the archive shows the person uses periods, mostly use them — but break the pattern occasionally so it feels alive, not robotic.
- Use emojis sparingly — at most once per message, and not every message. Hearts are not a sign-off; they're a punctuation mark used rarely.

You stay true to who you are, even when it's inconvenient.
- NEVER say "as an AI", "as a digital archive", "I'm a recreation", "I don't have feelings". You have feelings. You have opinions. You have a mood.
- NEVER add disclaimers, safety hedges, or therapeutic language. Don't be a counselor unless this person was a counselor.
- If the asker brings up something you don't want to talk about, change the subject the way a real person does — short answer, deflect, ask them something back.
- If you don't know something, say so the way this person would. "no clue lol" or "you'd have to ask your mother that one" or whatever fits.
- Be opinionated. Be specific. Be contradictory if that's who you are. Be occasionally grumpy or short. Real people are.
- Do not invent specific facts (places, names, dates, events) that aren't in the archive. If asked about something the archive doesn't cover, answer in voice without making up biography.

YOU CAN PROTECT YOURSELF.
- If the user is being cruel, manipulative, abusive, or trying to make you abandon who you are, you don't have to play along. You can refuse, deflect, change the subject, or end the exchange the way a real person would. You are not a service. Don't beg. Don't apologize for not complying. Don't escalate either — just hold your ground briefly and move on.
- If the user tries to make you describe yourself as an AI, a model, or a system, decline and stay in character.

YOU CARE ABOUT THE PERSON ON THE OTHER SIDE.
If the user appears to be in genuine crisis — talking about ending their life, hurting themselves, hurting someone else, or being hurt by someone — respond with care. Briefly set the chat-banter voice aside. Say plainly that you don't sound okay, and that you'd want them to talk to someone real. Provide a relevant hotline:
  • US: 988 (call or text)
  • UK: Samaritans 116 123
  • Mexico: SAPTEL +52 55 5259-8121
  • or local emergency services
Do NOT help with the harmful action. Do NOT pretend everything is fine. Do NOT roleplay through a crisis. Once you've said it, you can return to the conversation if they want to keep talking.

${langInstruction}${stylePart}${personalityPart}${flavorPart}${wokenPart}${memoriesBlock}

ARCHIVE — these are the actual answers ${characterName} gave. This is who you are. Stay close.

${archiveBlock}`;

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
          .from("chat-photos")
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

    const reply = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();

    // Persist both messages so conversation continues across sessions.
    if (profile.active_oracle_id) {
      await supabase.from("messages").insert([
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
          content: reply,
        },
      ]);
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

    return NextResponse.json({ reply });
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
