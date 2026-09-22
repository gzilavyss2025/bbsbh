# The scale has three landings, and a listed residue

**Status:** Accepted
**Date:** 2026-09-22
**Issue:** #1137, slice C1 of #1128. Earlier slices: PR #1135 (A), PR #1136 (B),
PR #1150 / ADR-0083 (D). Evidence: `.scratch/design-system/prC/measure.mjs`.

## Context

`src/tokens/spacing.css` declares a 4px scale: 0, 4, 8, 12, 16, 20, 24, 32, 40,
48, 64. The header calls the file the primitive tier — reusable, app-agnostic
step values only.

The stylesheets did not stand on that scale. Measured over the 137 partials in
`src/styles/`, `padding` and `gap` only, margins excluded:

| | literals | declarations |
| --- | --- | --- |
| `padding`/`gap` declarations | — | 2631 |
| ... carrying a px literal | 1723 | 1295 |
| on the 4px scale | 598 | — |
| off the scale | 1125 | 953 |
| ... at exactly 6, 10 or 14px | 488 | — |
| ... at any other value | 637 | 564 |

Two numbers decide this ADR.

**488 is larger than 598.** More raw literals sat at 6, 10 and 14px than sat on
the whole scale. A value written that often is not a mistake made 488 times. It
is a step that nobody had named, so each author found it again by eye.

**637 have no token at all.** They are not one problem. 363 of them are 1, 2 or
3px. 231 are odd values from 5 to 13. 43 are genuine one-offs — 18, 22, 28, 36,
72, 120, 200.

A guard that says "no raw px in `padding` or `gap`" must answer all three, or it
cannot go green. Rounding 637 literals to the nearest step would answer them,
but that is a spacing change across the whole app, made by a script, reviewed by
nobody.

## Decision

**1. Mint three half-steps.** `--space-1h` 6px, `--space-2h` 10px, `--space-3h`
14px. They go in the primitive tier because they meet its charter: a landing
between two rungs is as reusable and as app-agnostic as the rungs it sits
between. They are landings, not rungs — read `--space-N` first.

There is no half-step above 16px. Past that the eye stops reading a 2px
difference, and a fourth would start to say the scale is eight steps deep
between 0 and 16, which is not a scale.

**2. Sweep only where a token already carries the value exactly.** 1086
literals in 866 declarations across 89 partials: the 598 on the scale and the
488 the half-steps now carry. A 6px stays 6px and only starts reading a token.

The 598 were in neither the issue's sweep scope nor its residue. They belong in
the sweep: `gap: 8px` to `var(--space-2)` is the same exact-match mechanic, and
a guard that exempted a declaration with a perfect token would read "except"
more often than "no".

**3. The residue is listed, and it may only shrink.** `SPACING_RESIDUE` in
`scripts/check-typography.mjs` records 274 off-scale literals across 72
partials, value by value, with an exact count. The count is checked in both
directions. An unlisted literal fails the guard. A listed literal that is no
longer there also fails, so converting one forces the count down in the same
commit, and the list can never rot into a record of an app that has changed.

**Do not round a value to remove an entry.** That is a real spacing change, and
it would be made by whoever happened to be editing that partial instead of by
the people who own the scale.

**4. The 1-3px optical nudge is exempt, under a ceiling.** #1128 already grants
margins their 1-3px nudges as real spacing. A 2px pad on a chip is the same
correction on the same surface. No token exists at 1, 2 or 3px, and minting one
would say these are steps of the scale. They are corrections to it.

The band is exempt and not listed, because listing 348 sites records nothing
that has to be decided. It sits under `NUDGE_CEILING`, rounded up to the next
25, which only moves down. An exact count would fail on ordinary work — a new
component that pads a chip by 2px is normal — and `check-file-size.mjs` already
wrote down what happens to a guard that fails on ordinary work: somebody
deletes it.

## Consequences

The rule is on. `var()`, unitless `0`, `calc()`, `clamp()`, `min()`, `max()`,
`env()`, the non-px units and the keywords all pass. Any bare `<number>px`
fails, in a longhand or in any position of a shorthand. Margins keep their
nudges; the guard does not look at them.

**No value moved.** Every `padding` and `gap` declaration in all 89 changed
partials was resolved back to px on both sides of the diff and compared: 2123
declarations, zero differences. The diff is 866 insertions against 866
deletions.

**The 231 were closed by a second decision, recorded here.** The odd
5/7/9/11/13px band is the one rounding this codebase has agreed to: it went
DOWN one step — 5 to 4, 7 to 6, 9 to 8, 11 to 10, 13 to 12 — across 231
literals in 222 declarations in 63 partials.

There was a direction to choose, and not a nearest step, because the scale
these half-steps complete reads 4, 6, 8, 10, 12, 14, 16. Every gap is 2px, so
every one of the 231 sat exactly midway between two tokens. "Round to the
nearest" resolved to nothing, and no site had a reason to differ from any
other, so the direction was fixed once instead of 231 times. Down suits a
phone-first second screen: it recovers scroll and never widens a table already
filling 358 of 390px. The evidence — the band grouped by partial, and a
before-and-after of three real surfaces at 390px under both directions — is in
`docs/design-system-spacing-residue.md`.

That leaves 43 listed literals, all of them genuine one-offs at 18px and up.
Eleven of their seventeen values have no honest rounding at all. **The rounding
of the odd band does not license rounding one of these.** It was a recorded
decision over measured evidence, applied to every affected site at once.
Moving a single value to clear a ledger entry is a different act: an
unreviewed spacing change on a surface nobody compared.

**Two guard defects closed with it.** `check-typography.mjs` did not strip
comments, and its property regex was unanchored, so it scanned no `padding`
longhand at all. Both were harmless while every rule named a type property.
Neither is any more.

## Alternatives rejected

**Mint more half-steps to cover 5, 7, 9, 11 and 13px.** A scale with nine steps
between 0 and 16 is a list of numbers. The half-steps stop where the eye does.

**Round the 637 to the nearest step and close the rule completely.** This is a
spacing change across every screen in the app. It may still be the right answer
for the 231, but it is a decision with a before-and-after attached, not a step
in a mechanical sweep.

**Leave the 598 on-scale literals alone.** They already have a perfect token.
Exempting them would put the largest single group of raw px outside the rule on
the day the rule turned on.
