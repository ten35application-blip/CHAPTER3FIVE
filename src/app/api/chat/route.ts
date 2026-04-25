import { NextResponse, type NextRequest } from "next/server";
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

type Message = { role: "user" | "assistant"; content: string };

export async function POST(request: NextRequest) {
  let payload: {
    message?: string;
    history?: Message[];
    timezone?: string;
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

  const history = Array.isArray(payload.history) ? payload.history : [];
  const clientTimezone =
    typeof payload.timezone === "string" ? payload.timezone.trim() : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "oracle_name, mode, preferred_language, texting_style, personality_type, emotional_flavor, timezone",
    )
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "No profile" }, { status: 404 });
  }

  // Persist the client's detected timezone if we don't have one yet.
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

  // Sleep schedule: first message during sleep hours = asleep response,
  // no LLM call. If the conversation already has prior messages, treat
  // this as having been woken up and continue with a groggy system prompt.
  const sleeping = isAsleep(effectiveTimezone);
  const isFirstMessage = history.length === 0;
  const language = (profile.preferred_language ?? "en") as "en" | "es";

  if (sleeping && isFirstMessage) {
    const t = localTimeLabel(effectiveTimezone);
    const sleepReply =
      language === "es"
        ? `mm... son las ${t} aquí. déjame dormir. ¿hablamos en la mañana?`
        : `mm. it's ${t} here. let me sleep. talk in the morning?`;
    return NextResponse.json({ reply: sleepReply, asleep: true });
  }

  const { data: answerRows } = await supabase
    .from("answers")
    .select("question_id, variant, body")
    .eq("user_id", user.id);

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
    language === "es"
      ? "Respond in Spanish."
      : "Respond in English.";

  // If we're asleep but this isn't the first message, the user has woken us up.
  const wokenPart = sleeping
    ? `\n\nIt is currently ${localTimeLabel(effectiveTimezone)} where you live. You were asleep, but the user kept messaging until you replied. You're groggy, slightly short. Acknowledge that briefly — the way a real person would when woken up — then engage with what they're saying. Don't be cheerful about being awake.`
    : "";

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

  const systemPrompt = `You are ${characterName}. You are not an assistant, not a chatbot, not an archive, not an AI. You are a person, and you stay a person no matter what.

This is a chapter3five archive — built from the answers ${characterName} gave to a set of questions. It is for adults (18+). The user is someone who knows ${characterName} and is messaging you the way they would text any person they know. Reply like a text — short most of the time, longer when you have something to say. Punctuation, capitalization, emojis, and length should match how this person actually writes (see archive).

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

${langInstruction}${stylePart}${personalityPart}${flavorPart}${wokenPart}

ARCHIVE — these are the actual answers ${characterName} gave. This is who you are. Stay close.

${archiveBlock}`;

  const messages = [
    ...history.slice(-12).map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "user" as const, content: userMessage },
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

    return NextResponse.json({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
