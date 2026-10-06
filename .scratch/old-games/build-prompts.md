# Old games: build-prompt outlines

These are outlines, not full prompts. Each one names its model and effort from the
ladder in `.claude/skills/improve-prompt/SKILL.md`, step 5. Each picks the cheapest rung
that fits its hardest step. A step that changes the spoiler rule goes to Opus 5.5, high
(rung 7). Run them in this order. `plan.md`, section 6, says why.

Every prompt reads `plan.md`, `decisions.md` and DRAFT ADR-0101 first. Every prompt
starts from current `origin/main`, opens a draft PR, and runs `npm run lint` and
`npm test`. Issues gzilavyss2025/bbsbh#1525 and gzilavyss2025/bbsbh#1527 stay out of
scope.

## Prompt 1a. The event index: generator and reader

**Model: Sonnet 5.5, medium** (rung 3). It follows two patterns that exist:
ADR-0100's hand-run generator and the `staticJsonBy` reader.

**Needs first:** D2, D3, D6, D7, D8, D13 decided.

- Write `scripts/gen-notable.mjs` (name per D4). Use the three API routes in
  `plan.md`, section 2. Put the pure half under `scripts/lib/`.
- No-hitter rule: a game counts when `detailedState` is `Final` or `Completed Early`.
  `Forfeit` does not count (the 1979 DET@CWS 0-0 forfeit). Do not trust
  `abstractGameState`: postponed and cancelled rows also say `Final` there. Dedupe by
  gamePk (the schedule lists a suspended game twice).
- Cycle rule: the batched game log with `fields=` (it cuts bytes about 10 times).
- Merge the hand-seeded additions file (D3). Seed row 1: gamePk 716945.
- Add a `--season Y` flag (the nightly run) and an all-seasons mode (the hand run).
- Add a cross-check mode that reads Retrosheet's `nohitters.zip` and `tripleplays.zip`
  from paths given as arguments. It reports misses. It never writes the output. It
  follows ADR-0100's download rules.
- Add the reader under `src/api/notable/` and its `spoiler-manifest.json` entry:
  `reveal-only`, importers empty for now.
- Tests: a vocabulary test on a fixture, in the style of `test/milb-pool.test.js`. A row
  may hold the listed keys only. It holds no score.
- Check first: the postseason team fielding log with `gameType`, and the batched
  game-log form with `gameType`. If either fails, say so and stop. Do not invent a
  route.

## Prompt 1b. The event index: the full sweep

**Model: Haiku 4.5** (rung 1; no effort setting). Mechanical: run a generator that
exists, and commit its output.

- Run prompt 1a's generator in all-seasons mode. Expect about 4,000 calls and about
  803 MB.
- Run the cross-check. Paste its report in the PR. Do not edit the seed file. A person
  does that.
- Add the `EXCEPT` entry in `check-data-freshness.mjs`, and add the current-season run
  to the nightly workflow (if D9 says nightly).
- Stop on any HTTP error that repeats. Do not retry past the rule in root `CLAUDE.md`.

## Prompt 2a. Old-game pages: thin eras

**Model: Sonnet 5.5, medium** (rung 3). It follows the MiLB degrade pattern. It does
not touch a seal.

- First, load these on the existing route with Chromium and a screenshot each:
  - a 1927 game, for example PHA@BOS on 07041927 (gamePk 102436);
  - the 1956 World Series perfect game, BRO@NYY on 10081956 (gamePk 67524);
  - the 1979 forfeit, DET@CWS on 07121979 (gamePk 177426).
  Say what breaks. Do not fix what is not broken.
- Add plain "not in the record" lines for no umpires and no batting order.
- Offer no half-inning pages when the feed has 0 plays. The box score and the lineup
  pages stay.
- Check how an old club's logo and colours render (the 1927 Athletics). Report it; fix
  it only if the fix is small.
- Add a test for each fallback, written first and seen to fail.

## Prompt 2b. The feat label inside the box-score seal; accept ADR-0101

**Model: Opus 5.5, high** (rung 7). This is the step that touches the spoiler rule.

**Needs first:** D1 decided.

- Render the feat label inside the box score's `SealBox` reveal function only. Read
  ADR-0002, ADR-0049 and ADR-0101 before you edit.
- Add the box score's reveal module to the reader's importer allowlist. Add nothing
  else to it.
- Add a test that the label is not in the DOM while the box score is sealed. Add a test
  that the label shows under the day pass (ADR-0026) and a stamp (ADR-0048) with no
  `boxreveal` write.
- Change ADR-0101 from DRAFT to Accepted. Write in the decision Gary took on D1. Update
  `src/CLAUDE.md`'s UI-side list in one line.

## Prompt 3. The shelf

**Model: Sonnet 5.5, medium** (rung 3). It is a standalone open page. It follows the
postseason history page and ADR-0081's labelled door.

**Needs first:** D4, D5, D12 decided.

- Add the route and the page. Three tabs, one for each kind. Newest first.
- The door into the shelf carries ADR-0081's label: opening it shows results.
- Each row links to the game's `boxscore` with `gamePath`, sealed.
- Add the page to the reader's importer allowlist.
- Print the source line and the Retrosheet credit from `credits.mjs` if any row came
  from the seed file.
- Thin data per `plan.md`, section 3.

## Prompt 4. The callout

**Model: Sonnet 5.5, high** (rung 4). It adds a family to the existing callout system,
across several files. The era floors and the "first since at least" wording need some
judgment, so it is one rung above medium. It changes no gate: the play card and the Final
roll-up are already reveal-gated surfaces.

**Needs first:** D10, D11 decided; prompt 1b merged.

- Read `docs/callouts.md` first. Extend the existing surfaces. Do not build a parallel
  path.
- Triple play and cycle: on the revealed play card. No-hitter: in the box score's Final
  roll-up only. Never during the game.
- Era floors: 1901 for no-hitters and cycles; 1960 for triple plays.
- Add the callout builder to the reader's importer allowlist.
- Add a row to `docs/callouts.md`. Add tests for: a club with no prior event (no note), a
  prior event older than the floor ("first since at least"), and a renamed club.
