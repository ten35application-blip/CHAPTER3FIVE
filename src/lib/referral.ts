import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Earn a companion by bringing people in (Wilson 2026-08-21).
 *
 * Five people who verify their email, accept the terms, and actually
 * hold a conversation earns the referrer one formula companion —
 * talkable on the free tier, inside the same 20-message allowance.
 * Redeeming spends those five, so the counter resets and the next
 * five start a new cycle.
 *
 * ONE PLACE for the rules, because a referral program is a machine
 * that hands out money-costing things and every loose thread in it is
 * a farm waiting to happen.
 */

/** Referrals needed per earned companion. */
export const REFERRAL_GOAL = 5;

/**
 * Messages the referred person must have sent before they count.
 *
 * This is the anti-farm, and it is the whole reason the number isn't
 * zero. Ten throwaway email addresses is twenty minutes of tedium;
 * ten separate conversations is not worth a dollar of synthesis to
 * anybody. Counts the PERSON's messages, not the companion's replies.
 */
const REQUIRED_MESSAGES = 3;

/**
 * Unambiguous alphabet — no 0/O, no 1/I/l. These codes get read aloud,
 * texted, and typed by hand.
 */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function randomCode(length = 7): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/**
 * This account's code, minting one on first use. Never throws — a
 * failure returns null and the caller hides the card rather than
 * showing a broken share link.
 */
export async function getOrCreateReferralCode(
  userId: string,
): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("profiles")
      .select("referral_code")
      .eq("id", userId)
      .maybeSingle<{ referral_code: string | null }>();
    if (existing?.referral_code) return existing.referral_code;

    // Collision is vanishingly unlikely (31^7 ≈ 27 billion) but the
    // column is UNIQUE, so retry rather than hand back a failure.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode();
      const { error } = await admin
        .from("profiles")
        .update({ referral_code: code })
        .eq("id", userId);
      if (!error) return code;
      if ((error as { code?: string }).code !== "23505") break;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Evaluate this referrer's pending referrals and stamp the ones that
 * now qualify.
 *
 * Lazy on purpose: called when the referrer looks at their card, not
 * on every message send. Qualification can only ever move forward, so
 * checking late costs nothing but a moment's staleness, while checking
 * in the chat hot path would tax every message in the app for a
 * feature almost nobody is mid-cycle on.
 */
export async function refreshQualifications(referrerId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: pending } = await admin
    .from("referrals")
    .select("id, referred_id")
    .eq("referrer_id", referrerId)
    .is("qualified_at", null)
    .is("redeemed_at", null)
    .limit(100);
  if (!pending || pending.length === 0) return;

  for (const row of pending) {
    const referredId = row.referred_id as string;
    try {
      // 1. Email verified — blocks addresses that were never real.
      const { data: authRes } = await admin.auth.admin.getUserById(referredId);
      if (!authRes?.user?.email_confirmed_at) continue;

      // 2. Terms accepted AND the account still exists (a deleted
      //    account's referral must not mature into a reward).
      const { data: profile } = await admin
        .from("profiles")
        .select("terms_version_accepted, deleted_at")
        .eq("id", referredId)
        .maybeSingle<{
          terms_version_accepted: string | null;
          deleted_at: string | null;
        }>();
      if (!profile || profile.deleted_at || !profile.terms_version_accepted) {
        continue;
      }

      // 3. They actually talked.
      const { count } = await admin
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", referredId)
        .eq("role", "user");
      if ((count ?? 0) < REQUIRED_MESSAGES) continue;

      await admin
        .from("referrals")
        .update({ qualified_at: new Date().toISOString() })
        .eq("id", row.id)
        .is("qualified_at", null);
    } catch {
      // One bad row must not stop the rest from maturing.
    }
  }
}

export type ReferralStatus = {
  code: string | null;
  /** Qualified referrals not yet spent on a reward. */
  qualified: number;
  goal: number;
  /** Signed up but not yet qualified — shown as "on their way". */
  pending: number;
  canRedeem: boolean;
  /** Companions earned so far, all cycles. */
  earned: number;
};

export async function getReferralStatus(
  userId: string,
): Promise<ReferralStatus> {
  const admin = createAdminClient();
  const code = await getOrCreateReferralCode(userId);
  await refreshQualifications(userId);

  const [{ count: qualified }, { count: pending }, { count: earned }] =
    await Promise.all([
      admin
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("referrer_id", userId)
        .not("qualified_at", "is", null)
        .is("redeemed_at", null),
      admin
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("referrer_id", userId)
        .is("qualified_at", null)
        .is("redeemed_at", null),
      admin
        .from("oracles")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_referral_reward", true)
        .is("deleted_at", null),
    ]);

  const q = qualified ?? 0;
  return {
    code,
    qualified: q,
    goal: REFERRAL_GOAL,
    pending: pending ?? 0,
    canRedeem: q >= REFERRAL_GOAL,
    earned: earned ?? 0,
  };
}

/**
 * Record that `referredId` arrived through `code`. Silent no-op on
 * every failure mode — a referral that doesn't stick must never break
 * somebody's signup.
 *
 * Refuses: unknown codes, referring yourself, and any account that was
 * already referred (the UNIQUE constraint is the real enforcement;
 * this is the polite check in front of it).
 */

/** "w.ilson+x@gmail.com" → "wilson@gmail.com"; non-Google providers
 *  keep dots (meaningful there) but still lose the +suffix. */
function normalizeMailboxRoot(email: string): string {
  const [local, domain] = email.toLowerCase().split("@");
  if (!domain) return email.toLowerCase();
  let root = local.split("+")[0];
  if (domain === "gmail.com" || domain === "googlemail.com") {
    root = root.replace(/\./g, "");
  }
  return `${root}@${domain}`;
}

export async function claimReferral(
  code: string,
  referredId: string,
): Promise<void> {
  try {
    const clean = code.trim().toLowerCase();
    if (!clean || clean.length > 32) return;
    const admin = createAdminClient();
    const { data: referrer } = await admin
      .from("profiles")
      .select("id")
      .eq("referral_code", clean)
      .maybeSingle<{ id: string }>();
    if (!referrer || referrer.id === referredId) return;
    // ONE HUMAN PER INBOX (self-audit 2026-08-25). Gmail ignores dots
    // and everything after '+', so wilson+1@ through wilson+5@ verify
    // as five distinct addresses from one inbox — a five-alias farm
    // costing real synthesis per cycle. Normalize the mailbox root and
    // refuse a claim when this referrer already has a referral from
    // the same root. Different providers, different humans — this only
    // collapses the alias trick, never real people.
    const { data: referredUser } = await admin.auth.admin.getUserById(referredId);
    const referredEmail = referredUser?.user?.email ?? null;
    if (referredEmail) {
      const root = normalizeMailboxRoot(referredEmail);
      const { data: siblings } = await admin
        .from("referrals")
        .select("referred_id")
        .eq("referrer_id", referrer.id);
      for (const sib of siblings ?? []) {
        const { data: sibUser } = await admin.auth.admin.getUserById(
          sib.referred_id as string,
        );
        const sibEmail = sibUser?.user?.email ?? null;
        if (sibEmail && normalizeMailboxRoot(sibEmail) === root) {
          console.log(
            `[referral] claim refused — alias of an existing referral (${root})`,
          );
          return;
        }
      }
    }
    await admin
      .from("referrals")
      .insert({ referrer_id: referrer.id, referred_id: referredId });
  } catch {
    // Includes 23505 (already referred) — nothing to do about it.
  }
}
