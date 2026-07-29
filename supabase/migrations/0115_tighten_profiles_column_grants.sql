-- 0115_tighten_profiles_column_grants
--
-- Fable payment audit 2026-07-28 finding: profiles has blanket column
-- grants for every column, on both anon and authenticated. Credit
-- columns are trigger-protected (profiles_protect_billing) so a
-- forged PATCH gets rejected -- but relying on the trigger as the
-- only write barrier violates the column-allowlist posture used
-- elsewhere (messages table 0109 rework).
--
-- Fix: revoke ALL writes from anon (never legitimate); revoke the
-- specific server-only columns from authenticated (credits, billing
-- mirror, account state, activity tracking). Legitimate user edits
-- (full_name, avatar_url, theme, favorites, etc.) retain their
-- existing grants because they weren't touched.

-- anon has no legitimate write path to profiles.
revoke insert, update, delete on public.profiles from anon;

-- Server-controlled columns -- authenticated cannot INSERT or UPDATE
-- these via REST. Server actions using the admin client bypass grants;
-- Stripe webhook uses increment_profile_counter (service_role-only)
-- for credit deltas.
revoke insert (
  message_credits,
  image_credits,
  inherited_slot_credits,
  other_identity_credits,
  randomize_credits,
  extra_oracle_credits,
  extra_inherited_slots,
  paid_beneficiary_slots,
  stripe_customer_id,
  stripe_subscription_id,
  subscription_status,
  subscription_tier,
  pro_until,
  plan_source,
  trial_ends_at,
  current_period_end,
  cancel_at_period_end,
  deleted_at,
  scheduled_purge_at,
  deceased_at,
  deceased_confirmed_by,
  last_active_at,
  last_message_seen_at,
  last_outreach_at,
  last_proactive_at,
  randomize_count,
  free_identity_id
) on public.profiles from authenticated;

revoke update (
  message_credits,
  image_credits,
  inherited_slot_credits,
  other_identity_credits,
  randomize_credits,
  extra_oracle_credits,
  extra_inherited_slots,
  paid_beneficiary_slots,
  stripe_customer_id,
  stripe_subscription_id,
  subscription_status,
  subscription_tier,
  pro_until,
  plan_source,
  trial_ends_at,
  current_period_end,
  cancel_at_period_end,
  deleted_at,
  scheduled_purge_at,
  deceased_at,
  deceased_confirmed_by,
  last_active_at,
  last_message_seen_at,
  last_outreach_at,
  last_proactive_at,
  randomize_count,
  free_identity_id
) on public.profiles from authenticated;
