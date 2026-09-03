-- 0159 — THE SETTLEMENT LEDGER (Wilson 2026-09-02: "make sure it
-- updates every 27th … fix it all").
--
-- Before this, every month was recomputed from raw rows on every page
-- view, so a changed rate or fixed cost silently rewrote August. Now
-- a month is written down ONCE on its transfer day (the 27th) into
-- public.settlements and never moves; the ledger also carries the
-- running balances the formula needs (operating reserve, growth
-- account total, each partner's tax held / December pot / capital
-- put in), which replaces the O(n²) history walk.
--
-- Also here:
--   • business_settings gains the real Stripe fee shape (2.9% + 30¢)
--     and the members' $175/month contributions (Wilson 2026-09-02:
--     "pedro and I are each putting $175 a month into the bank
--     account on the first … until we make enough profit").
--   • store_purchases records what RevenueCat actually reports
--     (take-home %, net) so the store cut stops being a flat guess.
--   • chat_spend_events keeps the exact fractional cost next to the
--     ceil'd governor cents, so the books don't overstate spend.
--   • fixed_monthly_costs → the $261 list (chapter3five + PatternMD
--     share the LLC card: Supabase ×2, Vercel ×2, Resend ×2,
--     Anthropic plan, ElevenLabs Creator).

create table if not exists public.settlements (
  month text primary key check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  settled_at timestamptz not null default now(),
  -- 'cron' = the 27th job; 'lazy' = a page view after transfer day
  -- found the month unfrozen and froze it; 'admin' = manual re-run.
  settled_by text not null default 'lazy',
  window_start timestamptz not null,
  window_end timestamptz not null,
  -- The full MonthBreakdown exactly as rendered on transfer day.
  breakdown jsonb not null,
  -- Balances AFTER this month's settlement (the next month starts here).
  reserve_balance_cents integer not null default 0,
  growth_balance_cents integer not null default 0,
  -- { "<partner>": { potCents, taxHeldCents, capitalCents }, ... }
  partner_balances jsonb not null default '{}'::jsonb,
  note text
);
comment on table public.settlements is
  'One frozen row per settlement month (window prev-27th → 26th, final on the 27th). Service role only. Delete a row to force a recompute — the next read re-settles it from raw data and CURRENT settings.';

alter table public.settlements enable row level security;
-- No policies on purpose: only the service role (admin server code)
-- reads or writes the ledger. Revoke the anon/authenticated grants
-- Supabase adds by default so RLS is not the only wall.
revoke all on public.settlements from anon, authenticated;

-- Real card fees + member contributions.
alter table public.business_settings
  add column if not exists web_processing_fixed_cents integer not null default 30,
  add column if not exists member_contribution_cents integer not null default 17500,
  add column if not exists member_contributions_start_month text not null default '2026-09',
  add column if not exists member_contributions_end_month text;
comment on column public.business_settings.web_processing_fixed_cents is
  'Stripe per-charge fixed fee (30¢) — charged once per successful payment on top of web_processing_rate.';
comment on column public.business_settings.member_contribution_cents is
  'What EACH member puts into the business account on the 1st (capital, not income). Counted from member_contributions_start_month until member_contributions_end_month (null = still going).';

update public.business_settings
set web_processing_rate = 0.029,
    fixed_monthly_costs = '[
      {"name": "Supabase Pro ×2 (chapter3five + PatternMD)", "cents": 5000},
      {"name": "Vercel Pro ×2 (chapter3five + PatternMD)", "cents": 4000},
      {"name": "Resend Pro ×2 (chapter3five + PatternMD)", "cents": 4000},
      {"name": "Anthropic monthly plan", "cents": 10600},
      {"name": "ElevenLabs Creator (voice, later)", "cents": 2500}
    ]'::jsonb
where id = true;

-- What the store actually kept, straight from RevenueCat's event
-- (takehome_percentage / price). Null on older rows → formula falls
-- back to store_commission_rate.
alter table public.store_purchases
  add column if not exists takehome_pct numeric,
  add column if not exists net_cents integer,
  add column if not exists store_transaction_id text;
create index if not exists store_purchases_refund_lookup
  on public.store_purchases (user_id, product_id, purchased_at desc)
  where refunded_at is null;

-- Exact fractional cost per model call; `cents` stays ceil'd for the
-- spend governor (a 1¢ floor is right for gating, wrong for books).
alter table public.chat_spend_events
  add column if not exists exact_cents numeric;
