-- The agreements page upserts six rows in one shot
-- (.upsert(rows, { onConflict: "user_id,document,version" })). The
-- INSERT policy already exists from 0001, but Postgres RLS requires
-- the UPDATE policy too whenever the conflict path could fire — even
-- if the row doesn't actually exist yet, the planner needs the
-- permission. Without it: "new row violates row-level security
-- policy (USING expression) for table agreements".
--
-- Add a self-scoped UPDATE policy so users can upsert their own
-- acceptances cleanly.

create policy "agreements: users can update their own agreements"
  on public.agreements for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
