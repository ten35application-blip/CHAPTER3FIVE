/**
 * WHEN WOULD THIS PERSON TEXT FIRST? (Wilson 2026-09-05: "I just want
 * the people to feel real. Based off job, based off their texting
 * style, based off how they carry themselves.")
 *
 * The persona-outreach worker decides WHETHER an identity reaches out
 * (text-first cadence, back-off, the 24h per-user gate — none of that
 * changes here). This module decides WHEN inside the day, from the
 * identity's own traits, so a night-owl bartender texts at 9 pm and a
 * teacher texts at 3:30 when the kids are gone — not everyone at the
 * hour the cron happens to run.
 *
 * How it works, in plain words:
 *   1. Every waking hour (8 am – 9 pm, the user-side window the worker
 *      already enforces) starts with a weight from the identity's
 *      chronotype: morning people lean early, night owls lean late,
 *      steady types are flat.
 *   2. Their occupation, employment status, and daily ritual add
 *      weight to the hours those lives actually have free — lunch and
 *      after-work for office people, the shift gaps for nurses and
 *      drivers, the 3 pm bell for teachers, mid-morning for the
 *      retired.
 *   3. Once per day, per identity, ONE hour is drawn from those weights
 *      with a seed of (identity id + date). Same identity, same day →
 *      same hour, so the hourly cron and its pg_cron backstop agree.
 *      Different day → a different draw, so nobody texts at 6:00 pm
 *      every single day like a bot.
 *
 * The draw is accepted for that hour and the one after it (two cron
 * runs), so a single skipped run doesn't cost a whole day — the
 * day-after retention text especially. The worker's own one-per-
 * local-day gate guarantees that never becomes two texts.
 *
 * Pure, deterministic, no I/O, no model call. Cheap enough to run for
 * every identity every hour.
 */

export const OUTREACH_MIN_HOUR = 8; // inclusive — matches persona-outreach
export const OUTREACH_MAX_HOUR = 22; // exclusive

type Weights = number[]; // index = local hour 0..23

export type InitiationTraits = {
  chronotype?: string | null; // column wins; traits.chronotype is the fallback
  traits?: unknown;
};

function safeTimezone(tz: string | null | undefined): string {
  if (!tz) return "America/New_York";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "America/New_York";
  }
}

/** Local hour (0-23) and a YYYY-MM-DD key in the identity's user's tz. */
export function localClock(now: Date, tz: string | null | undefined): { hour: number; dateKey: string } {
  const timeZone = safeTimezone(tz);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = Number(get("hour")) % 24;
  return {
    hour: Number.isFinite(hour) ? hour : 12,
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

// ── deterministic randomness ──────────────────────────────────────────
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── the weights ───────────────────────────────────────────────────────
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function readTrait(traits: unknown, key: string): string {
  if (typeof traits !== "object" || traits === null) return "";
  return str((traits as Record<string, unknown>)[key]);
}

function bump(w: Weights, hours: number[], amount: number) {
  for (const h of hours) if (h >= 0 && h < 24) w[h] += amount;
}
const range = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => a + i); // [a, b)

/** Hour weights for one identity. Exported for the admin/debug view. */
export function initiationWeights(id: InitiationTraits): Weights {
  const w: Weights = new Array(24).fill(0);
  const chronotype = str(id.chronotype) || readTrait(id.traits, "chronotype");
  const occupation = readTrait(id.traits, "occupation").toLowerCase();
  const employment = readTrait(id.traits, "employmentStatus");
  const ritual = readTrait(id.traits, "dailyRitual").toLowerCase();

  // 1. Chronotype base — the shape of their day.
  if (chronotype === "morning_person") {
    bump(w, range(8, 12), 3);
    bump(w, range(12, 17), 1);
    bump(w, range(17, 20), 0.5);
  } else if (chronotype === "night_owl") {
    bump(w, range(8, 12), 0.25);
    bump(w, range(12, 17), 1);
    bump(w, range(17, 22), 3);
  } else {
    bump(w, range(8, 22), 1); // steady / unknown: flat
  }

  // 2. Work — when their life actually has a gap. Keyword-matched on
  //    the formula's OCCUPATIONS strings so new entries degrade to
  //    "office-ish" rather than breaking.
  const retired = employment === "retired_recently" || employment === "retired_years";
  const notWorking = retired || employment === "between_jobs" || /homemaker/.test(occupation);
  if (notWorking) {
    bump(w, range(9, 12), 2); // the retired text mid-morning
    bump(w, range(14, 17), 1);
    bump(w, range(19, 21), 1);
  } else if (/teacher|educator|school nurse|professor|librarian/.test(occupation)) {
    bump(w, range(15, 18), 3); // after the last bell
    bump(w, range(19, 22), 1);
  } else if (/nurse|paramedic|emt|dialysis|home health|hospice|healthcare|midwife|pharmacy|physical therapist|dental/.test(occupation)) {
    bump(w, range(8, 10), 1.5); // shift gaps: before, and the late evening after
    bump(w, range(14, 16), 1);
    bump(w, range(20, 22), 2);
  } else if (/law enforcement|firefighter|military|driver|transportation|cook|restaurant|bartender|server|retail|security/.test(occupation)) {
    bump(w, range(10, 13), 1.5); // odd hours — mid-morning and late
    bump(w, range(20, 22), 2);
  } else if (/trades|construction|electrician|plumber|hvac|mechanic|welder|carpenter|roofer|locksmith|farmer|landscap|mason|painter/.test(occupation)) {
    bump(w, range(8, 9), 1); // the early crew; done by four
    bump(w, range(16, 19), 3);
  } else if (/artist|musician|writer|entrepreneur|freelance|gig|photograph|designer/.test(occupation) || employment === "gig_freelance") {
    bump(w, range(11, 14), 1.5); // late starters
    bump(w, range(20, 22), 2.5);
  } else if (/clergy|ministry|pastor|chaplain/.test(occupation)) {
    bump(w, range(8, 10), 2);
    bump(w, range(19, 21), 2);
  } else {
    // office / admin / sales / finance / engineer / small business:
    // lunch and after work.
    bump(w, range(12, 14), 2);
    bump(w, range(17, 21), 2);
  }

  // 3. Their ritual — the one fixed point in the day they'd text from.
  if (/5am run|before anyone wakes|prays first thing|morning coffee|coffee brews|news with breakfast/.test(ritual)) {
    bump(w, range(8, 10), 2);
  } else if (/before bed|dusk|evening walk/.test(ritual)) {
    bump(w, range(19, 22), 2);
  } else if (/calls mom every sunday/.test(ritual)) {
    bump(w, range(10, 12), 1); // a Sunday-morning caller texts mornings
  }

  // Never outside the user-side window; never all zero.
  for (let h = 0; h < 24; h++) if (h < OUTREACH_MIN_HOUR || h >= OUTREACH_MAX_HOUR) w[h] = 0;
  if (w.every((x) => x === 0)) bump(w, range(OUTREACH_MIN_HOUR, OUTREACH_MAX_HOUR), 1);
  return w;
}

/** The one local hour this identity would text first on this date. */
export function initiationHourFor(oracleId: string, id: InitiationTraits, dateKey: string): number {
  const w = initiationWeights(id);
  const total = w.reduce((a, b) => a + b, 0);
  const rand = mulberry32(fnv1a(`${oracleId}|${dateKey}`))();
  let acc = 0;
  for (let h = 0; h < 24; h++) {
    acc += w[h];
    if (rand * total < acc) return h;
  }
  return OUTREACH_MAX_HOUR - 1;
}

/** True when it is this identity's hour (or the hour right after it —
 *  one missed cron run must not cost a whole day). */
export function isInitiationHour(
  oracleId: string,
  id: InitiationTraits,
  now: Date,
  tz: string | null | undefined,
): boolean {
  const { hour, dateKey } = localClock(now, tz);
  const chosen = initiationHourFor(oracleId, id, dateKey);
  return hour === chosen || hour === chosen + 1;
}

// ── calendar-day arithmetic in the user's timezone ────────────────────
// The worker's gates used to count hours ("24h since the last text").
// That was fine when the cron ran at the same hour every day. With
// personal hours it silently drops days: texted at 11 am, tomorrow's
// draw is 9 am → only 22h → blocked → the whole day slips. People count
// in days ("I texted her yesterday"), so the gates do too.

function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Whole calendar days between an earlier instant and now, both read
 *  in the user's timezone. Same day → 0, yesterday → 1. */
export function localDaysBetween(earlierIso: string, now: Date, tz: string | null | undefined): number {
  const then = new Date(earlierIso);
  if (!Number.isFinite(then.getTime())) return 999;
  return dayNumber(localClock(now, tz).dateKey) - dayNumber(localClock(then, tz).dateKey);
}

/** The instant today began in the user's timezone. */
export function startOfLocalDay(now: Date, tz: string | null | undefined): Date {
  const timeZone = safeTimezone(tz);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const secondsIntoDay = (get("hour") % 24) * 3600 + get("minute") * 60 + get("second");
  return new Date(now.getTime() - secondsIntoDay * 1000);
}

/** A cadence in days is met when the elapsed time says so OR when
 *  enough calendar days have turned — so a 1-day texter texts every
 *  day, not every other day. */
export function cadenceMet(lastIso: string, thresholdDays: number, now: Date, tz: string | null | undefined): boolean {
  const elapsedDays = (now.getTime() - Date.parse(lastIso)) / 86_400_000;
  if (!Number.isFinite(elapsedDays)) return true;
  return elapsedDays >= thresholdDays || localDaysBetween(lastIso, now, tz) >= Math.ceil(thresholdDays);
}

// ── "one day yes, one day no" (Wilson 2026-09-05) ─────────────────────
// WHETHER an identity reaches out today is its own coin flip, not a
// schedule. The text-first tier it rolled at creation (1 day for the
// rare daily texters … 21 for the quiet ones, with the worker's
// unanswered back-off already multiplied in) sets how often the coin
// lands yes; the flip itself is seeded by (id, date) so every hourly
// run agrees on today's answer. A daily-type texter still skips some
// days; a quiet type still surprises you now and then. Nobody is on a
// timer.
export const DAILY_YES_MAX = 0.7; // even the chattiest skip ~2 days in 7
export const DAILY_YES_MIN = 0.08; // even the quietest turn up ~twice a month

export function dailyYesProbability(cadenceDays: number): number {
  const c = Number.isFinite(cadenceDays) && cadenceDays > 0 ? cadenceDays : 7;
  return Math.min(DAILY_YES_MAX, Math.max(DAILY_YES_MIN, 1 / c));
}

/** Did this identity's coin land yes today? Deterministic per (id, date). */
export function dailyYes(oracleId: string, dateKey: string, cadenceDays: number): boolean {
  const roll = mulberry32(fnv1a(`yes|${oracleId}|${dateKey}`))();
  return roll < dailyYesProbability(cadenceDays);
}
