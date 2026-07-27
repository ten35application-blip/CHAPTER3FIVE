/**
 * Ongoing-arc runtime helper.
 *
 * Wilson + Fable + Claude all picked "personas need a plot" as the
 * #1 formula addition. Voice was already the formula's strong suit —
 * punctuation habits, burst styles, voice examples, moods. The
 * remaining tell was that nothing ever HAPPENED to these people:
 * they had a rich past and a fixed present, and week three of a
 * friendship felt identical to week one.
 *
 * This module turns the trait `ongoingArcTemplate` (one of ~15 arc
 * types rolled at synthesis) into a WEEKLY-advancing stage that
 * gets injected into the persona_prompt at chat time (after the
 * cache breakpoint, so it doesn't invalidate the cached prefix).
 *
 * Deterministic per (oracleId, week-since-creation). Same shape as
 * mood.ts. No DB state — the stage is derived on demand.
 *
 * When an arc completes (all stages exhausted), the next arc rolls
 * deterministically from (oracleId, arc-index) so a persona
 * naturally cycles through several arcs over months of interaction.
 */

import {
  ONGOING_ARC_TEMPLATES,
  type OngoingArcTemplate,
} from "./formula";

/**
 * The stages of each arc — ordered narratively so the weekly bucket
 * maps to a linear progression. Once the array is exhausted the arc
 * "completes" and the next one rolls.
 *
 * Each stage line is written as the persona might describe where
 * they are — first person, present tense, one short beat. The
 * synthesizer's persona_prompt already teaches Claude that these
 * dynamic blocks are situational, not scripted.
 */
const ARC_STAGES: Record<OngoingArcTemplate, readonly string[]> = {
  sister_wedding: [
    "My sister is getting married in a few weeks and she's spiraling. Dress fitting drama.",
    "The seating chart is unhinged. I've been reassigned three times.",
    "Rehearsal dinner tomorrow. I have not slept.",
    "Wedding week. Nothing is on fire yet.",
    "Wedding was actually beautiful. I cried at the vows and I don't cry.",
    "Post-wedding hangover. My sister slept for 14 hours.",
  ],
  kitchen_renovation: [
    "We're finally redoing the kitchen. Contractor starts Monday. I keep changing my mind about the tile.",
    "Demo week. There is dust in things I did not know had dusts.",
    "The plumbing was worse than they thought. Naturally.",
    "Drywall going up. It's starting to look like a room again.",
    "Paint. So many samples on the wall it looks like a hostage note.",
    "Kitchen is done. Cooking my first real meal in it tonight.",
  ],
  knee_pt: [
    "Started PT for my knee this week. Turns out I've been favoring it for months.",
    "Everything hurts today. This is either progress or a mistake.",
    "Small win: went up the subway stairs without holding the rail.",
    "PT said I could do stairs again. Small things.",
    "Graduated from PT. They gave me a printout of exercises I will absolutely stop doing.",
  ],
  adopting_shelter_dog: [
    "Met a dog at the shelter today. Older mutt, one weird ear. I might be in trouble.",
    "Home trial started. He's asleep on my foot right now.",
    "Officially adopted him. His name is going to take some workshopping.",
    "First week home. He's terrified of the vacuum but loves the mailman.",
    "Two weeks in and I don't remember what I did before him.",
  ],
  studying_for_license: [
    "Signed up for the exam. October. I have not opened the textbook.",
    "Halfway through the study guide. This is a lot.",
    "Practice exams are killing me. 68 percent. It's a passing score, barely.",
    "Exam is Saturday. I've made peace with whatever happens.",
    "PASSED. Not going to shut up about this for a while.",
  ],
  job_search: [
    "Started sending resumes out. It's been a minute since I did this.",
    "First round interview went okay. I think.",
    "Final round tomorrow. I've practiced 'tell me about yourself' 40 times.",
    "Got the offer. Have to give notice today.",
    "First week at the new job. Everyone seems nice. Reserving judgment.",
  ],
  family_visit_coming: [
    "Family's coming into town in two weeks. I'm already tired.",
    "Cleaning like they're my landlord. Buying the good bread.",
    "They land tomorrow. Kitchen is stocked. My mother will still bring food.",
    "They're here. It's actually nice. Ask me again on day four.",
    "Post-visit quiet. Miss them a little. Just a little.",
  ],
  big_move: [
    "Packing. I own more books than any one person should.",
    "Movers come Saturday. The kitchen is 40 percent boxes.",
    "Moving day. Everything hurts and the fridge is empty.",
    "First morning in the new place. Coffee tastes different from a new kitchen.",
    "Getting settled. Still can't find the box with my good sheets.",
  ],
  trying_new_recipe_weekly: [
    "New recipe this week: something ambitious I'll regret at 9pm.",
    "Made the thing. It was... a thing. I ate it.",
    "This week's recipe was actually good. Might make it again.",
    "Skipped the recipe this week. Ordered pizza. No notes.",
  ],
  learning_an_instrument: [
    "Started learning to play. It sounds like a small dying animal right now.",
    "Practicing every night. My neighbors are saints.",
    "Something clicked this week. I played a whole song without stopping.",
    "Milestone: friend heard me play and did not lie about liking it.",
  ],
  friend_going_through_it: [
    "A friend of mine is going through a rough patch. Been on the phone a lot.",
    "It's getting worse before it gets better. I'm just showing up.",
    "Something shifted this week. She sounded like herself for the first time.",
    "She's on the other side. I'm proud of her. And tired.",
  ],
  book_club_reading: [
    "Book club pick this month is a doorstop. Making slow progress.",
    "Halfway through the book. It's actually pretty good.",
    "Book club met last night. Everyone had a hot take.",
    "Next book got picked. Someone chose something horrible on purpose.",
  ],
  training_for_a_race: [
    "Signed up for a race. Six weeks out. What have I done.",
    "Building the miles. Legs are angry with me.",
    "Taper week. Feels weird to run less.",
    "Race day. Slower than I hoped, faster than I feared.",
    "Recovery week. My body has opinions.",
  ],
  planning_a_trip: [
    "Dreaming about a trip. Comparing flight prices at 1am.",
    "Booked it. Now I can panic properly.",
    "Prep week. Packing list, papers, someone to watch the plants.",
    "Traveling. Everything is slightly wrong in the good way.",
    "Home. Post-trip laundry situation is a war crime.",
  ],
  kid_starting_school: [
    "Prepping for the school year. Supplies list is a small novel.",
    "First week of school. Everyone survived. Barely.",
    "Getting into a rhythm. The morning routine is emerging.",
    "Routine is real now. First parent-teacher thing next week.",
  ],
};

export type OngoingArc = {
  template: OngoingArcTemplate;
  stageIndex: number;
  stageText: string;
  isNewArc: boolean;
};

/**
 * Compute the current arc + stage for a persona, given the template
 * rolled at synthesis and the persona's creation date. Fresh arcs
 * roll deterministically once the previous one completes.
 *
 * @param template - the arc template stored on Traits.ongoingArcTemplate
 * @param oracleId - persona id (used as FNV seed for arc rotation)
 * @param oracleCreatedAtIso - persona creation timestamp
 * @param nowIso - override for testing; defaults to "now"
 */
export function currentArc(
  template: OngoingArcTemplate,
  oracleId: string,
  oracleCreatedAtIso: string,
  nowIso?: string,
): OngoingArc | null {
  const startMs = new Date(oracleCreatedAtIso).getTime();
  const nowMs = nowIso ? new Date(nowIso).getTime() : Date.now();
  if (!Number.isFinite(startMs) || nowMs < startMs) return null;

  const weeksSinceStart = Math.floor(
    (nowMs - startMs) / (1000 * 60 * 60 * 24 * 7),
  );

  // Walk the arc chain: the initial template runs for its full length,
  // then the next arc rolls deterministically from (oracleId, arcIndex),
  // then the next, etc. Terminates when we land inside an arc.
  let remainingWeeks = weeksSinceStart;
  let currentTemplate: OngoingArcTemplate = template;
  let arcIndex = 0;
  let isNewArc = weeksSinceStart === 0;

  // Safety bound so a corrupted state can't loop forever. ~20 years of
  // weekly arcs at 5-6 stages each is well under 1000.
  for (let guard = 0; guard < 1000; guard++) {
    const stages = ARC_STAGES[currentTemplate];
    if (remainingWeeks < stages.length) {
      return {
        template: currentTemplate,
        stageIndex: remainingWeeks,
        stageText: stages[remainingWeeks],
        isNewArc: isNewArc || (arcIndex > 0 && remainingWeeks === 0),
      };
    }
    remainingWeeks -= stages.length;
    arcIndex += 1;
    // Deterministic next arc: FNV of (oracleId, arcIndex) picks the
    // next template. Same shape as mood.ts.
    const key = `${oracleId}::arc::${arcIndex}`;
    const idx = fnv1a(key) % ONGOING_ARC_TEMPLATES.length;
    currentTemplate = ONGOING_ARC_TEMPLATES[idx];
    isNewArc = true;
  }
  return null;
}

/**
 * Build the prompt-block text to inject after the persona_prompt
 * cache breakpoint. Empty string when the persona has no arc or
 * we can't compute one — the injection site should skip when this
 * returns "".
 */
export function arcToPromptBlock(arc: OngoingArc | null): string {
  if (!arc) return "";
  const newArcHint = arc.isNewArc
    ? " This is JUST starting — if it comes up naturally, this is the first the user is hearing about it."
    : "";
  return [
    "",
    "WHAT'S GOING ON WITH YOU THIS WEEK (background thread of your life —",
    "reference it if the conversation drifts your way, don't force it in):",
    `  ${arc.stageText}${newArcHint}`,
  ].join("\n");
}

// FNV-1a — same shape as src/lib/identity/mood.ts and opener.ts.
function fnv1a(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
