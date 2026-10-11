# HALO — Deep-work OS

**HALO** is a quiet instrument for intentional deep work. Plan the week as a radial halo of arcs, drop into a focus session with a synthesized ambient mixer, and watch capacity become a euro projection — entirely in the browser.

Built as a portfolio product piece: custom SVG planning, Web Audio atmosphere, and a live canvas field in one composition.

## Why it looks hard

Most demos stop at CRUD lists. HALO stacks three non-trivial front-end systems:

1. **Radial week planner** — custom SVG arcs, hit targets, and a utilization ring (not a table calendar)
2. **Focus studio** — Web Audio ambient graph (Drift / Rain / Room) with no external audio files
3. **Live canvas visualizer** — rings and spectrum driven by analyser energy during sessions

Plus EUR projection from hourly rate × booked hours, a 12-week deep-work heatmap, and durable `localStorage` state.

## Features

- Brand-first shell with a single primary composition
- Click any day on the ring (or legend) to add / edit deep-work or admin arcs
- Center utilization % and projected weekly EUR (`de-DE` currency formatting)
- Focus timer presets (25 / 50 / 90) with start, pause, complete
- Completed sessions land hours on the selected day and feed the heatmap
- Ambient mixer with per-layer gain and mute-all
- Privacy-first: no accounts, no backend, data stays in `localStorage`
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
- SVG · Canvas 2D · Web Audio API
- Google Fonts: Syne + DM Sans

## Project structure

| File         | Role                                      |
| ------------ | ----------------------------------------- |
| `index.html` | Shell UI                                  |
| `styles.css` | Theme, layout, motion                     |
| `app.js`     | State, radial week, sessions, persistence |
| `audio.js`   | Ambient mixer graph                       |
| `viz.js`     | Canvas visualizer loop                    |

## License

MIT — use it in your portfolio or as a starting point for client work.
