-- Wilson's feedback: the current one_line_hook is fine but flat --
-- give Adrian a bit more character without turning it into a novel.
-- The chat header truncates at ~70vw on mobile so keep it tight
-- enough to survive that. Ships together with the FLUX 1.1 Pro
-- refactor for Adrian's avatar generation.

update public.oracles
   set one_line_hook = 'chapter3five''s guide. Joined the team when it was still a spreadsheet of ideas. Warm, quietly funny, knows every corner of the app.'
 where is_concierge = true;
