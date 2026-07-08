---
name: run
description: Launch bbsbh's dev server and drive it with Playwright to verify a change
---

# Running and verifying bbsbh

This is a phone-first PWA with no backend — every screen fetches live from
`statsapi.mlb.com`. There's no test suite (see CLAUDE.md); verification means
actually loading screens in a browser. This skill exists to cut the token/time
cost of that loop: fixed port, no port-discovery, no manual server
start/stop/poll cycle, and a pinned set of real games with known-rare events
so you're not hunting for a live game each session.

## Fast path: Playwright (preferred)

`playwright.config.js` at the repo root auto-starts `npm run dev` on a fixed
port (`5173`, `strictPort: true` in `vite.config.js`) and reuses it if one's
already running — no separate "start dev server, poll for ready" step needed.

For a one-off check, write a small spec under `e2e/` (or reuse/extend
`e2e/smoke.spec.js`) and run:

```bash
npx playwright test e2e/smoke.spec.js        # single file
npx playwright test -g "innings viewer"       # by test name
```

Use `page.screenshot()` sparingly — prefer assertions (`expect(locator)...`)
over eyeballing screenshots; they're cheaper and don't need a human/model to
interpret. Reach for a screenshot only when checking actual visual layout.

Delete throwaway specs when done; keep `e2e/smoke.spec.js` as the one
long-lived example (slate loads, a pinned game's lineup and box score render).
This is a verification harness, not a CI-enforced regression suite — see
CLAUDE.md's "no test suite" note, which is still true in spirit.

## Manual path (only if Playwright MCP tools are what's available)

```bash
npm run dev     # binds :5173 (strictPort — fails loudly instead of drifting to :5174 if occupied)
```

Ready when the terminal prints `ready in`. Navigate directly to
`http://localhost:5173/{route}` — don't hit `/` and click through if you
already know the route (see below). Kill the server when done
(`run_in_background` + stop, or Ctrl-C) — don't leave it orphaned across
turns, it'll collide with the next `strictPort` start.

## Routes, so you don't have to derive them

`/{MMDDYYYY}/{away}{home}/{section}` — team abbrs lowercased, game 2 of a
doubleheader appends `-2` to the matchup (e.g. `milstl-2`). Sections:
`lineup1`, `lineup2`, `top{n}` / `bottom{n}`, `boxscore`.

## Pinned test games

A game resolved once by date+matchup is a game you don't have to re-resolve.
These are verified-real gamePks chosen for rare/unusual in-game events, so
they exercise edge cases a routine game won't. See `docs/test-games.md` for
the full pack with details on what each one exercises and why.

Quick reference (anchor game, verified 2026-07-08):
- **2026-07-07 MIL@STL game 2**, gamePk `823035`, route base
  `/07072026/milstl-2/` — pinch runners, defensive subs who returned to their
  starting position mid-game, a position player pitching, replay challenges.
  Final: MIL 10, STL 2. (This is the game that motivated the
  `isPitcherByTrade`/`allPositions` fixes noted in CLAUDE.md.)

More games (rare events: triple play, immaculate inning, batting out of
order, extreme extras, MiLB thin data, etc.) are catalogued in
`docs/test-games.md` — check there before assuming you need to find a new one.
