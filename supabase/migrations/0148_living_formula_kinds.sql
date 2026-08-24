-- Two CHECKs learn the living-formula values (2026-08-25):
--  - messages.initiated_by += 'birthday' (a companion celebrating its
--    own birthday is neither outreach nor anniversary-of-the-user)
--  - anniversary_acknowledgments.kind += 'persona_birthday' (the
--    once-a-year dedupe for that celebration, per companion)
alter table messages drop constraint messages_initiated_by_check;
alter table messages add constraint messages_initiated_by_check
  check (
    initiated_by is null
    or initiated_by = any (array[
      'user', 'persona', 'proactive', 'anniversary',
      'check_in', 'daily_question', 'system', 'concierge',
      'promise', 'birthday'
    ])
  );

alter table anniversary_acknowledgments
  drop constraint anniversary_acknowledgments_kind_check;
alter table anniversary_acknowledgments
  add constraint anniversary_acknowledgments_kind_check
  check (kind = any (array[
    'birthday', 'signup', 'first_message', 'persona_birthday'
  ]));
