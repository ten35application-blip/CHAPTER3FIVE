-- 0064: the automated block detector (516a0d0) writes severity values
-- 'warning' | 'temporary' | 'permanent', but 0033's check constraint only
-- allowed the tone-judge trio ('moderate','severe','critical'). Every
-- automated chat_blocks audit insert was silently rejected. Keep both
-- vocabularies: the legacy tone-judge path still writes the old trio.
alter table public.chat_blocks drop constraint chat_blocks_severity_check;
alter table public.chat_blocks add constraint chat_blocks_severity_check
  check (severity in ('moderate', 'severe', 'critical', 'warning', 'temporary', 'permanent'));
