-- 0135_rename_persona_outreach_cron_job
--
-- One job, two spellings, and the readout only knew one of them.
--
-- /api/cron/persona-outreach wrote its heartbeat as
-- job = 'persona_outreach' (underscore). Every reader of cron_runs
-- keys on 'persona-outreach' (hyphen) — the cron-health endpoint's
-- JOBS map, the admin page's cronJobList, and the admin overview API.
-- So did vercel.json's cron path and the route directory itself. The
-- underscore existed in exactly two insert() calls and nowhere else.
--
-- The effect was the same class of bug as check-in's missing
-- heartbeat: the job ran fine and recorded every run, but it recorded
-- them under a name no readout ever joined against, so it sat in the
-- dashboard as never-run and permanently stale. A dashboard that
-- always says "broken" is read the same way as one that always says
-- "fine" — after a week nobody looks. And had persona-outreach
-- genuinely stopped firing, the display would not have changed.
--
-- The route now writes the hyphen. This renames what it already
-- wrote, so the history it built up carries over instead of being
-- orphaned under a dead key. The rows are heartbeats — no foreign
-- keys point at cron_runs.job, and nothing outside this repo reads
-- the table — so a plain update is the whole migration.
--
-- Idempotent: re-running matches zero rows.

update public.cron_runs
   set job = 'persona-outreach'
 where job = 'persona_outreach';
