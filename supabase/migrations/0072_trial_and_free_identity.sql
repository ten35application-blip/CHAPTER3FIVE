-- ============================================================================
-- 0072_trial_and_free_identity.sql
--
-- Applied to live DB via MCP on 2026-07-25. Committing the file so a
-- fresh environment can `supabase db push` and get the same shape.
--
-- The 30-day trial + Free-tier mechanism:
--
--   - Every new signup (while the early-access cap below holds) gets a
--     30-day full-Pro trial: profiles.trial_ends_at = now() + 30 days,
--     plan_source = 'trial'. No card required. isPro() treats an
--     in-future trial_ends_at exactly like an in-future pro_until.
--   - EARLY-ACCESS CAP: only the first 1000 users get the trial.
--     handle_new_user counts plan_source = 'trial' rows before granting;
--     at or past 1000 the profile starts on Free tier directly
--     (plan_source 'none', trial_ends_at null). The count-then-insert
--     race at the margin is accepted — a handful of overages beat a
--     lock on the signup path.
--   - After the trial, the user drops to Free tier: they keep chatting
--     with exactly ONE identity — profiles.free_identity_id, which
--     defaults to the first identity they created (assigned server-side
--     by the identity-creation actions; a Settings picker can rewrite
--     it later). Other identities stay visible but are Pro-gated.
--
-- Both new columns are billing-adjacent and therefore server-side only:
-- protect_billing_columns (0065) is extended to cover them. Note the
-- guard deliberately keeps its current_user-only role check (unlike the
-- 0068 guards, which also inspect the `role` GUC): free_identity_id has
-- an ON DELETE SET NULL FK to oracles, and the referential action fired
-- by a hard delete from /trash runs the profiles UPDATE as the table
-- owner (current_user = postgres) while the session's `role` GUC still
-- reads 'authenticated' — a GUC check would wrongly block that delete.
--
-- Idempotent. Safe to run twice.
-- ============================================================================

-- ── 1 · plan_source learns 'trial' ──────────────────────────────────────────

alter table public.profiles
  drop constraint if exists profiles_plan_source_check;
alter table public.profiles
  add constraint profiles_plan_source_check
  check (plan_source in ('stripe', 'admin_grant', 'none', 'trial'));

-- ── 2 · new columns ─────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists trial_ends_at timestamptz null;
alter table public.profiles
  add column if not exists free_identity_id uuid null
    references public.oracles(id) on delete set null;

comment on column public.profiles.trial_ends_at is
  'When the signup 30-day full-Pro trial ends (NULL = no trial granted). In-future = treated as Pro by isPro().';
comment on column public.profiles.free_identity_id is
  'The ONE identity a Free-tier user can keep chatting with after the trial. Defaults to the first identity they created; a Settings picker may rewrite it. Server-side writes only.';

create index if not exists profiles_trial_ends_at_idx
  on public.profiles (trial_ends_at)
  where trial_ends_at is not null;

create index if not exists profiles_free_identity_id_idx
  on public.profiles (free_identity_id)
  where free_identity_id is not null;

-- ── 3 · extend the billing guard to the new columns ─────────────────────────

create or replace function public.protect_billing_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Only police the PostgREST user roles. service_role, postgres, and
  -- security-definer functions owned by postgres all pass through.
  -- (current_user only — see the header note about the FK's SET NULL.)
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- The defensive insert in the (gated) layout sends only { id }, so
    -- defaults apply. Reject any user insert that tries to smuggle
    -- non-default billing values in.
    if new.pro_until is not null
       or coalesce(new.plan_source, 'none') <> 'none'
       or coalesce(new.extra_oracle_credits, 0) <> 0
       or new.trial_ends_at is not null
       or new.free_identity_id is not null then
      raise exception 'billing columns can only be set server-side';
    end if;
  else
    if new.pro_until is distinct from old.pro_until
       or new.plan_source is distinct from old.plan_source
       or new.extra_oracle_credits is distinct from old.extra_oracle_credits
       or new.trial_ends_at is distinct from old.trial_ends_at
       or new.free_identity_id is distinct from old.free_identity_id then
      raise exception 'billing columns can only be changed server-side';
    end if;
  end if;

  return new;
end;
$$;

-- ── 4 · signups start their trial (capped at the first 1000) ────────────────
-- Replaces the live (0008-shape) definition; only the profiles insert
-- changes. SECURITY DEFINER owned by postgres, so the billing guard and
-- the oracles insert guard both pass through.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_oracle_id uuid;
  trial_count bigint;
begin
  select count(*) into trial_count
    from public.profiles
   where plan_source = 'trial';

  if trial_count < 1000 then
    insert into public.profiles (id, plan_source, trial_ends_at)
      values (new.id, 'trial', now() + interval '30 days')
      on conflict (id) do nothing;
  else
    -- Cap reached: straight to Free tier (one chattable identity).
    insert into public.profiles (id) values (new.id)
      on conflict (id) do nothing;
  end if;

  insert into public.oracles (user_id, name, mode, preferred_language)
    values (new.id, 'untitled', 'real', 'en')
    returning id into new_oracle_id;

  update public.profiles
    set active_oracle_id = new_oracle_id
    where id = new.id;

  return new;
end;
$$;

-- ── 5 · backfill: existing Free accounts get the trial too ──────────────────
-- Wilson's call: everyone already signed up gets the same 30 days,
-- counted from now. Guarded by the same 1000 cap so future re-runs of
-- this migration can't hand out trials past the early-access window.
-- Runs as postgres inside the migration, so the guard passes through.

do $$
declare
  trial_count bigint;
begin
  select count(*) into trial_count
    from public.profiles
   where plan_source = 'trial';

  if trial_count < 1000 then
    update public.profiles
       set trial_ends_at = now() + interval '30 days',
           plan_source   = 'trial'
     where coalesce(plan_source, 'none') = 'none'
       and pro_until is null;
  end if;
end $$;

-- Existing accounts also get their free identity slot pointed at the
-- first chattable identity they created, so the post-trial drop to Free
-- never strands them with zero conversations. (New accounts get this
-- assigned by the identity-creation server actions instead.)
update public.profiles p
   set free_identity_id = (
     select o.id
       from public.oracles o
      where o.user_id = p.id
        and o.deleted_at is null
        and o.persona_prompt is not null
      order by o.created_at asc
      limit 1
   )
 where p.free_identity_id is null;
