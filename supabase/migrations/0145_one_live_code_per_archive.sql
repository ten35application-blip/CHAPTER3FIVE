-- One live inherit code per archive, enforced where races can't reach.
--
-- Every mint path checks for an existing live code first, but two
-- requests in the same instant both see none and both insert — that is
-- how an archive ends up with two live codes, which used to make every
-- bare maybeSingle() lookup return null (the owner saw NO code at
-- all). The lookups are fixed to take the newest; this index makes the
-- state unreachable in the first place. Revoked codes are untouched —
-- an archive accumulates as many of those as its history needs.
create unique index if not exists inherit_codes_one_live_per_oracle
  on public.inherit_codes (oracle_id)
  where revoked_at is null;
