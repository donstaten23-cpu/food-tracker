# Food Tracker

A shared calorie/macro tracker for two people. Enter a food's numbers once —
from a nutrition label, a recipe you've calculated, wherever — and it's
saved as a preset you can log again with one tap from then on. Organized by
breakfast/lunch/dinner/snacks, with daily targets and a 14-day history chart.

This is a separate app from `personal-dashboard-tracker`, but it deliberately
reuses **the same Supabase project** — so the same login works for both, and
there's one Supabase Auth to manage instead of two.

There's no external API, no AI estimation, and nothing metered by usage —
just your own data in your own Supabase project. The only ongoing cost is
whatever Supabase itself charges (free tier is comfortably enough for two
people logging meals).

## Stack

- React + Vite, plain JS (no TypeScript)
- Supabase (Postgres + Auth), same project as the dashboard — no other
  backend

## One-time setup

### 1. Database schema

Supabase Dashboard → SQL Editor → paste and run
[`supabase/migrations/0001_food_tracker_schema.sql`](supabase/migrations/0001_food_tracker_schema.sql).

This creates `households`, `household_members`, `foods`, `food_entries`,
`daily_targets`, and two RPC functions (`create_household`, `join_household`)
the app uses for the onboarding screen. All new tables — nothing in this
migration touches the dashboard's existing tables.

If you ran an older copy of `0001` before it had the `last_used_at` column
(you'll see "Could not find the 'last_used_at' column" when importing or
using Quick add), also run
[`0002_foods_last_used_at.sql`](supabase/migrations/0002_foods_last_used_at.sql).
It's safe to run either way.

### 2. App environment

```
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Supabase
Dashboard → Project Settings → API (same project as the dashboard — these
are the same two values it already uses).

### 3. Install and run

```
npm install
npm run dev
```

### 4. Sign in and link the household

Sign in with your existing dashboard account (or sign up — same
Supabase Auth). On first login you'll be asked to create a household or
join one with an invite code:

1. You create a household — you'll land on Settings, which shows an invite
   code.
2. Your wife signs in (or signs up) on her own device, and enters that code
   on the "join household" screen.

Once both of you are in the same household, you'll see a shared food catalog
(for quick re-adding things either of you has logged before) and each other's
daily calorie total on the Today page — but each person's individual entries
and targets stay separately owned/editable.

## How logging works

- **New food** — the first time you eat something, type in its numbers
  (from a label, a recipe, wherever you look it up) and log it. This also
  saves it to your household's preset list.
- **Quick add** — everything you've logged before shows up here, most
  recently used first, searchable. Tap to re-log at its usual amount, or
  adjust the quantity first (it scales the macros for you) — no re-typing
  numbers.

Over time nearly everything you eat regularly ends up in Quick add, so
logging becomes mostly one-tap.

## Deploying

This is a static Vite build (`npm run build` → `dist/`) — deploy it anywhere
that serves static files (Netlify, Vercel, GitHub Pages, Cloudflare Pages,
etc.). No server-side rendering or Node runtime needed.
