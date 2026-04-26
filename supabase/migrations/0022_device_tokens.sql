-- chapter3five — Expo push notification tokens.
--
-- Mobile registers for push notifications and saves the resulting Expo
-- push token here. The proactive cron uses these to wake the device
-- when the thirtyfive sends a proactive message.
--
-- One row per (user, token). A single user can have multiple devices
-- (phone + tablet) and a single device can churn tokens over time.

create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_token text not null,
  platform text check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, expo_token)
);

create index if not exists device_tokens_user_idx on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;

drop policy if exists "device_tokens: owner reads" on public.device_tokens;
drop policy if exists "device_tokens: owner inserts" on public.device_tokens;
drop policy if exists "device_tokens: owner updates" on public.device_tokens;
drop policy if exists "device_tokens: owner deletes" on public.device_tokens;

create policy "device_tokens: owner reads"
  on public.device_tokens for select
  using (auth.uid() = user_id);
create policy "device_tokens: owner inserts"
  on public.device_tokens for insert
  with check (auth.uid() = user_id);
create policy "device_tokens: owner updates"
  on public.device_tokens for update
  using (auth.uid() = user_id);
create policy "device_tokens: owner deletes"
  on public.device_tokens for delete
  using (auth.uid() = user_id);
