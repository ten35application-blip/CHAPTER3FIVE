-- Wave 1 of "make the persona feel like a real person." Three layers:
--
--   1. ambient_cast (lifetime) — the named people in their life. A
--      sister, a roommate, a spouse, a coworker who eats salmon at
--      his desk. Mentioned naturally when relevant.
--
--   2. weekly_context (rotating, ~7 days) — what's been happening
--      this week. The construction upstairs, owing someone a callback,
--      a book they're reading. Surfaces only when the conversation
--      goes somewhere that touches it.
--
--   3. conversation_state (per (oracle, user), refreshed on idle gap)
--      — current mood + physical state. Tired, just had coffee,
--      hoodie weather, headphones on jazz. Colors short replies,
--      almost never announced.

alter table public.oracles
  add column if not exists ambient_cast jsonb,
  add column if not exists cast_extracted_at timestamptz,
  add column if not exists weekly_context jsonb,
  add column if not exists weekly_context_until timestamptz;

comment on column public.oracles.ambient_cast is
  'People in this persona''s life — [{name, relationship, vibe}, ...].';
comment on column public.oracles.weekly_context is
  'Rotating "what''s been happening this week" — { threads: [...] }.';
comment on column public.oracles.weekly_context_until is
  'When the current weekly_context expires and should be regenerated.';

create table if not exists public.conversation_state (
  oracle_id uuid not null references public.oracles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mood text,
  physical text,
  generated_at timestamptz not null default now(),
  primary key (oracle_id, user_id)
);

alter table public.conversation_state enable row level security;

-- Owner can read their own conversation states (debug + transparency).
create policy "users see their own conversation state"
  on public.conversation_state
  for select
  using (auth.uid() = user_id);

-- All writes go through the service role (chat route only).
