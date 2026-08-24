import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/notifications";

/**
 * Stop Stripe billing a dead account.
 *
 * Nothing anywhere cancelled a web subscription when its account was
 * deleted (self-audit 2026-08-25): the user deletes, the 30-day purge
 * erases auth + profile, and Stripe keeps charging the card forever —
 * every later invoice.paid finds no profile and is silently acked.
 * The stores handle this themselves (subscriptions live on the Apple/
 * Google account); the web rail was the hole.
 *
 * cancel_at_period_end, not an immediate cancel: they paid for the
 * period, and a reactivation inside the deletion window finds the
 * subscription still live (we un-cancel on reactivate). Best-effort by
 * design — a Stripe outage must never block a deletion the user is
 * entitled to — but every failure writes an audit row so it's findable
 * instead of a card that bleeds forever.
 */
export async function cancelStripeOnDeletion(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_subscription_id, subscription_status, plan_source")
      .eq("id", userId)
      .maybeSingle<{
        stripe_subscription_id: string | null;
        subscription_status: string | null;
        plan_source: string | null;
      }>();
    const subId = profile?.stripe_subscription_id;
    if (!subId) return;
    if (
      profile?.subscription_status === "canceled" ||
      profile?.subscription_status === "incomplete_expired"
    ) {
      return;
    }
    const stripe = getStripe();
    await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
    await recordAudit({
      actorUserId: userId,
      action: "stripe_cancel_on_deletion",
      targetUserId: userId,
      targetId: subId,
      details: { mode: "cancel_at_period_end" },
    });
  } catch (err) {
    console.error("[cancelOnDeletion] failed (deletion proceeds):", err);
    await recordAudit({
      actorUserId: userId,
      action: "stripe_cancel_on_deletion_FAILED",
      targetUserId: userId,
      details: { error: err instanceof Error ? err.message : String(err) },
    });
  }
}

/** Reactivation inside the window un-cancels, so a returning user's
 *  subscription doesn't silently die at period end. Best-effort. */
export async function uncancelStripeOnReactivation(
  userId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_subscription_id")
      .eq("id", userId)
      .maybeSingle<{ stripe_subscription_id: string | null }>();
    if (!profile?.stripe_subscription_id) return;
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(
      profile.stripe_subscription_id,
    );
    if (sub.status !== "canceled" && sub.cancel_at_period_end) {
      await stripe.subscriptions.update(profile.stripe_subscription_id, {
        cancel_at_period_end: false,
      });
    }
  } catch (err) {
    console.error("[cancelOnDeletion] un-cancel failed:", err);
  }
}
