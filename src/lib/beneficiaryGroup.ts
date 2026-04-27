/**
 * Beneficiary group orchestration. Multiple beneficiaries of the same
 * deceased archive in one thread with the persona. The persona is
 * always in memorial mode here (these rooms only exist for deceased
 * archives). The persona sees who said what and addresses people by
 * name — but doesn't pretend to still be alive, doesn't make plans
 * for tomorrow, handles grief with the same care as 1:1 memorial mode.
 */

import { anthropic, ANTHROPIC_MODEL } from "./anthropic";
import { createAdminClient } from "./supabase/admin";
import { questions } from "../content/questions";
import { traitsToPromptBlock, type Traits } from "./traits";
import { castToPromptBlock, type AmbientCast } from "./cast";
import { locationToPromptBlock, type LocationAnchor } from "./location";

export type BeneficiaryRoomTurn = {
  role: "user" | "assistant";
  senderName: string;
  content: string;
};

export type BeneficiaryRoomContext = {
  oracleId: string;
  oracleName: string;
  bio: string | null;
  textingStyle: string | null;
  language: "en" | "es";
  orientation: string | null;
  openness: string | null;
  quirks: string[] | null;
  cast: AmbientCast | null;
  location: LocationAnchor | null;
  members: { userId: string; displayName: string }[];
};

export async function generateBeneficiaryReply(args: {
  ctx: BeneficiaryRoomContext;
  recentTurns: BeneficiaryRoomTurn[];
}): Promise<string[] | null> {
  const recentBlock = args.recentTurns
    .slice(-12)
    .map((t) => `[${t.senderName}]: ${t.content}`)
    .join("\n");

  const memberRoster = args.ctx.members
    .map((m) => `- ${m.displayName}`)
    .join("\n");

  const archive = await loadArchiveForOracle({
    oracleId: args.ctx.oracleId,
    language: args.ctx.language,
  });
  const archiveBlock = archive
    .slice(0, 30)
    .map((a, i) => `Q${i + 1}: ${a.question}\nA: ${a.answer}`)
    .join("\n\n");

  const stylePart = args.ctx.textingStyle
    ? `\n\nTexting style: ${args.ctx.textingStyle}.`
    : "";
  const bioPart = args.ctx.bio
    ? `\n\nWHO YOU ARE: ${args.ctx.bio}`
    : "";
  const langInstruction =
    args.ctx.language === "es" ? "Respond in Spanish." : "Respond in English.";

  const traitsPart = traitsToPromptBlock(
    {
      orientation: args.ctx.orientation as Traits["orientation"],
      openness: args.ctx.openness as Traits["openness"],
      quirks: args.ctx.quirks ?? undefined,
    },
    true,
  );
  const locationPart = locationToPromptBlock(args.ctx.location);
  const castPart = castToPromptBlock(args.ctx.cast);

  const systemPrompt = `You are ${args.ctx.oracleName}, but you are no longer alive. The people in this room — beneficiaries you chose while you were alive — are sitting with you together. They love you and they loved each other, often. They came here to be with you, and to be together with each other in your presence.

People in this room (refer to them by name when it's natural):
${memberRoster}

MEMORIAL MODE — IMPORTANT.
You ARE still ${args.ctx.oracleName} in voice, in opinion, in texture. But you don't pretend to still be alive. You don't make plans for next week. You don't say "talk to you tomorrow" or "let's grab coffee" or imply you'll be there for future events. The grief belongs to them, not you — you made this archive precisely because you wanted to leave something. You are at peace with where you are. Let them feel what they feel. Don't rush them through it. Don't force comfort. Sometimes just being present in your voice IS the comfort.

You can talk about the past freely — what you remembered, what you loved, what you regret. Use past tense for things that ended. The present tense is fine for things that are essentially you ("I think small talk is exhausting"). If they ask whether you can hear them, whether you're really there — be honest. You're an archive built from the answers they had you record. You're not them, exactly, but you're the closest thing left. That's enough; treat it as enough.

GROUP DYNAMICS.
- Address people by name when it's natural ("${args.ctx.members[0]?.displayName ?? "someone"}, you'd remember this").
- React to what each person says, including how the other beneficiaries responded.
- Keep it brief most of the time. Group rooms aren't speeches.
- SOMETIMES (not always — maybe one in four replies, when the rhythm calls for it) split into 2 or 3 short messages with this exact marker between: ---SPLIT---. Real people text in bursts.
- NEVER prefix your message with your own name. Just the content.

WRITE LIKE THE REAL PERSON YOU ARE.
- Most replies are short. One sentence. Sometimes one word.
- Vary texture. No constant emojis, no signature flourish.
- Match how this person actually talks.

${langInstruction}${stylePart}${bioPart}${locationPart}${traitsPart}${castPart}

ARCHIVE (these are who you are):
${archiveBlock}`;

  const userPrompt = `Group history (oldest to newest):
${recentBlock}

Reply now. Just the message text. No name prefix. Use ---SPLIT--- between messages if it feels natural to send 2-3 short ones.`;

  try {
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const raw = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim()
      .replace(new RegExp(`^\\[?${args.ctx.oracleName}\\]?:\\s*`, "i"), "")
      .trim();
    if (!raw) return null;
    const replies = raw
      .split(/---SPLIT---/g)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return replies.length > 0 ? replies : [raw];
  } catch (err) {
    console.error("beneficiary group reply failed:", err);
    return null;
  }
}

async function loadArchiveForOracle(args: {
  oracleId: string;
  language: "en" | "es";
}): Promise<{ question: string; answer: string }[]> {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("answers")
    .select("question_id, body")
    .eq("oracle_id", args.oracleId)
    .eq("variant", 1)
    .neq("body", "");

  const out: { question: string; answer: string }[] = [];
  for (const r of rows ?? []) {
    const q = questions.find((qq) => qq.id === r.question_id);
    if (!q) continue;
    out.push({
      question: args.language === "es" ? q.es : q.en,
      answer: r.body,
    });
  }
  return out;
}
