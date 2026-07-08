# Reveal-only selectors live in isolated modules, called only from a reveal render path

Score-revealing computations (per-inning R/H/E/LOB and full-game totals,
pitch/whiff/Statcast derivations, live defensive alignment, live
batting-order subs) are impossible to un-render once they've touched the DOM
— a fetch-then-hide approach would need every future caller to remember to
hide it, and one forgotten `useMemo` would leak a score before the user asked
for it. Instead, every score-revealing selector lives in its own
"reveal-only" module (`src/api/linescore.js`, `src/api/derive.js`,
`src/api/defense.js`'s `revealDefense`, `src/api/battingorder.js`'s
`revealBattingOrder`), and the convention is enforced by never calling any of
them at render top-level or inside an eagerly-evaluated `useMemo` — only from
inside a `SealBox`'s reveal render function (ADR-0002). `src/api/select.js`
is the deliberate contrast: it holds only spoiler-free selectors (lineups,
umpires, venue, rosters) and touches no runs/hits/errors, so it's safe to
call anywhere.

`revealDefense` and `revealBattingOrder` additionally take the half being
revealed as a parameter and return only the starting nine plus subs *through
that half* — sub timing itself is spoiler-adjacent (it hints a mid-game event
happened), so the reveal-only boundary sits at half granularity, not just at
the stat values.
