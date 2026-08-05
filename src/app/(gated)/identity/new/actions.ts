"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { redirectWithError } from "@/lib/action-errors";
import { generateAndSaveFace } from "@/lib/faces/generate";
import { fingerprintTraits } from "@/lib/identity/fingerprint";
import { rollTraits, type Traits } from "@/lib/identity/formula";
import {
  synthesizePersona,
  SynthesisError,
} from "@/lib/identity/synthesize";
import { canCreateOracle, claimFreeIdentitySlot } from "@/lib/subscription";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MAX_FINGERPRINT_REROLLS = 5;

/**
 * The whole generator flow:
 *   1. Auth gate
 *   2. Roll traits + fingerprint; reroll on collision (up to 5 times)
 *   3. Call Claude to synthesize the persona
 *   4. Insert into oracles
 *   5. Redirect to /identity/new?id=<new_id> to show the reveal
 *
 * On any user-actionable failure, redirects back to /identity/new with a
 * plain-language ?error=. Raw Anthropic / Supabase errors are logged
 * server-side (via redirectWithError) but never shown to the user.
 */
export async function createIdentity(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  // Quota gate. Free tier: 1 identity via free_identity_id. Pro:
  // PRICING.totalIdentitiesPerPlan + extra_oracle_credits (bumped
  // by Stripe 'oracle' purchases). Fail-closed on unknown.
  const gate = await canCreateOracle(user.id);
  if (!gate.ok) {
    if (gate.reason === "upgrade_required") {
      redirect(
        `/upgrade?next=${encodeURIComponent("/identity/new")}&reason=identity`,
      );
    }
    if (gate.reason === "quota_reached") {
      redirectWithError(
        "/identity/new",
        `You're at ${gate.currentCount ?? "your"} of ${gate.quota ?? "the"} identities. Add an extra slot from Settings to make another.`,
      );
    }
    redirectWithError(
      "/identity/new",
      "Couldn't check your plan. Try again in a moment.",
    );
  }

  // Roll + fingerprint, retrying only on unique-constraint collisions.
  // Astronomically rare in 2^256 space, but the constraint exists so
  // we handle it cleanly rather than 500-ing.
  let traits: Traits | null = null;
  let fingerprint: string | null = null;
  for (let attempt = 0; attempt < MAX_FINGERPRINT_REROLLS; attempt++) {
    const candidate = rollTraits();
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
    redirectWithError(
      "/identity/new",
      "Couldn't find a fresh identity. Try again in a moment.",
    );
  }

  // Synthesize the persona via Claude.
  let persona;
  try {
    persona = await synthesizePersona(traits);
  } catch (err) {
    if (err instanceof SynthesisError) {
      if (err.kind === "refusal") {
        redirectWithError(
          "/identity/new",
          "That combination didn't sit right. Try again.",
          err,
        );
      }
      redirectWithError(
        "/identity/new",
        "Couldn't finish meeting them. Try again.",
        err,
      );
    }
    redirectWithError(
      "/identity/new",
      "Something went wrong. Try again in a moment.",
      err,
    );
  }

  // Insert via the admin client — 0067 (oracles_protect_backend_columns)
  // rejects ALL user-role INSERTs on this table by design; identity
  // creation is meant to route through server actions that use
  // service_role. Ownership (user_id) is set explicitly here.
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
      // Fable humanization (0078) — nullable rolls from formula.
      // Each may be null (no forced quirk) or a rolled value.
      disclosure_pace: traits.disclosurePace ?? null,
      silence_style: traits.silenceStyle ?? null,
      punctuation_habit: traits.punctuationHabit ?? null,
      memory_style: traits.memoryStyle ?? null,
      text_burst_style: traits.textBurstStyle ?? null,
      chronotype: traits.chronotype ?? null,
      voice_examples: persona.voice_examples,
      // Formula v5 additions (0094) — texting_fluency lives on the
      // row so replyGap can read it; pet_name lives here so
      // openers/outreach can reference it consistently.
      texting_fluency: traits.textingFluency ?? null,
      pet_name: persona.pet_name ?? null,
      // 'random', NOT 'randomize' — the 0060/0112 CHECK constraint
      // allows only ('random','photo','legacy','inherited'). The
      // 'randomize' value shipped 2026-07-27 violated it, so EVERY
      // formula-identity insert 23514'd after the ~30s synthesis had
      // already run and been paid for. Formula creation was dead in
      // production for nine days and the retry button re-ran the same
      // doomed insert. autoPopulate.ts always wrote 'random' correctly.
      creation_source: "random",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    redirectWithError(
      "/identity/new",
      "Couldn't save them. Try again.",
      insertError,
    );
  }

  // First identity created claims the post-trial Free-tier slot
  // (profiles.free_identity_id, NULL-only, server-side write).
  await claimFreeIdentitySlot(user.id, inserted.id);

  // Fire-and-forget face generation. `after()` runs once the redirect
  // response is sent — Flux Pro takes 15–40s and must never block the
  // reveal. generateAndSaveFace never throws; failures land in
  // oracles.face_generation_status for later retry via
  // POST /api/faces/generate (force) or /api/faces/backfill.
  // (const captures: `after`'s closure can't rely on `let` narrowing.)
  const oracleId = inserted.id;
  const rolledTraits = traits;
  after(async () => {
    await generateAndSaveFace(oracleId, rolledTraits);
  });

  redirect(`/identity/new?id=${inserted.id}`);
}
