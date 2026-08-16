/**
 * Auto-populate a subscribing user's circle so it isn't empty on
 * their first post-payment open.
 *
 * Wilson's Phase-3 spec (2026-08-03):
 *   Basic ($5/mo) → 2 random companions + 1 photo placeholder = 3 total
 *   Pro   ($10/mo) → 4 random companions + 1 photo placeholder = 5 total
 *
 * Called from BOTH webhook paths (Stripe + RevenueCat) via after()
 * so the webhook returns 200 within Stripe's / RevenueCat's
 * timeout window and the heavy generation runs in the background.
 *
 * Idempotency + concurrency:
 *
 *   - try_acquire_auto_populate_lock (migration 0126) is a
 *     CAS-style RPC. Two racing webhook invocations can call it
 *     concurrently; exactly one wins, the loser returns without
 *     side-effects. Stale locks (>5 min without completion) are
 *     reclaimable so a crashed run does not wedge the user.
 *
 *   - The per-tier top-up counts EXISTING non-Me / non-inherited
 *     / non-concierge / non-deleted / non-placeholder oracles and
 *     only creates the difference. A user with 2 companions who
 *     upgrades Basic → Pro gets 2 more random + 1 placeholder
 *     (4 random + 1 placeholder = 5). A user who cancels and
 *     re-subscribes at the same tier already has the quota, so
 *     nothing new is created.
 *
 * Failure posture: never throws. Every leg logs its own error
 * and moves on. On any failure, the completion timestamp is still
 * stamped in the finally block so the "your companions are being
 * created" banner does not linger forever after a botched run.
 */

import { after } from "next/server";
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
import { createAdminClient } from "@/lib/supabase/admin";
import { PRICING } from "@/lib/pricing";

const MAX_FINGERPRINT_REROLLS = 5;

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Kick off the subscribe-time auto-populate for `userId` at the
 * given `tier`. Idempotent; concurrent-safe; never throws.
 *
 * Call site pattern (both webhook paths):
 *   after(async () => {
 *     await autoPopulateForSubscribe(userId, tier);
 *   });
 *
 * The helper handles its own logging + status stamping. Nothing
 * for the webhook to await or unwind on failure.
 */
export async function autoPopulateForSubscribe(
  userId: string,
  tier: "basic" | "pro",
): Promise<void> {
  const admin = createAdminClient();

  // 1. Acquire the per-user lock (5 min stale reclaim).
  const acquired = await tryAcquireLock(admin, userId);
  if (!acquired) {
    console.log(
      `[autoPopulate] ${userId} — another run holds the lock; skipping`,
    );
    return;
  }

  try {
    // 2. Compute what's missing.
    const randomTarget =
      tier === "basic"
        ? PRICING.basicFormulaIdentitiesPerPlan
        : PRICING.formulaIdentitiesPerPlan;

    const [existingRandom, existingPlaceholder] = await Promise.all([
      countExistingRandom(admin, userId),
      countExistingPhotoCompanion(admin, userId),
    ]);

    let randomToCreate = Math.max(0, randomTarget - existingRandom);
    let placeholderToCreate = Math.max(0, 1 - existingPlaceholder);

    // TRANSACTION MINT BUDGET (Wilson 2026-08-16: "make a bunch of
    // emails … same apple id"). Account-level counting resets when the
    // account is deleted; the store transaction doesn't. A subscription
    // mints its tier's companions once, EVER — cycling accounts under
    // one Apple/Google sub transfers the plan but arrives with the
    // budget already spent. An upgrade keeps its transaction id, so a
    // Basic→Pro top-up (target 4, minted 2) still works. Stripe subs
    // have no store transaction: unaffected (a new web signup can't
    // reuse a Stripe sub without paying again).
    const txnId = await activeStoreTransactionId(admin, userId);
    if (txnId) {
      const { data: ledger } = await admin
        .from("iap_mint_ledger")
        .select("minted_random, minted_placeholder")
        .eq("original_transaction_id", txnId)
        .maybeSingle<{ minted_random: number; minted_placeholder: number }>();
      const mintedRandom = ledger?.minted_random ?? 0;
      const mintedPlaceholder = ledger?.minted_placeholder ?? 0;
      randomToCreate = Math.min(
        randomToCreate,
        Math.max(0, randomTarget - mintedRandom),
      );
      placeholderToCreate = Math.min(
        placeholderToCreate,
        Math.max(0, 1 - mintedPlaceholder),
      );
      if (ledger && (mintedRandom > 0 || mintedPlaceholder > 0)) {
        console.log(
          `[autoPopulate] ${userId} txn=${txnId} — ledger minted random=${mintedRandom} placeholder=${mintedPlaceholder}; budget caps creation to random=${randomToCreate} placeholder=${placeholderToCreate}`,
        );
      }
    }

    console.log(
      `[autoPopulate] ${userId} tier=${tier} — existing random=${existingRandom} placeholder=${existingPlaceholder}; creating random=${randomToCreate} placeholder=${placeholderToCreate}`,
    );

    // 3. Ensure the photo placeholder FIRST so the user's very
    //    first dashboard load has something to see even if the
    //    persona synthesis calls run long. Cheap DB insert.
    let placeholderCreated = 0;
    if (placeholderToCreate > 0) {
      try {
        placeholderCreated = (await createPhotoPlaceholder(admin, userId))
          ? 1
          : 0;
      } catch (err) {
        console.error(
          `[autoPopulate] ${userId} — placeholder create failed:`,
          err,
        );
      }
    }

    // 4. Synthesize random identities SERIALLY. Anthropic-tier
    //    calls take ~30s each; running them in parallel risks
    //    rate-limit spikes on a busy webhook window and complicates
    //    partial-failure accounting. Serial keeps the total time
    //    predictable (basic ≤ 60s, pro ≤ 120s) inside the
    //    maxDuration=300 the webhook route sets.
    // Roster dedupe: start from the distinctive values already on the
    // user's live roster, and GROW the set as this run creates more —
    // this loop mints 2-4 companions back-to-back for one user, the
    // single most likely place for two "Chickens out back".
    const { data: sibRows } = await admin
      .from("oracles")
      .select("traits")
      .eq("user_id", userId)
      .is("deleted_at", null);
    const avoidDistinctive = distinctiveValuesFromTraits(
      (sibRows ?? []).map((r) => r.traits),
    );

    // 4b. HEAL PASS first (2026-08-15): finish any provisioning rows a
    //     previous truncated/failed run left behind — retry their faces
    //     and fold them into the reveal batch below. Idempotent.
    const revealIds: string[] = [];
    const { data: orphans } = await admin
      .from("oracles")
      .select("id, traits, avatar_url")
      .eq("user_id", userId)
      .eq("provisioning", true)
      .is("deleted_at", null);
    for (const o of orphans ?? []) {
      if (!o.avatar_url) {
        try {
          await generateAndSaveFace(o.id as string, o.traits as never);
        } catch (err) {
          console.error(
            `[autoPopulate] ${userId} — heal face failed for ${o.id}:`,
            err,
          );
          continue; // stays hidden; next run retries
        }
      }
      revealIds.push(o.id as string);
    }

    // ATOMIC DELIVERY (Wilson 2026-08-15: "they should all come in at
    // the same time"): each identity is inserted provisioning=true
    // (invisible), its face is AWAITED, and the entire batch flips
    // visible in one update at the end — names and faces land
    // together, never a faceless row on anyone's dashboard.
    let randomCreated = 0;
    for (let i = 0; i < randomToCreate; i++) {
      let created: { oracleId: string; traits: unknown } | null = null;
      for (let attempt = 0; attempt < 2 && !created; attempt++) {
        try {
          created = await createOneRandomIdentity(
            admin,
            userId,
            avoidDistinctive,
          );
        } catch (err) {
          console.error(
            `[autoPopulate] ${userId} — identity ${i + 1}/${randomToCreate} attempt ${attempt + 1} failed:`,
            err,
          );
        }
      }
      if (!created) continue; // heal pass on a later run tops this up
      randomCreated++;
      for (const v of distinctiveValuesFromTraits([created.traits as never])) {
        avoidDistinctive.add(v);
      }
      try {
        await generateAndSaveFace(created.oracleId, created.traits as never);
        revealIds.push(created.oracleId);
      } catch (faceErr) {
        console.error(
          `[autoPopulate] ${userId} — face gen failed for ${created.oracleId} (stays hidden for heal):`,
          faceErr,
        );
      }
    }

    // 4c. Spend the transaction's mint budget for what actually got
    //     minted this run. Read-modify-write is safe here: the per-user
    //     populate lock serializes runs, and a store transaction has
    //     exactly one owning user at a time.
    if (txnId && (randomCreated > 0 || placeholderCreated > 0)) {
      try {
        const { data: cur } = await admin
          .from("iap_mint_ledger")
          .select("minted_random, minted_placeholder")
          .eq("original_transaction_id", txnId)
          .maybeSingle<{ minted_random: number; minted_placeholder: number }>();
        await admin.from("iap_mint_ledger").upsert({
          original_transaction_id: txnId,
          minted_random: (cur?.minted_random ?? 0) + randomCreated,
          minted_placeholder:
            (cur?.minted_placeholder ?? 0) + placeholderCreated,
          last_user_id: userId,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error(
          `[autoPopulate] ${userId} — mint ledger write failed:`,
          err,
        );
      }
    }

    // 5. The reveal: the whole batch becomes visible in one write.
    if (revealIds.length > 0) {
      const { error: revealErr } = await admin
        .from("oracles")
        .update({ provisioning: false })
        .in("id", revealIds);
      if (revealErr) {
        console.error(
          `[autoPopulate] ${userId} — reveal update failed:`,
          revealErr,
        );
      }
    }
  } finally {
    // 5. Stamp completion regardless of success/failure so the
    //    dashboard "companions being created" banner clears.
    try {
      await admin.rpc("mark_auto_populate_complete", {
        target_user_id: userId,
      });
    } catch (err) {
      console.error(
        `[autoPopulate] ${userId} — completion stamp failed:`,
        err,
      );
    }
  }
}

/**
 * Convenience wrapper: schedule the populate as a background task
 * from a webhook handler. Same as writing the after() call inline
 * at each site, but pulled into one place so the two webhook
 * handlers stay parallel.
 *
 * Safe to call more than once for the same user (the helper
 * guards with the per-user lock).
 */
export function scheduleAutoPopulate(
  userId: string,
  tier: "basic" | "pro",
): void {
  after(async () => {
    await autoPopulateForSubscribe(userId, tier);
  });
}

// ---------------------------------------------------------------
// Internals
// ---------------------------------------------------------------

/**
 * The store transaction backing the user's current basic/pro
 * entitlement, if any. Stripe-only subscribers return null (no store
 * transaction exists; the mint budget doesn't apply to them).
 */
async function activeStoreTransactionId(
  admin: AdminClient,
  userId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("iap_entitlements")
    .select("original_transaction_id, updated_at")
    .eq("user_id", userId)
    .in("entitlement_id", ["basic", "pro"])
    .not("original_transaction_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ original_transaction_id: string | null }>();
  return data?.original_transaction_id ?? null;
}

async function tryAcquireLock(
  admin: AdminClient,
  userId: string,
): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc("try_acquire_auto_populate_lock", {
      target_user_id: userId,
      stale_after_seconds: 300,
    });
    if (error) {
      console.error(
        `[autoPopulate] ${userId} — lock RPC failed; skipping run:`,
        error,
      );
      return false;
    }
    return data === true;
  } catch (err) {
    console.error(
      `[autoPopulate] ${userId} — lock RPC threw; skipping run:`,
      err,
    );
    return false;
  }
}

/** Count non-Me / non-inherited / non-concierge / non-deleted /
 *  non-placeholder oracles owned by the user. Mirrors the same
 *  filter shape as canCreateOracle in src/lib/subscription.ts
 *  with the extra `is_photo_placeholder=false` clause. */
async function countExistingRandom(
  admin: AdminClient,
  userId: string,
): Promise<number> {
  const { count } = await admin
    .from("oracles")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_concierge", false)
    .eq("is_self_archive", false)
    .eq("is_photo_placeholder", false)
    .is("inherited_at", null)
    .is("deleted_at", null);
  return count ?? 0;
}

/** Count photo companions (unfilled placeholder OR already-filled
 *  photo persona) so a filled photo doesn't get duplicated by a
 *  subsequent subscription.updated webhook. Audit 2026-08-03:
 *  earlier version filtered is_photo_placeholder=true only — once
 *  the user uploaded, the row no longer matched and every
 *  subscription.updated event (cancel_at_period_end toggle, coupon,
 *  price change, dunning) appended a NEW placeholder over the
 *  quota. Counting by creation_source='photo' catches both states
 *  and keeps the "at most one photo slot per user" invariant.
 *  Inherited photo copies (0111) are excluded — those are separate
 *  ownership. */
async function countExistingPhotoCompanion(
  admin: AdminClient,
  userId: string,
): Promise<number> {
  const { count } = await admin
    .from("oracles")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("creation_source", "photo")
    .is("inherited_at", null)
    .is("deleted_at", null);
  return count ?? 0;
}

/**
 * Roll traits + fingerprint + synthesize + insert one random
 * identity. Returns { oracleId, traits } on success so the caller
 * can fire face generation. Mirrors /api/identity/new/route.ts's
 * flow without the auth / legal / quota gates (this runs
 * post-subscribe, quota was implicit in the tier).
 */
async function createOneRandomIdentity(
  admin: AdminClient,
  userId: string,
  avoidDistinctive?: ReadonlySet<string>,
): Promise<{ oracleId: string; traits: Traits } | null> {
  // Roll + fingerprint, retrying on unique-constraint collisions.
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
    console.error(
      `[autoPopulate] ${userId} — could not find fresh fingerprint after ${MAX_FINGERPRINT_REROLLS} rolls`,
    );
    return null;
  }

  // Synthesize persona via Claude.
  let persona;
  try {
    persona = await synthesizePersona(traits);
  } catch (err) {
    if (err instanceof SynthesisError) {
      console.error(
        `[autoPopulate] ${userId} — synth ${err.kind}:`,
        err.message,
      );
    } else {
      console.error(`[autoPopulate] ${userId} — synth threw:`, err);
    }
    return null;
  }

  // Insert via admin (0067 blocks user-role inserts).
  const { data: inserted, error: insertError } = await admin
    .from("oracles")
    .insert({
      user_id: userId,
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
      provisioning: true,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    console.error(
      `[autoPopulate] ${userId} — insert failed:`,
      insertError,
    );
    return null;
  }

  return { oracleId: inserted.id as string, traits };
}

/**
 * Create a single photo-placeholder oracle. Minimal row:
 *
 *   name              — "Your photo companion" (soft placeholder;
 *                       replaced from the uploaded photo in Phase 4)
 *   one_line_hook     — the tap-to-upload hint the dashboard row
 *                       shows in place of a preview
 *   creation_source   — 'photo' (this IS a photo identity; the
 *                       is_photo_placeholder flag says it just
 *                       hasn't been filled in yet)
 *   is_photo_placeholder — true
 *   persona_prompt / traits / fingerprint / voice_examples —
 *                       all null; Phase 4's photo-upload route
 *                       generates them from the uploaded image
 *                       and flips is_photo_placeholder=false in
 *                       the same write.
 *
 * Wrapped in a small pre-check that skips insert if a placeholder
 * already exists — belt against the count race between two racing
 * webhook invocations (the outer per-user lock already handles it,
 * but this stops accidental doubles under any future concurrency).
 */
async function createPhotoPlaceholder(
  admin: AdminClient,
  userId: string,
): Promise<boolean> {
  // Belt: recheck under the lock. The outer lock already serializes,
  // but a stale-reclaim can hand the lock to run #2 mid-way through
  // run #1's placeholder insert; the recheck stops doubles.
  const alreadyExists = await countExistingPhotoCompanion(admin, userId);
  if (alreadyExists > 0) return false;

  const { error } = await admin.from("oracles").insert({
    user_id: userId,
    name: "Your photo companion",
    one_line_hook: "Tap to upload a photo — I'll come alive.",
    creation_source: "photo",
    is_photo_placeholder: true,
  });
  if (error) {
    console.error(
      `[autoPopulate] ${userId} — placeholder insert failed:`,
      error,
    );
    return false;
  }
  return true;
}
