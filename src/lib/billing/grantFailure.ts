import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Record that a customer paid and did not get what they paid for.
 *
 * See migration 0133 for why this exists. Short version: six paths in
 * the Stripe webhook could charge a card and then fail the grant, and
 * every one of them logged to console and returned 200. Stripe's retry
 * does not save us — the payments row is already claimed paid, so a
 * retry short-circuits by design. A console.error was the entire
 * recovery mechanism.
 *
 * WHY THIS NEVER THROWS. It is called from inside webhook handlers that
 * are already on a failure path. If writing the failure record itself
 * failed and that threw, it would take down the surrounding handler and
 * turn "one credit didn't land" into "the whole event errored" — which,
 * on a checkout.session.completed, can mean a paid subscription never
 * gets applied at all. The console.error stays as the last-resort trace
 * for exactly that case.
 *
 * Call it and move on; do not await it in a way that can change control
 * flow, and do not use its return value to decide anything.
 */
export type GrantFailureKind =
  | "message_credits"
  | "image_credits"
  | "inherited_slot"
  | "other_identity_create"
  | "unrecognized_purchase"
  // Not a credit that failed to land — a paid account restore where the
  // follow-up write that takes the user's identities off the purge
  // countdown didn't stick. They got their account back and would lose
  // everything in it 30 days later. Same recovery shape as the rest:
  // unretryable (the payments row is already claimed) and invisible
  // without a row here. grant_failures.kind is plain text, no CHECK
  // constraint, so adding a value needs no migration.
  | "restore_account_oracle_purge_dates"
  // Paid $5 to bring one identity out of the trash and the un-delete
  // didn't stick (or the session carried no oracle_id at all). The
  // identity stays on its purge countdown while the customer believes
  // they saved it — the most expensive possible misunderstanding.
  | "restore_oracle"
  // The legacy one-credit purposes (extra companion slot, randomize,
  // beneficiary slot). `purpose` carries which counter was owed.
  | "profile_counter_credit"
  // A subscription checkout where binding customer/subscription/tier to
  // the profile failed. Worst of the set: renewals reverse-look-up the
  // profile by stripe_subscription_id, which was never written — so the
  // card is charged EVERY month and every renewal event no-ops, forever,
  // until a person re-binds it by hand.
  | "subscription_bind"
  // invoice.paid arrived but extending pro_until failed. The subscriber
  // paid for the month and lapses to Free mid-cycle; self-heals only at
  // NEXT month's invoice, so a person should re-sync it before then.
  | "subscription_renewal_sync";

export async function recordGrantFailure(input: {
  kind: GrantFailureKind;
  userId: string | null;
  stripeEventId?: string | null;
  stripeSessionId?: string | null;
  delta?: number | null;
  purpose?: string | null;
  error?: unknown;
}): Promise<void> {
  // Always log first — if the insert below is what's broken, this line
  // is all that's left.
  console.error(
    `[grant-failure] ${input.kind} user=${input.userId ?? "unknown"} ` +
      `event=${input.stripeEventId ?? "-"} delta=${input.delta ?? "-"}`,
    input.error,
  );

  try {
    const message =
      input.error instanceof Error
        ? input.error.message
        : typeof input.error === "string"
          ? input.error
          : input.error
            ? JSON.stringify(input.error)
            : null;

    await createAdminClient().from("grant_failures").insert({
      kind: input.kind,
      user_id: input.userId,
      stripe_event_id: input.stripeEventId ?? null,
      stripe_session_id: input.stripeSessionId ?? null,
      delta: input.delta ?? null,
      purpose: input.purpose ?? null,
      error: message,
    });
  } catch (err) {
    console.error("[grant-failure] could not record the failure:", err);
  }
}
