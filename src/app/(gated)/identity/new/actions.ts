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

  // Insert the row. RLS's write policy scopes to auth.uid() = user_id.
  const { data: inserted, error: insertError } = await supabase
    .from("oracles")
    .insert({
      user_id: user.id,
      traits,
      fingerprint,
      name: persona.name,
      one_line_hook: persona.one_line_hook,
      persona_prompt: persona.persona_prompt,
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
