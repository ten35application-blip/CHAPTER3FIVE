-- A signup that never confirmed and never signed in is not a person's
-- account; it is usually a mistyped address (2026-09-08: two cases of
-- typo-then-retry in one week). Sweep them once a month (Wilson: "we
-- don't get many users, monthly is fine") — 1st of the month, 4:07 AM
-- Eastern. Cascades clear the profile row and everything under it.
select cron.schedule(
  'purge-unconfirmed-signups',
  '7 8 1 * *',
  $$delete from auth.users where email_confirmed_at is null and last_sign_in_at is null and created_at < now() - interval '24 hours'$$
);
