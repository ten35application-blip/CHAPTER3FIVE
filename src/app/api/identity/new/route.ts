import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { getRequestAuth } from "@/lib/api/mobileAuth";
import { generateAndSaveFace } from "@/lib/faces/generate";
import { fingerprintTraits } from "@/lib/identity/fingerprint";
import {
  distinctiveValuesFromTraits,
  rollTraits,
  type Traits,
} from "@/lib/identity/formula";
import {
  synthesizePersona,
  SynthesisError,
} from "@/lib/identity/synthesize";
import { requireTermsAccepted } from "@/lib/legal/gate";
import { canCreateOracle, claimFreeIdentitySlot } from "@/lib/subscription";
import { sendCompanionsReadyEmail } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_FINGERPRINT_REROLLS = 5;

// Persona synthesis can run long; match the legacy page's posture and
// give the route headroom well past the Hobby default.
export const maxDuration = 300;

/**
 * POST /api/identity/new — the mobile twin of the createIdentity()
 * server action (identity/new/actions.ts). Same flow, JSON in/out:
 *
 *   1. Auth gate (cookie or Bearer) + terms gate
 *   2. Quota gate (canCreateOracle) — 402 upgrade_required /
 *      409 quota_reached with the action's exact user copy
 *   3. Roll traits + fingerprint; reroll on collision (up to 5 times)
 *   4. Claude synthesizes the persona
 *   5. Insert into oracles (service role — 0067 blocks user inserts)
 *   6. Fire-and-forget face generation via after()
 *   7. → { id } — the client loads the reveal card itself (same
 *      SELECT the web reveal page runs, RLS-scoped to the owner)
 *
 * Every failure returns the SAME plain-language message the web
 * action shows via redirectWithError, so mobile and web read
 * identically. Raw errors are logged server-side only.
 */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getRequestAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const legal = await requireTermsAccepted(supabase, user.id);
  if (!legal.ok) return legal.response;

  // Quota gate. Free tier: 1 identity via free_identity_id. Pro:
  // PRICING.totalIdentitiesPerPlan + extra_oracle_credits. Fail-closed.
  const gate = await canCreateOracle(user.id);
  if (!gate.ok) {
    if (gate.reason === "upgrade_required") {
      return NextResponse.json(
        { error: "upgrade_required", code: "upgrade_required" },
        { status: 402 },
      );
    }
    if (gate.reason === "quota_reached") {
      return NextResponse.json(
        {
          error: `You're at ${gate.currentCount ?? "your"} of ${gate.quota ?? "the"} identities. Add an extra slot from Settings to make another.`,
          code: "quota_reached",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Couldn't check your plan. Try again in a moment." },
      { status: 500 },
    );
  }

  // Roster dedupe — see the web twin. Admin client: traits is
  // server-side.
  const { data: sibRows } = await createAdminClient()
    .from("oracles")
    .select("traits")
    .eq("user_id", user.id)
    .is("deleted_at", null);
  const avoidDistinctive = distinctiveValuesFromTraits(
    (sibRows ?? []).map((r) => r.traits),
  );

  // Roll + fingerprint, retrying only on unique-constraint collisions.
  let traits: Traits | null = null;
  let fingerprint: string | null = null;
  for (let attempt = 0; attempt < MAX_FINGERPRINT_REROLLS; attempt++) {
    const candidate = rollTraits({ avoidDistinctive });
    const candidateFingerprint = fingerprintTraits(candidate);
    const { data: existing } = await supabase
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
    return NextResponse.json(
      { error: "Couldn't find a fresh identity. Try again in a moment." },
      { status: 500 },
    );
  }

  // Synthesize the persona via Claude.
  let persona;
  try {
    persona = await synthesizePersona(traits);
  } catch (err) {
    console.error("[api/identity/new] synthesis failed:", err);
    if (err instanceof SynthesisError) {
      if (err.kind === "refusal") {
        return NextResponse.json(
          { error: "That combination didn't sit right. Try again." },
          { status: 502 },
        );
      }
      return NextResponse.json(
        { error: "Couldn't finish meeting them. Try again." },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: "Something went wrong. Try again in a moment." },
      { status: 500 },
    );
  }

  // TOCTOU re-check — see the web twin (identity/new/actions.ts): the
  // early gate ran before ~35s of synthesis; a duplicate request that
  // passed the same gate may have landed an identity since. The
  // check-to-insert gap here is milliseconds, so re-checking closes
  // the realistic race.
  const lateGate = await canCreateOracle(user.id);
  if (!lateGate.ok) {
    return NextResponse.json(
      {
        error:
          "Another identity finished creating just now — you're at your plan's limit.",
        code: "quota_reached",
      },
      { status: 409 },
    );
  }

  // Insert via the admin client — 0067 (oracles_protect_backend_columns)
  // rejects ALL user-role INSERTs on this table by design. Ownership
  // (user_id) is set explicitly here, same as the web action.
  const admin = createAdminClient();
  const { data: inserted, error: insertError } = await admin
    .from("oracles")
    .insert({
      user_id: user.id,
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
      // 'random', NOT 'randomize' — the 0060/0112 CHECK constraint
      // allows only ('random','photo','legacy','inherited'). See the
      // matching comment in (gated)/identity/new/actions.ts: the
      // 'randomize' value made every formula insert fail 23514 after
      // the synthesis had already run. Both twins fixed together.
      creation_source: "random",
      // Hidden until the face is ready — atomic reveal (2026-08-15).
      provisioning: true,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    console.error("[api/identity/new] insert failed:", insertError);
    return NextResponse.json(
      { error: "Couldn't save them. Try again." },
      { status: 500 },
    );
  }

  // First identity created claims the post-trial Free-tier slot.
  await claimFreeIdentitySlot(user.id, inserted.id);

  // "Your companion is here." — the same arrival email bundle
  // deliveries send, for a single creation (Wilson 2026-08-19: an
  // email when you create an identity). Best-effort: mail trouble
  // never fails a creation someone just paid for.
  if (user.email) {
    sendCompanionsReadyEmail({
      to: user.email,
      userId: user.id,
      companions: [
        { name: persona.name, hook: persona.one_line_hook ?? null },
      ],
    }).catch((err) =>
      console.error("companion-ready email failed:", err),
    );
  }

  // ATOMIC REVEAL (2026-08-15, "they should all come in at the same
  // time"): the face is AWAITED so the identity arrives complete —
  // name and portrait together. The loader copy already promises
  // "about a minute"; the extra ~20-30s lives inside that promise.
  // One retry; if the face still fails, reveal anyway (letter avatar
  // beats a dead-end for a user who watched the loader).
  const oracleId = inserted.id as string;
  const rolledTraits = traits;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await generateAndSaveFace(oracleId, rolledTraits);
      break;
    } catch (err) {
      console.error("[api/identity/new] face gen attempt failed:", err);
    }
  }
  await admin
    .from("oracles")
    .update({ provisioning: false })
    .eq("id", oracleId);

  return NextResponse.json({ id: oracleId });
}
