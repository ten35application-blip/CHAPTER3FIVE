-- The per-document consent ledger had recorded NOTHING since it
-- shipped. ALLOWED_DOCS (lib/legal/acceptance.ts) sends eight
-- documents — terms, privacy, cookies, ai_processing, eula,
-- guidelines, age_18plus, not_therapy — but this CHECK constraint
-- permitted only seven, omitting eula and guidelines. The writer
-- upserts all eight as ONE batch, so the two disallowed values failed
-- the entire statement, and writePerDocAgreements swallows the error
-- by design (a ledger failure must never block consent). Result: 38
-- blanket acceptances on file, zero granular ones — exactly the
-- records that prove a specific user specifically acknowledged "this
-- is not therapy" and "I am 18 or older" (found in the pre-launch
-- legal audit, 2026-08-21).
--
-- memory_mode is retained: not currently sent, but a valid historical
-- value, and dropping it would invalidate rows from an older client.

alter table public.agreements
  drop constraint agreements_document_check;

alter table public.agreements
  add constraint agreements_document_check
  check (document = any (array[
    'terms',
    'privacy',
    'cookies',
    'ai_processing',
    'eula',
    'guidelines',
    'age_18plus',
    'not_therapy',
    'memory_mode'
  ]));
