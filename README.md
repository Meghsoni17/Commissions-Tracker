# Commission Tracker

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
- **Local-first** — all data is stored in your browser's `localStorage`; no
  account or server required. The app seeds itself with sample data on first
  run so the dashboard isn't empty — clear it any time from the banner.
- **Light/dark theme**, with an explicit toggle in addition to following your
  system setting.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL. To build a static production bundle:

```bash
npm run build
```

The output in `dist/` can be deployed to any static host (Vercel, Netlify,
GitHub Pages, etc.) — there is no backend.

## Stack

React + TypeScript + Vite, Tailwind CSS for styling, and Recharts for the
graphs.
