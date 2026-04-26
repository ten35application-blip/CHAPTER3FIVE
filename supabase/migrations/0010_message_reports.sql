-- chapter3five — user-submitted reports of thirtyfive messages
--
-- A user can hit "Report" on any assistant message in the chat surface.
-- The report row stores the message content + an optional reason. Admin
-- reviews via /admin and marks resolved.

create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  oracle_id uuid references public.oracles(id) on delete set null,
  message_content text not null,
  reason text,
  reported_at timestamptz not null default now(),
  resolved_at timestamptz,
  notes text
);

create index if not exists message_reports_user_idx on public.message_reports (user_id);
create index if not exists message_reports_open_idx on public.message_reports (reported_at) where resolved_at is null;

alter table public.message_reports enable row level security;

create policy "message_reports: users see their own"
  on public.message_reports for select using (auth.uid() = user_id);

create policy "message_reports: users insert their own"
  on public.message_reports for insert with check (auth.uid() = user_id);
