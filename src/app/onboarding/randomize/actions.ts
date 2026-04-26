"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  questions,
  eligibleAnswerIndexes,
  type GenderFilter,
} from "@/content/questions";
import {
  pickPersonality,
  pickFlavor,
  PERSONALITY_DESCRIPTIONS,
  FLAVOR_DESCRIPTIONS,
  type PersonalityType,
  type EmotionalFlavor,
} from "@/content/personality";
import { anthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { rollRandomTraits } from "@/lib/traits";
import { rollRandomCast } from "@/lib/cast";

export async function generateRandomizedArchive(formData: FormData) {
  const genderRaw = String(formData.get("gender") ?? "any");
  const gender: GenderFilter =
    genderRaw === "female" || genderRaw === "male" ? genderRaw : "any";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/signin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language, mode, active_oracle_id, randomize_credits, randomize_count")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/onboarding");
  }
  if (!profile.active_oracle_id) {
    redirect("/onboarding");
  }

  // Paywall: must have at least one credit. Send to checkout if not.
  if ((profile.randomize_credits ?? 0) <= 0) {
    redirect("/randomize/pay");
  }

  const language = (profile.preferred_language ?? "en") as "en" | "es";
  const oracleId = profile.active_oracle_id;

  // Per-question independent random pick from the gender-filtered pool.
  const rows = questions
    .filter((q) => q.randomizeOptions && q.randomizeOptions[language]?.length)
    .map((q) => {
      const options = q.randomizeOptions[language];
      const allowed = eligibleAnswerIndexes(options.length, gender);
      if (allowed.length === 0) return null;
      const idx = allowed[Math.floor(Math.random() * allowed.length)];
      return {
        user_id: user.id,
        oracle_id: oracleId,
        question_id: q.id,
        language,
        variant: 1,
        body: options[idx],
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) {
    redirect("/onboarding/randomize?error=No%20answers%20match%20that%20pick");
  }

  const { error: insertError } = await supabase
    .from("answers")
    .upsert(rows, { onConflict: "oracle_id,question_id,variant" });

  if (insertError) {
    redirect(
      `/onboarding/randomize?error=${encodeURIComponent(insertError.message)}`,
    );
  }

  // Layer a coherent character on top: an MBTI-style type + an emotional flavor.
  const personalityType = pickPersonality();
  const emotionalFlavor = pickFlavor();

  // Decrement credits + increment count atomically-ish.
  const newCredits = Math.max(0, (profile.randomize_credits ?? 0) - 1);
  const newCount = (profile.randomize_count ?? 0) + 1;

  await supabase
    .from("profiles")
    .update({
      personality_type: personalityType,
      emotional_flavor: emotionalFlavor,
      randomize_credits: newCredits,
      randomize_count: newCount,
    })
    .eq("id", user.id);

  // Roll the persona's orientation, romantic openness, and 0–3
  // identity quirks from a wide weird pool. Persisted on the oracle
  // so the chat system prompt has them on every turn. The user
  // discovers these by talking — never shown on a profile or stat
  // page — so two randomized identities always feel like different
  // actual people.
  const traits = rollRandomTraits();
  const cast = rollRandomCast();
  await supabase
    .from("oracles")
    .update({
      orientation: traits.orientation,
      relationship_openness: traits.openness,
      identity_quirks: traits.quirks,
      traits_extracted_at: new Date().toISOString(),
      ambient_cast: cast,
      cast_extracted_at: new Date().toISOString(),
    })
    .eq("id", oracleId);

  // Synthesize a backstory the persona can stand on. Reads a sample
  // of the random answers + the personality + flavor, asks Claude
  // for a short first-person bio (name already chosen, age/place/
  // occupation/defining traits filled in). Stored on oracles.bio
  // and injected into the chat system prompt so the persona has
  // concrete anchors instead of relying on emergent properties of
  // the random answers.
  await synthesizeBio({
    oracleId,
    oracleName:
      (
        await supabase
          .from("oracles")
          .select("name")
          .eq("id", oracleId)
          .maybeSingle()
      ).data?.name ?? "your identity",
    language,
    personality: personalityType as PersonalityType,
    flavor: emotionalFlavor as EmotionalFlavor,
    answers: rows.slice(0, 30).map((r) => {
      const q = questions.find((qq) => qq.id === r.question_id)!;
      return {
        prompt: language === "es" ? q.es : q.en,
        answer: r.body,
      };
    }),
  });

  redirect("/onboarding/randomize/meet");
}

async function synthesizeBio(opts: {
  oracleId: string;
  oracleName: string;
  language: "en" | "es";
  personality: PersonalityType;
  flavor: EmotionalFlavor;
  answers: { prompt: string; answer: string }[];
}): Promise<void> {
  try {
    const supabase = await createClient();
    const archive = opts.answers
      .map((a) => `Q: ${a.prompt}\nA: ${a.answer}`)
      .join("\n\n");

    const personalityDesc =
      PERSONALITY_DESCRIPTIONS[opts.personality] ?? "";
    const flavorDesc = FLAVOR_DESCRIPTIONS[opts.flavor] ?? "";

    const langInstr =
      opts.language === "es"
        ? "Escribe el bio en español, en primera persona."
        : "Write the bio in English, first person.";

    const systemPrompt = `You are reading 30 sample answers a randomized chapter3five identity gave to questions about themselves. The identity's name is ${opts.oracleName}. Their personality is ${opts.personality} (${personalityDesc}). Their emotional flavor is "${opts.flavor}" (${flavorDesc}).

Your job: write a SHORT first-person introduction — 3 to 5 sentences — that this person would write about themselves. Establish: an approximate age (e.g. "late 30s", "early 60s"), a place they live, what they do for work or how they spend their days, and 1-2 defining traits. Anchor on details that show up in the answers. Don't invent facts that contradict the answers.

Voice: as if THEY are introducing themselves to someone who's about to talk to them. Match their personality. Don't be saccharine. Don't list traits like a dating profile. Make it feel like a real human paragraph.

${langInstr}

Output ONLY the bio paragraph(s). No JSON, no preamble, no quote marks around it.

ARCHIVE SAMPLE:
${archive}`;

    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 400,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content:
            "Write the bio now. Just the paragraph(s). No quotes, no preamble.",
        },
      ],
    });

    const bio = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim()
      .replace(/^["']|["']$/g, "");

    if (!bio) return;

    await supabase
      .from("oracles")
      .update({ bio })
      .eq("id", opts.oracleId);
  } catch (err) {
    // Bio generation is best-effort. If it fails, the persona still
    // works — just falls back to personality + flavor + answer pool.
    console.error("bio synthesis failed:", err);
  }
}
