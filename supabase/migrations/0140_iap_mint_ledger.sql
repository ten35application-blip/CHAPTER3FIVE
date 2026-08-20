-- Backfill migration (ultrareview 2026-08-19 finding #2): the
-- per-store-transaction mint budget — the guard that stops account
-- cycling from re-minting a full companion circle on one purchase
-- ("I would rather them now like hey, fuck no", Wilson 2026-08-16) —
-- was applied straight to production via the management API and never
-- landed as a file. On a fresh environment the guard's maybeSingle()
-- reads fail SILENTLY (only `data` is destructured), so the budget
-- no-ops and cycling works again. This file reproduces production
-- exactly; IF NOT EXISTS makes it a no-op where the table exists.

create table if not exists public.iap_mint_ledger (
  original_transaction_id text primary key,
  minted_random integer not null default 0,
  minted_placeholder integer not null default 0,
  last_user_id uuid,
  updated_at timestamptz not null default now()
);

-- RLS on, NO policies: service-role only, same posture as
-- iap_entitlements (0122). No user client has any business here —
-- the ledger is the anti-fraud memory of the store transaction
-- itself, not user data.
alter table public.iap_mint_ledger enable row level security;
