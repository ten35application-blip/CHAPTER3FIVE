-- 0164 — THE VAULT GOES QUIET (Wilson 2026-09-02: "i rather get one
-- email the 27th and not this email that we be getting daily").
--
-- archive-backup still snapshots the irreplaceables every morning, but
-- the daily copy now lands in this PRIVATE bucket instead of three
-- inboxes; the email with the attachment goes out once a month, on
-- the 27th, next to the transfer sheet. No storage policies on
-- purpose — only the service role (the cron) reads or writes here.
--
-- Applied to production 2026-09-02 via the Supabase MCP; kept here so
-- the schema is reproducible.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vault-snapshots', 'vault-snapshots', false, 52428800, array['application/json'])
on conflict (id) do nothing;
