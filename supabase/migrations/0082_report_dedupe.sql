-- 0082_report_dedupe
--
-- Fable audit on 7798945 flagged: an authed user could rapid-fire
-- tapback → report → tapback → report on the same message and
-- explode the admin inbox + burn Resend quota. RLS already scopes
-- reports to messages in the reporter's own thread, but nothing
-- stopped duplicate rows for the same (message, reporter) pair
-- while the first report was still pending review.
--
-- Partial unique index: at most one PENDING report per
-- (message, reporter) at a time. Once an admin resolves the
-- report to 'reviewed' or 'dismissed' via the queue, the user
-- can report the same message again if it recurs — the partial
-- predicate is what makes that possible.
--
-- The API route catches 23505 and returns a clean 409 so the
-- client can render "already reported" instead of a raw error.

create unique index if not exists message_reports_pending_dedupe_idx
  on public.message_reports (message_id, reporter_user_id)
  where status = 'pending';
