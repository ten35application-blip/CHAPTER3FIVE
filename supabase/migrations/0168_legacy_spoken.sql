-- 0168: which draft answers were dictated (2026-09-07).
-- Their words either way; the flag only keeps a speech engine's
-- punctuation from voting on the archive's measured typing rules.
alter table public.legacy_drafts
  add column if not exists spoken jsonb not null default '[]'::jsonb;
