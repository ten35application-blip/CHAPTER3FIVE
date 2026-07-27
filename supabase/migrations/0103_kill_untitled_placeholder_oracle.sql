-- ============================================================================
-- 0103_kill_untitled_placeholder_oracle.sql
--
-- handle_new_user has been creating a placeholder oracle at every signup
-- (name='untitled', persona_prompt=null) so profiles.active_oracle_id
-- could point somewhere. This placeholder shows up on the user's
-- dashboard as "Untitled — waiting behind Pro," which is confusing
-- noise: free users chat with Adrian, they don't need a mystery locked
-- row in their contacts. Wilson's call: kill it.
--
-- Two changes:
--   1. Rewrite handle_new_user to NOT create the placeholder. profile
--      still lands with active_oracle_id = NULL; any code that reads
--      it (legacy-mode onboarding, /identity/legacy/new) should already
--      handle "no oracle yet" for a fresh user.
--   2. Soft-delete any existing "untitled" placeholders. Not just the
--      one Wilson just made -- catches the whole class. Skip rows that
--      have a persona_prompt or a synthesized name (someone actually
--      LEGITIMATELY named their identity "untitled" won't be caught,
--      that's fine).
--
-- Idempotent.
-- ============================================================================

-- ── 1 · handle_new_user without the placeholder oracle ─────────────────────
-- Same shape as 0096's rewrite, minus the oracle insert and the
-- active_oracle_id update. SECURITY DEFINER + set search_path preserved.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  concierge_id uuid;
begin
  select id into concierge_id
    from public.oracles
    where is_concierge = true
    limit 1;

  insert into public.profiles (id, free_identity_id)
    values (new.id, concierge_id)
    on conflict (id) do nothing;

  return new;
end;
$$;


-- ── 2 · clean up existing untitled placeholders ────────────────────────────
-- Null the FK first (belt against ON DELETE SET NULL not firing on a
-- soft-delete), then set deleted_at on rows that look like the
-- auto-created placeholder: name='untitled', persona_prompt IS NULL.
-- Runs as postgres inside the migration so protect_billing_columns and
-- protect_oracle_columns both pass through.
update public.profiles
   set active_oracle_id = null
 where active_oracle_id in (
   select id from public.oracles
    where name = 'untitled'
      and persona_prompt is null
      and deleted_at is null
 );

update public.oracles
   set deleted_at = now()
 where name = 'untitled'
   and persona_prompt is null
   and deleted_at is null;
