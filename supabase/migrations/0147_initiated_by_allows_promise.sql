-- The promised-pings cron stamps its deliveries initiated_by='promise'
-- so /admin and analytics can tell a kept promise from ordinary
-- outreach. The CHECK predates the value; without this every promise
-- delivery 23514s at the insert and the cron retries it forever.
alter table messages drop constraint messages_initiated_by_check;
alter table messages add constraint messages_initiated_by_check
  check (
    initiated_by is null
    or initiated_by = any (array[
      'user', 'persona', 'proactive', 'anniversary',
      'check_in', 'daily_question', 'system', 'concierge',
      'promise'
    ])
  );
