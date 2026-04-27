-- Theme preference per user. Two values for now: 'dusk' (default —
-- the warm-dark mood the app shipped with) and 'daylight' (warm
-- parchment for daytime/bright-room use). The CSS ships both
-- palettes; the layout sets data-theme on <html> based on this.

alter table public.profiles
  add column if not exists theme text not null default 'dusk'
  check (theme in ('dusk', 'daylight'));
