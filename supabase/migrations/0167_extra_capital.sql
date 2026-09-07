-- 0167 — ONE-OFF MEMBER DEPOSITS (Wilson 2026-09-05: "we got our debit
-- cards and pedro is putting in $255").
--
-- The $175s are monthly and symmetric; the savings floor is a single
-- deposit that stays in savings. This is the third kind: a one-off
-- deposit by one partner into the OPERATING account (it lands in the
-- reserve), booked as that partner's capital in that month and owed
-- back like the rest. A list, so future one-offs need no migration.
--
-- Applied to production 2026-09-05 via the Supabase MCP; kept here so
-- the schema is reproducible.

alter table public.business_settings
  add column if not exists extra_capital jsonb not null default '[]'::jsonb;

comment on column public.business_settings.extra_capital is
  'One-off member deposits: [{month:"YYYY-MM", by:<partner name>, cents:int, note?:text}]. Each lands in the reserve that month and is booked as that partner''s capital (owed back).';

update public.business_settings
set extra_capital = '[{"month":"2026-09","by":"Pedro","cents":25500,"note":"opening deposit when the debit cards arrived"}]'::jsonb
where id = true;
