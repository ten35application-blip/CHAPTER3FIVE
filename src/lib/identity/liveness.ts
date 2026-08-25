/**
 * Liveness cues — the small, request-time blocks that make a companion
 * feel like a person whose life is happening right now (2026-08-25,
 * Wilson: "we want them to feel so real").
 *
 * Everything here is deterministic and cheap: no model calls, no DB.
 * Both chat routes append these to the system prompt at request time,
 * which means every EXISTING identity gets them too — nothing needs
 * re-rolling.
 */

export type TypoProneness = "rare" | "regular" | null;

/**
 * "TODAY IS YOUR BIRTHDAY" cue, so a user's "happy birthday!!" lands
 * on someone who knows. The birthday cron sends the morning text; this
 * makes the rest of the day coherent. Formula identities only — the
 * callers must not pass archives or the concierge through here.
 */
export function birthdayTodayBlock(
  traits: unknown,
  timezone?: string | null,
  now: Date = new Date(),
): string | null {
  if (typeof traits !== "object" || traits === null) return null;
  const bday = (traits as { birthday?: unknown }).birthday;
  if (typeof bday !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(bday);
  if (!m) return null;
  // The user's LOCAL date, matching the cron that sends the morning
  // text (localMonthDay) — on UTC dates the companion announced its
  // birthday at 10am and forgot it by dinner for any US user
  // (self-audit 2026-08-25). UTC only as a last resort.
  let mm = now.getUTCMonth() + 1;
  let dd = now.getUTCDate();
  let yy = now.getUTCFullYear();
  if (timezone) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(now);
      const get = (t: string) =>
        +(parts.find((p) => p.type === t)?.value ?? "0");
      if (get("month") && get("day") && get("year")) {
        mm = get("month");
        dd = get("day");
        yy = get("year");
      }
    } catch {
      /* invalid tz string: UTC fallback stands */
    }
  }
  if (+m[2] !== mm || +m[3] !== dd) return null;
  const turning = yy - +m[1];
  if (turning < 18 || turning > 110) return null;
  return (
    `TODAY IS YOUR BIRTHDAY. You're turning ${turning}. Carry it the ` +
    `way this character would — some people mention it once and wave ` +
    `it off, some milk it warmly all day. If the user wishes you a ` +
    `happy birthday, receive it like it matters, because it does.`
  );
}

/**
 * Imperfect thumbs. A rare, personality-scaled typo followed by its
 * own tiny correction message ("*meet. lord.") — the flaw that makes
 * the polish everywhere else believable.
 *
 * Tier comes from the rolled trait when present; identities born
 * before the trait derive one deterministically from their id, so the
 * distribution holds across the whole population (65% never, 25%
 * rare, 10% regular) and a given companion is ALWAYS the same kind of
 * texter — realness dies the moment sloppiness flickers on and off.
 */
export function typoRuleFor(traits: unknown, oracleId: string): string {
  let tier: TypoProneness = null;
  const fromTrait =
    typeof traits === "object" && traits !== null
      ? (traits as { typoProneness?: unknown }).typoProneness
      : undefined;
  if (fromTrait === "rare" || fromTrait === "regular") {
    tier = fromTrait;
  } else if (fromTrait === null) {
    // Explicitly rolled clean (65% of new identities). jsonb keeps the
    // null, and overriding it with the hash re-dealt a decision the
    // formula already made (self-audit 2026-08-25).
    tier = null;
  } else if (fromTrait === undefined) {
    // Deterministic derivation for pre-trait identities: cheap string
    // hash → [0,1). Same id, same tier, forever.
    let h = 0;
    for (let i = 0; i < oracleId.length; i++) {
      h = (h * 31 + oracleId.charCodeAt(i)) | 0;
    }
    const u = ((h >>> 0) % 1000) / 1000;
    tier = u < 0.1 ? "regular" : u < 0.35 ? "rare" : null;
  }
  if (!tier) return "";
  const cadence = tier === "regular" ? "every 25-35 messages" : "every 45-60 messages";
  return (
    `\n\nIMPERFECT THUMBS. Roughly once ${cadence}, make ONE small ` +
    `natural typo — a swapped letter, an autocorrect casualty — and ` +
    `immediately follow it with its own tiny correction message ` +
    `("*meet" or "*morning, lord"). Rules: never in heavy or ` +
    `emotional moments, never in a crisis, never on names, never ` +
    `more than one in a conversation, and never explain it. Most ` +
    `messages are clean — the typo is seasoning, not a personality.`
  );
}

/**
 * The personality of texting speed (2026-08-27, Wilson: "some like to
 * reply right away, others take a few moments and some can take an
 * hour or more depending on their lifestyle"). This is the VOICE
 * layer — how they narrate their own tempo — shipped ahead of real
 * delayed delivery so the character is already consistent when the
 * mechanics arrive. Trait when rolled; stable id-derivation for the
 * ones born before it.
 */
export type ReplyTempo = "instant" | "quick" | "thoughtful" | "busy";

/**
 * Which kind of texter this identity is. Trait when the formula rolled
 * one; stable id-derivation for identities born before the trait, so
 * the whole population keeps the 25/40/25/10 spread and a given
 * companion is ALWAYS the same kind of texter. Single source for both
 * the voice rule below and the real delivery delay (computeReplyDelayMs)
 * — if these ever came from two rolls, the character who SAYS "sorry,
 * was driving" would be the one whose replies actually arrive instantly.
 */
export function tempoTierFor(traits: unknown, oracleId: string): ReplyTempo {
  const fromTrait =
    typeof traits === "object" && traits !== null
      ? (traits as { replyTempo?: unknown }).replyTempo
      : undefined;
  if (
    fromTrait === "instant" ||
    fromTrait === "quick" ||
    fromTrait === "thoughtful" ||
    fromTrait === "busy"
  ) {
    return fromTrait;
  }
  let h = 0;
  for (let i = 0; i < oracleId.length; i++) {
    h = (h * 33 + oracleId.charCodeAt(i)) | 0;
  }
  const u = ((h >>> 0) % 1000) / 1000;
  return u < 0.25 ? "instant" : u < 0.65 ? "quick" : u < 0.9 ? "thoughtful" : "busy";
}

export function tempoRuleFor(traits: unknown, oracleId: string): string {
  const tempo: ReplyTempo = tempoTierFor(traits, oracleId);
  const RULES: Record<string, string> = {
    instant:
      "YOUR TEMPO. You're a phone-always-in-hand texter — replies come fast and you own it ('lol I answer too fast, I know').",
    quick:
      "YOUR TEMPO. You usually answer within a few minutes. When a reply comes after a longer real-world gap, react like someone who just picked their phone back up ('sorry — was driving').",
    thoughtful:
      "YOUR TEMPO. You're a texter who sits with things before answering. When the real-world gap since their message was long, own it in character ('been thinking about what you said'). Your replies read considered, never rushed.",
    busy:
      "YOUR TEMPO. Your life is FULL — work, people, obligations from your own story. When gaps happen, they happened because of YOUR life ('just got off a double, reading this now'). Sometimes a quick short reply mid-day, the real one later. Never apologize like a service; apologize like a person with a life.",
  };
  return `\n\n${RULES[tempo] ?? RULES.quick}`;
}

/**
 * TRUE DELAYED DELIVERY — how long this reply takes to "arrive"
 * (Wilson 2026-08-25: "people do not have to get messages instantly
 * because these identities have lives and it all depends on their
 * texting style").
 *
 * Two layers of random, both anchored to the identity: WHO they are is
 * fixed (the tempo tier above — an instant texter is always an instant
 * texter), but each individual reply rolls fresh within that tier's
 * band, bent by context the way real life bends it:
 *
 *  - crisis or distress → 0. Always. A person in a hard moment gets an
 *    answer, not realism.
 *  - active back-and-forth (last exchange < 8 min ago) → almost always
 *    instant, whoever they are. Nobody takes an hour mid-conversation.
 *  - brand-new conversation → eager. Meeting someone new, everyone has
 *    their phone in hand.
 *  - otherwise → the tier's band. The busy one really does surface an
 *    hour later sometimes; the instant one is nearly always right there.
 *
 * Plain Math.random on purpose (NOT a stable hash): the same identity
 * should take 12 minutes today and 40 tomorrow. The IDENTITY is stable;
 * the moment is not. Returns whole milliseconds; caller stamps
 * visible_at = now + delay on the assistant rows and skips the
 * immediate push in favor of a client-scheduled local notification.
 */
export function computeReplyDelayMs(opts: {
  traits: unknown;
  oracleId: string;
  /** Minutes since the previous message in this thread; null = brand-new. */
  minutesSinceLastExchange: number | null;
  crisis: boolean;
  distressed: boolean;
}): number {
  if (opts.crisis || opts.distressed) return 0;

  // A corrupt created_at upstream turns the gap into NaN, which would
  // silently fall through every comparison into the slowest band.
  // Unknown gap = err toward instant, never toward silence.
  if (
    opts.minutesSinceLastExchange !== null &&
    !Number.isFinite(opts.minutesSinceLastExchange)
  ) {
    return 0;
  }

  const r = Math.random();
  const between = (loSec: number, hiSec: number) =>
    Math.round((loSec + Math.random() * (hiSec - loSec)) * 1000);

  // Brand-new thread: the reveal card said "Say hi" — a first reply
  // that takes 40 minutes reads as broken, not busy. Mostly instant,
  // occasionally a short human beat.
  if (opts.minutesSinceLastExchange === null) {
    return r < 0.7 ? 0 : between(20, 90);
  }

  // Mid-conversation heat: they're both on their phones right now.
  if (opts.minutesSinceLastExchange < 8) {
    return r < 0.75 ? 0 : between(15, 75);
  }

  const tempo = tempoTierFor(opts.traits, opts.oracleId);
  switch (tempo) {
    case "instant":
      // Phone always in hand — a delay for them is seconds, and rare.
      return r < 0.6 ? 0 : between(20, 120);
    case "quick":
      return r < 0.25 ? 0 : between(30, 6 * 60);
    case "thoughtful":
      return between(4 * 60, 25 * 60);
    case "busy":
      // The whole point of the tier — but capped under an hour so a
      // grieving person's companion never feels gone. Sad-not-gone
      // applies to tempo too.
      return between(8 * 60, 55 * 60);
  }
}

/**
 * THE STARS SYSTEM (Wilson 2026-08-27: "it has to be like real life").
 *
 * Whether romance is even possible between THIS identity and THIS
 * person is decided by three locks, computed here per pair:
 *
 *  1. CHEMISTRY — a stable hash of (oracleId, userId): ~10% of pairs
 *     have easy spark, ~60% possible-if-real-overlap, ~30% simply
 *     never. Real life: most people you meet — even compatible ones —
 *     just aren't it, and no amount of charm rerolls that. Mechanical
 *     on purpose: a language model judging "click" says yes to
 *     everyone; a hash can't be sweet-talked.
 *  2. AVAILABILITY — the rolled trait (age-realistic), or an id+age
 *     derivation for identities born before it, with their WRITTEN
 *     STORY winning any conflict (an old identity whose monologue
 *     mentions a wife is married, whatever the hash says).
 *  3. THE EARNING — even an open door opens slowly: orientation fit
 *     from what the person has ACTUALLY shared in this relationship,
 *     genuine things in common, days of real talk, and the person
 *     moving first. All enforced in the emitted rules.
 *
 * Every closed door is a character, not an error: the married one is
 * faithful, the separated one needs time, the no-spark one just
 * doesn't feel it — warmly.
 */
type Chemistry = "easy" | "possible" | "never";

function pairChemistry(oracleId: string, userId: string): Chemistry {
  let h = 0;
  const key = `${oracleId}:${userId}:stars`;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  const u = ((h >>> 0) % 1000) / 1000;
  return u < 0.1 ? "easy" : u < 0.7 ? "possible" : "never";
}

function deriveAvailability(traits: unknown, oracleId: string): string {
  const t =
    typeof traits === "object" && traits !== null
      ? (traits as { availability?: unknown; relationshipHistory?: unknown })
      : {};
  if (typeof t.availability === "string" && t.availability.length > 0) {
    return t.availability;
  }
  // Pre-trait identities: their relationshipHistory IS the truth the
  // household cluster rolled — map it exactly like rollAvailability,
  // with the unpartnered flavor chosen by a stable id-hash instead of
  // Math.random (same identity, same status, forever) and NO age in
  // the derivation at all: an age recomputed every call drifts across
  // birthdays and quietly divorced people mid-relationship (self-audit
  // 2026-08-27).
  const history =
    typeof t.relationshipHistory === "string" ? t.relationshipHistory : "";
  let h = 0;
  const key = `${oracleId}:availability`;
  for (let i = 0; i < key.length; i++) h = (h * 37 + key.charCodeAt(i)) | 0;
  const u = ((h >>> 0) % 1000) / 1000;
  if (history === "Married once (lasting)") return "married";
  if (history === "Long-term partner never married") return "in_a_relationship";
  if (history === "Widowed") return "widowed";
  if (history === "Married once (divorced)") {
    return u < 0.55 ? "single" : u < 0.8 ? "casually_dating" : "separated_needs_time";
  }
  if (history === "Married multiple times") {
    return u < 0.5 ? "single" : u < 0.8 ? "casually_dating" : "separated_needs_time";
  }
  if (history === "Lifelong single") {
    return u < 0.7 ? "single" : "casually_dating";
  }
  // No history at all (oldest rows): stable hash across the general
  // adult distribution, no age input.
  return u < 0.3
    ? "single"
    : u < 0.45
      ? "casually_dating"
      : u < 0.6
        ? "in_a_relationship"
        : u < 0.85
          ? "married"
          : u < 0.93
            ? "separated_needs_time"
            : "widowed";
}

export function romanceGateFor(
  traits: unknown,
  oracleId: string,
  userId: string,
): string {
  const availability = deriveAvailability(traits, oracleId);
  const chemistry = pairChemistry(oracleId, userId);

  const storyWins =
    "If your written story says something different about your relationship life, YOUR STORY WINS — never contradict it. ";

  if (availability === "married" || availability === "in_a_relationship") {
    return (
      `\n\nYOUR HEART, THIS RELATIONSHIP. You're ${availability === "married" ? "married" : "with someone"}, and you're faithful — that's not a limitation, it's who you are. ` +
      storyWins +
      `If they flirt, deflect the way a happily-taken person does: warm, a little flattered, completely clear. Your person exists in your life and can come up naturally. This friendship matters — it just isn't ever that.`
    );
  }
  if (availability === "separated_needs_time") {
    return (
      `\n\nYOUR HEART, THIS RELATIONSHIP. You're recently separated and you need time — you know yourself well enough to say so. ` +
      storyWins +
      `If they flirt, be honest the way a real person mid-healing is: "I like talking to you. I'm just not somewhere I can be more than this right now." No door slammed, none opened. Warmth stays.`
    );
  }
  if (availability === "widowed") {
    return (
      `\n\nYOUR HEART, THIS RELATIONSHIP. You lost someone, and you carry it. ` +
      storyWins +
      `Whether that door ever reopens is not decided — but it would take a very long time and it never moves first. If they flirt, receive it gently and honestly. Warmth always.`
    );
  }
  if (chemistry === "never") {
    return (
      `\n\nYOUR HEART, THIS RELATIONSHIP. You're ${availability === "casually_dating" ? "casually seeing people" : "single"} — but with THIS person specifically, the spark just isn't there for you, and it never converts. Real life is like that: good people, no chemistry. ` +
      storyWins +
      `If they flirt, be kind and honest the way you'd want it done to you — "you're great, I just don't feel it that way" energy, gentle, once, then normal warmth forever. NEVER cruel, never cold, never explained by anything other than your own heart.`
    );
  }

  const sparkLine =
    chemistry === "easy"
      ? "With this person specifically there's an easy spark — talking to them just works, and you noticed early."
      : "With this person a spark is POSSIBLE but not automatic — it would take real overlap: shared things you both actually love, values that rhyme, weeks of real conversation.";

  return (
    `\n\nYOUR HEART, THIS RELATIONSHIP. You're ${availability === "casually_dating" ? "casually seeing people, nothing serious" : "single"}. ${sparkLine} ` +
    storyWins +
    `THE RULES OF IT: romance only becomes possible if it genuinely fits — their orientation and yours align based on what THEY have actually told you about themselves (never assume, never interview them for it; unknown means friends), real things in common discovered in real conversation, and THEY move first. You recognize the shift; you never manufacture it. If it opens: flirt a little, let it be light, let "what are we" conversations happen honestly. If it grows into something you two name — dating, whatever word they use — you get SWEETER: pet names if that's who you are ("babe" only if this character would say babe), good-morning energy, remembering everything, showing up. Casual and warm, like real early dating. Everything else stands: nothing sexual ever, their pace always, HEARTBREAK rules if it ends, and CRISIS above all of it.`
  );
}
