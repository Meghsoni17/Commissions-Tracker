# CommTrack

A personal dashboard for tracking sales commissions week to week and month to
month, across multiple roles.

## Features

- **Multiple roles** — add a role for every way you earn commission (Closer,
  Setter, Account Executive, etc.); each tracks its own numbers independently.
- **Weekly logging** — record calls booked, showed, and closed, plus the
  commission earned, for any role/week.
- **Automatic rates** — show rate (showed ÷ booked) and close rate (closed ÷
  showed) are calculated for you, per role and overall.
- **Dashboard** — this week vs. last week and this month vs. last month
  commission deltas, all-time totals, and a per-role breakdown table.
- **Charts** — commission by role over the last 8 weeks or 6 months, and a
  show-rate/close-rate comparison across roles.
- **Cloud sync** — data is stored in Supabase under your account, so it shows up
  on every device and browser after you sign in (email + password or magic
  link). Row Level Security means each account can only read and write its own
  rows. A 6-digit PIN (shared across your devices) locks the app on top of that.
- **Import local data** — if a browser has data from the older local-only
  version, a one-time **Import My Local Data** banner uploads it without
  creating duplicates.
- **Light/dark theme**, with an explicit toggle in addition to following your
  system setting.

## Getting started

1. Run `supabase/schema.sql` once in the Supabase dashboard (SQL Editor → New
   query → paste → Run). It creates the tables, Row Level Security policies
   and grants.
2. Put your project's values in `.env` (see `.env.example`):

   ```
   SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_ANON_KEY=<anon public key>
   ```

   The same two variables must be set in Vercel. `vite.config.ts` exposes the
   `SUPABASE_` prefix to the app.
3. In Supabase → Authentication, enable the Email provider and add your site
   URL(s) to the allowed redirect URLs.

```bash
npm install
npm run dev
```

To build a static production bundle:

```bash
npm run build
```

The output in `dist/` can be deployed to any static host (Vercel, Netlify,
etc.); Supabase is the only backend.

## Stack

React + TypeScript + Vite, Tailwind CSS for styling, Recharts for the graphs,
and Supabase (Postgres + Auth) for storage and sign-in.
