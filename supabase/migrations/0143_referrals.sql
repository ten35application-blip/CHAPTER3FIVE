-- Earn an identity by bringing people in (Wilson 2026-08-21).
-- Five people who verify, accept terms, and actually TALK to Adrian
-- earns the referrer one formula companion — talkable on the free
-- tier, still inside the free tier's 20-message allowance.
--
-- Anti-farm, deliberately: "qualified" is not "an email row exists."
-- Ten throwaway addresses is twenty minutes of tedium; ten separate
-- conversations is not worth a dollar of synthesis to anyone. The
-- unique constraint on referred_id makes a referral a once-ever
-- property of an ACCOUNT, so delete-and-resignup can't re-credit.

alter table public.profiles
  add column if not exists referral_code text unique;

-- The earned companion is the third thing a free account may talk to,
-- alongside Adrian and a $5-redeemed inherited archive.
alter table public.oracles
  add column if not exists is_referral_reward boolean not null default false;
grant select (is_referral_reward) on public.oracles to authenticated;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  -- UNIQUE: an account can be referred exactly once, ever.
  referred_id uuid not null references auth.users(id) on delete cascade unique,
  created_at timestamptz not null default now(),
  -- Stamped when the referred account has verified its email, accepted
  -- terms, and held a real conversation. Null until then.
  qualified_at timestamptz,
  -- Stamped when this referral was spent on a reward, so each cycle
  -- counts a fresh five and the counter resets on its own.
  redeemed_at timestamptz,
  constraint referrals_no_self check (referrer_id <> referred_id)
);

create index if not exists referrals_referrer_idx
  on public.referrals (referrer_id);
create index if not exists referrals_pending_idx
  on public.referrals (referrer_id) where redeemed_at is null;

-- Service-role only. The count reaches the user through an API that
-- returns a NUMBER and never the identities behind it — Wilson's
-- rule: "a counter of how many people actually made an account but
-- does not tell them who."
alter table public.referrals enable row level security;
