-- Mobile revenue had nowhere to live. The admin revenue page reads
-- `payments`, which is Stripe-only by construction (stripe_session_id,
-- stripe_payment_intent_id, stripe_event_id), so every dollar earned
-- through Apple and Google was invisible on the one page that exists
-- to answer "how are we doing" (Wilson 2026-08-21).
--
-- Deliberately a SEPARATE table rather than rows in `payments`: the
-- refund handler, the reusable-checkout dedupe, and the pending-payment
-- writer all query `payments` on Stripe columns, and store rows sitting
-- in there would be a foot-gun waiting for whoever touches those next.
--
-- Amounts recorded are GROSS — what the customer paid at the store —
-- not net of Apple's or Google's commission. The admin UI labels it as
-- such; the authoritative net figures live in RevenueCat and each
-- store's financial reports.

create table if not exists public.store_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  platform text not null check (platform in ('ios', 'android', 'web', 'unknown')),
  product_id text not null,
  amount_cents integer not null,
  currency text not null default 'usd',
  kind text not null check (kind in ('subscription', 'one_time')),
  original_transaction_id text,
  -- RevenueCat's event id: the idempotency key. A retried webhook
  -- delivery must never double-count revenue.
  revenuecat_event_id text unique,
  event_type text,
  purchased_at timestamptz not null default now(),
  refunded_at timestamptz
);

create index if not exists store_purchases_purchased_at_idx
  on public.store_purchases (purchased_at desc);
create index if not exists store_purchases_user_idx
  on public.store_purchases (user_id);

-- Service-role only, same posture as payments/iap_entitlements: this is
-- financial data, no user client has business reading it.
alter table public.store_purchases enable row level security;
