Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

# Lens L2 of #724: the pure helpers that put the sheet into words

## Context

Repo `gzilavyss2025/bbsbh` (Tally Baseball). Issue #724 builds "Lens and Ruler": on a phone, the
scorecard opens zoomed onto the next sealed at-bat, and a bar under it says in plain words what just
happened. The brief is the issue comment
https://github.com/gzilavyss2025/bbsbh/issues/724#issuecomment-5953254710. **Read all of it.** This
slice is items 3 to 6 of its section 6, and the copy in its section 4. Where this prompt and the brief
disagree, this prompt wins.

This slice writes **pure functions and their tests only. No UI, no CSS, no ADR.** Other slices run
at the same time: L1 (CSS focus ring) and L3 (the lens layout, which adds `src/lib/scorecard/geometry.js`).
Do not touch their files. Later slices call your functions.

## Workspace (cloud session)

1. `git fetch origin`. Your base is `origin/claude/lens-ruler`, not `main`. If it does not exist, stop
   and tell Gary to run step 0 of the run sheet.
2. `git worktree add .claude/worktrees/lens-l2 -b claude/lens-l2-words origin/claude/lens-ruler`.
   A hook refuses edits in the plain clone. Run `npm install` in the worktree.
3. If `gh` is missing, use your GitHub tools for the PR.

## Read first

`CLAUDE.md` (the spoiler rule), `src/api/CLAUDE.md`, `src/lib/CLAUDE.md`, `test/CLAUDE.md`, ADR-0006,
0016, 0046, 0047, 0055, 0072. Then `src/api/scorecardGame.js` (`scorecardFull`, `scorecardStep`, the
card fields `reached`, `scored`, `outAt`, `outNumber`, `rbi`, `code`, `centerCode`, `endsHalf`,
`atBatIndex`, `leadoffMarks`) and `src/screens/scorecard/ScorecardPage.jsx` (how the page builds the
clamped `view`).

## Search before you build

These may already do part of the job. Read each one. Reuse it if it reads only revealed data and has
the shape you need. Say in the PR what you reused and what you did not, and why.

- `src/api/expresslane/runners.js` (`runnersOnBase`) and the rest of `src/api/expresslane/`.
- `src/components/scoring/BaseState.jsx` and `BaseoutDiamond.jsx`.
- Any result-to-words map in the innings viewer, play-by-play or Express Lane
  (`git grep -n -i "grounded out\|struck out\|doubled"` in `src/`).

## Build

Put the code in a **new folder `src/lib/scorecard/`**. `src/lib/` is at its `check-dir-size` budget
(59 files), so do not add a file directly in `src/lib/`. Split by job, each file under 600 lines.

Each function takes **only the clamped `view` or its cards**, never the raw feed. That makes it
spoiler-safe by construction. Write each test first and watch it fail.

1. `playWords(card, names)` → `"Okafor doubled."` The verbs are in brief section 4. For an event you do
   not map, use the feed's `result.event` in lower case, if the card carries it. Do not invent words.
   A reached-on-error line names the fielder's position.
2. `runnerMoves(prevCards, nextCards)` → `[{ name, kind: 'to' | 'scores' | 'out', base }]`, and a
   formatter to `"Quillen to 3rd."`, `"Quillen scores."`, `"Quistorff out at 2nd."`. Diff two renders,
   the same idea as the ink-in diff in `ScorecardPage`. Never look ahead in the feed.
3. `situation(view, half)` → `{ outs, bases }` after the last revealed step, plus a formatter:
   `"Top 3 · 1 out · on 2nd, 3rd"`, `"No outs · bases empty"`. A steal or wild pitch **during** the next
   plate appearance leads the next step (ADR-0016 `midAtBat`), so it is correctly not shown yet.
4. `halfTotals(view, inning, half)` → `{ r, h, e, lob }`, or `null` until that half has committed
   (the moment `revealTo` inks P/WH/FO and the scoreboard cell). Read ADR-0006 first: per-inning
   `errors` is a fielding stat, so E is the errors of the club in the field during that half. Use a
   value the view already carries before you count cards. A formatter gives `"Top 3 · 1 R · 1 H · 0 E · 1 LOB"`.

Minor-league games often lack names. Every function falls back to `''`, `null` or `—` and never throws
(CLAUDE.md convention). Return name parts so the UI can show "the next at-bat" when a name is missing.

## Tests

- Pin them on the captured real game `test/fixtures/game-823035.trimmed.json` (see `test/CLAUDE.md`
  and `test/scorecard-game.test.js` for how the suite loads it and builds views at a given `through`
  and step).
- Cover: a hit with runners moving, an out at a base, a run that scores, a double play, a walk, an
  unmapped event (the fallback), the half not yet committed (`halfTotals` is null), a committed half.
- **Spoiler invariant:** walk every step of the fixture. At each step, assert that every name and
  `atBatIndex` that any function returns appears in that step's clamped view. A value from past the
  clamp fails the test.
- A minor-league-shaped input with names missing returns the fallbacks.

## Docs

- A header comment on each new file: what it reads, and why it takes only the clamped view.
- One line in `src/lib/CLAUDE.md` that points to `src/lib/scorecard/`. You own this edit. L3 does not
  touch that file.
- `src/api/spoiler-manifest.json` covers `src/api/` only, so it needs no entry.

## Rules

- ASD-STE100 for comments, commits and PR text. Never "playoffs".
- Never loosen a test. The browser suite is Gary's alone: leave it. Do not push to `main`. Do not merge your PR.

## Finish

1. `npm run lint`, `npm test` and `npm run build` pass. Read the exit codes.
2. Run the `ponytail-review` skill on your diff and apply its cuts. Then run `/code-review` and fix
   what it confirms.
3. Push. Open a PR into **`claude/lens-ruler`**. Title: "Lens L2: play words, runner moves, situation
   and half totals". Body: the API of each function (signature + one example), what you reused,
   the spoiler argument, the tests, "Part of #724". No UI changed, so no local check.
4. Your last message, in plain words for Gary: the PR link, and that this slice has nothing to see on
   screen. The bar (L4) shows it.
