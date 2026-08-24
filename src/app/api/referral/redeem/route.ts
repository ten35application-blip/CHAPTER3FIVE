import { NextResponse, type NextRequest } from "next/server";
import { recordAudit } from "@/lib/notifications";
import { after } from "next/server";
import { getRequestAuth } from "@/lib/api/mobileAuth";
import { generateAndSaveFace } from "@/lib/faces/generate";
import { fingerprintTraits } from "@/lib/identity/fingerprint";
import {
  distinctiveValuesFromTraits,
  rollTraits,
  type Traits,
} from "@/lib/identity/formula";
import { synthesizePersona, SynthesisError } from "@/lib/identity/synthesize";
import { requireTermsAccepted } from "@/lib/legal/gate";
import { sendCompanionsReadyEmail } from "@/lib/notifications";
import { REFERRAL_GOAL, refreshQualifications } from "@/lib/referral";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
// Synthesis + portrait, same budget as the other creation routes.
export const maxDuration = 300;

const MAX_FINGERPRINT_REROLLS = 8;

/**
 * POST /api/referral/redeem — spend five qualified referrals on one
 * companion.
 *
 * Deliberately does NOT consult canCreateOracle: this companion was
 * earned, not bought, so it stands outside plan quota entirely. It is
 * stamped is_referral_reward, which is what lets a free account talk
 * to it (the third and last such exception, alongside Adrian and a
 * $5-redeemed archive) — and what keeps it out of the quota tally so
 * earning one never eats a slot the user paid for.
 *
 * The five referrals are CLAIMED FIRST, before ~35s of synthesis. If
 * the weave then fails, the claim is rolled back so nobody loses five
 * real humans to a bad minute at Anthropic. Claiming first is what
 * makes a double-tap impossible: the second request finds four left.
 */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getRequestAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const legal = await requireTermsAccepted(supabase, user.id);
  if (!legal.ok) return legal.response;

  const admin = createAdminClient();

  // SELF-HEAL FIRST (self-audit 2026-08-25): a crash between the
  // five-claim and the finished insert used to spend five real humans
  // on nothing — the reward row (if it existed) sat provisioning=true
  // forever, excluded from every other heal path (adoptOrphan and the
  // subscriber heal both skip is_referral_reward by design). If a
  // stranded reward exists, FINISH it and hand it over: their claim
  // already paid for it.
  const { data: strandedReward } = await admin
    .from("oracles")
    .select("id, traits, avatar_url, created_at")
    .eq("user_id", user.id)
    .eq("is_referral_reward", true)
    .eq("provisioning", true)
    .is("deleted_at", null)
    .lt("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string; traits: unknown; avatar_url: string | null }>();
  if (strandedReward) {
    if (!strandedReward.avatar_url && strandedReward.traits) {
      const face = await generateAndSaveFace(
        strandedReward.id,
        strandedReward.traits as never,
      );
      if (!face.ok) {
        console.error(
          `[referral/redeem] heal face failed for ${strandedReward.id}:`,
          face.error,
        );
      }
    }
    await admin
      .from("oracles")
      .update({ provisioning: false })
      .eq("id", strandedReward.id);
    return NextResponse.json({ id: strandedReward.id, healed: true });
  }

  await refreshQualifications(user.id);

  const { data: ready } = await admin
    .from("referrals")
    .select("id")
    .eq("referrer_id", user.id)
    .not("qualified_at", "is", null)
    .is("redeemed_at", null)
    .order("qualified_at", { ascending: true })
    .limit(REFERRAL_GOAL);

  if (!ready || ready.length < REFERRAL_GOAL) {
    return NextResponse.json(
      {
        error: `You're at ${ready?.length ?? 0} of ${REFERRAL_GOAL}. Keep sharing — it unlocks the moment the fifth person settles in.`,
        code: "not_enough_referrals",
      },
      { status: 409 },
    );
  }

  // Claim the five up front. `.is("redeemed_at", null)` makes this the
  // race guard: two taps can't both come back with five rows.
  const ids = ready.map((r) => r.id as string);
  const stamp = new Date().toISOString();
  const { data: claimed } = await admin
    .from("referrals")
    .update({ redeemed_at: stamp })
    .in("id", ids)
    .is("redeemed_at", null)
    .select("id");
  // Durable trail the moment five humans are spent — if the process
  // dies before the reward row exists, THIS is how support finds and
  // repays the loss (self-audit 2026-08-25). The completion audit
  // below closes the loop; an open 'spent' with no 'completed' is a
  // claim to reconcile.
  await recordAudit({
    actorUserId: user.id,
    action: "referral_claim_spent",
    targetUserId: user.id,
    details: { referralIds: claimed?.map((c) => c.id) ?? [], stamp },
  });

  if (!claimed || claimed.length < REFERRAL_GOAL) {
    // Someone else's request took them a millisecond ago. Put back
    // whatever partial set this request managed to grab.
    if (claimed && claimed.length > 0) {
      await admin
        .from("referrals")
        .update({ redeemed_at: null })
        .in(
          "id",
          claimed.map((c) => c.id as string),
        );
    }
    return NextResponse.json(
      { error: "That reward is already being made. Give it a moment." },
      { status: 409 },
    );
  }
  const releaseClaim = async () => {
    await admin
      .from("referrals")
      .update({ redeemed_at: null })
      .in("id", ids)
      .eq("redeemed_at", stamp);
  };

  // Roll someone unlike the people they already have.
  const { data: sibRows } = await admin
    .from("oracles")
    .select("traits")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .limit(40);
  const avoidDistinctive = distinctiveValuesFromTraits(
    (sibRows ?? []).map((r) => r.traits),
  );

  let traits: Traits | null = null;
  let fingerprint: string | null = null;
  for (let attempt = 0; attempt < MAX_FINGERPRINT_REROLLS; attempt++) {
    const candidate = rollTraits({ avoidDistinctive });
    const candidateFingerprint = fingerprintTraits(candidate);
    const { data: existing } = await admin
      .from("oracles")
      .select("id")
      .eq("fingerprint", candidateFingerprint)
      .maybeSingle();
    if (!existing) {
      traits = candidate;
      fingerprint = candidateFingerprint;
      break;
    }
  }
  if (!traits || !fingerprint) {
    await releaseClaim();
    return NextResponse.json(
      { error: "Couldn't find someone new just now. Try again in a moment." },
      { status: 503 },
    );
  }

  let persona;
  try {
    persona = await synthesizePersona(traits);
  } catch (err) {
    await releaseClaim();
    console.error("[referral/redeem] synthesis failed:", err);
    return NextResponse.json(
      {
        error:
          err instanceof SynthesisError
            ? "Couldn't finish meeting them. Your five are safe — try again."
            : "Something went wrong. Your five are safe — try again.",
      },
      { status: 502 },
    );
  }

  const { data: inserted, error: insertError } = await admin
    .from("oracles")
    .insert({
      user_id: user.id,
      created_by: user.id,
      traits,
      fingerprint,
      name: persona.name,
      one_line_hook: persona.one_line_hook,
      persona_prompt: persona.persona_prompt,
      significant_events: persona.significant_events,
      disclosure_pace: traits.disclosurePace ?? null,
      silence_style: traits.silenceStyle ?? null,
      punctuation_habit: traits.punctuationHabit ?? null,
      memory_style: traits.memoryStyle ?? null,
      text_burst_style: traits.textBurstStyle ?? null,
      chronotype: traits.chronotype ?? null,
      voice_examples: persona.voice_examples,
      texting_fluency: traits.textingFluency ?? null,
      pet_name: persona.pet_name ?? null,
      creation_source: "random",
      is_referral_reward: true,
      provisioning: true,
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !inserted) {
    await releaseClaim();
    console.error("[referral/redeem] insert failed:", insertError);
    return NextResponse.json(
      { error: "Couldn't save them. Your five are safe — try again." },
      { status: 500 },
    );
  }

  // Face, then reveal — same atomic-arrival rule as every other
  // creation path: nobody meets a companion with a letter for a face.
  const oracleId = inserted.id;
  const rolledTraits = traits;
  for (let attempt = 0; attempt < 2; attempt++) {
    const face = await generateAndSaveFace(oracleId, rolledTraits);
    if (face.ok) break;
    console.error("[referral/redeem] face gen attempt failed:", face.error);
  }
  await admin.from("oracles").update({ provisioning: false }).eq("id", oracleId);

  after(async () => {
    if (!user.email) return;
    await sendCompanionsReadyEmail({
      to: user.email,
      userId: user.id,
      companions: [
        { name: persona.name, hook: persona.one_line_hook ?? null },
      ],
    }).catch((err) =>
      console.error("[referral/redeem] arrival email failed:", err),
    );
  });

  await recordAudit({
      actorUserId: user.id,
      action: "referral_claim_completed",
      targetUserId: user.id,
      targetId: oracleId,
      details: { stamp },
    });
    return NextResponse.json({
    oracle_id: oracleId,
    name: persona.name,
    hook: persona.one_line_hook ?? null,
  });
}
