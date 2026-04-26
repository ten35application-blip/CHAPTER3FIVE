-- chapter3five — email send log + admin/system audit log.
--
-- email_log: every transactional email we send (and try to send). Lets
-- admin see "did the welcome email actually go out?" and "is Resend
-- bouncing for a domain?" without tailing logs.
--
-- audit_log: structured trail of sensitive actions (account deletion,
-- admin marking deceased, admin resolving a crisis, etc.). Future-proofs
-- us against "who did what" questions.

create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  recipient text not null,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null,             -- 'welcome' | 'crisis_alert' | 'outreach' | 'beneficiary_designation' | 'beneficiary_activation' | 'beneficiary_claimed'
  subject text,
  status text not null default 'sent' check (status in ('sent', 'failed', 'queued')),
  error text,
  sent_at timestamptz not null default now()
);

create index if not exists email_log_recipient_idx on public.email_log (recipient);
create index if not exists email_log_user_idx on public.email_log (user_id);
create index if not exists email_log_sent_at_idx on public.email_log (sent_at desc);
create index if not exists email_log_status_idx on public.email_log (status);

alter table public.email_log enable row level security;
-- Service role only.

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,                -- denormalized so it survives user delete
  action text not null,            -- 'account_deleted' | 'marked_deceased' | 'unmarked_deceased' | 'crisis_resolved' | 'message_report_resolved' | etc.
  target_user_id uuid references auth.users(id) on delete set null,
  target_id text,                  -- generic id (oracle, message report, etc.)
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_actor_idx on public.audit_log (actor_user_id);
create index if not exists audit_log_action_idx on public.audit_log (action);
create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;
-- Service role only.
