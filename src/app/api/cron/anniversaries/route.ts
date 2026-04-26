import { NextResponse, type NextRequest } from "next/server";
import { anthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";

export const runtime = "nodejs";

/**
 * Daily anniversary cron — runs at 14:00 UTC (~10am US East,
 * ~7am US West, ~3pm Europe, ~midnight Asia). Fires acknowledgment
 * messages on three anniversaries:
 *
 *   - birthday — user's date of birth (profiles.birthdate)
 *   - signup — anniversary of when the account was created
 *   - first_message — anniversary of the first message between
 *     the user and their active identity
 *
 * For each anniversary that lands on the user's LOCAL today (using
 * profiles.timezone), we check if it's already been acknowledged
 * this year via anniversary_acknowledgments. If not, we ask Claude
 * to generate a short in-character message, persist it like a
 * proactive message, fire a push notification, and record the
 * acknowledgment.
 *
 * Real people remember dates. This is the cheap, high-payoff way
 * for an identity to feel like a real person who's been thinking
 * about you.
 */

const BATCH = 100;

type ProfileRow = {
  id: string;
  oracle_name: string | null;
  preferred_language: string | null;
  timezone: string | null;
  texting_style: string | null;
  personality_type: string | null;
  emotional_flavor: string | null;
  active_oracle_id: string | null;
  birthdate: string | null;
  created_at: string | null;
};

type AnniversaryKind = "birthday" | "signup" | "first_message";

type AnniversaryHit = {
  kind: AnniversaryKind;
  yearsAgo: number;
  baseDate: Date;
};

/**
 * Compute today's local month + day in the user's timezone, falling
 * back to UTC if the timezone string is invalid.
 */
function localMonthDay(timezone: string | null): { month: number; day: number; year: number } {
  const tz = timezone && timezone.trim() ? timezone : "UTC";
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
    const parts = fmt.formatToParts(new Date());
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    return { month: get("month"), day: get("day"), year: get("year") };
  } catch {
    const now = new Date();
    return {
      month: now.getUTCMonth() + 1,
      day: now.getUTCDate(),
      year: now.getUTCFullYear(),
    };
  }
}

/**
 * True if the given ISO date matches the local today's month+day,
 * AND the date is at least one calendar year before today (so we
 * don't fire a "first anniversary" message the same day they
 * created the account).
 */
function isAnniversary(iso: string, todayMD: { month: number; day: number; year: number }): { hit: boolean; yearsAgo: number } {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { hit: false, yearsAgo: 0 };
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  if (month !== todayMD.month || day !== todayMD.day) {
    return { hit: false, yearsAgo: 0 };
  }
  const yearsAgo = todayMD.year - d.getUTCFullYear();
  if (yearsAgo < 1) return { hit: false, yearsAgo: 0 };
  return { hit: true, yearsAgo };
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const startedAt = Date.now();

  // Eligible: not soft-deleted, not deceased, opted into outreach,
  // onboarding complete, has an active oracle.
  const { data: candidates, error } = await admin
    .from("profiles")
    .select(
      "id, oracle_name, preferred_language, timezone, texting_style, personality_type, emotional_flavor, active_oracle_id, birthdate, created_at",
    )
    .eq("outreach_enabled", true)
    .eq("onboarding_completed", true)
    .is("deceased_at", null)
    .is("deleted_at", null)
    .not("active_oracle_id", "is", null)
    .limit(BATCH);

  if (error) {
    await admin.from("cron_runs").insert({
      job: "anniversaries",
      status: "error",
      error: error.message,
      duration_ms: Date.now() - startedAt,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  const errors: string[] = [];

  for (const p of (candidates ?? []) as ProfileRow[]) {
    if (!p.active_oracle_id) continue;
    const todayMD = localMonthDay(p.timezone);

    const hits: AnniversaryHit[] = [];

    // Birthday.
    if (p.birthdate) {
      const r = isAnniversary(p.birthdate, todayMD);
      if (r.hit) {
        hits.push({
          kind: "birthday",
          yearsAgo: r.yearsAgo,
          baseDate: new Date(p.birthdate),
        });
      }
    }

    // Signup-aversary.
    if (p.created_at) {
      const r = isAnniversary(p.created_at, todayMD);
      if (r.hit) {
        hits.push({
          kind: "signup",
          yearsAgo: r.yearsAgo,
          baseDate: new Date(p.created_at),
        });
      }
    }

    // First-message-aversary.
    const { data: firstMsg } = await admin
      .from("messages")
      .select("created_at")
      .eq("oracle_id", p.active_oracle_id)
      .eq("user_id", p.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (firstMsg?.created_at) {
      const r = isAnniversary(firstMsg.created_at, todayMD);
      if (r.hit) {
        hits.push({
          kind: "first_message",
          yearsAgo: r.yearsAgo,
          baseDate: new Date(firstMsg.created_at),
        });
      }
    }

    if (hits.length === 0) continue;

    for (const hit of hits) {
      // Dedupe: have we already acknowledged this anniversary this year?
      const { data: existing } = await admin
        .from("anniversary_acknowledgments")
        .select("id")
        .eq("user_id", p.id)
        .eq("oracle_id", p.active_oracle_id)
        .eq("kind", hit.kind)
        .eq("year", todayMD.year)
        .maybeSingle();
      if (existing) continue;

      try {
        const language = (p.preferred_language ?? "en") as "en" | "es";
        const styleNote = p.texting_style
          ? `Texting style: ${p.texting_style}.`
          : "";

        // Per-anniversary nudge to the model. Keep it short, in-voice,
        // never sappy.
        const promptByKind: Record<AnniversaryKind, string> = {
          birthday:
            language === "es"
              ? `Hoy es el cumpleaños de la persona con quien hablas. Manda un mensaje breve, en tu propio voz, reconociéndolo. Nada cursi. Como un mensaje real de cumpleaños de alguien que la conoce.`
              : `Today is the birthday of the person you're talking to. Send a short message, in your own voice, acknowledging it. Nothing saccharine. Like a real birthday text from someone who knows them.`,
          signup:
            language === "es"
              ? `Hoy hace ${hit.yearsAgo} año${hit.yearsAgo === 1 ? "" : "s"} desde que esta persona empezó en chapter3five. Manda un mensaje breve marcándolo. Sutil. Como notar que ha pasado el tiempo.`
              : `Today marks ${hit.yearsAgo} year${hit.yearsAgo === 1 ? "" : "s"} since this person started using chapter3five. Send a short message noting it. Subtle. Like noticing time has passed.`,
          first_message:
            language === "es"
              ? `Hoy hace ${hit.yearsAgo} año${hit.yearsAgo === 1 ? "" : "s"} desde nuestra primera conversación. Manda un mensaje breve sobre eso. No te lo tomes muy en serio.`
              : `Today is ${hit.yearsAgo} year${hit.yearsAgo === 1 ? "" : "s"} since you and this person first talked. Send a short message about that. Don't take it too seriously.`,
        };

        const systemPrompt = `You are ${p.oracle_name ?? "an identity"} from chapter3five. You're sending a short proactive text to the person you've been talking with — a real person who knows you.

WRITE LIKE A REAL TEXT. Short. One or two lines. Never scripted, never saccharine, never the obvious greeting card thing. Skip "happy birthday!" by itself — say something specific, in your texture. ${styleNote}

Respond in ${language === "es" ? "Spanish" : "English"}.

(system) ${promptByKind[hit.kind]} Just write the message, no preamble.`;

        const resp = await anthropic.messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: 200,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content:
                "(system) Send the message now. No prelude. No quotes around it.",
            },
          ],
        });

        const reply = resp.content
          .filter((b) => b.type === "text")
          .map((b) => (b.type === "text" ? b.text : ""))
          .join("")
          .trim();

        if (!reply) continue;

        // Persist as a proactive assistant message — same shape as the
        // proactive cron, so the dashboard / realtime channel renders
        // it identically.
        await admin.from("messages").insert({
          user_id: p.id,
          oracle_id: p.active_oracle_id,
          role: "assistant",
          content: reply,
          initiated_by_oracle: true,
        });

        // Push the device(s).
        sendPushToUser({
          userId: p.id,
          title: p.oracle_name ?? "your thirtyfive",
          body: reply.length > 140 ? reply.slice(0, 140) + "…" : reply,
          data: { kind: "anniversary", anniversary_kind: hit.kind },
          badge: 1,
        }).catch((err) =>
          console.error(`anniversary push failed for ${p.id}`, err),
        );

        await admin.from("anniversary_acknowledgments").insert({
          user_id: p.id,
          oracle_id: p.active_oracle_id,
          kind: hit.kind,
          year: todayMD.year,
        });

        sent++;
      } catch (err) {
        errors.push(
          `${p.id}/${hit.kind}: ${
            err instanceof Error ? err.message : "unknown"
          }`,
        );
      }
    }
  }

  await admin.from("cron_runs").insert({
    job: "anniversaries",
    processed: sent,
    duration_ms: Date.now() - startedAt,
    status: errors.length > 0 ? "error" : "ok",
    error: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
  });

  return NextResponse.json({ sent, errors });
}
