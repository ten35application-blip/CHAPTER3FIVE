-- Fix: agreements.document check constraint only allowed the original
-- 3 documents ('terms', 'privacy', 'cookies') but the agreements page
-- now requires 6 acknowledgments (added ai_processing, age_18plus,
-- not_therapy when the consent flow was rewritten). Inserting any of
-- the new three throws "agreements_document_check" violation.
--
-- Drop the old constraint, recreate with the full set.

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
    'not_therapy'
  ));
