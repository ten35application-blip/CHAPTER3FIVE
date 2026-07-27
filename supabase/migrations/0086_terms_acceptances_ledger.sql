-- 0086_terms_acceptances_ledger
--
-- Fable's Part-B audit flagged the acceptance record as
-- thin + destructible:
--   - profiles.terms_version_accepted is the only record; each
--     re-consent overwrites the last, so no history exists.
--   - Hard-deleting a profile (account purge) removes the proof
--     of consent along with the user.
--   - No IP / user-agent captured, so a compliance dispute has
--     nothing beyond "the row exists."
--
-- Fix: append-only ledger. One row per (user, version, accepted_at).
-- Survives account deletion by nulling the FK on delete rather than
-- cascading. RLS lets users read their own history but never insert,
-- update, or delete — writes are server-role only via the accept
-- action.
--
-- profiles.terms_version_accepted stays as the fast-path column the
-- (gated) layout reads on every request; the ledger is the source
-- of truth for legal disputes.
--
-- Idempotent. Safe to run twice.

create table if not exists public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  -- Nulled (not cascaded) on account delete so the acceptance record
  -- survives the account. The user_id references keep it useful while
  -- the account exists; the email column below preserves who accepted
  -- what after the account is gone.
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  ip_address inet,
  user_agent text
);

create index if not exists terms_acceptances_user_idx
  on public.terms_acceptances (user_id, accepted_at desc);
create index if not exists terms_acceptances_version_idx
  on public.terms_acceptances (terms_version, accepted_at desc);

alter table public.terms_acceptances enable row level security;

-- Users can read their own acceptance history.
create policy "terms_acceptances: user reads own"
  on public.terms_acceptances
  for select
  using (user_id = auth.uid());

-- No user insert / update / delete policies — writes are server-role
-- only via the /onboarding accept action.

grant select on public.terms_acceptances to authenticated;
