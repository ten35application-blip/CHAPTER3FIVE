-- chapter3five — built-in help identity.
--
-- Every new account gets a "chapter3five" help identity automatically.
-- It's not a persona, it doesn't have a backstory, it doesn't chat
-- conversationally. It answers FAQs about the app itself: "how do I
-- delete my account?", "how do I add a beneficiary?", "where are my
-- payments?" — and directs the user to the right screen.
--
-- We add a new mode 'help' on the oracles check constraint so the
-- chat / dashboard can recognize and route accordingly. The help
-- identity is never deletable, never inheritable, never put in a
-- group chat — owner_user_id-scoped, RLS-protected like anyone else's
-- identity.

alter table public.oracles
  drop constraint if exists oracles_mode_check;
alter table public.oracles
  add constraint oracles_mode_check
  check (mode in ('real', 'randomize', 'memory', 'help'));

-- profiles.mode also references the same values when the user picks
-- a starter mode — but help isn't a starter mode (it's auto-created
-- alongside whatever the user picks), so we don't touch profiles.

-- Index to find the help identity quickly per user.
create index if not exists oracles_user_mode_idx
  on public.oracles (user_id, mode);

-- Extend the signup trigger to also auto-create a help identity
-- alongside the user's "untitled" starter oracle. Preserves the
-- existing behavior (profile + starter oracle + active_oracle_id
-- pointing at the starter), just adds one more insert.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_oracle_id uuid;
begin
  insert into public.profiles (id) values (new.id)
    on conflict (id) do nothing;

  insert into public.oracles (user_id, name, mode, preferred_language, onboarding_completed)
    values (new.id, 'untitled', 'real', 'en', false)
    returning id into new_oracle_id;

  update public.profiles
    set active_oracle_id = new_oracle_id
    where id = new.id;

  -- Built-in help identity. Onboarding completed = true so it shows
  -- in the conversation list without going through /onboarding.
  insert into public.oracles (user_id, name, mode, preferred_language, onboarding_completed, bio, texting_style)
    values (
      new.id,
      'chapter3five',
      'help',
      'en',
      true,
      'I am the chapter3five help assistant. I can answer questions about how the app works — adding family members, deleting your account, restoring a deleted identity, changing your settings. I don''t hold conversations; I help you find your way.',
      'plain, helpful, no abbreviations, no emojis, short answers'
    );

  return new;
end;
$$;

-- Backfill: every existing user who doesn't already have a help
-- identity gets one. Idempotent.
do $$
declare
  p record;
begin
  for p in
    select pr.id
      from public.profiles pr
      left join public.oracles o
        on o.user_id = pr.id and o.mode = 'help'
     where o.id is null
  loop
    insert into public.oracles (user_id, name, mode, preferred_language, onboarding_completed, bio, texting_style)
      values (
        p.id,
        'chapter3five',
        'help',
        'en',
        true,
        'I am the chapter3five help assistant. I can answer questions about how the app works — adding family members, deleting your account, restoring a deleted identity, changing your settings. I don''t hold conversations; I help you find your way.',
        'plain, helpful, no abbreviations, no emojis, short answers'
      );
  end loop;
end $$;
