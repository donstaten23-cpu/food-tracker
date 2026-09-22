-- Adds foods.last_used_at, which drives Quick add ordering and the CSV import.
--
-- 0001 now includes this column, but a database created from an earlier copy
-- of 0001 won't have it (symptom: "Could not find the 'last_used_at' column of
-- 'foods' in the schema cache"). Safe to run whether or not the column exists.
--
-- Run this once in the Supabase Dashboard -> SQL Editor.

alter table foods
  add column if not exists last_used_at timestamptz not null default now();

-- Make PostgREST (the API layer) pick up the new column immediately.
notify pgrst, 'reload schema';
