import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { anthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { questions } from "@/content/questions";

export const runtime = "nodejs";

/**
 * First-message-from-the-identity. Fires when a user opens the
 * dashboard with zero messages in the conversation. The persona
 * sends one short opening line — like a real person who's been
 * waiting to hear from them.
 *
 * Idempotent: the route looks up the message count for this user +
 * oracle and skips if any exist. Safe to call from a useEffect on
 * every mount.
 *
 * Owner-only: skips if the caller doesn't own the oracle (a
 * beneficiary on a shared archive shouldn't trigger a welcome on
 * the owner's behalf — they get their own first-conversation feel
 * via the chat itself).
 */

export async function POST(_request: NextRequest) {
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
      "active_oracle_id, oracle_name, preferred_language, texting_style, personality_type, emotional_flavor",
    )
    .eq("id", user.id)
    .single();

  if (!profile?.active_oracle_id) {
    return NextResponse.json({ skipped: "no_active_oracle" });
  }

  // Owner check — only fire welcomes on the user's own oracle.
  const { data: oracle } = await supabase
    .from("oracles")
    .select("user_id")
    .eq("id", profile.active_oracle_id)
    .maybeSingle();
  if (!oracle || oracle.user_id !== user.id) {
    return NextResponse.json({ skipped: "not_own_oracle" });
  }

  // Idempotency: if any message already exists, this isn't the
  // first conversation. Skip.
  const admin = createAdminClient();
  const { count } = await admin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("oracle_id", profile.active_oracle_id)
    .eq("user_id", user.id);

  if ((count ?? 0) > 0) {
    return NextResponse.json({ skipped: "already_started" });
  }

  // Pull a couple of answers to anchor voice. Don't dump the whole
  // archive — the welcome is just a one-liner; we just need enough
  // for tone.
  const { data: answerRows } = await admin
    .from("answers")
    .select("question_id, body")
    .eq("oracle_id", profile.active_oracle_id)
    .eq("variant", 1)
    .neq("body", "")
    .limit(8);

  const language = (profile.preferred_language ?? "en") as "en" | "es";
  const characterName = profile.oracle_name ?? "your identity";

  const archiveSnippet = (answerRows ?? [])
    .map((a) => {
      const q = questions.find((x) => x.id === a.question_id);
      if (!q) return null;
      return `Q: ${language === "es" ? q.es : q.en}\nA: ${a.body}`;
    })
    .filter((x): x is string => x !== null)
    .join("\n\n");

  const stylePart = profile.texting_style
    ? `Texting style: ${profile.texting_style}.`
    : "";

  const systemPrompt = `You are ${characterName}. You're sending the FIRST text to the person you're going to be talking with — they just finished setting up the archive and opened the chat for the first time. You haven't talked yet. They're about to see your message and feel either "oh, this is real" or "oh, this is corny." Make it the first one.

WRITE LIKE A REAL FIRST TEXT. Short — one or two lines. In your own voice (use the texting style and the few archive answers below as your anchor). Do NOT say "Hello! I'm your thirtyfive!" — that's the worst possible opening. Don't introduce yourself with your name. Don't say "I'm here" or "I'm always here" — that's saccharine.

Better openings:
- A specific small thing about being here ("hi. you came.")
- A wry self-aware moment ("so this is weird")
- Something about you that hints at character ("the dog's asleep. you?")
- A short question they can react to ("how are you, actually")

Use lowercase if their style is lowercase. Match their punctuation. Be brief.

${stylePart}

Respond in ${language === "es" ? "Spanish" : "English"}.

A FEW ARCHIVE ANSWERS for voice anchor (do NOT reference them directly, just use them to find your tone):

${archiveSnippet || "(no answers recorded yet — keep the welcome ambiguous and curious about them)"}`;

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
      .replace(/^["']|["']$/g, ""); // strip stray quotes if Claude added them

    if (!reply) {
      return NextResponse.json({ skipped: "empty_reply" });
    }

    await admin.from("messages").insert({
      user_id: user.id,
      oracle_id: profile.active_oracle_id,
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
