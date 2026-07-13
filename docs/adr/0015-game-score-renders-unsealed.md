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

- It's an additive blend of a dozen-plus capped/saturating factors (lead
  changes, largest comeback, late-and-close, extra innings, walk-off, total
  runs, run distribution, clutch homers, rare feats, a blowout penalty…) —
  see `docs/game-score.md` for the full factor table. No single factor is
  allowed more than ~15% of the 0–10 range, so dozens of distinct game shapes
  collide onto the same displayed value (a "7.5" could be a 2-1 pitchers'
  duel or a 9-8 seesaw).
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
