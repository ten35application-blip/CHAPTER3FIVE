-- chapter3five — cron heartbeat. Each cron writes a row when it runs so
-- we can see in admin if a job stopped firing without having to read
-- Vercel logs.

create table if not exists public.cron_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,           -- 'outreach', 'proactive', etc.
  ran_at timestamptz not null default now(),
  status text not null default 'ok' check (status in ('ok', 'error')),
  processed int,                -- e.g. emails sent / proactives delivered
  error text,
  duration_ms int
);

create index if not exists cron_runs_job_ran_idx
  on public.cron_runs (job, ran_at desc);

alter table public.cron_runs enable row level security;
-- Service role only.
