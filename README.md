# Food Tracker

A shared calorie/macro tracker for two people. Describe what you ate in
plain language and Claude estimates the calories/macros, or enter exact
numbers yourself when you have them (packaging, a label, etc.). Log against
breakfast/lunch/dinner/snacks, track daily targets, and see history for the
last two weeks.

This is a separate app from `personal-dashboard-tracker`, but it deliberately
reuses **the same Supabase project** — so the same login works for both, and
there's one Supabase Auth to manage instead of two.

## Stack

- React + Vite, plain JS (no TypeScript)
- Supabase (Postgres + Auth + Edge Functions), same project as the dashboard
- A Supabase Edge Function (`estimate-food`) calls the Claude API server-side
  to turn a text description into a structured calorie/macro estimate
- [recharts](https://recharts.org/) for the history chart

## One-time setup

### 1. Database schema

Supabase Dashboard → SQL Editor → paste and run
[`supabase/migrations/0001_food_tracker_schema.sql`](supabase/migrations/0001_food_tracker_schema.sql).

This creates `households`, `household_members`, `foods`, `food_entries`,
`daily_targets`, and two RPC functions (`create_household`, `join_household`)
the app uses for the onboarding screen. All new tables — nothing in this
migration touches the dashboard's existing tables.

### 2. Edge Function

Supabase Dashboard → Edge Functions → Deploy a new function named
`estimate-food` → paste in
[`supabase/functions/estimate-food/index.ts`](supabase/functions/estimate-food/index.ts).

Then set its secret (Edge Functions → estimate-food → Secrets):

```
ANTHROPIC_API_KEY=sk-ant-...
```

Get a key from https://console.anthropic.com/settings/keys. `SUPABASE_URL`
and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically by the Edge
Functions runtime.

If you have the Supabase CLI installed, this is equivalent to:

```
supabase functions deploy estimate-food
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

### 3. App environment

```
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Supabase
Dashboard → Project Settings → API (same project as the dashboard — these
are the same two values it already uses).

### 4. Install and run

```
npm install
npm run dev
```

### 5. Sign in and link the household

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

- **Describe it** — type what you ate in plain English. It's sent to the
  `estimate-food` Edge Function, which asks Claude for a structured
  breakdown (per-item calories/protein/carbs/fat, with any assumptions noted)
  and logs it once you confirm.
- **Quick add** — anything logged before (estimated or exact) shows up here
  for one-tap re-logging.
- **Exact entry** — when you have real numbers (a nutrition label, a recipe
  you've calculated), enter them directly; these are marked `source: exact`
  and never touched by the estimator.

## Deploying

This is a static Vite build (`npm run build` → `dist/`) — deploy it anywhere
that serves static files (Netlify, Vercel, GitHub Pages, Cloudflare Pages,
etc.). No server-side rendering or Node runtime needed; the only backend
logic is the Supabase Edge Function above.
