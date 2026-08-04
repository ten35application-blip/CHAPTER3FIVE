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
  | "unrecognized_purchase";

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
