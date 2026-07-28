-- 0116_profiles_column_allowlist
--
-- Redo of migration 0115. Fable's audit 2026-07-28 caught that the
-- 0115 approach ("revoke column-level UPDATE on server-only columns")
-- is a silent no-op: Postgres column-level REVOKE cannot subtract
-- from a table-level GRANT. The profiles_protect_billing trigger
-- caught what the grant layer was supposed to catch, so nothing was
-- exploitable -- but the intended defense-in-depth never landed.
--
-- Correct approach: REVOKE table-level INSERT/UPDATE/DELETE from
-- authenticated first, then GRANT the specific user-editable columns
-- back. That's a real allowlist enforced at the grant layer, matching
-- the messages-table posture (0109).
--
-- Server-only columns (NOT granted, admin client only):
--   Credit counters:  message_credits, image_credits,
--                     inherited_slot_credits, other_identity_credits,
--                     extra_oracle_credits, extra_inherited_slots,
--                     paid_beneficiary_slots
--   Billing mirror:   stripe_customer_id, stripe_subscription_id,
--                     subscription_status, subscription_tier,
--                     pro_until, plan_source, trial_ends_at,
--                     current_period_end, cancel_at_period_end
--   Account state:    id, created_at, scheduled_purge_at,
--                     deceased_at, deceased_confirmed_by
--   Tracking:         last_message_seen_at, last_outreach_at,
--                     last_proactive_at
--   Provisioning:     free_identity_id
--
-- User-editable columns (grant list below) match every `.from("profiles").update({...})`
-- call using the user client in src/ as of the audit date.

-- Anon has no legitimate write path to profiles.
revoke insert, update, delete on public.profiles from anon;

-- Wipe the blanket table-level grants; column-level GRANTs below
-- become the allowlist.
revoke insert, update, delete on public.profiles from authenticated;

-- User-editable columns. Grant INSERT so the row can be created
-- during handle_new_user (that trigger runs as postgres and doesn't
-- need this, but keeping the surface consistent) and UPDATE so
-- Settings / onboarding / chat's timezone stamp / push opt-in all
-- keep working.
grant insert (
  full_name,
  avatar_url,
  oracle_name,
  mode,
  preferred_language,
  active_oracle_id,
  date_of_birth,
  birthdate,
  personality_type,
  emotional_flavor,
  texting_style,
  theme,
  timezone,
  favorites,
  muted_conversations,
  last_read,
  onboarding_completed,
  outreach_enabled,
  push_subscription,
  terms_accepted_at,
  terms_version_accepted,
  updated_at,
  deleted_at,
  last_active_at,
  randomize_credits,
  randomize_count
) on public.profiles to authenticated;

grant update (
  full_name,
  avatar_url,
  oracle_name,
  mode,
  preferred_language,
  active_oracle_id,
  date_of_birth,
  birthdate,
  personality_type,
  emotional_flavor,
  texting_style,
  theme,
  timezone,
  favorites,
  muted_conversations,
  last_read,
  onboarding_completed,
  outreach_enabled,
  push_subscription,
  terms_accepted_at,
  terms_version_accepted,
  updated_at,
  deleted_at,
  last_active_at,
  randomize_credits,
  randomize_count
) on public.profiles to authenticated;
