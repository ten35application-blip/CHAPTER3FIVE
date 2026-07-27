-- 0070 revoked table-wide SELECT on oracles and re-granted an explicit
-- column list. Every column added since (0078 humanization, 0080
-- chronotype/voice, 0094 formula-v5) was never re-granted, so any user
-- select touching those columns fails with 42501 permission denied for
-- the whole table -- PostgREST denies the query, not just the missing
-- columns. This restores read access on those six columns so the
-- authenticated role can round-trip the full oracle row it needs for
-- chat, welcome, and any surface that reads the newer humanization
-- fields. Write-side protection is untouched -- protect_oracle_columns
-- (0067 + 0091 + 0094) still blocks user UPDATEs on the trait-derived
-- fields.
grant select (
  memory_style,
  text_burst_style,
  chronotype,
  voice_examples,
  pet_name,
  texting_fluency
) on public.oracles to anon, authenticated;
