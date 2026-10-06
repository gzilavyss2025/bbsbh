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

**Model: Sonnet 5.5, medium** (rung 3). The full prompt is `prompt-1b.md`. It follows
ADR-0100's open-data pattern.

**Needs first:** prompt 1a merged.

- A `--check-retrosheet` mode on `gen-notable.mjs`. It reads the extracted
  `nohitters.zip` and `tripleplays.zip` (`gameinfo.csv` and `teamstats.csv`) and
  never downloads. Cycles are out: Retrosheet has no cycle list.
- It matches by date and score, with either game of a doubleheader day, so it needs no
  team-code table. It gives each Retrosheet game one label (`matched`, `missed`,
  `dropped-league`, and others) and lists `index-only` rows.
- It writes nothing. A person adds each true miss to the seed.
- Known cases: Larsen 1956, the 2023 seed row, and the 1920 World Series triple play.
  The 1920 case is the first known test of the postseason triple-play route.

## Prompt 1c. The event index: the full history

**Model: Haiku 4.5** (rung 1; no effort setting). The full prompt is `prompt-1c.md`.
Mechanical: run the generator and the cross-check, compare counts, commit data.

**Needs first:** prompts 1a and 1b merged. (1a merged in gzilavyss2025/bbsbh#1575.)

- Run `gen-notable.mjs` from 1901 to 2025 in six chunks of about 20 seasons. The
  generator writes after each season, so a stopped chunk keeps what it finished.
- Cost, from 1a's measured runs: 29 to 77 calls a season. About 6,000 calls and about
  900 MB in all (an estimate). The first plan said about 4,000 calls; the postseason club
  calls account for most of the difference.
- Check 1960 to 2025 against exact counts from `findings.md`: 196 no-hitters, 266 triple
  plays (with the seed row), 198 cycles. Spot-check Larsen, the 1979 forfeit, the seed
  row and the 2021 seven-inning games.
- Run the cross-check. Paste its report. Add no seed rows.

## Prompt 2a. Old-game pages: thin eras

**Model: Sonnet 5.5, high** (rung 4). The full prompt is `prompt-2a.md`, graded and
rewritten with `/improve-prompt`. It moved up from medium: a survey with judgment, then
fixes across several screens.

**Decided (2026-10-06):** D14, the "no play-by-play" notice shows only before 1960.

- Survey the three test games (1927, 1956, the 1979 forfeit) and mark each card fine,
  empty or false. Stop and report if more than 3 cards are false.
- One "played" selector that reads `detailedState`, not `abstractGameState`.
- Plain lines for missing umpires and batting orders; no innings pages for a pre-1960
  played game with 0 plays; no present-day data on an old game.

## Prompt 2b. The feat label inside the box-score seal; accept ADR-0101

**Model: Opus 5.5, high** (rung 7). The full prompt is `prompt-2b.md`, graded and
rewritten with `/improve-prompt`. This step touches the spoiler rule.

**Decided (2026-10-06):** D1, seal by surface.

- The reader `src/api/notable/notable.js`, `reveal-only`, with one importer:
  `screens/boxscore/FeatLabel.jsx`.
- `FeatLabel.jsx` mounts inside the box score's reveal render and fetches only after the
  reveal. `BoxScore.jsx` is at its size ceiling (1,191 of 1,200), so it gets one import
  and one mount.
- No seal input changes and nothing new is persisted.
- The DOM check uses a scratch Playwright script, because the e2e hook blocks
  `playwright test`.
- ADR-0101 becomes Accepted, with an "As built" section.

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
