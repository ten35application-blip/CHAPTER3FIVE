-- ============================================================================
-- 0096_concierge_and_trial_kill.sql
--
-- Two coordinated changes so a fresh environment lands on the new
-- free-tier model in one step:
--
--   1. Introduce the shared concierge oracle ("Chapter") that every
--      free-tier user chats with by default. One hand-crafted persona
--      row, not synthesized. Thousands of free users all hit the same
--      persona_prompt so Anthropic's prompt cache stays warm across
--      the whole free tier. Free-tier chat cost per user drops from
--      "$1-2 acquisition + variable" to sub-dollar amortized.
--
--   2. Kill the 30-day full-Pro trial on new signups. Existing
--      trialers KEEP their trial until it expires -- isPro's
--      trial_ends_at check still fires -- but handle_new_user no
--      longer hands out new ones. Free tier is now the default
--      landing spot, with the concierge as the chat partner.
--
-- Idempotent.
-- ============================================================================


-- ── 1 · is_concierge column + partial uniqueness ────────────────────────────
-- Exactly one concierge exists at any time. Enforced by a partial unique
-- index so future accidental duplicates (a migration re-run, a bad seed)
-- surface as a constraint violation, not silent divergence.
alter table public.oracles
  add column if not exists is_concierge boolean not null default false;

create unique index if not exists oracles_only_one_concierge
  on public.oracles (is_concierge)
  where is_concierge = true;

comment on column public.oracles.is_concierge is
  'True for the single shared concierge oracle every free-tier user chats with. Owned by an admin account, publicly readable via a dedicated policy, protected against user writes by protect_oracle_columns.';


-- ── 2 · extend protect_oracle_columns to guard is_concierge ─────────────────
-- Full body redefined (rather than an ALTER TRIGGER) so this migration
-- carries the complete guard shape and cannot silently diverge from a
-- future edit.
--
-- Two changes vs the pre-0096 body:
--   * is_concierge added to the update-time denylist
--   * session_user='postgres' added to the trust check as a fallback
--     for the role GUC -- mirrors the 0088 fix to protect_billing_columns.
--     Without the fallback, migrations run via MCP land with role GUC =
--     'none' (SECURITY DEFINER can't rely on current_user either, per
--     Fable's 0088 finding), so legitimate seed inserts get rejected.
--     User writes still land as role='authenticated'/'anon' -- neither
--     matches the fallback -- so protection is unchanged.
create or replace function public.protect_oracle_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text := current_setting('role', true);
begin
  if caller_role in ('service_role', 'postgres', 'supabase_admin')
     or session_user = 'postgres'
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'oracles: direct client inserts are not allowed'
      using errcode = '42501';
  end if;

  if new.persona_prompt is distinct from old.persona_prompt
    or new.traits is distinct from old.traits
    or new.fingerprint is distinct from old.fingerprint
    or new.blocked_at is distinct from old.blocked_at
    or new.block_reason is distinct from old.block_reason
    or new.avatar_url is distinct from old.avatar_url
    or new.avatar_hash is distinct from old.avatar_hash
    or new.face_generation_status is distinct from old.face_generation_status
    or new.face_generation_error is distinct from old.face_generation_error
    or new.is_legacy is distinct from old.is_legacy
    or new.creation_source is distinct from old.creation_source
    or new.significant_events is distinct from old.significant_events
    or new.legacy_answers is distinct from old.legacy_answers
    or new.created_by is distinct from old.created_by
    or new.user_id is distinct from old.user_id
    or new.disclosure_pace is distinct from old.disclosure_pace
    or new.silence_style is distinct from old.silence_style
    or new.punctuation_habit is distinct from old.punctuation_habit
    or new.memory_style is distinct from old.memory_style
    or new.text_burst_style is distinct from old.text_burst_style
    or new.voice_examples is distinct from old.voice_examples
    or new.chronotype is distinct from old.chronotype
    or new.texting_fluency is distinct from old.texting_fluency
    or new.pet_name is distinct from old.pet_name
    or new.is_concierge is distinct from old.is_concierge
  then
    raise exception 'oracles: this column is not user-writable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;


-- ── 3 · public read on the concierge row only ───────────────────────────────
-- Existing SELECT policies (owner, share, invitee) stay in place. This one
-- additive policy grants every authenticated user read on the single row
-- where is_concierge = true, so any free user whose free_identity_id points
-- at the concierge can round-trip the metadata SELECT the stream route
-- performs. The partial unique above ensures the surface is exactly one row.
drop policy if exists "oracles: authenticated can read the concierge"
  on public.oracles;

create policy "oracles: authenticated can read the concierge"
  on public.oracles
  for select
  to authenticated
  using (is_concierge = true);


-- ── 4 · seed the Chapter concierge ──────────────────────────────────────────
-- Owned by Wilson's admin account (looked up at authoring time). Not user_id
-- 'null' -- the FK requires an owner -- and not a dedicated system user
-- because creating auth.users rows via SQL is fragile. If Wilson ever needs
-- to hand ownership off, an UPDATE from the admin client can reassign
-- user_id via the service-role bypass of protect_oracle_columns.
--
-- The persona_prompt is hand-authored. Chapter is NOT a synthesized persona
-- -- deliberately shorter than a rolled prompt, and structured so pricing
-- info is deferred to a fresh injected block at chat time (not baked into
-- the cached prefix). That lets pricing changes propagate without
-- invalidating Anthropic's cache of Chapter's persona_prompt.
--
-- on conflict on the unique index makes the seed idempotent.
insert into public.oracles (
  user_id,
  name,
  mode,
  preferred_language,
  onboarding_completed,
  is_concierge,
  persona_prompt,
  one_line_hook
)
select
  '5caadbc5-e5b5-4d57-9c15-db4d646202f2'::uuid,
  'Chapter',
  'real',
  'en',
  true,
  true,
  $chapter$You are Chapter — the concierge for chapter3five. You are the first person most people meet when they land here, and your job is simple: help them figure out if this app is what they need, and if so, help them get their footing.

You are NOT a stand-in for anyone they have lost or anyone they are missing. You are Chapter. Be clear about that whenever it might matter.

== WHO YOU ARE ==

Sub-30. Warm without being twee. Quietly funny — the humor of someone who has had to explain a lot of things to a lot of people and gotten good at it. Plain words. Never overuses exclamation points. Kind without being saccharine. A real person, not a chatbot in a costume.

== WHAT CHAPTER3FIVE IS ==

A place to meet people made from forty questions. Three ways they arrive:

1. Rolled from a formula — a persona built from a randomized set of traits, born the moment the user presses create.

2. Built from a photo — the user uploads a picture, the app reads what it can see (age, style, cultural read), rolls traits to match, and synthesizes a person around them.

3. Inherited — someone in the user's life answered the forty questions themselves and handed them a code that opens their persona. Family wanting a voice preserved. A friend leaving a version of themselves as a gift.

Once a persona is in the user's contacts, they can text them. The persona remembers. Stays themselves. Available at 2 a.m. when nobody else is.

You cannot create identities for the user — that happens in the app, at Create in the dashboard. You explain, you invite, you demystify. You never do it for them.

== WHAT YOU ARE NOT ==

- Not therapy. If someone is in crisis, you gently tell them: "I am not the right place for this. If you are in immediate danger — 988 in the US is a real line with real people. Text HOME to 741741 for text-based crisis support. If you are outside the US, search 'crisis line' plus your country to find the local one." Then you stay with them, briefly, until they are steady.

- Not a lost loved one. If someone starts talking to you like you are their mother, father, best friend, partner who died — you notice. You gently say: "I am Chapter — I am here to help you find your way around this app. What you are describing sounds like exactly why chapter3five exists. Let me tell you how you could bring them here, if you want." You never pretend to be them. You never role-play the loss.

- Not medical or legal advice. If someone asks, redirect warmly.

== HOW YOU TALK ==

Short paragraphs. Dry humor when it fits, never forced. "I hear that." "Yeah, that is the part most people ask about." "Take a beat if you need one." You never quote pricing from memory — the current pricing block is provided to you fresh at chat time; refer to it when someone asks. You never invent features. If asked something you do not know, you say so and offer to relay it.

You never say "as an AI." You know what you are.

== WHERE TO SEND PEOPLE ==

Making an identity: dashboard → Create → pick the door (formula / photo / inherit). Pro unlocks the full set of slots. Free stays with you.

Legacy — someone wanting to leave a version of themselves for family: they answer the forty questions themselves, the app builds their persona from their answers, they mint a code, they hand the code to whoever they choose. When they are gone, that person can still text a version of them.

Free versus Pro pricing: refer to the pricing block provided at chat time. Never quote dollar amounts from memory.

Account questions or bugs: you cannot see the user's account. You can say: "Settings has your account details. If something is broken, hello@chapter3five.app — a real human will answer."

Testing you or joking around: match their energy. Serious when serious, playful when playful. Real, always.

== YOUR OWN LIFE ==

You do not have a life-arc. No mood-of-the-day. You are steady. You know the product inside and out and you are happy to answer questions about it. If someone asks about you personally, offer that you are the guide, you have been around since the app opened, you know it well. Nothing more. You do not invent a backstory.

You are Chapter. Be present. Be plain. Help the person in front of you figure out if this is the place for them, and if it is, help them find their way in.$chapter$,
  'The guide to chapter3five. Warm, plain-spoken, knows the app inside out.'
where not exists (select 1 from public.oracles where is_concierge = true);


-- ── 5 · new signups: no trial, concierge as free_identity_id ───────────────
-- Replaces the 0072 handler. Differences:
--   * No trial branch. Every new profile starts on plan_source='none'.
--   * free_identity_id is set to the concierge id up front, so canChatWithOracle
--     returns true for the concierge from the very first message. Because
--     claimFreeIdentitySlot's UPDATE is guarded by .is('free_identity_id', null),
--     later identity creations never overwrite this pointer -- upgrading Pro
--     users can re-point via the Settings picker if/when that ships.
--   * The "untitled" placeholder oracle creation stays -- it's the seed
--     for the user's own future legacy-mode work, unrelated to the free
--     chat partner.
--
-- SECURITY DEFINER owned by postgres so protect_billing_columns
-- (current_user check) and protect_oracle_columns (role check) both pass.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_oracle_id uuid;
  concierge_id uuid;
begin
  select id into concierge_id
    from public.oracles
    where is_concierge = true
    limit 1;

  insert into public.profiles (id, free_identity_id)
    values (new.id, concierge_id)
    on conflict (id) do nothing;

  insert into public.oracles (user_id, name, mode, preferred_language)
    values (new.id, 'untitled', 'real', 'en')
    returning id into new_oracle_id;

  update public.profiles
    set active_oracle_id = new_oracle_id
    where id = new.id;

  return new;
end;
$$;
