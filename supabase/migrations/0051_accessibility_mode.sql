-- chapter3five — accessibility mode flag.
--
-- A profile-level boolean the user can flip in /account. When on,
-- the root <html> element gets data-accessibility="on" and CSS
-- bumps font sizes, touch targets, and contrast across the whole
-- app — without affecting users who haven't opted in.
--
-- Designed for older users (the user we're building this for has
-- 90-year-olds in mind), or anyone who finds the default text
-- too small.

alter table public.profiles
  add column if not exists accessibility_mode boolean not null default false;

comment on column public.profiles.accessibility_mode is
  'When true, the UI uses larger text, larger touch targets, and higher-contrast colors. Opt-in via /account.';
