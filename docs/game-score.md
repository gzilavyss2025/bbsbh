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
score = clamp(2.0 + drama + action + spectacle + dominance − dud, 0, 10), rounded to 0.1
```

Five buckets, each capped so many game shapes collide onto one displayed value
(a "10" can be a walk-off, a lead-trading slugfest, a perfect game, or a 3-HR
night). **A game can reach 10 without a walk-off or extras** — saturating any
axis, or blending a few, gets there.

**drama** (cap 5.0):

| Factor | Cap | Why it matters |
|---|---|---|
| Lead changes / ties | 1.5 | every flip is a page-turn in the scorebook |
| Largest comeback | 1.2 | a rally means dense, consequential innings |
| Late & close (margin ≤1 from the 7th on) | 0.8 | every pitch matters at the end |
| Extra innings | 1.0 | bonus baseball, guaranteed tension |
| Walk-off | 0.8 | the single best ending in the sport |
| Low-score tension (margin ≤2, ≤6 total runs) | 1.3 | a 1-0 duel is gripping with no lead change |

**action** (capped per-factor): total runs (1.2), loser's runs (0.6, both
dugouts alive), scoring spread across halves (0.7).

**spectacle** (cap 1.5): clutch HRs (0.5 ea, tie/go-ahead 7th+, 2 max), an
offensive feat (cycle 0.6 > grand slam 0.4), HR count (0.4).

**dominance** (cap 7.5) — the co-equal axis for a historic *individual*
performance, read from the boxscore, either side of the ball:

| Component | Source |
|---|---|
| Best **pitching** line — suppression (`o·0.16 − h·0.55`) + Ks + deep/walkless bonus | `boxscore` pitchers, ≥5 IP |
| Best **batting** line — total bases, 4+ hits, multi-HR (RBI de-weighted, blowout-proof) | `boxscore` batters |
| Combined-team shutout, only if ≤3 hits allowed | linescore hit totals |

Take the best of the three, subtract a **floor** (`DOM_FLOOR = 2.0`), **gain**-
amplify (`× 1.5`), apply the **career-arc**, and add a floor-exempt **arc
bonus**: `min(7.5, max(0, best − 2.0)·1.5·arc + 0.6·(arc−1)·min(best,4))`. The
floor keeps this axis from lifting the *typical* game (a routine quality start
nets ~0); the gain restores the peaks; the arc bonus keeps a short-but-electric
edge-of-career gem (a 5-inning debut) above the field without moving the median,
since prime players (`arc === 1`) get zero from it. Dominance **cancels the dud**
(−0.5 each) so a gem or a monster line isn't dismissed as a blowout.

### The career-arc modifier

A reverse bell — a dominant line at either edge of a career is more worth
scoring than the same line in a prime season. **MLB**: MLB debut ×1.5, tapering
across the first ~1.5 seasons to ×1.0, flat through the prime, rising with age
(×1.0 at 35 → ×1.5 at 40+). **MiLB** (no meaningful MLB debut): *young-for-level*
instead — a 19yo dominating AA (norm ~23.5) earns ×1.45; an age-appropriate 23yo
earns ~×1.0. Level norms in `LEVEL_BASELINE_AGE`. Uses `gameData` bios
(`birthDate`/`mlbDebutDate`), no extra fetch.

## Calibration anchors

Rescored against the full 2026 population (all levels): median ~5.5, 10s ~2–3%.
Roughly percentile anchors, not vibes:

- **9–10** (top ~3%) — a complete-game 15-K one-hitter (Misiorowski vs PHI,
  2026-06-12 → **10**, even though it was 6-0); Verlander's 7 IP / 2 H / 8 K at
  42 (dominance × twilight arc); a 3-HR / 6-RBI night in a competitive game; an
  11-inning walk-off with drama saturated. Multiple routes to the top, by design.
- **6–7** — a rookie's electric MLB-debut gem (5 no-hit IP, held up by the arc
  bonus); a taut 1-0 pitchers' duel; a two-way MiLB nailbiter.
- **~5** (median) — an ordinary 5-3: one lead change, some scoring, not dead.
- **2.5–3.5** — a blowout (a 17-2 laugher stays ~2.6). A merely *good* start in a
  blowout no longer rescues much — only a genuine gem/monster clears the floor.
- **1.5–2.5** — a 12-0 laugher, near-zero on every axis. (A truly dominant line
  is the one thing that pulls a lopsided score back up — it's still worth
  scoring.)

## Data scope

MLB + the four full-season MiLB levels (`SWEPT_SPORT_IDS = [1, 11, 12, 13,
14]`, the same set `gen-callouts.mjs` sweeps). Regular season only (`gameType
'R'` — spring training/exhibition games are skipped, they aren't "the
season"). Deliberately never touches `winProbability` (MLB-only) — every
factor comes from the live feed's linescore + play-by-play + **boxscore**
(individual lines for the dominance axis) + **gameData** bios (for the arc),
which every level carries. A thin MiLB box score just degrades dominance to 0.

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

A full backfill (folding in a new season, a storage-shape change, or a
**formula change** — a Final game is otherwise never recomputed) is a one-time
hand-run **`--rescore`**, which re-scores every gamePk already in the file (plus
the trailing window) with checkpointing every 200 games so a long run resumes
cleanly. `computeGameScore` is exported and the sweep is guarded to run only as
the entry point, so the formula is importable for tests without a live fetch.
