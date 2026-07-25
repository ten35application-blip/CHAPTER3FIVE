-- ============================================================================
-- 0061_block_state.sql
--
-- Chat v2: block enforcement + chat image uploads.
--
-- 1. oracles.blocked_at / block_reason — set when a persona blocks the user
--    (repeated disrespect: cursing, harassment, etc.). RLS scopes oracles to
--    a single user_id, so a block is effectively per-(oracle, its owner).
--    If shared oracles (oracle_shares) ever need per-viewer blocks, extend
--    with a join table later — for MVP this column pair is the whole state.
--    Enforcement lives in /api/chat/[id]/stream (403 'blocked') and the chat
--    page (input row replaced with a blocked notice). The trigger that SETS
--    these is deferred — see TODO(block-detector) in the stream route; for
--    now blocks are toggled manually (admin via SQL/MCP).
--
-- 2. Partial index on blocked_at — dashboards/admin sweeps only ever ask
--    "which oracles have an active block", so index just those rows.
--
-- 3. Private `chat-uploads` storage bucket for images attached to chat
--    messages (path: <user_id>/<oracle_id>/<timestamp>-<filename>). Owner-
--    scoped policies: first path folder must equal auth.uid(). The stream
--    route mints short-lived signed URLs (15 min) for Claude Vision; the
--    chat page re-signs on load for rendering history.
--    (0025 created a `chat-photos` bucket that was never wired up client-
--    side; chat v2 standardizes on `chat-uploads` per Wilson's directive.)
--
-- Additive + idempotent. Safe to run twice.
-- ============================================================================

-- Block state on the persona.
alter table public.oracles
  add column if not exists blocked_at timestamptz,
  add column if not exists block_reason text;

comment on column public.oracles.blocked_at is
  'When the persona blocked its user. Non-null = chat is closed: the stream '
  'route returns 403 and the chat page hides the composer. No refund.';

comment on column public.oracles.block_reason is
  'Short internal note on why the block was set (e.g. "repeated harassment"). '
  'Surfaced to the client only as small print, never as the headline copy.';

-- Only blocked rows are ever queried by blocked_at.
create index if not exists oracles_blocked_at_idx
  on public.oracles (blocked_at)
  where blocked_at is not null;

-- Private bucket for chat image attachments. 8 MB cap + image-only MIME
-- allowlist enforced server-side by Storage (client also pre-checks 8 MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-uploads',
  'chat-uploads',
  false,
  8388608,
  array['image/png', 'image/jpeg', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Owner-scoped storage policies: a user owns paths whose first folder is
-- their uid (same convention as avatars/0011 and chat-photos/0025).
drop policy if exists "chat-uploads: owner reads" on storage.objects;
drop policy if exists "chat-uploads: owner writes" on storage.objects;
drop policy if exists "chat-uploads: owner deletes" on storage.objects;

create policy "chat-uploads: owner reads"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'chat-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "chat-uploads: owner writes"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "chat-uploads: owner deletes"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'chat-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
