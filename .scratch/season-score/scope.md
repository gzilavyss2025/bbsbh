# Season Score — scope of work

**Status:** needs-triage · scoping only, no implementation yet
**Slug:** `season-score`

## Goal

A **0.0–10.0 Season Score** per MLB team — the season-level sibling of Game Score
(`docs/game-score.md`) — answering: *how is this team's season going relative to
what we had a right to expect?* Expectations means some blend of preseason
projections, recent-seasons history, and roster context (who left, who arrived).

Motivating example: the 2026 Brewers traded Freddy Peralta, Isaac Collins, and
Caleb Durbin off a franchise-record 97-win 2025, drew a Vegas over/under of
**84.5** and a PECOTA projection of **80.5** — so a mid-July record anywhere near
last year's pace is a dramatic over-performance the raw standings table doesn't
show.

### Anchor semantics (shared by all three plans)

- **5.0** — season going exactly as expected.
- **7–8** — clearly over-performing (Brewers 2026 as of mid-July should land here
  or higher under any sane calibration).
- **9–10** — historic over-performance (top ~3% of team-seasons vs expectations).
- **2–3** — clearly under-performing; **0–1** — a collapse.
- Rounded to 0.1 after summing, same as Game Score.

## Research findings that do the heavy lifting

(External research pass, 2026-07-14. Full brief preserved below in *Appendix*.)

1. **The free MLB Stats API standings endpoint already carries the "luck" axis.**
   `GET /api/v1/standings?leagueId=103|104&season=YYYY` returns `runsScored`,
   `runsAllowed`, `runDifferential`, **`expectedRecords` with `type: "xWinLoss"`
   (MLB's own Pythagorean record)**, and `splitRecords` including **`oneRun`** and
   **`extraInning`**. Plus `&date=YYYY-MM-DD` / `standingsTypes=byDate` for
   standings as of any day (trajectory). Zero third parties, zero licensing.
2. **Betting-market preseason win totals are the cleanest external baseline.**
   Factual market data (not copyrightable), 30 integers, hand-snapshotted once per
   season from VegasInsider/Covers into a static JSON. Brewers 2026: **84.5**.
   Historical seasons freely archived (sportsoddshistory.com, sportsbettingdime).
3. **Projection systems are cite-and-snapshot only.** FanGraphs Depth Charts /
   ZiPS (Brewers ~88–94, ZiPS narrative "~92") and PECOTA (80.5) have no public
   JSON API; a one-time manual snapshot with attribution is low-risk, live
   scraping is not. FiveThirtyEight Elo is frozen post-shutdown (historical
   reference only).
4. **The transactions endpoint detects departures programmatically.**
   `GET /api/v1/transactions?teamId={id}&startDate=…&endDate=…` gives who left
   (trade/release/FA) — join against our existing `war.json` /
   `war-history.json` (FanGraphs WAR precompute, already in the repo) to price
   what left.
5. **A prior-3-season Marcel-style baseline is fully self-computable**: weighted
   (3/2/1) win%, regressed to .500 (~0.30 season of .500 ball), from three
   `standings?season=YYYY` calls. A projection we own outright.
6. **Nobody publishes a machine-readable "season vs expectations" grade.** This
   is a genuine gap, not a re-implementation.

## Shared infrastructure (identical across plans)

Mirrors the Game Score pipeline — extend the established pattern, don't invent one:

- **Generator** `scripts/gen-season-score.mjs` → `public/data/season-score.json`,
  on the **nightly cron** (`update-nightly-data.yml`) — unlike Game Score, a
  season score only meaningfully changes once a day. Full rebuild each run (30
  rows; nothing append-only about it).
- **Seed file** `scripts/season-expectations-seed.json` — hand-curated once per
  season (like `milb-history-seed.json`): per team, the preseason O/U line and
  optionally projection-system numbers, with source + date fields. **Edit the
  seed, never the output.**
- **Storage shape** (per teamId):
  `{ "score": 7.4, "asOf": "2026-07-13", "baseline": 84.5, "paceWins": 96, … }`
  plus whichever sub-components the chosen plan surfaces (for a breakdown modal,
  the `GameScoreModal` pattern).
- **Reader** `src/api/seasonScore.js`, same shape as `gameScore.js`.
- **Surfaces**: the Team page header, next to the already-unsealed W–L record /
  standings block (`TeamPage.jsx`); optionally later as a small badge on
  GameSelect team rows and a league-wide "Season Watch" table.
- **Spoiler analysis + ADR** (required before shipping): the Team page already
  renders record and division standings unsealed, gated by the `asOf` /
  `dayBefore(asOf)` convention ("entering today"). A season score derived from
  standings is the same exposure class — **but** it must respect `asOf` the same
  way (when viewing a past game, show the score *entering that day*, or hide it),
  and it must never leak *today's* result via a mid-day update (nightly cron +
  `asOf` stamp handles this). Write ADR-00xx documenting this, referencing
  ADR-0015's reasoning style.
- **MLB-only for v1.** MiLB standings exist but expectations baselines don't;
  degrade to "no score" per the MiLB-degrades-gracefully convention.

---

## Plan A — "The Line" (market-anchored composite) — *recommended*

The season score is fundamentally **pace vs. the preseason betting line**,
adjusted by sustainability and context. Closest in spirit to Game Score: an
additive composite of capped factors around a base of 5.0.

```
score = clamp(5.0 + expectation + luckAdj + trajectory + context, 0, 10)
```

| Bucket | Cap | Source | What it measures |
|---|---|---|---|
| **expectation** | ±3.5 | seed O/U vs current 162-game pace | wins above/below the line, prorated; a saturating curve (e.g. tanh) so +12 wins ≈ +3, +25 saturates |
| **luckAdj** | ±1.0 | API `xWinLoss` + `oneRun` split | Pythag says the record is earned (small boost) vs. smoke-and-mirrors (haircut); keeps a lucky 10 honest |
| **trajectory** | ±0.8 | standings `byDate` (30/60-day window) | surging vs. fading — same record trending up scores above trending down |
| **context** | 0 to +0.7 | transactions + `war.json` | roster-churn bonus: over-performing *after shedding WAR* (the Peralta case) counts extra; never a penalty (churn alone isn't failure) |

- **Early-season damping:** multiply the non-base component by
  `min(1, gamesPlayed / 60)` so April noise can't produce a 9.
- **Fallback baseline:** if a team is missing from the seed, fall back to the
  Marcel baseline (Plan B's core) so the score never fails to exist.
- **Effort:** ~2–3 sessions. Seed curation (30 lines) + generator + reader +
  Team page surface + ADR + calibration pass against 2024–2025 back-computed
  seasons (historical O/U lines are freely archived, so we can backtest).
- **Risks:** the seed is a hand-maintained yearly ritual (mitigated: one file,
  once per February, with the Marcel fallback if skipped). Single-baseline
  sensitivity — PECOTA vs Vegas vs ZiPS spans 80.5→92 for the same team — is
  mitigated by storing the baseline in the output so the UI can show it.

## Plan B — "Own the Math" (fully self-contained, zero third parties)

No seed file, no external sources, nothing to curate: the expectation baseline is
computed entirely from the MLB Stats API, so the score works forever, for any
season, unattended — the same self-sufficiency bar as the rest of the app.

- **Baseline:** Marcel-style regressed record — prior three seasons' win%
  weighted 3/2/1, regressed to .500 by adding ~50 games of .500 ball. (Brewers:
  2025's 97-65 dominates, so the baseline lands ~86–88 — notably close to the
  actual Vegas line, which is the classic result for this method.)
- **Roster-churn adjustment to the baseline itself** (this is where B gets
  interesting): price the offseason using transactions + `war-history.json` —
  `baseline − k × (WAR departed − WAR arrived)`, capped. Losing Peralta/Collins/
  Durbin *lowers* the expectation, so the same 2026 record scores as a bigger
  over-performance. This is a crude Depth-Charts-at-home, but it's *ours*.
- **Scoring transform:** rather than hand-tuned caps, map the pace-vs-baseline
  delta through a **Monte-Carlo percentile**: simulate the season 10k times with
  the baseline win% as true talent (binomial per game is fine), find the
  percentile of the team's actual current record within that distribution, map
  percentile → 0–10. A 10 literally means "a top-2% outcome given what this
  roster projected to be." Self-calibrating; no anchor-tuning sessions.
- Same luck/trajectory adjustments as Plan A, same damping.
- **Effort:** ~3–4 sessions (the churn-pricing and simulation are new math, and
  the simulation needs a seeded PRNG for reproducible nightly output).
- **Risks:** Marcel is blind to *why* rosters change (it prices the Peralta
  trade only via WAR, missing prospect arrivals with no MLB WAR history);
  regression constants need a backtest against ~10 historical seasons to feel
  honest. No market wisdom: a team every model knew was tanking still shows a
  high prior-seasons baseline.

## Plan C — "Ship of Theseus" (out of left field)

Don't score the *record* against expectations at all — score **where the wins
are coming from**. The premise: a season over-performs when production comes from
players nobody counted on. The Brewers feel special not because 96-win pace beats
84.5, but because they're doing it *after shipping out the guys who earned the
97*. Measure that directly.

- **Preseason "expected WAR map":** at season start (or reconstructed from
  Opening Day rosters via the API), each player on the roster carries his prior
  established level — last-2-year WAR from `war-history.json`, age-adjusted.
  Departed players (transactions endpoint) carry theirs *out*.
- **In-season "actual WAR map":** current-season `war.json` (already precomputed
  nightly), attributed per team.
- **The score is a found-money ratio**, blended from three sub-axes:
  1. **Found money** (cap ~4): share of the team's current WAR produced by
     players with little/no prior established WAR on this team — rookies,
     scrap-heap signings, breakouts. High = the org conjured a team from nothing.
  2. **Absorbed losses** (cap ~3): WAR that walked out the door (Peralta et al.)
     as a fraction of last season's team WAR, *credited only if the team is at or
     above .500* — surviving amputation scores, bleeding out doesn't.
  3. **Record reality check** (±3): the team still has to actually be winning —
     a pace-vs-Marcel term (Plan B's core, small) so a 55-win team of delightful
     rookies can't score an 8.
- **What makes it unique:** no one publishes this. It's a *narrative* metric — it
  ranks the 2026 Brewers above a 96-win team that simply ran back a 95-win
  roster, which is exactly the intuition in the motivating example, and it
  produces genuinely different information from the standings table (Plan A/B
  mostly re-render "games above the line" — C tells you something you can't
  eyeball). It also reuses the most infrastructure: `war.json`,
  `war-history.json`, and the transactions scan pattern from `gen-rehab.mjs`
  already exist.
- **Effort:** ~4–5 sessions. Player→team WAR attribution across midseason trades
  is the hard part (a traded player's WAR splits across stints; FanGraphs bulk
  data has team stints, needs verification). Calibration is genuinely novel — no
  external anchor to check against, so it needs a backtest gallery (2024 Royals,
  2023 Orioles, 2019 Twins…) reviewed by eye.
- **Risks:** WAR-dependency chains the score to the unofficial FanGraphs bulk
  endpoint (already a repo-wide dependency, but this deepens it); early-season
  WAR is noisy (damp harder, `gamesPlayed/80`); "established level" definitions
  are debatable and will need an honest write-up in the doc.

---

## Comparison & recommendation

| | A — The Line | B — Own the Math | C — Ship of Theseus |
|---|---|---|---|
| Baseline | Vegas O/U (seed) | Marcel + churn pricing | Expected-WAR map |
| Third-party exposure | 30 hand-copied integers/yr | none | FanGraphs WAR (existing) |
| Annual maintenance | seed file each Feb | none | none |
| Novelty | low (but legible) | medium | high |
| Matches the Brewers intuition | well | well | *exactly* |
| Effort | 2–3 sessions | 3–4 | 4–5 |

**Recommendation: build A first, with B's Marcel baseline as its built-in
fallback** (they share the generator skeleton, luck axis, trajectory axis, and
damping — B is mostly a config of A). Ship C second as a *companion axis* rather
than a competitor: the storage shape already reserves room for sub-components,
so `season-score.json` can later carry both `score` (A/B) and `theseus` (C), and
the Team page breakdown modal can tell both stories.

## Milestones

1. **M0 — decision + ADR.** Pick the plan (or the A+B hybrid), write the ADR
   (unsealed-rendering + `asOf` rules), create the seed-file format.
2. **M1 — generator + backtest.** `gen-season-score.mjs` runnable against 2024
   and 2025 (historical O/U lines + API historical standings), calibration
   anchors documented in `docs/season-score.md` (sibling of `docs/game-score.md`).
3. **M2 — reader + Team page surface**, `asOf`-aware, MiLB-degrades check,
   `npm run lint` / `npm run e2e` green.
4. **M3 — nightly cron wiring** + seed the 2026 season, verify Brewers land 7+.
5. **M4 (later)** — Ship of Theseus companion axis; league-wide table surface.

## Appendix — external research brief (2026-07-14)

Key retained facts (full agent brief summarized):

- **Brewers 2026:** Vegas O/U **84.5** (post-Peralta trade); PECOTA **80.5**
  (2nd NL Central behind Cubs ~90.5); ZiPS/FG Depth Charts ~88–94 ("~92"
  narrative). 2025 actual: **97–65**, 1st NL Central, franchise record, swept by
  LAD in NLCS. The Brewers have beaten their preseason O/U in 8 of the last 9
  full seasons — the market is systematically low on this franchise (good
  narrative, known bias).
- **Standings endpoint fields (verified vs 2025 response — re-verify on a 2026
  in-season pull):** `runsScored/runsAllowed/runDifferential`,
  `expectedRecords[].type: "xWinLoss" | "xWinLossSeason"`, `splitRecords`
  (`oneRun`, `extraInning`, home/away/day/night/lastTen/…), `streak`,
  `divisionRank/leagueRank/sportRank/wildCardRank`, `gamesBack`. Historical:
  `&date=YYYY-MM-DD`, `standingsTypes=byDate`.
- **Transactions:** `/api/v1/transactions?teamId=&startDate=&endDate=` (dates
  required) → person, from/to team, typeCode (TR/REL/SFA), description.
- **Historical preseason O/U archives (free):** sportsoddshistory.com/mlb-odds,
  sportsbettingdime.com …/past-seasons (2018+).
- **Projection sources:** FanGraphs projected standings / playoff odds (JS
  pages, no public JSON, cite-and-snapshot only); PECOTA (subscriber
  spreadsheet; headline numbers leak into free MLB.com article each Feb);
  Clay Davenport (claydavenport.com, plain HTML, most scrape-friendly);
  FiveThirtyEight Elo (github.com/fivethirtyeight/data/tree/master/mlb-elo,
  **frozen post-shutdown**, historical only).
- Pythagenpat if we compute our own: `exp = ((RS+RA)/G)^0.287`.
