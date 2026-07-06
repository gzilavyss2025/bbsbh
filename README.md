# bbsbh — Baseball Scorebook Helper

A **spoiler-safe, read-only second-screen companion** for scoring baseball
games by hand in a paper scorebook. It pulls live data from the public MLB
Stats API and shows lineups, umpires, and inning-by-inning totals — but every
score-revealing number stays **sealed** until you tap to reveal it.

It is **not** a data-entry tool. You keep scoring on paper; this app only
displays, on a delay, without spoiling you.

React + Vite • installable PWA • phone-first (iPhone) • no backend.

---

## The spoiler rule (the whole point of the app)

Enforced in `src/components/SealBox.jsx` and `src/screens/InningViewer.jsx`:

1. **Sealed numbers never exist in the DOM until reveal.** Values are computed
   in the revealed branch only — there is no fetched-then-hidden node to leak.
   Score-revealing selectors live in their own modules (`api/linescore.js`,
   `api/derive.js`) and are only called from inside a `SealBox`'s reveal.
2. **Each inning re-seals on navigation.** The inning panel is keyed by inning
   number, so moving Back/Next remounts a fresh, sealed box.
3. **Reveal is one-directional.** Once revealed it stays revealed — a stray
   double-tap can't flash-and-rehide.
4. **Global "Reveal score" is gated** behind a confirmation sheet.

---

## Local development

```bash
npm install
npm run dev        # dev server
npm run build      # production build → dist/
npm run preview    # serve the built app
```

### Team logos (and sketch references)

Team logos come from MLB's own logo CDN, keyed by the same team ids the app
already uses for schedule and box-score data — no bundled assets or extra
dependency. Every club (MLB and MiLB) is drawn to one square SVG viewBox, so
dimensions are identical everywhere and the art scales cleanly to any size.

- Helper: `teamLogoUrl(teamId)` in `src/lib/teams.js`.
- Rendering: `src/components/TeamLogo.jsx`, used in the game slate and each
  team-info header. It falls back to a text monogram when a lower-level MiLB
  club has no CDN logo, so a broken image never appears.
- **Reference for hand-sketching:** open a logo directly at any size, e.g.
  `https://www.mlbstatic.com/team-logos/158.svg` (158 = Brewers). Because it's
  SVG it stays crisp zoomed in — handy when tracing or sketching by eye.

App icons are generated from `public/icons/icon.svg`:

```bash
node scripts/gen-icons.mjs   # rasterizes the SVG into the PWA PNG sizes
```

---

## How it's built

- **No backend.** Every device queries the public MLB Stats API directly
  (`https://statsapi.mlb.com`). There is no auth, database, or synced state.
- **Data layer** (`src/api/`):
  - `mlb.js` — schedule, game feed, and the separate `/teams/{id}/coaches`
    call for managers (they are **not** in the live feed).
  - `select.js` — spoiler-free selectors (lineups, umpires, venue, weather).
  - `linescore.js` — per-inning R/H/E/LOB. **Reveal-only.**
  - `derive.js` — Pitches / Whiffs / 1st-pitch strikes / rolling pitch count,
    computed from play-by-play (not pre-totaled anywhere). **Reveal-only.**
- **Screens** (`src/screens/`): game select → away info → home info → innings.
- **PWA**: `vite-plugin-pwa` provides the manifest, icons, and offline shell.
  MLB API requests are `NetworkOnly` so a stale (spoiler-revealing) score is
  never served from cache.

### Derived stat definitions (`api/derive.js`)

- **Whiff** = swinging strike (pitch call code `S` or `W`).
- **1st-pitch strike** = the plate appearance's first pitch is anything except
  a ball / intentional ball / pitchout / HBP (called & swinging strikes,
  fouls, and balls-in-play all count).
- **Total pitches (rolling)** = cumulative pitches for that pitching side
  through the current inning.

---

## Deploy to Vercel

1. Push this repo to GitHub.
2. On [vercel.com](https://vercel.com), **Add New… → Project**, import the
   repo. Vercel auto-detects **Vite** — keep the defaults and **Deploy**.
3. Open the resulting `*.vercel.app` URL in **Safari** on iPhone → **Share** →
   **Add to Home Screen**. It launches full-screen like a native app.

Every push to the connected branch auto-deploys; reopen the home-screen app to
get the update (no re-install).

---

## Phase 2 — not yet built (see brief §5)

- **Weather fallback for MiLB parks** (MLB already returns weather; only the
  minors need a stadium-coordinate + weather-API fallback).
- **Boxscore web link.** The canonical public `mlb.com` boxscore URL pattern
  still needs verifying against a live game before hardcoding — it could not
  be reached from the build environment. `gamePk` is the key ingredient.
- Richer **"game hasn't started yet"** handling and auto-refresh.

MiLB fields (lineups, weather, coaches) are less reliable than MLB, so every
screen degrades gracefully to "not posted yet / —" rather than assuming a
field is present.
