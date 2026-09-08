import "server-only";
import { anthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEGACY_QUESTIONS, LEGACY_CATEGORY_LABELS } from "@/lib/legacy/questions";
import { LEGACY_ANYTHING_ID } from "@/lib/legacy/answer-floor";
import { LEGACY_MAX_ANSWER_CHARS } from "@/lib/legacy/sanitize";
import { updateOwnArchive } from "@/lib/legacy/updateArchive";

/**
 * TALK TO YOUR OWN ARCHIVE (Wilson 2026-09-08).
 *
 * "You send yourself a message saying I love pizza or my favorite
 * color is green or there was this time in which I did this. The
 * message will process and attach it to the question it goes to."
 *
 * The rules, all enforced here:
 *
 *   - ONLY YOUR OWN ORIGINAL. is_self_archive, not inherited, owned
 *     by the caller, recorded in self mode. Copies and archives made
 *     about someone else never get this — updateOwnArchive refuses
 *     them a second time underneath.
 *   - WORD FOR WORD. The message is appended to the answer exactly as
 *     typed. Nothing is paraphrased; the archive stays their words.
 *   - THE REPLY SAYS WHERE IT WENT, so a wrong sort is visible at once
 *     and fixable on the update screen in Settings.
 *   - STATEMENTS SAVE, QUESTIONS TALK. A question falls through to the
 *     normal archive chat so they can hear how they sound. When the
 *     sorter isn't sure, it asks "Keep this?" and waits for yes/no.
 *   - ONE WELCOME AT CREATION, THEN SILENCE. Never a reminder.
 *
 * Both chat routes call handleSelfTalk before caps and before any
 * model call; a non-null result means the turn is fully handled and
 * both message rows are already written.
 */

export const SELF_TALK_INITIATED_BY = "self_talk";

type OracleGate = {
  id: string;
  user_id: string;
  name: string;
  is_legacy: boolean | null;
  is_self_archive: boolean | null;
  inherited_at: string | null;
  legacy_answers: { subject?: { mode?: unknown }; answers?: Record<string, string> } | null;
};

export function isOwnSelfArchive(row: OracleGate | null | undefined, userId: string): row is OracleGate {
  return Boolean(
    row &&
      row.user_id === userId &&
      row.is_legacy === true &&
      row.is_self_archive === true &&
      !row.inherited_at &&
      row.legacy_answers?.subject?.mode === "self",
  );
}

type Kind = "add" | "question" | "yes" | "no" | "chat";

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["add", "question", "yes", "no", "chat"] },
    question_id: { type: "string" },
    sure: { type: "boolean" },
  },
  required: ["kind", "question_id", "sure"],
  additionalProperties: false,
} as const;

function questionLabel(id: string): string {
  if (id === LEGACY_ANYTHING_ID) return "the small stuff";
  const q = LEGACY_QUESTIONS.find((x) => x.id === id);
  if (!q) return "the small stuff";
  return LEGACY_CATEGORY_LABELS[q.category];
}

function questionMenu(answers: Record<string, string>): string {
  const lines = LEGACY_QUESTIONS.map((q) => {
    const has = typeof answers[q.id] === "string" && answers[q.id].trim() ? " (answered)" : "";
    return `${q.id}${has}: ${q.promptSelf ?? q.prompt}`;
  });
  lines.push(`${LEGACY_ANYTHING_ID}: Anything at all — favorite color, movie, food you hate, the song, the team, the small stuff. Use this when nothing above fits.`);
  return lines.join("\n");
}

const SYSTEM = `You sort messages a person sends to their own life archive. The archive is a set of answers to fixed questions, in their own words.

Decide what the message is:
- "add": a fact, preference, memory, story or opinion about themselves that belongs in the archive ("I love pizza", "my favorite color is green", "there was this time I…", "my dad taught me to fish"). Pick the single best question_id from the list; use "anything" when nothing fits.
- "question": they are asking the archive something or want to hear it talk ("what's my favorite food?", "what would you say to my kids?").
- "yes" / "no": a short answer to a pending "Keep this?" question, ONLY when one is pending.
- "chat": greetings, thanks, jokes, tests, or anything that is not about them and not worth keeping ("hey", "lol", "testing").

sure = true only when you are confident it is an "add" AND confident of the question_id. A pending "Keep this?" makes a bare yes/no/ok/nah a "yes" or "no". Never rewrite the message; you only sort it. Return JSON only.`;

async function classify(input: {
  text: string;
  recent: { role: string; content: string }[];
  answers: Record<string, string>;
  pending: string | null;
}): Promise<{ kind: Kind; question_id: string; sure: boolean }> {
  const context = input.recent
    .map((m) => `${m.role === "user" ? "THEM" : "ARCHIVE"}: ${m.content.slice(0, 300)}`)
    .join("\n");
  const prompt = `QUESTIONS:\n${questionMenu(input.answers)}\n\nPENDING "Keep this?": ${input.pending ? `yes — "${input.pending.slice(0, 200)}"` : "none"}\n\nRECENT:\n${context || "(nothing yet)"}\n\nMESSAGE:\n${input.text}`;
  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 200,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    messages: [{ role: "user", content: prompt }],
  });
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("selfTalk: no text block");
  const parsed = JSON.parse(block.text) as { kind: Kind; question_id: string; sure: boolean };
  const valid =
    parsed.question_id === LEGACY_ANYTHING_ID || LEGACY_QUESTIONS.some((q) => q.id === parsed.question_id);
  return { kind: parsed.kind, question_id: valid ? parsed.question_id : LEGACY_ANYTHING_ID, sure: Boolean(parsed.sure) && valid };
}

/** Where a fast yes/no needs no model call. */
function quickYesNo(text: string): "yes" | "no" | null {
  const t = text.trim().toLowerCase().replace(/[.!…]+$/, "");
  if (/^(yes|yeah|yep|yup|ok|okay|sure|keep it|save it|please|sí|si|dale|claro)$/.test(t)) return "yes";
  if (/^(no|nah|nope|don't|dont|skip|never mind|nevermind)$/.test(t)) return "no";
  return null;
}

const T = {
  en: {
    saved: (label: string) => `Saved under “${label}”, word for word. You can see it in Settings → Update.`,
    keep: (label: string) => `Want me to keep that in your archive? It would go under “${label}”. Reply yes or no.`,
    notSaved: "Okay, not saved.",
    nothingPending: "Nothing waiting to save. Text me something about you and I'll keep it.",
    full: "That part of your archive is full. Add it from Settings → Update instead.",
    failed: "I couldn't save that just now. Try again in a minute, or add it from Settings → Update.",
  },
  es: {
    saved: (label: string) => `Guardado en “${label}”, palabra por palabra. Lo puedes ver en Ajustes → Actualizar.`,
    keep: (label: string) => `¿Quieres que lo guarde en tu archivo? Iría en “${label}”. Responde sí o no.`,
    notSaved: "Está bien, no lo guardo.",
    nothingPending: "No hay nada pendiente por guardar. Escríbeme algo sobre ti y lo guardo.",
    full: "Esa parte de tu archivo está llena. Agrégalo desde Ajustes → Actualizar.",
    failed: "No pude guardarlo ahora. Intenta en un minuto, o agrégalo desde Ajustes → Actualizar.",
  },
};

/** Bookkeeping replies never become part of the archive's chat memory. */
const SELF_TALK_PREFIXES = ["Saved under “", "Want me to keep that", "Okay, not saved.", "Nothing waiting to save.", "That part of your archive is full.", "I couldn't save that just now.", "Hey, it's you. This is your archive.", "Guardado en “", "¿Quieres que lo guarde", "Está bien, no lo guardo.", "No hay nada pendiente", "Esa parte de tu archivo", "No pude guardarlo ahora.", "Hola, soy tú. Este es tu archivo."];
export function isSelfTalkReply(row: { role?: string | null; content?: string | null; initiated_by?: string | null }): boolean {
  if (row.initiated_by === SELF_TALK_INITIATED_BY) return true;
  if (row.role !== "assistant" || typeof row.content !== "string") return false;
  return SELF_TALK_PREFIXES.some((p) => row.content!.startsWith(p));
}

export type SelfTalkResult = { reply: string; userMessageId: string | null; replyMessageId: string | null; saved: boolean };

/**
 * Handle one message from a person to their own archive. Returns null
 * when the message should go to the normal archive chat (a question,
 * a greeting). Otherwise both rows are written and the reply is final.
 */
export async function handleSelfTalk(input: {
  userId: string;
  oracle: OracleGate;
  text: string;
  language: "en" | "es";
}): Promise<SelfTalkResult | null> {
  const admin = createAdminClient();
  const t = T[input.language] ?? T.en;
  const text = input.text.trim();
  if (!text) return null;
  const answers = input.oracle.legacy_answers?.answers ?? {};

  const { data: pendingRow } = await admin
    .from("self_talk_pending")
    .select("text, question_id")
    .eq("oracle_id", input.oracle.id)
    .maybeSingle<{ text: string; question_id: string }>();
  const pending = pendingRow ?? null;

  let kind: Kind;
  let questionId = LEGACY_ANYTHING_ID;
  let sure = false;
  const quick = pending ? quickYesNo(text) : null;
  if (quick) {
    kind = quick;
  } else {
    const { data: recentRows } = await admin
      .from("messages")
      .select("role, content")
      .eq("oracle_id", input.oracle.id)
      .eq("user_id", input.userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(6);
    const recent = (recentRows ?? []).reverse() as { role: string; content: string }[];
    try {
      const c = await classify({ text, recent, answers, pending: pending?.text ?? null });
      kind = c.kind;
      questionId = c.question_id;
      sure = c.sure;
    } catch (err) {
      console.error("[selfTalk] classify failed:", err);
      return null; // fall through to the normal chat; nothing is lost
    }
  }

  // Questions and chatter go to the archive itself.
  if (kind === "question" || kind === "chat") return null;
  if ((kind === "yes" || kind === "no") && !pending) {
    return persist(input, text, t.nothingPending, false);
  }

  let reply: string;
  let saved = false;
  if (kind === "no") {
    await admin.from("self_talk_pending").delete().eq("oracle_id", input.oracle.id);
    reply = t.notSaved;
  } else if (kind === "yes" || (kind === "add" && sure)) {
    const keepText = kind === "yes" ? pending!.text : text;
    const qid = kind === "yes" ? pending!.question_id : questionId;
    const outcome = await appendAnswer(input.userId, input.oracle.id, answers, qid, keepText);
    if (outcome === "ok") {
      saved = true;
      reply = t.saved(questionLabel(qid));
      if (pending) await admin.from("self_talk_pending").delete().eq("oracle_id", input.oracle.id);
    } else if (outcome === "full") {
      reply = t.full;
    } else {
      reply = t.failed;
    }
  } else {
    // "add" but not sure: park it and ask.
    await admin
      .from("self_talk_pending")
      .upsert({ oracle_id: input.oracle.id, user_id: input.userId, text, question_id: questionId, created_at: new Date().toISOString() });
    reply = t.keep(questionLabel(questionId));
  }
  return persist(input, text, reply, saved);
}

/** Append, never replace: the earlier words stay, the new ones follow. */
async function appendAnswer(
  userId: string,
  oracleId: string,
  answers: Record<string, string>,
  questionId: string,
  text: string,
): Promise<"ok" | "full" | "failed"> {
  const previous = (answers[questionId] ?? "").trim();
  let combined = previous ? `${previous}\n\n${text}` : text;
  let qid = questionId;
  if (combined.length > LEGACY_MAX_ANSWER_CHARS && questionId !== LEGACY_ANYTHING_ID) {
    const anyPrev = (answers[LEGACY_ANYTHING_ID] ?? "").trim();
    combined = anyPrev ? `${anyPrev}\n\n${text}` : text;
    qid = LEGACY_ANYTHING_ID;
  }
  if (combined.length > LEGACY_MAX_ANSWER_CHARS) return "full";
  const result = await updateOwnArchive(userId, oracleId, { answers: { [qid]: combined } });
  if (!result.ok) {
    console.error("[selfTalk] update refused:", result.error);
    return "failed";
  }
  return "ok";
}

async function persist(
  input: { userId: string; oracle: OracleGate },
  userText: string,
  reply: string,
  saved: boolean,
): Promise<SelfTalkResult> {
  const admin = createAdminClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const { data: userRow } = await admin
    .from("messages")
    .insert({
      user_id: input.userId,
      oracle_id: input.oracle.id,
      role: "user",
      content: userText,
      read_by_oracle_at: nowIso,
      created_at: nowIso,
    })
    .select("id")
    .single();
  const { data: replyRow } = await admin
    .from("messages")
    .insert({
      user_id: input.userId,
      oracle_id: input.oracle.id,
      role: "assistant",
      content: reply,
      initiated_by: SELF_TALK_INITIATED_BY,
      created_at: new Date(now + 1).toISOString(),
    })
    .select("id")
    .single();
  return { reply, userMessageId: userRow?.id ?? null, replyMessageId: replyRow?.id ?? null, saved };
}

/** The one welcome, written the moment their own archive is minted. */
export async function writeSelfTalkWelcome(userId: string, oracleId: string): Promise<void> {
  const { data: prof } = await createAdminClient()
    .from("profiles")
    .select("preferred_language")
    .eq("id", userId)
    .maybeSingle<{ preferred_language: string | null }>();
  const language = prof?.preferred_language === "es" ? "es" : "en";
  const content =
    language === "es"
      ? "Hola, soy tú. Este es tu archivo. Cuando quieras agregar algo — un gusto, una historia, algo que quieres que sepan — escríbelo aquí y lo guardo donde va, con tus palabras. También puedes hacerlo en Ajustes → Actualizar."
      : "Hey, it's you. This is your archive. Whenever you want to add something — a favorite, a story, something you want them to know — just text it here and I'll put it where it belongs, in your words. You can also do it in Settings → Update.";
  const { error } = await createAdminClient().from("messages").insert({
    user_id: userId,
    oracle_id: oracleId,
    role: "assistant",
    content,
    initiated_by: SELF_TALK_INITIATED_BY,
  });
  if (error) console.error("[selfTalk] welcome insert failed:", error);
}
