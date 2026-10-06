# Old games: build-prompt outlines

These are outlines, not full prompts. Each one names its model and effort from the
ladder in `.claude/skills/improve-prompt/SKILL.md`, step 5. Each picks the cheapest rung
that fits its hardest step. A step that changes the spoiler rule goes to Opus 5.5, high
(rung 7). Run them in this order. `plan.md`, section 6, says why.

Every prompt reads `plan.md`, `decisions.md` and DRAFT ADR-0101 first. Every prompt
starts from current `origin/main`, opens a draft PR, and runs `npm run lint` and
`npm test`. Issues gzilavyss2025/bbsbh#1525 and gzilavyss2025/bbsbh#1527 stay out of
scope.

## Prompt 1a. The event index: generator, nightly step, tests

**Model: Sonnet 5.5, high** (rung 4). The full prompt is `prompt-1a.md`. It moved up
from medium when the full prompt was written: it needs merge rules, a nightly step, a
directory budget and live field checks, across several files.

**Decided (2026-10-06):** D2, D3, D5, D6, D7, D8, D9, D13. See `decisions.md`.

Two changes from the first outline, found while writing the full prompt:

- **No reader in 1a.** `check-dead-exports.mjs` fails on an export that nothing
  imports. ADR-0076 lets a dataset ship before any surface reads it. The reader moves to
  prompt 2b, its first importer.
- **The nightly step is in 1a, not 1c.** `scripts/CLAUDE.md`: a generator is wired into
  its cron in the same commit that adds it.

It commits 2025 only. The cross-check moved out to 1b.

## Prompt 1b. The event index: the Retrosheet cross-check

**Model: Sonnet 5.5, medium** (rung 3). It follows ADR-0100's open-data pattern.

**Needs first:** prompt 1a merged.

- Add a `--check-retrosheet <dir>` mode to `gen-notable.mjs`. It reads the extracted
  `nohitters.zip` and `tripleplays.zip` from the paths given. It never downloads
  (ADR-0100). Inspect the extracted files first; do not assume their columns.
- Match a Retrosheet game to an API game by date and score. Accept either game of a
  doubleheader day (`findings.md`, Step 1). This needs no team-code table.
- Label each Retrosheet row: matched; matched but dropped by D6 (Negro league);
  before 1901; or missed. Print the report. Never write the output or the seed. A
  person adds a seed row.
- Tests for the matcher and the labels.

## Prompt 1c. The event index: the full history

**Model: Haiku 4.5** (rung 1; no effort setting). Mechanical: run a generator that
exists, and commit its output.

**Needs first:** prompts 1a and 1b merged.

- Run `gen-notable.mjs --from 1901 --to <season in play>`. Expect about 4,000 calls
  and about 803 MB.
- Run the cross-check. Paste its report in the PR. Do not edit the seed file. A person
  does that.
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

**Decided (2026-10-06):** D1, seal by surface.

- Add the reader under `src/api/notable/`, through `staticJsonBy`. Its
  `spoiler-manifest.json` entry is `reveal-only`, and its importer allowlist names the
  box score's reveal module only (ADR-0101, part 4).
- Render the feat label inside the box score's `SealBox` reveal function only. Read
  ADR-0002, ADR-0049 and ADR-0101 before you edit.
- Add a test that the label is not in the DOM while the box score is sealed. Add a test
  that the label shows under the day pass (ADR-0026) and a stamp (ADR-0048) with no
  `boxreveal` write.
- Change ADR-0101 from DRAFT to Accepted. Write in the decision Gary took on D1. Update
  `src/CLAUDE.md`'s UI-side list in one line.

## Prompt 3. The shelf

**Model: Sonnet 5.5, medium** (rung 3). It is a standalone open page. It follows the
postseason history page and ADR-0081's labelled door.

**Decided (2026-10-06):** D4 ("Notable games", `/notable`), D5 (show the score), D12
(the box score, sealed).

- Add the route `/notable` and the page "Notable games". Three tabs, one for each
  kind. Newest first. Each row shows the final score.
- One line says the shelf lists AL and NL games (D6).
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

**Decided (2026-10-06):** D10 (club always; player and league only when notable), D11
(no link; the link is gzilavyss2025/bbsbh#1570). **Needs first:** prompt 1c merged.

- Read `docs/callouts.md` first. Extend the existing surfaces. Do not build a parallel
  path.
- Triple play and cycle: on the revealed play card. No-hitter: in the box score's Final
  roll-up only. Never during the game.
- Three lines (D10). The club line always shows. The player line shows for cycles and
  no-hitters, only when the event is not the player's first. The league line shows only
  after a long league-wide gap: set the threshold with the worthiness rubric and say
  how you set it. Do not guess one.
- No link to the earlier game (D11).
- Era floors, for all three lines: 1901 for no-hitters and cycles; 1960 for triple
  plays.
- Add the callout builder to the reader's importer allowlist.
- Add a row to `docs/callouts.md`. Add tests for: a club with no prior event (no note), a
  prior event older than the floor ("first since at least"), a renamed club, a
  player's first cycle (no player line), and a player's second (a player line).
