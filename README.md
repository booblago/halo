# HALO — Deep-work OS

**HALO** is a quiet instrument for intentional deep work. Plan the week as stacked hour lanes, drop into a focus session with a synthesized ambient mixer, and watch capacity become a euro projection — with optional cloud sync.

Custom SVG planning, Web Audio atmosphere, a live canvas field, and Neon Postgres accounts in one composition.

## Why it looks hard

Most demos stop at CRUD lists. HALO stacks three non-trivial front-end systems:

1. **Week runway** — seven animated day lanes with stacked deep/admin hours and a utilization meter
2. **Focus studio** — Web Audio ambient graph (Drift / Rain / Room) with no external audio files
3. **Live canvas visualizer** — 2D waveform + pulse bars driven by analyser energy

Plus EUR projection from hourly rate × booked hours, a 12-week deep-work heatmap, and durable `localStorage` state.

## Features

- Brand-first shell with a single primary composition
- Click any day on the ring (or legend) to add / edit deep-work or admin arcs
- Center utilization % and projected weekly EUR (`de-DE` currency formatting)
- Focus timer presets (25 / 50 / 90) with start, pause, complete
- Completed sessions land hours on the selected day and feed the heatmap
- Ambient mixer with per-layer gain and mute-all
- Optional accounts: create / sign in, week state syncs to Neon Postgres on Vercel
- Still works offline in `localStorage` when signed out
- Responsive layout for desktop and mobile

## How to run

Open `index.html` in a modern browser (Chrome or Edge recommended for Web Audio).

Or from this folder:

```bash
# optional local server
npx --yes serve .
```

Then open the printed local URL. Click **Start focus** once to unlock audio (browser autoplay policy).

## Stack

- HTML / CSS / JavaScript (no build step)
- Vercel Functions + Neon Postgres for accounts / sync
- SVG · Canvas 2D · Web Audio API
- Google Fonts: Syne + DM Sans

## Cloud sync

1. Click **Account** → **Create account**
2. Email + password are stored hashed in Neon
3. Week plan / sessions sync via `/api/state`

Local:

```bash
npm install
npx vercel env pull .env.local
npm run db:init
npx vercel dev
```

## Project structure

| Path        | Role                                         |
| ----------- | -------------------------------------------- |
| `index.html` | Shell UI                                    |
| `styles.css` | Theme, layout, motion                       |
| `app.js`     | State, week runway, sessions, account sync  |
| `audio.js`   | Ambient mixer graph                         |
| `viz.js`     | Canvas waveform visualizer                  |
| `motion.js`  | Pointer wash + dust field                   |
| `api/`       | Auth + state sync (Vercel Functions)        |
| `scripts/`   | DB init helpers                             |

## License

MIT
