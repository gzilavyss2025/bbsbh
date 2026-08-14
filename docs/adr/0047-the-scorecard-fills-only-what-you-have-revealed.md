# ADR-0047 — The scorecard fills only what you have revealed

Status: accepted (2026-08-14)

## Context

The Numbers Game "22" sheet has been in the codebase three times over, each
copy holding a different piece of the product:

- the **DEV-only Scorecard Lab** (`/scorecard-lab`), which could ink a whole
  game onto the sheet via `loadScorecard.js`'s full-reveal half — deliberately
  kept out of the production module graph, because nothing clamped it;
- the **printable sheet** (`/{date}/{matchup}/sheet`, PR #705), which ships
  the grid EMPTY by design — the paper you print is the paper you score on;
- the **box score**, which already transcribes the #22's batting and pitching
  column orders but never drew the sheet itself.

What no surface offered: seeing the sheet **filled in** — the notation the
app already derives per plate appearance (the diamond, the fielding chain,
the pitch ladder, the out numbers) laid out in batting-order rows × innings,
during the game or after it. And nothing let a scorer disagree with a derived
notation: the official scorer's E5 that was a hit all day, a fielding chain
you'd write differently.

The obstacle was never drawing — the Lab drew it. It was the spoiler rule: a
filled scorecard is nothing BUT score-revealing state, and the Lab's own
loader was the manifest's motivating false-header case.

## Decision

**One grid builder, one clamp.** `src/api/scorecardGame.js` (reveal-gated,
ADR-0009's pattern) owns the inked grid, the per-inning P/TP/LOB row, the
scoreboard with its FINAL block and decisions, and the pitcher table. Every
builder takes a `through` half-index and accumulates only from halves at or
under it. The visible inning columns come off the same clamp with
`unlockedInnings`' walk, so extras never spoil (ADR-0008) — a marathon grows
its columns one revealed inning at a time. `loadScorecard.js` keeps only the
loader and the pre-pitch staging view, finally the spoiler-free module its
header always claimed; the Lab now passes `through: Infinity` explicitly.

**Three surfaces, each holding the gate its own way:**

- `/{date}/{matchup}/scorecard` (`screens/scorecard/ScorecardPage.jsx`) — the
  live sheet, viewable at ANY point. It passes the user's own persisted
  `revealedThrough` mark, reads it and never advances it (no SealBox, no
  `revealTo`). Under Scores Unlocked / a consented day it substitutes the
  render-only mark exactly as the innings viewer does (ADR-0026).
- The **box score** embeds the completed sheet (`BoxScorecard.jsx`) at the
  page's foot, `through: Infinity` — safe because it mounts inside the box
  score's single SealBox reveal render (ADR-0002), behind which the whole
  game is already open.
- The **print sheet is untouched**: its grid stays empty, and
  `test/print-sheet.test.js` now forbids `screens/sheet/` from importing
  `scorecardGame.js` by name.

**Overrides are a pencil layer, not data entry.** Tapping a filled box opens
a small editor for the three marks a scorer argues with — the outcome box,
the diamond-center chain, the RBI count. An override lives in
`localStorage` per game (`lib/scorecardNotes.js` + `useScorecardNotes`),
keyed by the feed's own `atBatIndex`, wins at render time only, and is
flagged with an amber corner. Nothing derived is modified: the AB/H/R/RBI
tallies, the P/TP/LOB row and the scoreboard keep reading the feed, an
override never syncs, and clearing one returns the feed's call. The root
`CLAUDE.md` line "this app is not a data-entry tool" stands — you still keep
score on paper; this is the margin note in your copy of the book.

## Consequences

- A spoiler audit of the filled sheet is one file (`scorecardGame.js`) plus
  the manifest's importer allowlist — three names, each named above.
- The sheet's numbers can never disagree with the innings viewer's: P and
  LOB come from `computeDerivedByInning`/`revealInning`, the pitcher table
  from `computePitcherLines`, all pinned by `test/scorecard-game.test.js` on
  the captured real game — which is also what caught the one real bug this
  work surfaced: a pinch runner's run never folded back into the origin
  batter's diamond once the fixture was trimmed past the substitution
  playEvents (the fixture now keeps them; the Bauers/Mitchell case is
  pinned).
- The inning-end diagonal is derived, not stored: the next-due batter's
  unused box in a FINISHED half. A revealed half still being played draws no
  premature slash.
- An override exists only for a cell the user has revealed — a sealed cell is
  never rendered, so there is nothing to tap. If overrides ever grow a cloud
  mirror, they are consented user annotations, never a reveal source.

## Amendment (2026-08-14): the sheet plays

The live scorecard gained the reveal VERB, not just the reveal's output. The
next plate appearance renders as a face-down kraft seal in the grid cell it
will ink into (`scorecardPlays`' `frontier` + `scorecardStep`); tapping it
advances the SAME persisted cursor the innings viewer's at-bat stepping
walks (`revealAtBat`'s entry-count mark, ADR-0016), and the last step of a
finished half collapses into the ordinary `revealTo` commit. One ratchet,
two surfaces — the sheet and the innings viewer can never double-reveal or
disagree about where you are.

Three rules keep the game honest:

- **Mid-step, only cards.** A stepped half contributes its revealed cards
  and nothing else — no P/TP/LOB line, no scoreboard cell, no inning-end
  diagonal. Those are whole-half facts and they ink on commit, which is the
  turn-end beat.
- **The frontier is derived, never stored.** It is always the half after
  `revealedThrough`; under the Scores Unlocked pass the render mark covers
  the whole game, so the seal simply never renders and nothing on the page
  can commit (ADR-0026's commitReveals contract, honored by construction).
- **Juice follows the tap.** Newly revealed marks ink in (outcome, then
  diamond, then the out circle pressed with `--ease-press` — the stamp's own
  ease); the ink-in set is diffed per side and armed only after the reader's
  first tap, so a cold load or a sheet flip renders settled ink. Skipped
  under reduced motion. ADR-0046 is respected: every duration is a fixed
  token, never a function of what was revealed.

Deliberately NOT built: points, streaks, or any meta-economy. The app's
fantasy is being the scorer; the game is the ritual (press, ink, count outs,
flip the sheet), and the gamification stops where the paper does.
