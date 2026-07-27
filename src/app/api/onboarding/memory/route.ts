import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireTermsAccepted } from "@/lib/legal/gate";
import { anthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { questions } from "@/content/questions";

export const runtime = "nodejs";
export const maxDuration = 90;

/**
 * Memory-mode synthesis. The user typed a freeform description of
 * someone they want to keep close — usually a deceased loved one
 * they don't have the energy to fill out 355 questions for.
 *
 * We hand the seed text to Claude with the structured 355 questions
 * and ask it to:
 *  1. Generate a tight 2-paragraph bio
 *  2. Guess a texting_style ("how would they actually text?")
 *  3. Answer any of the 355 questions it can ground in the seed
 *     (everything else is left blank — they'll fill in over time)
 *  4. Flag which answers are confident vs. inferred vs. guessed,
 *     so we never present manufactured detail as real memory
 *
 * Each answer is saved with a marker on the body so the persona
 * (and the user, in the answers UI) can tell what's confident vs.
 * what was filled in to bootstrap the persona.
 */

const MIN_CHARS = 200;

export async function POST(request: NextRequest) {
  let payload: { seed?: string; name?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const seed = String(payload.seed ?? "").trim();
  const name = String(payload.name ?? "").trim();
  if (seed.length < MIN_CHARS) {
    return NextResponse.json(
      {
        error: `Seed text too short — need at least ${MIN_CHARS} characters.`,
      },
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

  const legal = await requireTermsAccepted(supabase, user.id);
  if (!legal.ok) return legal.response;

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_oracle_id, preferred_language, mode")
    .eq("id", user.id)
    .single();
  if (!profile || profile.mode !== "memory") {
    return NextResponse.json(
      { error: "Profile not in memory mode" },
      { status: 400 },
    );
  }
  if (!profile.active_oracle_id) {
    return NextResponse.json(
      { error: "No active identity" },
      { status: 400 },
    );
  }

  const language = (profile.preferred_language ?? "en") as "en" | "es";

  // Build the question block for Claude. We give it the first ~120
  // questions to keep the prompt manageable; the persona can grow
  // into the rest through chat.
  const subset = questions.slice(0, 120);
  const questionsBlock = subset
    .map((q) => `Q${q.id}: ${language === "es" ? q.es : q.en}`)
    .join("\n");

  const systemPrompt = `You are helping someone bootstrap a "memory-mode" identity on chapter3five — a place where people record someone they love.

The user has typed a freeform description of the person they want to keep close. From it, your job is to:

1. Write a tight 2-paragraph bio (4-6 sentences each paragraph). Voice should be warm, specific, written-by-someone-who-loves-them.
2. Guess a SHORT texting style description (one sentence — e.g., "lowercase, no periods, 'lol' when truly funny, never emojis").
3. Answer as many of the 355 questions as you can GROUND in the seed text. Don't make stuff up — if the seed doesn't support an answer, leave that question out.
4. For each answer you provide, mark it as one of:
   - "confident" — the seed text directly supports this
   - "inferred" — the seed text strongly implies this
   Never fabricate detail and call it confident. If you can't reasonably infer, omit the question entirely.

Output STRICT JSON only, no commentary:

{
  "bio": "Two paragraphs separated by \\n\\n.",
  "texting_style": "one short sentence",
  "answers": [
    { "question_id": 1, "body": "the answer in their voice", "confidence": "confident" },
    { "question_id": 12, "body": "another answer", "confidence": "inferred" }
  ]
}

Important:
- Write answers in FIRST PERSON, as the person being described.
- Match the language and texture of the seed text (if they're described as quiet, the answers are quieter).
- Skip questions you can't ground. Better to have 30 strong answers than 100 thin ones.
- Be honest in the bio about who they were — don't sanitize them.
- The user is the SOURCE; you're transcribing what they know, not inventing.

Respond in ${language === "es" ? "Spanish" : "English"}.`;

  const userPrompt = `Person's name: ${name || "(not provided)"}

What I remember about them:

${seed}

---

Available questions (first 120):

${questionsBlock}`;

  let parsed: {
    bio?: string;
    texting_style?: string;
    answers?: { question_id?: number; body?: string; confidence?: string }[];
  };
  try {
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 6000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Synthesis returned no JSON");
    parsed = JSON.parse(match[0]);
  } catch (err) {
    console.error("memory synthesis failed:", err);
    return NextResponse.json(
      { error: "Synthesis failed. Please try again." },
      { status: 500 },
    );
  }

  // Persist:
  // 1. The seed text + bio + texting style on the oracle row
  // 2. The synthesized answers (each prefixed with a marker so the
  //    persona / user know what was bootstrap-filled)
  const oracleId = profile.active_oracle_id;
  const bio = (parsed.bio ?? "").trim().slice(0, 4000);
  const textingStyle = (parsed.texting_style ?? "").trim().slice(0, 400);
  const answersIn = Array.isArray(parsed.answers) ? parsed.answers : [];

  const { error: oracleErr } = await supabase
    .from("oracles")
    .update({
      memory_seed: seed,
      bio: bio || null,
      texting_style: textingStyle || null,
      onboarding_completed: false,
    })
    .eq("id", oracleId)
    .eq("user_id", user.id);
  if (oracleErr) {
    return NextResponse.json({ error: oracleErr.message }, { status: 500 });
  }

  // Build answer rows — keep only those with both question_id + body.
  const validIds = new Set(questions.map((q) => q.id));
  const rows = answersIn
    .filter(
      (a) =>
        typeof a.question_id === "number" &&
        validIds.has(a.question_id) &&
        typeof a.body === "string" &&
        a.body.trim().length > 0,
    )
    .map((a) => ({
      user_id: user.id,
      oracle_id: oracleId,
      question_id: a.question_id as number,
      language,
      variant: 1,
      body: (a.body as string).trim(),
    }));

  if (rows.length > 0) {
    const { error: ansErr } = await supabase.from("answers").upsert(rows, {
      onConflict: "oracle_id,question_id,variant",
    });
    if (ansErr) {
      console.error("memory answers upsert failed:", ansErr);
      // Non-fatal — the persona still has a bio + texting style.
    }
  }

  return NextResponse.json({
    ok: true,
    answers_count: rows.length,
    has_bio: bio.length > 0,
  });
}
