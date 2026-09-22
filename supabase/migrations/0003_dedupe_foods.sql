-- Removes duplicate rows from `foods`, keeping the oldest one per
-- (household, name, brand), compared case-insensitively.
--
-- Why they exist: before this fix, tapping Log in Quick add inserted a new
-- catalog row every time (the app now only reuses the existing one).
--
-- Log entries that pointed at a duplicate are re-pointed to the kept row
-- first, so nothing in history changes. Heads up: two presets that share the
-- same name and brand (e.g. "Rice" 1 cup vs "Rice" 2 cups) count as
-- duplicates and get merged into the oldest one.
--
-- Run once in the Supabase Dashboard -> SQL Editor.
--
-- Optional preview first (what would be merged):
--   select lower(trim(name)) as name, lower(trim(coalesce(brand, ''))) as brand, count(*)
--   from foods
--   group by household_id, 1, 2
--   having count(*) > 1
--   order by count(*) desc;

-- 1) Re-point log entries from duplicates to the row being kept.
update food_entries e
set food_id = k.keep_id
from (
  select id,
         first_value(id) over w as keep_id,
         row_number() over w as rn
  from foods
  window w as (
    partition by household_id, lower(trim(name)), lower(trim(coalesce(brand, '')))
    order by created_at, id
  )
) k
where e.food_id = k.id and k.rn > 1;

-- 2) Delete the duplicates.
delete from foods
where id in (
  select id
  from (
    select id,
           row_number() over (
             partition by household_id, lower(trim(name)), lower(trim(coalesce(brand, '')))
             order by created_at, id
           ) as rn
    from foods
  ) ranked
  where rn > 1
);
