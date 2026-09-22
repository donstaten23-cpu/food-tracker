-- Lets any household member delete a saved food, matching who can already
-- edit them. 0001 only allowed the person who created a food to delete it,
-- which meant e.g. you couldn't remove foods your partner imported.
--
-- Deleting a food doesn't touch past log entries: they keep their own copy of
-- the numbers (food_entries.food_id just becomes null).
--
-- Run this once in the Supabase Dashboard -> SQL Editor.

drop policy if exists "foods_delete_own" on foods;

create policy "foods_delete_household" on foods
  for delete using (is_household_member(household_id));
