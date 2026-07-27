-- 0081_chat_spend_events
--
-- Per-user Anthropic spend ledger. Wilson pays for tokens directly and
-- runs multiple products; nothing today caps how much a single Free
-- user can trigger. A misbehaving / testing / abusive account can rack
-- up dozens of dollars of Claude calls before anyone notices.
--
-- Every Claude/Haiku call routes through recordAnthropicSpend which
-- appends a row here. spendGovernor.ts sums current-month spend per
-- user; when Free-tier users hit PRICING.freeMonthlySpendCents, the
-- chat stream returns 402 with a friendly "you've hit this month's
-- allowance" screen. Pro/admin/trial are never gated.
--
-- Observability: `route` tags every event with its origin so we can
-- see chat vs residue vs reflect vs outreach spend by user.

create table if not exists public.chat_spend_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  -- Estimated cost of THIS call in whole cents (rounded up). Nullable
  -- so a rare estimation failure doesn't drop the row.
  cents integer,
  -- Raw usage numbers from the SDK's usage payload, when available.
  input_tokens integer,
  output_tokens integer,
  cache_read_tokens integer,
  cache_creation_tokens integer,
  model text,
  -- Where in the app the call originated. Free-form for now; typical
  -- values: 'chat_stream', 'outreach', 'residue', 'reflect',
  -- 'voice_backfill', 'block_detector', 'crisis_helper'.
  route text,
  created_at timestamptz not null default now()
);

create index if not exists chat_spend_events_user_month_idx
  on public.chat_spend_events (user_id, created_at desc);

alter table public.chat_spend_events enable row level security;

-- Users can read their OWN spend (so we can render a friendly "you've
-- used $X of $Y" pill on /settings later). No client writes — the
-- server records via service role.
create policy "spend: user reads own"
  on public.chat_spend_events
  for select
  using (user_id = auth.uid());

grant select on public.chat_spend_events to authenticated;
