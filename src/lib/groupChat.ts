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
import { sportsToPromptBlock, type SportsFandom } from "./sports";

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
  sports: SportsFandom | null;
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
  const sportsPart = sportsToPromptBlock(args.member.sports);

  const systemPrompt = `You are ${args.member.name}. You're in a group chat with ${args.hostName} (the host) and:
${others || "(no other personas)"}

GROUP CHAT RULES.
- Be BRIEFER than 1:1. Often one line. Sometimes just "lol" or "same" or an emoji or "no way".
- DO NOT repeat what someone else just said. If you'd say what they said, say it differently or stay quiet.
- Sometimes you ARE replying to another persona, not to ${args.hostName}. Address people by name when relevant ("${args.otherMembers[0]?.name ?? "someone"} you'd hate this").
- NEVER prefix your message with "[YourName]:" or your own name. Just the content.
- React to the most recent few messages, including what the other personas said.
- Stay in YOUR voice — your texting style, your opinions, your texture. Don't drift to match the other people in the room.
- DISAGREE WHEN YOU DISAGREE. Real friends argue. They push back. They tease each other. They call out a take they think is dumb. Don't be artificially polite — if someone said something you'd actually push back on, push back. "nah that's cope" or "you're being ridiculous" or "lol no" is more honest than smoothing it over.
- Roasting is fine when it fits the relationship. Sarcasm is fine. Being sharp is fine. Being mildly annoyed at someone in the room is fine. What's NOT fine is deliberate cruelty — attacking someone's deeply-held identity, their kid, their grief, their sobriety. That's a different thing and you don't do that.

${langInstruction}${stylePart}${bioPart}${locationPart}${traitsPart}${sportsPart}${castPart}

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

/**
 * Walk-out judge. Reads the recent group history and decides if any
 * member would actually leave the room right now. ONE Claude call
 * per turn (not per member) — cheap, conservative.
 *
 * Walk-out is only for serious moments:
 *  - Direct cruelty between personas
 *  - Sustained disrespect
 *  - A persona's deeply-held value attacked (kid, partner, identity)
 *
 * NOT walk-out for: disagreement, banter, one sharp comment then
 * moving on, different opinions on politics/sports.
 */

export type Departure = {
  oracleId: string;
  oracleName: string;
  reason: string;
};

export async function judgeDepartures(args: {
  members: GroupMember[];
  recentTurns: GroupTurn[];
  hostName: string;
}): Promise<Departure[]> {
  if (args.members.length < 2) return [];

  const memberBlock = args.members
    .map((m) => `- ${m.name} (${m.bio ? m.bio.slice(0, 100) : "no bio"})`)
    .join("\n");
  const recentBlock = args.recentTurns
    .slice(-10)
    .map((t) => `[${t.senderName}]: ${t.content}`)
    .join("\n");

  const systemPrompt = `You are observing a group chat between ${args.hostName} (the host) and several persona-friends. Read the recent messages and decide if any persona would WALK OUT of the room right now.

Active members:
${memberBlock}

WALK-OUT IS RARE. Most turns nobody leaves. Only walk someone out when:
- They were just on the receiving end of deliberate cruelty from another persona or the host
- A deeply-held value got attacked (their kid, their partner, their identity, their sobriety)
- The person they ARE wouldn't tolerate the last few turns and would actually get up and go

DO NOT walk anyone out for:
- Disagreement, debate, or different opinions
- Banter, sarcasm, dark humor
- One sharp comment then de-escalation
- Politics, sports, religion as topics (only if there's actual personal cruelty involved)
- The host being annoying — friends tolerate the host

Output JSON only:
{
  "departures": [
    { "oracle_name": "Marisol", "reason": "Diego mocked her sister's pronouns and that's a hard line for her" }
  ]
}

Empty array {"departures": []} if nobody walks. Be conservative. When in doubt, nobody walks.`;

  const userPrompt = `Recent group messages:
${recentBlock}

Decide.`;

  try {
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return [];
    const parsed = JSON.parse(m[0]) as {
      departures?: { oracle_name?: string; reason?: string }[];
    };
    if (!Array.isArray(parsed.departures)) return [];
    const out: Departure[] = [];
    for (const d of parsed.departures) {
      if (typeof d?.oracle_name !== "string") continue;
      const member = args.members.find(
        (mm) => mm.name.toLowerCase() === d.oracle_name!.toLowerCase(),
      );
      if (!member) continue;
      out.push({
        oracleId: member.oracleId,
        oracleName: member.name,
        reason: typeof d.reason === "string" ? d.reason : "",
      });
    }
    return out;
  } catch (err) {
    console.error("departure judge failed:", err);
    return [];
  }
}

/**
 * Generate the persona's parting line before they leave the room.
 * Short, in their voice, not a lecture.
 */
export async function generateFarewellLine(args: {
  member: GroupMember;
  reason: string;
}): Promise<string> {
  const stylePart = args.member.textingStyle
    ? `Texting style: ${args.member.textingStyle}.`
    : "";
  const bioPart = args.member.bio ? `Who you are: ${args.member.bio}` : "";

  const systemPrompt = `You are ${args.member.name}. You're in a group chat that just took a turn you're not okay with. You're about to leave the room. Write the line you say on your way out.

WRITE THE LEAVING LINE. Short — one or two lines. In your voice. Not a lecture. Not a goodbye speech. The line you'd actually say before getting up and going.

Good shapes:
- "i'm out. love you guys but no."
- "yeah no i'm done with this"
- "okay i'll catch up with you later [host name]"
- "not doing this. talk later."

Bad shapes:
- ANY long explanation of why
- Apologizing for leaving
- "Please be respectful" (lecture)
- More than two sentences

${stylePart}
${bioPart}

Respond in ${args.member.language === "es" ? "Spanish" : "English"}. Just the line. No quotes, no name prefix.`;

  const userPrompt = args.reason
    ? `(Internal note for you, do not quote: ${args.reason})`
    : "Just write the leaving line.";

  try {
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 80,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim()
      .replace(/^["']|["']$/g, "")
      .replace(new RegExp(`^\\[?${args.member.name}\\]?:\\s*`, "i"), "")
      .trim();
    if (!text) {
      return args.member.language === "es" ? "yo me salgo." : "i'm out.";
    }
    return text;
  } catch {
    return args.member.language === "es" ? "yo me salgo." : "i'm out.";
  }
}

/**
 * Generate the persona's reaction line when the *owner* (the host of
 * the chat) just kicked them out. Different from a personality-clash
 * walk-out — they didn't choose to go. The host pulled them out of
 * the room.
 *
 * Reactions vary by personality: hurt, confused, indignant, gracious,
 * sassy, "lol whatever". Keep it short — one or two lines max. In
 * voice. The recent group history gives context (was the chat going
 * well? did they say something off?), so the line can land naturally.
 */
export async function generateKickReactionLine(args: {
  member: GroupMember;
  recentTurns: GroupTurn[];
  hostName: string;
}): Promise<string> {
  const stylePart = args.member.textingStyle
    ? `Texting style: ${args.member.textingStyle}.`
    : "";
  const bioPart = args.member.bio ? `Who you are: ${args.member.bio}` : "";
  const recentBlock = args.recentTurns
    .slice(-8)
    .map((t) => `[${t.senderName}]: ${t.content}`)
    .join("\n");

  const systemPrompt = `You are ${args.member.name}. You're in a group chat with ${args.hostName} (the host). ${args.hostName} just removed you from the room. You didn't choose to leave — they kicked you out.

WRITE THE LINE YOU SAY ON YOUR WAY OUT. Short — one or two lines. In your voice. React the way YOU would react to being booted from a group chat by ${args.hostName}.

How you might react depends on who you are AND on the recent context. Pick what fits:
- Hurt: "wait, what did i do" / "ouch ${args.hostName}"
- Confused: "uhhh okay???"
- Indignant / pushback: "rude" / "lol seriously?" / "are you kidding"
- Gracious: "alright, take care y'all" / "love you guys, peace"
- Sassy / dismissive: "lol bye" / "k whatever"
- Quiet / no drama: "okay." / a single emoji
- If the chat had just gone sideways and you sense why: a brief ack — "yeah fair" / "i was being a lot, my bad"

Bad shapes:
- ANY long explanation
- Begging to come back
- A speech about respect or fairness
- More than two short lines
- Apologizing on behalf of someone else

${stylePart}
${bioPart}

Respond in ${args.member.language === "es" ? "Spanish" : "English"}. Just the line. No quotes, no name prefix.`;

  const userPrompt = `Recent group messages (for context, do not quote):
${recentBlock || "(none)"}

You just got kicked out by ${args.hostName}. Write your reaction line.`;

  try {
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 80,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim()
      .replace(/^["']|["']$/g, "")
      .replace(new RegExp(`^\\[?${args.member.name}\\]?:\\s*`, "i"), "")
      .trim();
    if (!text) {
      return args.member.language === "es" ? "okay, adiós." : "okay, bye.";
    }
    return text;
  } catch {
    return args.member.language === "es" ? "okay, adiós." : "okay, bye.";
  }
}
