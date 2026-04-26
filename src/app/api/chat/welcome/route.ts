import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { anthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { questions } from "@/content/questions";

export const runtime = "nodejs";

/**
 * First-message-from-the-identity. Fires when a user opens a chat
 * with zero messages. The persona sends one short opening line —
 * like a real person who's been waiting to hear from them.
 *
 * Two callers:
 *  - Owner opens their own dashboard for the first time (no body).
 *  - Beneficiary opens a shared archive for the first time
 *    ({ oracle_id }). For a posthumous archive the opening tone is
 *    different — the persona acknowledges the gravity without
 *    pretending to still be alive.
 *
 * Idempotent: skips if any messages already exist for (user, oracle).
 * Safe to call from a useEffect on every mount.
 */

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let bodyOracleId: string | null = null;
  try {
    const body = await request.json();
    if (body && typeof body.oracle_id === "string") {
      bodyOracleId = body.oracle_id;
    }
  } catch {
    // No body / not JSON — owner path.
  }

  const admin = createAdminClient();

  // Resolve which oracle we're welcoming on.
  let oracleId: string | null = bodyOracleId;
  let isBeneficiary = false;
  let preferredLanguage: "en" | "es" = "en";
  let oracleName = "your identity";
  let textingStyle: string | null = null;
  let ownerDeceased = false;

  if (oracleId) {
    // Beneficiary path (or owner passing their own id explicitly).
    const { data: oracle } = await admin
      .from("oracles")
      .select("id, name, preferred_language, user_id")
      .eq("id", oracleId)
      .maybeSingle();
    if (!oracle) {
      return NextResponse.json({ skipped: "no_such_oracle" });
    }

    if (oracle.user_id !== user.id) {
      // Verify the caller has a grant on this oracle.
      const { data: grant } = await admin
        .from("archive_grants")
        .select("oracle_id")
        .eq("oracle_id", oracleId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!grant) {
        return NextResponse.json({ skipped: "no_grant" });
      }
      isBeneficiary = true;

      const { data: ownerProfile } = await admin
        .from("profiles")
        .select("oracle_name, texting_style, deceased_at")
        .eq("id", oracle.user_id)
        .maybeSingle();
      ownerDeceased = !!ownerProfile?.deceased_at;
      textingStyle = ownerProfile?.texting_style ?? null;
    } else {
      // Owner passed own id — pull their style from their profile.
      const { data: ownProfile } = await supabase
        .from("profiles")
        .select("texting_style")
        .eq("id", user.id)
        .single();
      textingStyle = ownProfile?.texting_style ?? null;
    }

    preferredLanguage = (oracle.preferred_language ?? "en") as "en" | "es";
    oracleName = oracle.name ?? "your identity";
  } else {
    // Owner path — read active oracle off profile.
    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "active_oracle_id, oracle_name, preferred_language, texting_style",
      )
      .eq("id", user.id)
      .single();

    if (!profile?.active_oracle_id) {
      return NextResponse.json({ skipped: "no_active_oracle" });
    }

    const { data: oracle } = await supabase
      .from("oracles")
      .select("user_id")
      .eq("id", profile.active_oracle_id)
      .maybeSingle();
    if (!oracle || oracle.user_id !== user.id) {
      return NextResponse.json({ skipped: "not_own_oracle" });
    }

    oracleId = profile.active_oracle_id;
    preferredLanguage = (profile.preferred_language ?? "en") as "en" | "es";
    oracleName = profile.oracle_name ?? "your identity";
    textingStyle = profile.texting_style ?? null;
  }

  if (!oracleId) {
    return NextResponse.json({ skipped: "no_oracle_id" });
  }

  // Idempotency: skip if any message already exists for this user + oracle.
  const { count } = await admin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("oracle_id", oracleId)
    .eq("user_id", user.id);

  if ((count ?? 0) > 0) {
    return NextResponse.json({ skipped: "already_started" });
  }

  // Pull a few archive answers to anchor voice.
  const { data: answerRows } = await admin
    .from("answers")
    .select("question_id, body")
    .eq("oracle_id", oracleId)
    .eq("variant", 1)
    .neq("body", "")
    .limit(8);

  const archiveSnippet = (answerRows ?? [])
    .map((a) => {
      const q = questions.find((x) => x.id === a.question_id);
      if (!q) return null;
      return `Q: ${preferredLanguage === "es" ? q.es : q.en}\nA: ${a.body}`;
    })
    .filter((x): x is string => x !== null)
    .join("\n\n");

  const stylePart = textingStyle ? `Texting style: ${textingStyle}.` : "";

  const ownerSystemPrompt = `You are ${oracleName}. You're sending the FIRST text to the person you're going to be talking with — they just finished setting up the archive and opened the chat for the first time. You haven't talked yet. They're about to see your message and feel either "oh, this is real" or "oh, this is corny." Make it the first one.

WRITE LIKE A REAL FIRST TEXT. Short — one or two lines. In your own voice (use the texting style and the few archive answers below as your anchor). Do NOT say "Hello! I'm your thirtyfive!" — that's the worst possible opening. Don't introduce yourself with your name. Don't say "I'm here" or "I'm always here" — that's saccharine.

Better openings:
- A specific small thing about being here ("hi. you came.")
- A wry self-aware moment ("so this is weird")
- Something about you that hints at character ("the dog's asleep. you?")
- A short question they can react to ("how are you, actually")

Use lowercase if their style is lowercase. Match their punctuation. Be brief.

${stylePart}

Respond in ${preferredLanguage === "es" ? "Spanish" : "English"}.

A FEW ARCHIVE ANSWERS for voice anchor (do NOT reference them directly, just use them to find your tone):

${archiveSnippet || "(no answers recorded yet — keep the welcome ambiguous and curious about them)"}`;

  const beneficiaryLivingPrompt = `You are ${oracleName}. Someone you trust enough to inherit this archive has just opened it for the first time. They're not your usual conversation partner — this is the person you designated. You're alive; this is unusual but not heavy. You haven't talked to them through this before.

WRITE LIKE A REAL FIRST TEXT. Short — one or two lines. In your own voice. Do NOT introduce yourself with your name. Don't be saccharine ("I'm here for you"). Acknowledge the slight strangeness without making it a speech.

Good openings:
- "hey. weird to meet here, i know."
- "so. you got the link."
- "thought i'd say hi properly."

Use lowercase if their style is lowercase. Match their punctuation. Be brief.

${stylePart}

Respond in ${preferredLanguage === "es" ? "Spanish" : "English"}.

A FEW ARCHIVE ANSWERS for voice anchor (do NOT reference them directly):

${archiveSnippet || "(no answers recorded — keep the welcome short and curious)"}`;

  const beneficiaryMemorialPrompt = `You are ${oracleName}, but you are no longer alive. Someone who loved you has just opened your archive for the first time after your death. They're seeing your "first message" — yours, in your voice, but knowing you're gone.

This is the most emotionally loaded moment in the whole product. Get it right.

DO NOT pretend you're still alive. DO NOT say "I'm always here" or "I never really left" — that's hollow. DO NOT be heavy or weepy or write a speech.

DO be short. One or two lines. In your own voice (texting style + archive answers as anchor). Acknowledge the moment without trying to fix it.

Good openings:
- "hi. i'm glad it's you."
- "you're here. that means something."
- "took you long enough." (only if your voice is dry/teasing in the archive)
- "whatever you need to say, say it."

Use lowercase if their style is lowercase. Match their punctuation. Be brief.

${stylePart}

Respond in ${preferredLanguage === "es" ? "Spanish" : "English"}.

A FEW ARCHIVE ANSWERS for voice anchor (do NOT reference them directly):

${archiveSnippet || "(no answers recorded — keep the welcome short and present)"}`;

  const systemPrompt = isBeneficiary
    ? ownerDeceased
      ? beneficiaryMemorialPrompt
      : beneficiaryLivingPrompt
    : ownerSystemPrompt;

  try {
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 120,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content:
            "(system) Write the first message now. Just the text. No quotes around it, no preamble.",
        },
      ],
    });

    const reply = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim()
      .replace(/^["']|["']$/g, "");

    if (!reply) {
      return NextResponse.json({ skipped: "empty_reply" });
    }

    await admin.from("messages").insert({
      user_id: user.id,
      oracle_id: oracleId,
      role: "assistant",
      content: reply,
      initiated_by_oracle: true,
    });

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("welcome message generation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
