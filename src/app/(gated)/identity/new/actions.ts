"use server";

import { redirect, RedirectType } from "next/navigation";
import { redirectWithError } from "@/lib/action-errors";
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
import { canCreateOracle, claimFreeIdentitySlot } from "@/lib/subscription";
import { sendCompanionsReadyEmail } from "@/lib/notifications";
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

  // Roster dedupe: steer the roll around distinctive values already on
  // this user's companions (two "Chickens out back" reads as the
  // machine). Admin client — the traits column is server-side.
  const { data: sibRows } = await createAdminClient()
    .from("oracles")
    .select("traits")
    .eq("user_id", user.id)
    .is("deleted_at", null);
  const avoidDistinctive = distinctiveValuesFromTraits(
    (sibRows ?? []).map((r) => r.traits),
  );

  // Roll + fingerprint, retrying only on unique-constraint collisions.
  // Astronomically rare in 2^256 space, but the constraint exists so
  // we handle it cleanly rather than 500-ing.
  let traits: Traits | null = null;
  let fingerprint: string | null = null;
  for (let attempt = 0; attempt < MAX_FINGERPRINT_REROLLS; attempt++) {
    const candidate = rollTraits({ avoidDistinctive });
    const candidateFingerprint = fingerprintTraits(candidate);
    // Admin client on purpose — same as the roster-dedupe query above.
    // Under the caller's own token RLS scopes this SELECT to their own
    // oracles, so a fingerprint already taken by ANY other user reads
    // back as free, all five re-rolls falsely "pass", and the collision
    // only surfaces on the insert, against the oracles_fingerprint_key
    // unique index — which spans the whole table, not one user.
    const { data: existing } = await createAdminClient()
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

  // TOCTOU re-check. The gate at the top ran BEFORE ~35s of synthesis;
  // /identity/new fires createIdentity() on mount, so a refresh
  // mid-spinner starts a second request that passed the same early
  // gate. Requests stagger by human-scale seconds while this
  // check-to-insert gap is milliseconds — re-checking here closes the
  // realistic race (free user ending up owning 2+ identities, paying
  // twice for synthesis).
  const lateGate = await canCreateOracle(user.id);
  if (!lateGate.ok) {
    redirectWithError(
      "/dashboard",
      "Another identity finished creating just now — you're at your plan's limit. The one you made should already be on your dashboard.",
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
      provisioning: true,
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

  // ATOMIC REVEAL (2026-08-15): face is AWAITED so the identity
  // arrives complete — name and portrait together, matching the
  // mobile twin. One retry; on persistent failure reveal anyway
  // (letter avatar beats a dead-end after a watched loader).
  const oracleId = inserted.id;
  const rolledTraits = traits;
  for (let attempt = 0; attempt < 2; attempt++) {
    // generateAndSaveFace never throws — it returns { ok } (ultrareview
    // 2026-08-19 nit: the old try/catch always broke on attempt 0, so
    // the retry this loop exists for never ran and a Flux flake meant
    // a letter avatar after a watched loader).
    const face = await generateAndSaveFace(oracleId, rolledTraits);
    if (face.ok) break;
    console.error("[identity/new]", "face gen attempt failed:", face.error);
  }
  await createAdminClient()
    .from("oracles")
    .update({ provisioning: false })
    .eq("id", oracleId);

  // REPLACE, not push. The reveal lives at the same route that
  // auto-generates when it has no ?id=, so a plain redirect left
  // "/identity/new" (no id) in history directly behind the card. Pressing
  // Back — the most ordinary thing anyone does in a browser — remounted
  // AutoGenerate and silently rolled a SECOND companion against their
  // lifetime slots, with no confirmation and no way to undo. Replacing
  // the entry means Back leaves the flow instead of re-entering it.
  redirect(`/identity/new?id=${inserted.id}`, RedirectType.replace);
}
