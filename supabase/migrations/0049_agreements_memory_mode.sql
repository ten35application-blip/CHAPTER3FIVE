-- Allow 'memory_mode' as an agreements document. Conditional on the
-- user picking memory mode at onboarding; otherwise not collected.
-- Without this, the upsert in /agreements/actions.ts throws
-- "agreements_document_check" when a memory-mode user accepts.

alter table public.agreements
  drop constraint if exists agreements_document_check;

alter table public.agreements
  add constraint agreements_document_check
  check (document in (
    'terms',
    'privacy',
    'cookies',
    'ai_processing',
    'age_18plus',
    'not_therapy',
    'memory_mode'
  ));
