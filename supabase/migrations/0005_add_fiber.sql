-- Adds fiber tracking so the Today page can show Net Carbs (carbs - fiber)
-- instead of total carbs, matching how Cronometer et al. label it.
--
-- Run this once in the Supabase Dashboard -> SQL Editor.

alter table foods add column if not exists fiber_g numeric not null default 0;
alter table food_entries add column if not exists fiber_g numeric not null default 0;
