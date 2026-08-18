-- One walk in progress PER MODE, not per account (Wilson 2026-08-19:
-- "I should be able to do it for me, and also do it for someone else").
-- Settings has always shown two slots — one for yourself, one for a
-- loved one — but legacy_drafts' UNIQUE(user_id) meant starting the
-- second walk demanded abandoning the first. The mode-conflict
-- interstitial on the web walk existed solely to guard the data loss
-- that constraint created; with a draft row per (user, mode) the
-- conflict class is gone.
--
-- Backfill BEFORE the new unique constraint: every existing row
-- carries its mode inside subject->>'mode' (pre-toggle mints default
-- to 'other', same rule the app applies).

alter table public.legacy_drafts
  add column if not exists mode text not null default 'other';

update public.legacy_drafts
  set mode = case when subject->>'mode' = 'self' then 'self' else 'other' end;

alter table public.legacy_drafts
  add constraint legacy_drafts_mode_check check (mode in ('self', 'other'));

alter table public.legacy_drafts
  drop constraint legacy_drafts_user_id_key;

alter table public.legacy_drafts
  add constraint legacy_drafts_user_mode_key unique (user_id, mode);
