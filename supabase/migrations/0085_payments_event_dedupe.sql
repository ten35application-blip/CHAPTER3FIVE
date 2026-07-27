-- 0085_payments_event_dedupe
--
-- Fable audit on 461a411 flagged: the renewal ledger insert in
-- handleInvoicePaid isn't idempotent under concurrent duplicate
-- webhook delivery. The stripe_events primary-key dedupe is a
-- check-then-insert with a gap between check and the payments
-- insert, so two racing invoice.paid deliveries can both slip
-- past the dedupe and each write a payments row, double-booking
-- MRR.
--
-- Partial unique index on payments(stripe_event_id) turns the
-- second racing insert into a 23505 that we can catch and
-- treat as "already logged, skip." Partial because most
-- payments rows historically have null stripe_event_id (the
-- pending-then-paid pattern only sets it on refund + subscription
-- renewal paths); a full unique index would refuse legacy nulls
-- but Postgres treats nulls as distinct so this is defensive
-- either way.

create unique index if not exists payments_stripe_event_unique_idx
  on public.payments (stripe_event_id)
  where stripe_event_id is not null;
