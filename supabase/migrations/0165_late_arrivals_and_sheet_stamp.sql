-- Money-path audit (2026-09-02), three small fixes the ledger needs:
--
-- 1. store_purchases.recorded_at — WHEN THE ROW LANDED, as opposed to
--    purchased_at (when the customer paid, set by the store webhook).
--    Apple/Google webhooks can arrive days late. After a month is
--    frozen, a purchase whose purchased_at falls inside that month
--    would otherwise be invisible to every later month (they filter by
--    purchased_at) — money earned that no month ever counts. The live
--    computation now also sweeps rows recorded AFTER the previous
--    month's settled_at, whatever their purchased_at says.
--    Table is empty today (verified 0 rows), so the default is safe.
--
-- 2. settlements.sheet_emailed_at — the 27th cron sweeps EVERY
--    settleable month and emails the transfer sheet only where this is
--    null, then stamps it. A month can freeze without a sheet (someone
--    opened the admin page after the 27th and it froze lazily); the
--    stamp is what says "the owners were told". Backfilled for months
--    before the ledger shipped so the first cron doesn't email August.
--
-- 3. Month-format checks on business_settings — a typo like '2026-9'
--    would silently never match and the $175s / savings floor would
--    never count. Fail loudly at write time instead.

alter table public.store_purchases
  add column if not exists recorded_at timestamptz not null default now();

comment on column public.store_purchases.recorded_at is
  'When this row was written (webhook arrival), vs purchased_at (event time). Late-arriving rows are swept into the next open settlement month by recorded_at.';

create index if not exists store_purchases_recorded_at_idx
  on public.store_purchases (recorded_at);

alter table public.settlements
  add column if not exists sheet_emailed_at timestamptz;

comment on column public.settlements.sheet_emailed_at is
  'When the transfer-sheet email for this month was delivered to the owners. Null = frozen but nobody was told yet; the 27th cron emails every null and stamps it.';

update public.settlements
   set sheet_emailed_at = settled_at
 where month < '2026-09' and sheet_emailed_at is null;

alter table public.business_settings
  drop constraint if exists business_settings_contrib_start_month_fmt,
  drop constraint if exists business_settings_contrib_end_month_fmt,
  drop constraint if exists business_settings_locked_savings_month_fmt;

alter table public.business_settings
  add constraint business_settings_contrib_start_month_fmt
    check (member_contributions_start_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  add constraint business_settings_contrib_end_month_fmt
    check (member_contributions_end_month is null or member_contributions_end_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  add constraint business_settings_locked_savings_month_fmt
    check (locked_savings_month is null or locked_savings_month ~ '^\d{4}-(0[1-9]|1[0-2])$');
