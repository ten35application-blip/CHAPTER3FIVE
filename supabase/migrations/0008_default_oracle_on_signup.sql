-- chapter3five — auto-create a default oracle for every new signup
--
-- When auth.users gets a new row, the existing trigger creates a profile.
-- Now we ALSO create an oracle row and point profile.active_oracle_id at it.
-- This means new users hit /onboarding with a real oracle to fill in.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_oracle_id uuid;
begin
  insert into public.profiles (id) values (new.id)
    on conflict (id) do nothing;

  insert into public.oracles (user_id, name, mode, preferred_language)
    values (new.id, 'untitled', 'real', 'en')
    returning id into new_oracle_id;

  update public.profiles
    set active_oracle_id = new_oracle_id
    where id = new.id;

  return new;
end;
$$;

-- Backfill: any existing profile that doesn't have an active oracle gets one.
do $$
declare
  p record;
  new_oracle_id uuid;
begin
  for p in
    select id from public.profiles where active_oracle_id is null
  loop
    insert into public.oracles (user_id, name, mode, preferred_language)
      values (p.id, 'untitled', 'real', 'en')
      returning id into new_oracle_id;
    update public.profiles
      set active_oracle_id = new_oracle_id
      where id = p.id;
  end loop;
end $$;
