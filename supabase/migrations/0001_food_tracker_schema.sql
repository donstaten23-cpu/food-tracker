-- Food tracker schema.
--
-- Lives in the SAME Supabase project as personal-dashboard-tracker (shared
-- Supabase Auth, so both apps use the same login). These tables are new and
-- don't touch anything the dashboard reads/writes.
--
-- Model: a "household" is just a pairing of two (or more) auth.users who
-- share a food catalog and can see each other's log, for support/visibility.
-- Each person still only manages their own entries and their own targets.
--
-- Run this once in the Supabase Dashboard -> SQL Editor.

-- ---------------------------------------------------------------------------
-- households
-- ---------------------------------------------------------------------------
create table if not exists households (
  id           uuid primary key default gen_random_uuid(),
  name         text not null default 'My Household',
  invite_code  text not null unique,
  created_at   timestamptz not null default now()
);

alter table households enable row level security;

-- ---------------------------------------------------------------------------
-- household_members
-- One row per (household, user). A user belongs to at most one household —
-- enforced with a unique constraint on user_id rather than a composite key,
-- since this app doesn't support switching households.
-- ---------------------------------------------------------------------------
create table if not exists household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id      uuid not null unique references auth.users(id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

alter table household_members enable row level security;

-- Helper: is the current user a member of household `hid`?
-- security definer so RLS policies can call it without needing their own
-- read access to household_members (avoids policy recursion).
create or replace function is_household_member(hid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

-- households: only visible to members. Created/joined via the functions
-- below rather than direct insert, so there's no need for a broad
-- "look up by invite code" select policy.
create policy "households_select_own" on households
  for select using (is_household_member(id));

-- household_members: a member can see the other row(s) in their own household.
create policy "household_members_select_own_household" on household_members
  for select using (is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- foods
-- Reusable catalog, shared within a household. Populated both from LLM
-- estimates (source = 'estimated') and from exact/label entries
-- (source = 'exact'), so past entries can be quickly re-logged.
-- ---------------------------------------------------------------------------
create table if not exists foods (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  created_by   uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  brand        text,
  serving_qty  numeric not null default 1,
  serving_unit text not null default 'serving',
  calories     numeric not null,
  protein_g    numeric not null default 0,
  carbs_g      numeric not null default 0,
  fat_g        numeric not null default 0,
  source       text not null default 'estimated' check (source in ('estimated', 'exact')),
  created_at   timestamptz not null default now()
);

alter table foods enable row level security;

create policy "foods_select_household" on foods
  for select using (is_household_member(household_id));

create policy "foods_insert_household" on foods
  for insert with check (is_household_member(household_id) and created_by = auth.uid());

create policy "foods_update_household" on foods
  for update using (is_household_member(household_id));

create policy "foods_delete_own" on foods
  for delete using (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- food_entries
-- The actual log. Macro values are copied at log time (not looked up live
-- from `foods`) so editing/deleting a catalog food later doesn't rewrite
-- history.
--
-- Visible to the whole household (so partners can see each other's log),
-- but each person can only insert/update/delete their OWN entries.
-- ---------------------------------------------------------------------------
create table if not exists food_entries (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  food_id      uuid references foods(id) on delete set null,
  logged_date  date not null default (now() at time zone 'utc')::date,
  meal_type    text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  description  text not null,
  quantity     numeric not null default 1,
  unit         text not null default 'serving',
  calories     numeric not null,
  protein_g    numeric not null default 0,
  carbs_g      numeric not null default 0,
  fat_g        numeric not null default 0,
  source       text not null default 'estimated' check (source in ('estimated', 'exact')),
  created_at   timestamptz not null default now()
);

create index if not exists food_entries_household_date_idx
  on food_entries (household_id, logged_date);

alter table food_entries enable row level security;

create policy "food_entries_select_household" on food_entries
  for select using (is_household_member(household_id));

create policy "food_entries_insert_own" on food_entries
  for insert with check (is_household_member(household_id) and user_id = auth.uid());

create policy "food_entries_update_own" on food_entries
  for update using (user_id = auth.uid());

create policy "food_entries_delete_own" on food_entries
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- daily_targets
-- One row per user. Visible to the household (so you can see how close your
-- partner is to their own target) but only editable by its owner.
-- ---------------------------------------------------------------------------
create table if not exists daily_targets (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  calories     numeric not null default 2000,
  protein_g    numeric not null default 150,
  carbs_g      numeric not null default 200,
  fat_g        numeric not null default 65,
  updated_at   timestamptz not null default now()
);

alter table daily_targets enable row level security;

create policy "daily_targets_select_household" on daily_targets
  for select using (is_household_member(household_id));

create policy "daily_targets_upsert_own" on daily_targets
  for insert with check (user_id = auth.uid() and is_household_member(household_id));

create policy "daily_targets_update_own" on daily_targets
  for update using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Household setup functions. Defined last since they touch every table
-- above (RPCs the client calls instead of raw inserts, since joining a
-- household needs to bypass the normal RLS/insert policies).
-- ---------------------------------------------------------------------------

-- Create a new household and make the caller its owner. Returns the new id.
create or replace function create_household(p_name text default 'My Household')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_code text;
begin
  -- 6-char, human-typeable invite code (uppercase letters + digits).
  v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  insert into households (name, invite_code) values (p_name, v_code)
  returning id into v_id;

  insert into household_members (household_id, user_id, role)
  values (v_id, auth.uid(), 'owner');

  -- Give the creator a default target row immediately so the Today page
  -- has something to show progress against before they visit Settings.
  insert into daily_targets (user_id, household_id) values (auth.uid(), v_id)
  on conflict (user_id) do nothing;

  return v_id;
end;
$$;

grant execute on function create_household(text) to authenticated;

-- Join an existing household by invite code. Returns the household id.
create or replace function join_household(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from households where invite_code = upper(p_code);

  if v_id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into household_members (household_id, user_id, role)
  values (v_id, auth.uid(), 'member')
  on conflict (user_id) do update set household_id = excluded.household_id;

  insert into daily_targets (user_id, household_id) values (auth.uid(), v_id)
  on conflict (user_id) do update set household_id = excluded.household_id;

  return v_id;
end;
$$;

grant execute on function join_household(text) to authenticated;
