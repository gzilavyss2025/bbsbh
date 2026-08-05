# Lineup Strength — REMOVED from the app, stashed here

**Status: removed.** The card, the grade, the solver and the nightly values file
were all taken out of the app. Reason: not useful enough on the lineup page to
justify a number that is wrong often enough to notice — the model can't see rest
days, nagging injuries, platoon plans or the man who played fourteen innings
yesterday, and all of those count against the grade (see `model.md`, "What the
model deliberately won't say"). A confident-looking 0–10 next to a posted lineup
reads as an assessment; it was closer to a guess.

Nothing about it was lost. `model.md` is the design doc verbatim — the formula,
the constants, the three deliberate absences and the receipt design, including
the evidence that killed each rejected variant. Read it before rebuilding any of
this; every one of those three looks like an obvious thing to add back.

## The formula, in one line

```
total = Σ(bat + glove) over the nine − glove(DH)
grade = clamp(10 − gap / SCORE_GAP_FULL, 0, 10)      # gap = optimal − posted, runs/game
```

`bat` is wRC+ regressed toward 100 by PA, converted to runs per lineup slot;
`glove` is season Fielding runs regressed toward 0 by innings. Position
eligibility is a hard boolean from recent innings, and the best nine is an exact
Hungarian assignment over it. Constants are in `model.md` ("Tunables").

## What was removed, and where to get it back

Everything below existed at commit **`d83f5dd`** and can be restored with
`git show d83f5dd:<path>`:

| path | what it was |
|---|---|
| `src/lib/lineupSolver.js` | pure Hungarian assignment + the value function |
| `src/lib/lineupStrengthTier.js` | the seeded tier-word ladder |
| `src/api/lineupStrength.js` | grade, receipt grouping, catcher-rest rule, `fetchLineupValues` |
| `src/components/teamstats/LineupStrengthCard.jsx` | the card on the lineup page |
| `scripts/gen-lineup-values.mjs` | nightly build of `public/data/lineup-values.json` |
| `public/data/lineup-values.json` | per-hitter bat, glove, eligible positions |
| `test/lineup-strength.test.js` | 32 tests pinning every invariant in `model.md` |
| `docs/lineup-strength.md` | now `model.md`, next to this file |

Wiring that was unpicked at the same time: the `lineupValuesData` prop chain
(`useGameData.js` → `GameView.jsx` → `TeamInfo.jsx`, including the three-day
freshness clamp that hid the grade on archival games), the `.lstrength*` block in
`src/styles/44-pre-game-cards.css`, and the `lineup-values` step in
`.github/workflows/update-nightly-data.yml`.

## One thing deliberately left in place

`scripts/gen-war.mjs` still fetches **wRC+** and **Fielding runs** alongside WAR
and writes them into `public/data/war.json` as the `wrc` and `fld` maps. Nothing
reads them now. They were kept because they ride along on the single FanGraphs
`type=6` request that WAR itself needs — removing them would mean touching the
WAR pipeline for no gain, and keeping them means a rebuild here starts with its
inputs already on disk. If they're ever pruned, read §1 of `model.md` first: the
reason that request is `type=6` (Value) rather than `type=8` (Dashboard) is that
a composite can't be decomposed back into its parts, and that lesson cost real
debugging.

## If it comes back

The likeliest reason to revive it isn't the card — it's the **receipt**. `rows`
was fully computed and unit-tested but never rendered, because how to explain a
grade was unresolved; `model.md` ("Explaining the grade — PARKED, and why") has
the measurements behind both candidate renderings and the likely answer. A
version that *explains* a lineup ("Pederson profiles as the stronger option at
first, pushing Burger to third…") is a different and more defensible product than
a version that *scores* one, and the explaining half was always the part that
worked.
