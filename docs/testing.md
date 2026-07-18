# Testing

Two layers, deliberately split by what each can check cheaply and
deterministically.

## Unit suite — `npm test` (CI-gated)

Plain `node:test` over `test/*.test.js`, no transform step, so it covers the
**pure data layer only** (`.js` modules — not `.jsx` components, which would
need Vite's JSX transform). It runs on every PR via `.github/workflows/ci.yml`
alongside lint + build. Keep it fast and dependency-free; that's why it lives in
`node --test` rather than a framework.

What's covered:

| Area | File | What it pins |
| --- | --- | --- |
| Reveal-only derivations | `reveal-only.test.js` | `derive.js` / `linescore.js` / `pitchers.js` — the numbers that ARE the spoiler surface: per-inning pitches/whiffs/first-pitch strikes, R/H/E lines, reveal-gated pitcher lines, inherited-runner attribution |
| Pre-pitch selectors | `pre-pitch-selectors.test.js` | `defenseEntering` / `lineupEntering` self-gate to `revealedThrough + 1` (ADR-0010); one team's subs don't bleed into the other's card |
| Spoiler-gate primitives | `spoiler-gates.test.js` | `halfIndex`, `safeToShowEntering`, `selectPrePitchChanges` |
| Reveal ratchet | `reveal-progress-core.test.js` | `revealProgressCore.js` — the mark only moves forward; malformed storage can't over-reveal; extras unlock one at a time (ADR-0008) |
| Real-game invariant | `invariant-real-game.test.js` | the spoiler invariant on a **captured real feed** (see below) |
| Graceful degradation | `graceful-degradation.test.js` | every selector falls back to `''`/`[]`/`null` on sparse MiLB feeds instead of throwing |
| Routing | `route.test.js` | `parseRoute` branch ordering + path builder round-trips + the spoiler-cutoff query |
| Pure helpers | `lib-helpers.test.js` | `ordinal`, `dates`, `statTiers`, `runExpectancy` |
| Formulas / transactions | `season-score.test.js`, `team-score.test.js`, `team-transactions.test.js`, `statsapi.test.js`, `game-notes-regressions.test.js` | the statistical generators and the transaction grouper |

### Coverage

`npm run test:coverage` runs the same suite with Node's built-in
`--experimental-test-coverage` (test/scripts excluded). It's a report, not a
gate — use it to spot an untested branch before adding a test. The
reveal-critical modules (`derive`, `linescore`, `pitchers`, `defense`,
`battingorder`, `revealProgressCore`, `route`) sit at ~100% line coverage; use
that as the floor when touching them.

### The captured real-game fixture

`test/fixtures/game-823035.trimmed.json` is a field-trimmed snapshot of
statsapi's `/api/v1.1/game/823035/feed/live` — the pinned 2026-07-07 MIL@STL g2
(final 10–2), the same game the e2e specs use. It's trimmed to only the feed
paths the reveal-only selectors read (players, plays, linescore, boxscore),
which drops it from ~800 KB to ~150 KB. `invariant-real-game.test.js` loads it
to assert the reveal gating holds on real data — offline and identically every
run, unlike the e2e specs which fetch the live feed.

To refresh or capture another game, fetch the live feed and keep only the read
paths:

```bash
curl -s "https://statsapi.mlb.com/api/v1.1/game/<gamePk>/feed/live" -o feed.json
# then trim gameData.{datetime,status,teams,players,probablePitchers} and
# liveData.{linescore,boxscore.teams/officials,plays.allPlays} — see the shape
# of the existing fixture; drop per-player bios and per-pitch fields the
# selectors don't read.
```

Prefer a hand-built minimal fixture (`test/fixtures/mini-game.js`) for
unit-level assertions where you want to control exactly one behavior; use the
captured real feed for "does the real shape still parse" confidence.

## Browser harness — `npm run e2e` (not CI-gated)

Playwright specs under `e2e/`. This is a **verification harness**, not a
regression suite (see the config header and CLAUDE.md): the invariant specs
(`e2e/invariants/**`) fetch the live statsapi at test time, so they depend on
network and on games that age out — deliberately kept out of CI. They're the
only place the **DOM-level** guarantee is checked (a `SealBox` never renders its
children until revealed), which the unit suite can't reach because `SealBox` is
a `.jsx` component. Run them locally against a live or recent game when changing
anything user-visible; `docs/test-games.md` lists gamePks with rare events.

The unit suite's `invariant-real-game.test.js` now pins the same spoiler
guarantee at the **data layer** deterministically in CI, so a regression in the
reveal-only selectors is caught automatically even though the browser specs
aren't.
