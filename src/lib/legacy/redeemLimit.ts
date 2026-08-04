import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Rate limiting for inherit-code redemption (migration 0131).
 *
 * An inherit code is ~31 bits after the 2026-08-04 widening — enough
 * that a code can't be stumbled into, not enough to survive unlimited
 * automated guessing. The endpoint also leaks validity before payment
 * (404 for a bad code, 402-with-checkout for a good one), which makes
 * probing free. A limiter is what actually closes that: guessing has to
 * be cheap AND unlimited to be worth doing, and this removes the second.
 *
 * Deliberately generous. The person on the other end of this is often
 * elderly, typing a code read to them over the phone, from a card, in a
 * bad week. Ten wrong attempts an hour is far past honest fumbling and
 * far below useful enumeration.
 *
 * Successful redemptions are recorded too, but never counted against
 * the limit — someone redeeming codes from several relatives in one
 * sitting is a real and good thing to do.
 *
 * Fails OPEN on a database error. A logging table being unavailable
 * must never be the reason a family can't reach their person; the
 * consequence of failing open is a window of unthrottled guessing,
 * which is strictly better than the alternative here.
 */

const WINDOW_MS = 60 * 60 * 1000;
const MAX_FAILED_PER_WINDOW = 10;

export async function tooManyRedeemAttempts(
  userId: string,
): Promise<boolean> {
  try {
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const { count, error } = await createAdminClient()
      .from("inherit_redeem_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("succeeded", false)
      .gte("attempted_at", since);
    if (error) return false;
    return (count ?? 0) >= MAX_FAILED_PER_WINDOW;
  } catch {
    return false;
  }
}

export async function recordRedeemAttempt(
  userId: string,
  succeeded: boolean,
): Promise<void> {
  try {
    await createAdminClient()
      .from("inherit_redeem_attempts")
      .insert({ user_id: userId, succeeded });
  } catch {
    /* best-effort — never block a redemption on the audit write */
  }
}

/** Shown when the limiter trips. Says nothing about code validity. */
export const REDEEM_RATE_LIMIT_MESSAGE =
  "That's a lot of tries in a short time. Give it an hour and try again — and if the code isn't working, the person who sent it can check it on their end.";
