-- The phone reports which build it is running when it registers its
-- push token (2026-09-08). Lets the server know who is on 1.5 yet —
-- first use: hold the "I can keep what you tell me" welcome until a
-- person's phone is on the build that shows the archive's face.
alter table public.device_tokens add column if not exists app_version text, add column if not exists app_build text;
grant select (app_version, app_build), insert (app_version, app_build), update (app_version, app_build) on public.device_tokens to authenticated;
