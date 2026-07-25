-- chapter3five — 0062: block-event audit log (pricing & policy drop).
--
-- chat_block_events: append-only log of every decision to block a user
-- from an identity (persona-initiated, human admin, or automated).
-- Written server-side when a block lands; read by admins for audit,
-- review, and a potential appeal flow later.
--
-- Deliberately NOT readable by users: a blocked user should not see
-- the internal reason format. Policy surface for users is the Terms
-- (billing / no-refund) and Community Guidelines copy.

create table if not exists public.chat_block_events (
  id uuid primary key default gen_random_uuid(),
  oracle_id uuid references public.oracles(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  reason text,
  decided_by text not null check (decided_by in ('persona', 'human_admin', 'automated')),
  created_at timestamptz not null default now()
);

create index if not exists chat_block_events_oracle_idx
  on public.chat_block_events (oracle_id);
create index if not exists chat_block_events_user_idx
  on public.chat_block_events (user_id);
create index if not exists chat_block_events_created_at_idx
  on public.chat_block_events (created_at desc);

alter table public.chat_block_events enable row level security;
-- No policies on purpose (house pattern, see 0021 audit_log):
-- RLS enabled + zero policies = anon/authenticated can read nothing.
-- Admin pages and the block-writing path use the service role.
