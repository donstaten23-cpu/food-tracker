-- Recipes: combine existing foods into one reusable item that logs as a
-- single entry (e.g. "Chili" made of ground beef + beans + onion).
--
-- Ingredients are copied from `foods` at add time (same rationale as
-- food_entries) so editing/deleting a food later doesn't change a saved
-- recipe's numbers. Totals aren't cached on `recipes` — they're just the
-- sum of `recipe_ingredients`, computed client-side.
--
-- Run this once in the Supabase Dashboard -> SQL Editor.

create table if not exists recipes (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  created_by    uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  servings      numeric not null default 1,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz not null default now()
);

alter table recipes enable row level security;

create policy "recipes_select_household" on recipes
  for select using (is_household_member(household_id));

create policy "recipes_insert_household" on recipes
  for insert with check (is_household_member(household_id) and created_by = auth.uid());

create policy "recipes_update_household" on recipes
  for update using (is_household_member(household_id));

create policy "recipes_delete_own" on recipes
  for delete using (created_by = auth.uid());

create table if not exists recipe_ingredients (
  id            uuid primary key default gen_random_uuid(),
  recipe_id     uuid not null references recipes(id) on delete cascade,
  household_id  uuid not null references households(id) on delete cascade,
  food_id       uuid references foods(id) on delete set null,
  name          text not null,
  quantity      numeric not null default 1,
  unit          text not null default 'serving',
  calories      numeric not null default 0,
  protein_g     numeric not null default 0,
  carbs_g       numeric not null default 0,
  fat_g         numeric not null default 0,
  fiber_g       numeric not null default 0
);

alter table recipe_ingredients enable row level security;

create policy "recipe_ingredients_select_household" on recipe_ingredients
  for select using (is_household_member(household_id));

create policy "recipe_ingredients_insert_household" on recipe_ingredients
  for insert with check (is_household_member(household_id));

create policy "recipe_ingredients_update_household" on recipe_ingredients
  for update using (is_household_member(household_id));

create policy "recipe_ingredients_delete_household" on recipe_ingredients
  for delete using (is_household_member(household_id));

-- Logging a recipe writes one food_entries row (numbers copied in, same as
-- logging a food) but keeps a pointer back to the recipe for "last used".
alter table food_entries add column if not exists recipe_id uuid references recipes(id) on delete set null;
