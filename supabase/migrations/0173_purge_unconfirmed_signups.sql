-- 2026-09-08: a monthly pg_cron sweep of unconfirmed, never-signed-in
-- signups was scheduled here and REMOVED the same night. Wilson: "I'm
-- scared we might delete actual accounts. Whenever I see too many
-- piling up I'll let you know." Cleanup is manual, on his word only.
select cron.unschedule('purge-unconfirmed-signups')
where exists (select 1 from cron.job where jobname = 'purge-unconfirmed-signups');
