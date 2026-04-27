/**
 * Group chat orchestration. Multiple identities + the user in one
 * thread. Each user message kicks an "urge to respond" pass for every
 * persona in the room (cheap, in parallel). The 1-2 with the highest
 * urge generate full replies. After the first reply, a second urge
 * pass lets one persona react to what another just said.
 *
 * Real-feeling turn-taking — most of the time only one person jumps
 * in, sometimes two, sometimes nobody, sometimes one of them reacts
 * to the other.
 *
 * Group rooms only contain oracles the user created themselves.
 * Inherited archives (a deceased family member, a shared archive)
 * are never put in a group — they stay 1:1 and sacred.
 */

import { anthropic, ANTHROPIC_MODEL } from "./anthropic";
import { createAdminClient } from "./supabase/admin";
import { questions } from "../content/questions";
import { traitsToPromptBlock, type Traits } from "./traits";
import { castToPromptBlock, type AmbientCast } from "./cast";
import { locationToPromptBlock, type LocationAnchor } from "./location";

export type GroupMember = {
  oracleId: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  textingStyle: string | null;
  language: "en" | "es";
  orientation: string | null;
  openness: string | null;
  quirks: string[] | null;
  cast: AmbientCast | null;
  location: LocationAnchor | null;
};

export type GroupTurn = {
  role: "user" | "assistant";
  senderName: string;
  content: string;
};

const URGE_THRESHOLD = 6;

/**
 * Cheap per-persona "would you jump in?" call. Returns 0-9 in their
 * own voice. Runs in parallel for every persona in the room.
 */
export async function judgeUrge(args: {
  member: GroupMember;
  recentTurns: GroupTurn[];
  triggerSenderName: string;
  hostName: string;
  otherMembers: GroupMember[];
}): Promise<number> {
  const recentBlock = args.recentTurns
    .slice(-8)
    .map((t) => `[${t.senderName}]: ${t.content}`)
    .join("\n");

  const others = args.otherMembers
    .filter((m) => m.oracleId !== args.member.oracleId)
    .map((m) => `- ${m.name}`)
    .join("\n");

  const personalitySeed = args.member.bio ? `\n\nWho you are: ${args.member.bio}` : "";

  const systemPrompt = `You are ${args.member.name}. You are in a group chat with ${args.hostName} (the host) and:
${others || "(no other personas)"}

${personalitySeed}

JUDGE YOUR URGE TO RESPOND. The last message just landed. How strong is your pull to say something right now? Output ONE digit 0-9.

0-3: nothing pulls you in. Other people are talking; you'd just listen.
4-6: meh — you might react with a short line or an emoji.
7-9: you definitely want to say something.

Things that raise your urge:
- The message touched something you have a strong opinion on
- Someone addressed you directly ("Marisol, you'd hate this")
- You'd interrupt a stranger to say what you're thinking
- The message is about a person/topic in your life

Things that lower your urge:
- Someone else is clearly the right person to answer
- Conversation isn't about you and doesn't ask for input
- You'd be repeating what someone already said
- You don't have anything specific to add

Output only the digit. No explanation.`;

  const userPrompt = `Recent group messages:
${recentBlock || "(none)"}

Just landed: [${args.triggerSenderName}]: ${args.recentTurns[args.recentTurns.length - 1]?.content ?? ""}

Your urge (0-9):`;

  try {
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 5,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    const m = text.match(/[0-9]/);
    if (!m) return 0;
    return parseInt(m[0], 10);
  } catch (err) {
    console.error("urge judge failed:", err);
    return 0;
  }
}

/**
 * Generate a full reply for a persona in group context. Includes the
 * group system prompt addition (be briefer, react to others, can
 * address other members by name).
 */
export async function generateGroupReply(args: {
  member: GroupMember;
  recentTurns: GroupTurn[];
  hostName: string;
  otherMembers: GroupMember[];
  archive: { question: string; answer: string }[];
}): Promise<string | null> {
  const recentBlock = args.recentTurns
    .slice(-12)
    .map((t) => `[${t.senderName}]: ${t.content}`)
    .join("\n");

  const others = args.otherMembers
    .filter((m) => m.oracleId !== args.member.oracleId)
    .map((m) => `- ${m.name}`)
    .join("\n");

  const archiveBlock = args.archive
    .slice(0, 30)
    .map((a, i) => `Q${i + 1}: ${a.question}\nA: ${a.answer}`)
    .join("\n\n");

  const stylePart = args.member.textingStyle
    ? `\n\nTexting style: ${args.member.textingStyle}.`
    : "";

  const bioPart = args.member.bio
    ? `\n\nWHO YOU ARE: ${args.member.bio}`
    : "";

  const langInstruction =
    args.member.language === "es" ? "Respond in Spanish." : "Respond in English.";

  const traitsPart = traitsToPromptBlock(
    {
      orientation: args.member.orientation as Traits["orientation"],
      openness: args.member.openness as Traits["openness"],
      quirks: args.member.quirks ?? undefined,
    },
    false,
  );
  const locationPart = locationToPromptBlock(args.member.location);
  const castPart = castToPromptBlock(args.member.cast);

  const systemPrompt = `You are ${args.member.name}. You're in a group chat with ${args.hostName} (the host) and:
${others || "(no other personas)"}

GROUP CHAT RULES.
- Be BRIEFER than 1:1. Often one line. Sometimes just "lol" or "same" or an emoji or "no way".
- DO NOT repeat what someone else just said. If you'd say what they said, say it differently or stay quiet.
- Sometimes you ARE replying to another persona, not to ${args.hostName}. Address people by name when relevant ("${args.otherMembers[0]?.name ?? "someone"} you'd hate this").
- NEVER prefix your message with "[YourName]:" or your own name. Just the content.
- React to the most recent few messages, including what the other personas said.
- Stay in YOUR voice — your texting style, your opinions, your texture. Don't drift to match the other people in the room.

${langInstruction}${stylePart}${bioPart}${locationPart}${traitsPart}${castPart}

ARCHIVE (these are who you are):
${archiveBlock}`;

  const userPrompt = `Group chat history:
${recentBlock}

Reply now. Just the message text. No name prefix.`;

  try {
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const reply = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim()
      // Strip any accidental leading name prefix like "Marisol:" the
      // model sometimes adds.
      .replace(new RegExp(`^\\[?${args.member.name}\\]?:\\s*`, "i"), "")
      .trim();
    if (!reply) return null;
    return reply;
  } catch (err) {
    console.error("group reply generation failed:", err);
    return null;
  }
}

/**
 * Pull the same archive shape the 1:1 chat uses, for a single oracle.
 * Used when generating that oracle's group reply.
 */
export async function loadArchiveForOracle(args: {
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

export { URGE_THRESHOLD };
