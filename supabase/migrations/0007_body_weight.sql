-- Body weight log for progress tracking. Kept private to each user (not
-- shared with the household like food_entries) since weight is personal.
--
-- One row per user per day (unique constraint) so logging again the same
-- day updates that day's entry instead of piling up duplicates.
--
-- Run this once in the Supabase Dashboard -> SQL Editor.

create table if not exists body_weights (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  logged_date  date not null default (now() at time zone 'utc')::date,
  weight_lb    numeric not null,
  created_at   timestamptz not null default now(),
  unique (user_id, logged_date)
);

alter table body_weights enable row level security;

create policy "body_weights_select_own" on body_weights
  for select using (user_id = auth.uid());

create policy "body_weights_insert_own" on body_weights
  for insert with check (user_id = auth.uid());

create policy "body_weights_update_own" on body_weights
  for update using (user_id = auth.uid());

create policy "body_weights_delete_own" on body_weights
  for delete using (user_id = auth.uid());
