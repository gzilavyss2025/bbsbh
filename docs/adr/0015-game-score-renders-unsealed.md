# Game Score is the one score-derived number allowed outside a SealBox

Every other number derived from a game's outcome is reveal-only (ADR-0001):
computed lazily inside a `SealBox`'s render function, never touched until the
user taps. Game Score (`FINAL · 7.5` on a slate card, `scripts/gen-game-score.mjs`
→ `public/data/game-score.json` → `src/api/gameScore.js`) is a deliberate,
narrow exception — the whole point is to help a reader pick *which* finished
game to score without opening any of them, so the number has to be visible
before reveal, right on the spoiler-free `GameCard`.

That's safe only because the number itself carries no exploitable signal back
to the raw result:

- It's an additive blend of a dozen-plus capped/saturating factors across five
  buckets (drama, action, spectacle, dominance, dud) — see `docs/game-score.md`
  for the full factor table. What keeps it safe is **collision**: so many
  distinct game shapes map onto the same displayed value that the number doesn't
  invert to a result. A "10" can be a walk-off, a lead-trading slugfest, a
  perfect game, or a 3-HR night; a "7.5" a 2-1 duel or a 9-8 seesaw.
- The **dominance axis** (a dominant individual pitching or batting line ×
  a career-arc modifier, which lets a game reach 10 without a walk-off/extras)
  is a larger bucket than the others but built from several small sub-factors,
  and it *increases* collision rather than reducing it — it folds in whole new
  game-shapes (a quiet 1-0 gem, a rookie debut, a 42-year-old's twilight start)
  that now share high values with the loud ones. Its inputs (strikeouts, total
  bases, age) carry no signal about *who won* or *by how much*, which is the
  only thing the spoiler rule protects; it reads the feed's `boxscore` +
  `gameData` bios but stays precomputed off-DOM in the cron, so no new DOM
  exposure.
- Final margin — the most spoiler-adjacent input — only enters through a
  thresholded, capped penalty (zero for any margin ≤3, flat-capped at a 9+
  run blowout), never directly.
- Rounding to one decimal happens *after* summing every factor, so nothing
  upstream is individually recoverable from the shown digit.
- It's precomputed off-DOM by a script (never client-side from the live
  feed) and read from a static per-gamePk file, the same build-time-fetch
  shape as WAR/milestones — a slate page never fetches a game's own feed just
  to decide whether to show a number.

Deliberately excluded from the formula: win probability (`winProbability` is
MLB-only — see `game.js` — and this needs to work at every MiLB level too) and
anything requiring a lookup that could reverse-engineer to one specific score.

The visibility toggle (`useGameScoreVisible`, off by default, set from
`FavoriteTeamModal`) is a taste preference, not a spoiler control — even with
it off, the underlying file is still fetched same-origin like any other
build-time data file. Don't read that as a spoiler gate; the mitigation above
is what actually keeps this exception safe, and it must hold before this
number is ever shown unsealed anywhere else.
