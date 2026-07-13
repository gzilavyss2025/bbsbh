# Game Score — the 0.0–10.0 "how exciting was this game" rating

Shown as `FINAL · 7.5` on a slate card (`GameCard.jsx`), gated behind the
`useGameScoreVisible` toggle (off by default — set from `FavoriteTeamModal`).
Computed by `scripts/gen-game-score.mjs`, read via `src/api/gameScore.js`. See
ADR-0015 for *why* this one number is allowed to render outside a `SealBox`
despite being derived from score-revealing data — read that before touching
the formula's factor caps.

This is **not** the Bill James pitching Game Score
(`src/api/performanceScore.js`) — that rates one pitcher's start; this rates
the whole game's entertainment value, for a reader deciding which of
tonight's finished games is worth their scoring time.

## Formula

Additive composite, base 2.0 (every completed game earns something):

```
score = clamp(2.0 + drama + action + spectacle − dud, 0, 10), rounded to 0.1
```

| Factor | Cap | Source | Why it matters |
|---|---|---|---|
| Lead changes / ties | 1.5 | running score per play | every flip is a page-turn in the scorebook |
| Largest comeback | 1.2 | winner's max deficit | a rally means dense, consequential innings to score |
| Late & close (margin ≤1 from the 7th on, or scaled for a shorter game) | 0.8 | running score + inning | every pitch matters at the end |
| Extra innings | 1.0 | `innings.length − scheduledInnings` | bonus baseball, guaranteed tension |
| Walk-off | 0.8 | last play, bottom half, <3 outs | the single best ending in the sport |
| Total runs | 1.2 | final totals | more scoring action to write down |
| Loser's runs | 0.6 | final totals | distinguishes 6-5 from 6-0 — both dugouts alive |
| Scoring spread (halves with a run) | 0.7 | linescore innings | runs sprinkled around beats one inning then silence |
| Clutch HRs (tie/go-ahead, 7th+) | 0.5 ea, 2 max | play-by-play | late tying/go-ahead homers are peak drama |
| Rare feats (no-hit bid through the late-start inning > cycle > grand slam) | 1.0 | linescore hits / play-by-play | historic, worth having scored |
| HR count | 0.4 | play-by-play | mild spice |
| **Dud penalty** — margin beyond 3, plus a sloppy-game (4+ errors) ding | −2.0 | final totals | a 12-1 game is dead by the 5th |

`drama` sums the first five factors (cap 5.0), `action` the next three (no
extra cap needed — capped per-factor), `spectacle` the HR-related three
(cap 1.5), `dud` is subtracted.

## Calibration anchors

- **10.0** — 11-inning walk-off: 4+ lead changes, winner erased a 3-run
  deficit, a tying HR late, both teams hitting well. Nearly every factor
  saturated.
- **7.5** — nine-inning one-run game, a couple of lead changes, tied late,
  decided by a rally.
- **5.0** — an ordinary 5-3 game: one lead change, some mid-game scoring,
  effectively decided by the 7th but not dead.
- **3.0** — 6-1, winner cruised after an early lead.
- **1.0–2.0** — a 12-0 laugher: base 2.0, near-zero drama, the dud penalty
  near its cap. (A no-hit *blowout* is the one thing that pulls a lopsided
  score back up — correctly, since that's still worth having scored.)

## Data scope

MLB + the four full-season MiLB levels (`SWEPT_SPORT_IDS = [1, 11, 12, 13,
14]`, the same set `gen-callouts.mjs` sweeps). Regular season only (`gameType
'R'` — spring training/exhibition games are skipped, they aren't "the
season"). Deliberately never touches `winProbability` (MLB-only) — every
factor comes from the live feed's linescore + play-by-play, which every level
carries.

## Storage shape

Each `public/data/game-score.json` entry is keyed by gamePk:

```json
{ "score": 7.5, "sportId": 1, "homeId": 158, "awayId": 133 }
```

`sportId`/`homeId`/`awayId` come straight off the same live feed already
fetched to compute `score` (`feed.gameData.teams.{home,away}.id` /
`.sport.id`) — no extra call. Neither is score-revealing, and together they
let a caller (the Top Games page's level + favorite-team filters) filter the
whole season's pool without fetching per-game metadata separately.

## Pipeline

`scripts/gen-game-score.mjs` is APPEND-ONLY/incremental, mirroring
`gen-umpire-accuracy.mjs`: each run sweeps a trailing window of dates
(`--days`, default 3), fetches the live feed for every newly-Final gamePk not
already in `public/data/game-score.json`, scores it, and merges the result in
(deduped by gamePk — a Final game's score never changes, so it's never
recomputed). Runs on its own tight cron
(`.github/workflows/update-game-score.yml`, every 10 minutes) rather than the
once-nightly batch, so a score is normally available within ~10-15 minutes of
a game going Final.

A full-season backfill (folding in a new season, or a storage-shape change
like the one above) is a one-time hand-run: delete the JSON file so every
entry rebuilds in the current schema, then run with `--days` covering back to
the earliest sportId's `regularSeasonStartDate` for that season (see
`/api/v1/seasons?sportId={id}&season={year}`).
