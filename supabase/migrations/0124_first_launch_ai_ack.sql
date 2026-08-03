-- ============================================================
-- profiles.first_launch_ai_ack_at
-- ============================================================
-- One-time acknowledgment stamp. Google Play's Generative AI policy
-- expects a visible in-context signal that the counterparty is AI;
-- Wilson's product rule keeps AI wording out of the normal chat
-- surface. Compromise: one modal shown ONCE before the first send to
-- the concierge (Adrian), disclosing that the app's companions are
-- software, not real people. This column carries that stamp so we
-- never show it again for the same user.
--
-- Nullable. Write path is server-side only via /api/user/ack-ai
-- (admin client) — no UPDATE grant to authenticated so a crafted
-- client can't reset it. SELECT is granted so the client can decide
-- whether to render the modal.

alter table public.profiles
  add column if not exists first_launch_ai_ack_at timestamptz;

-- Read grant (0116 revoked-then-explicit pattern; add the new column
-- to the SELECT allowlist so client fetches can see it).
grant select (first_launch_ai_ack_at) on public.profiles to authenticated;
