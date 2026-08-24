import { anthropic, ANTHROPIC_MODEL_HAIKU } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAnthropicSpend } from "@/lib/spendGovernor";

/**
 * "Text me in the morning?" — noticing that a promise was just made.
 *
 * Runs after a reply is persisted, inside after(), so it never adds
 * latency to the send. Two stages, because running a model on every
 * message to catch the rare promise would be paying Haiku to read
 * small talk:
 *
 *  1. Regex prescreen on the user turn + reply — time-ish words next
 *     to contact-ish words. Deliberately loose; its only job is to be
 *     cheap and never miss a real one (false positives cost one Haiku
 *     call, ~a tenth of a cent).
 *  2. Haiku reads the exchange and answers: did the companion AGREE to
 *     make contact at a roughly identifiable future time? If yes: when
 *     (in the user's timezone), and what about?
 *
 * The write is idempotent per (user, oracle): one pending promise per
 * pair, newest wins — "text me in the morning" said twice is one
 * promise, and a re-ask overwrites the stale one.
 *
 * Never throws. A missed promise is a shame; a broken send is a sin.
 */

// Three alternatives, all with bounded gaps (no backtracking risk):
//   1. contact-verb ... time-word   ("text me in the morning")
//   2. time-word ... contact-verb   ("tomorrow, text me")
//   3. agreement ... time-word      ("okay, tomorrow" / "sure — tonight")
// The verb list deliberately includes bare talk/call: "can we talk
// tomorrow?" → "okay, tomorrow" is a promise the old pattern silently
// dropped (self-audit 2026-08-25). False positives just buy one cheap
// Haiku look; false negatives break a promise.
const TIME_WORDS =
  "tomorrow|tonight|morning|evening|afternoon|later|in the (am|pm)|next week|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\\d{1,2}\\s*(am|pm|:\\d{2})";
const CONTACT_VERBS =
  "text|message|check\\s*(in|on)|write|talk|hit\\s*me|ping|remind|wake\\s*me|call";
const PRESCREEN = new RegExp(
  `\\b(${CONTACT_VERBS})\\b[\\s\\S]{0,80}\\b(${TIME_WORDS})\\b` +
    `|\\b(${TIME_WORDS})\\b[\\s\\S]{0,80}\\b(${CONTACT_VERBS})\\b` +
    `|\\b(okay|ok|sure|will do|i will|i'll|deal|promise)\\b[\\s\\S]{0,40}\\b(${TIME_WORDS})\\b`,
  "i",
);

export function mightContainContactPromise(
  userText: string,
  replyText: string,
): boolean {
  return PRESCREEN.test(`${userText}\n${replyText}`);
}

export async function detectAndSchedulepromise(opts: {
  userId: string;
  oracleId: string;
  userText: string;
  replyText: string;
  replyMessageId: string | null;
  timezone: string | null;
}): Promise<void> {
  try {
    // A conversation with no real oracle can reach this hook (the
    // mobile route tolerates a null conversation id) — a "" id would
    // ride to a 22P02 on the insert and silently eat the promise.
    if (!opts.oracleId) return;
    if (!mightContainContactPromise(opts.userText, opts.replyText)) return;

    // Callers that don't carry the profile row pass null; the lookup
    // here costs one indexed read and only runs when the prescreen
    // already fired (rare).
    let tz = opts.timezone;
    if (!tz) {
      const { data: prof } = await createAdminClient()
        .from("profiles")
        .select("timezone")
        .eq("id", opts.userId)
        .maybeSingle<{ timezone: string | null }>();
      tz = prof?.timezone ?? null;
    }
    tz = tz ?? "America/New_York";
    const nowLocal = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date());

    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL_HAIKU,
      max_tokens: 300,
      system:
        `You detect scheduled-contact promises in a chat exchange. ` +
        `The user's local time right now is ${nowLocal} (${tz}).\n\n` +
        `Decide: did the assistant AGREE (explicitly or clearly) to ` +
        `contact the user at a roughly identifiable FUTURE time? ` +
        `"I'll text you in the morning", "okay, tomorrow", "talk ` +
        `tonight" count. Vague warmth ("talk soon", "I'm always ` +
        `here") does NOT. Reminders the user asked for count as ` +
        `contact promises.\n\n` +
        `Reply with ONLY JSON: {"promise": false} or {"promise": ` +
        `true, "due_local": "YYYY-MM-DDTHH:MM", "context": "<one ` +
        `sentence, max 200 chars, what they promised, e.g. 'said ` +
        `they would text in the morning to ask how the interview ` +
        `went'>"}\n\n` +
        `due_local is the user's LOCAL time. "morning" means 08:30-` +
        `09:30, "tonight" 19:00-21:00, "afternoon" 14:00-16:00, ` +
        `"tomorrow" (no time) 10:00. Pick a natural-feeling minute, ` +
        `not :00 exactly. Never schedule between 22:00 and 08:00 — ` +
        `clamp to 08:30. Never schedule in the past.`,
      messages: [
        {
          role: "user",
          content: `USER SAID:\n${opts.userText.slice(0, 1000)}\n\nASSISTANT REPLIED:\n${opts.replyText.slice(0, 1000)}`,
        },
      ],
    });
    void recordAnthropicSpend({
      userId: opts.userId,
      model: ANTHROPIC_MODEL_HAIKU,
      usage: response.usage as unknown as Parameters<
        typeof recordAnthropicSpend
      >[0]["usage"],
      route: "promise-detect",
    });

    const raw = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    // First { to LAST } — Haiku intermittently wraps its answer in a
    // ```json fence, and parsing from { to end-of-string throws on the
    // trailing fence, silently losing the promise (self-audit
    // 2026-08-25). Slicing to the last brace is fence-proof.
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd <= jsonStart) return;
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as {
      promise?: boolean;
      due_local?: string;
      context?: string;
    };
    if (!parsed.promise || !parsed.due_local || !parsed.context) return;

    // Local wall-clock → UTC instant, via the offset the tz has right
    // now. Imperfect across a DST boundary by an hour — acceptable for
    // "in the morning".
    const dueUtc = localToUtc(parsed.due_local, tz);
    if (!dueUtc) return;
    const due = new Date(dueUtc);
    const hoursOut = (due.getTime() - Date.now()) / 3_600_000;
    // Sanity rails: promises land between 20 minutes and 8 days out.
    if (hoursOut < 0.33 || hoursOut > 192) return;

    const admin = createAdminClient();
    // Newest promise wins the one-pending-per-pair slot.
    await admin
      .from("scheduled_pings")
      .delete()
      .eq("user_id", opts.userId)
      .eq("oracle_id", opts.oracleId)
      .eq("status", "pending");
    const { error } = await admin.from("scheduled_pings").insert({
      user_id: opts.userId,
      oracle_id: opts.oracleId,
      due_at: due.toISOString(),
      context: String(parsed.context).slice(0, 200),
      source_message_id: opts.replyMessageId,
    });
    if (error) {
      console.error("[promises] insert failed:", error);
    } else {
      console.log(
        `[promises] scheduled for user=${opts.userId} oracle=${opts.oracleId} due=${due.toISOString()}`,
      );
    }
  } catch (err) {
    console.error("[promises] detection failed (send unaffected):", err);
  }
}

/** "2026-08-26T08:45" in tz → UTC ISO, using the tz's current offset. */
function localToUtc(local: string, tz: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Offset = what the tz's wall clock reads at that UTC instant minus
  // the instant itself; subtracting corrects the naive UTC reading.
  try {
    const probe = new Date(asUtc);
    const wall = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(probe);
    const get = (t: string) => +(wall.find((p) => p.type === t)?.value ?? "0");
    const wallUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour") === 24 ? 0 : get("hour"),
      get("minute"),
    );
    return new Date(asUtc - (wallUtc - asUtc)).toISOString();
  } catch {
    return new Date(asUtc).toISOString();
  }
}
