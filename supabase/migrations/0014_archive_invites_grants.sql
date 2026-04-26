-- chapter3five — family-shared access to a single archive.
--
-- Different from share codes (which copy the archive into the recipient's
-- account). Grants give read-only access to the SAME archive — same
-- answers, same name, same photo — so multiple family members can all
-- talk to the same Mom and each have their own private conversation.

-- archive_invites: a code the owner generates and hands out. Each code
-- can be redeemed once. Owner can revoke anytime.
create table if not exists public.archive_invites (
  id uuid primary key default gen_random_uuid(),
  oracle_id uuid not null references public.oracles(id) on delete cascade,
  inviter_user_id uuid not null references auth.users(id) on delete cascade,
  invitee_email text,
  code text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked')),
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists archive_invites_oracle_idx
  on public.archive_invites (oracle_id);
create index if not exists archive_invites_inviter_idx
  on public.archive_invites (inviter_user_id);
create index if not exists archive_invites_code_idx
  on public.archive_invites (code);

alter table public.archive_invites enable row level security;

-- Owner sees / manages their own invites.
create policy "archive_invites: owner reads"
  on public.archive_invites for select
  using (auth.uid() = inviter_user_id);
create policy "archive_invites: owner inserts"
  on public.archive_invites for insert
  with check (auth.uid() = inviter_user_id);
create policy "archive_invites: owner updates"
  on public.archive_invites for update
  using (auth.uid() = inviter_user_id);

-- Any signed-in user can look up a code (to redeem it). Codes are random
-- enough that brute force is infeasible.
create policy "archive_invites: authenticated lookup"
  on public.archive_invites for select
  to authenticated
  using (status = 'pending');

-- archive_grants: the actual permission row. One row per (oracle, invitee).
-- Owner is implicit (always has access via oracles.user_id).
create table if not exists public.archive_grants (
  id uuid primary key default gen_random_uuid(),
  oracle_id uuid not null references public.oracles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  granted_by uuid not null references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  unique (oracle_id, user_id)
);

create index if not exists archive_grants_oracle_idx
  on public.archive_grants (oracle_id);
create index if not exists archive_grants_user_idx
  on public.archive_grants (user_id);

alter table public.archive_grants enable row level security;

-- Owner of the oracle sees all grants on it; invitee sees their own grants.
create policy "archive_grants: owner reads grants on their oracles"
  on public.archive_grants for select
  using (
    exists (select 1 from public.oracles o where o.id = archive_grants.oracle_id and o.user_id = auth.uid())
  );
create policy "archive_grants: invitee reads their own"
  on public.archive_grants for select
  using (auth.uid() = user_id);

-- Inserts: only the owner of the oracle can grant (used by accept-invite
-- server action which runs in the owner-of-oracle's name when validating).
-- For the invitee-driven flow, we use service-role (admin client) on accept.
create policy "archive_grants: owner inserts"
  on public.archive_grants for insert
  with check (
    exists (select 1 from public.oracles o where o.id = archive_grants.oracle_id and o.user_id = auth.uid())
  );

-- Owner of the oracle can revoke (delete).
create policy "archive_grants: owner revokes"
  on public.archive_grants for delete
  using (
    exists (select 1 from public.oracles o where o.id = archive_grants.oracle_id and o.user_id = auth.uid())
  );

-- ============================================================================
-- Extend RLS so invitees can read the shared oracle's metadata + answers.
-- (They still cannot edit anything — read-only.)
-- ============================================================================
create policy "oracles: invitees read via grant"
  on public.oracles for select
  using (
    exists (
      select 1 from public.archive_grants g
      where g.oracle_id = oracles.id and g.user_id = auth.uid()
    )
  );

create policy "answers: invitees read via grant"
  on public.answers for select
  using (
    exists (
      select 1 from public.archive_grants g
      where g.oracle_id = answers.oracle_id and g.user_id = auth.uid()
    )
  );
