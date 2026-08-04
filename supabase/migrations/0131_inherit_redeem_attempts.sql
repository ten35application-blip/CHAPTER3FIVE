-- 0131_inherit_redeem_attempts
--
-- Applied to the remote project 2026-08-04.
--
-- Rate limiting for inherit-code redemption.
--
-- WHY. An inherit code was ~25 bits (10,000 x 60 x 59 = 35.4M), and the
-- comment justifying that risk in identity/inherit/actions.ts claimed
-- "codes are 128-bit-ish random strings" — off by about 100 bits, and
-- it was the stated basis for accepting enumeration.
--
-- Worse, the redeem endpoint was a FREE oracle: a caller with no
-- credits got 404 for a bad code and 402-with-checkout-url for a good
-- one, so valid/invalid was distinguishable before paying anything.
-- With no rate limit, guessing is not 35M attempts — it is
-- 35M / (codes outstanding). At 10,000 minted codes, a few thousand
-- requests finds SOMEBODY's archive, and $5 then buys a stranger's
-- sealed letter and everything they recorded.
--
-- Widening the code alone doesn't fix that, and a long code fights the
-- product: these get read aloud over the phone to grandparents. So the
-- fix is a real attempt limiter (this table), plus a modest widening to
-- a third word (~31 bits) on newly minted codes. Two-word codes already
-- printed on cards stay valid forever.
--
-- Append-only, service-role only. RLS enabled with NO policies, so
-- every other role fails closed.

create table if not exists public.inherit_redeem_attempts (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now(),
  succeeded boolean not null default false
);

alter table public.inherit_redeem_attempts enable row level security;

revoke all on public.inherit_redeem_attempts from anon, authenticated;
revoke all on sequence public.inherit_redeem_attempts_id_seq from anon, authenticated;

create index if not exists inherit_redeem_attempts_user_time_idx
  on public.inherit_redeem_attempts (user_id, attempted_at desc);

comment on table public.inherit_redeem_attempts is
  'Append-only log of inherit-code redemption attempts, used to rate-limit guessing. Service-role only; RLS enabled with no policies so every other role fails closed.';
