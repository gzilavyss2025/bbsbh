# Kraft amber means sealed, and nothing else

**Status:** Accepted
**Date:** 2026-09-22
**Issue:** #1138, slice D of #1128. Evidence: finding 9 of
`.scratch/design-system/fable-critique.md` (PR #1124).

## Context

This app has one colour that carries a **promise**. Kraft-tape amber
(`--seal`, `#B5824A`) means *the thing under this is sealed, and a tap will
lift it*. Every other colour in the palette describes something — manila is
paper, navy is ink, clay is an out, field green is on base. The seal is the
only one that makes an offer.

An offer is only worth anything if it is kept. Measured on `main` f12208170:

| | |
| --- | --- |
| partials reading `var(--seal*)` | **67** |
| declarations | **295** (296 grep hits — one is prose in a comment) |
| border family | 114 |
| `background` | 78 |
| `color` | 75 |
| `color-mix()` tints | 27 |

It was the border of a lineup-page toggle, a postseason-odds pill, a roster
segmented control and the design lab's own verdict box. It was the fill of a
"1st of 30" rank chip, a Watch button, a rehab banner, a hover state on a photo
thumbnail. It was the *weave of the cover itself* on a strip of tape saying a
player is on a rehab assignment.

Not one of those can be revealed. A reader who has learned what kraft means —
and the whole app teaches it, on every score, all season — meets it on 234 declarations
that will never open. That is not decoration going slightly wrong.
It is the app making a promise it cannot keep, over and over, until the promise
stops being heard on the cover too.

## Decision

**`var(--seal*)` may appear only where a reveal is possible.**

"A reveal is possible" means one of four things:

1. **The cover**, its copy, and the tear it splits into (`SealBox.jsx`,
   ADR-0001/0002).
2. **A control that lifts a seal**: the reveal button, the standings reveal
   chip, the Scores Unlocked switch and the consent to spoil a day (ADR-0026),
   the scorecard's face-down at-bat, the due-up pill.
3. **The Game Log's mint strip** — the one action in the app that leaves
   something behind on the far side of a seal (ADR-0035).
4. **The four surfaces finding 9 put on its must-survive list**, where kraft
   carries real meaning rather than a stray accent: the `@` watermark, the
   Last 10 Games home-game ticket the hatched win–loss stamps print on, the
   pencilled-in option year on a contract, and **the club band's 3px accent
   underline** — where `var(--bar-accent, var(--seal))` is the club's accent
   SLOT (ADR-0030) and kraft is only what it falls back to unthemed.

Everything else moved, to one of two places:

- **`--marker`** (`#E9C33F`, highlighter yellow) for rank, flag and "this one
  stands out" emphasis. It already existed and was read 24 times.
- **a structural token** — a rule, a neutral, the action colour, the club
  accent — for the borders on controls that are neither a cover nor a
  highlight. This is where most of the sweep landed, because most of the
  spread was borders.

The classification is one row per read, with the reason, in
`.scratch/design-system/prD/ledger.md`. It was written and committed **before**
anything moved, so the sweep is reviewable against a decision rather than as
234 unexplained colour changes.

| destination | reads |
| --- | --- |
| STAYS | 61, in 21 partials |
| `--marker` | 50 |
| structural | 184 |

## `--marker` is a fill, not an ink

Highlighter yellow reads at **1.58:1** against `--paper-2`. It cannot be body
text on paper, and as a hairline it all but disappears — *worse* than the
3.11:1 kraft it replaces. So it moves in three shapes, each one already in the
repo before this sweep:

| role | recipe | precedent |
| --- | --- | --- |
| fill | `var(--marker)` + `var(--text-heading)` on it | the Close Game pill |
| wash | `color-mix(in srgb, var(--marker) 16%, var(--paper-2))` | five rules |
| edge on a marker fill | `color-mix(in srgb, var(--marker) 70%, var(--text-heading))` | the pregame board |

Where the emphasis had to be carried by a *mark* — an 11px pip, a 2px rail, a
5px arrow, a corner fold — marker cannot hold 3:1 on paper and the read goes
structural instead. A highlight the reader cannot see is not a highlight.

`--text-heading` on `--marker` is the pair `contrastPairings.js` already
asserts for the Close Game pill (10.5:1). It is reused, not reinvented.

## One new token pair

The status-tape family is three weaves of one diagonal hatch: `--il-texture`
(clay, injured list), `--win-texture` (field green, a win stamp) and — until
now — `--seal-texture` (kraft) for a game or a player put **on hold**.

Kraft tape on a rehab banner is the sharpest form of the problem: it is the
cover's own material, on something no tap will ever lift. But the family is
real, and flattening the rehab banner to a plain fill would lose it. So the
weave stays and the colour moves: `--marker-deep` (`#C9A32C`) and
`--hold-texture`, same hatch, flag colour. `--text-heading` holds AA against
both of its stripes (13.5:1 and 7.5:1), both asserted.

One pairing moved with its surface, as pairings must: the Game Log's
completed-set ring left the seal for `--marker`, which took it from 4.2:1 to
8.4:1 on the album board.

## The guard

`scripts/check-seal-scope.mjs`, in `check-stamp-surfaces.mjs`'s style and wired
into `npm run lint`. An allowlist of the (file, selector) pairs that may read
`var(--seal*)`, plus two assertions the sweep alone could not make:

- **Every allowlisted selector must still be reached.** A guard that quietly
  stops checking something is worse than no guard, so a selector that gets
  renamed or repainted fails here rather than rotting on the list.
- **Outside `src/styles/`, only an allowlisted file may name the token.** A
  component can set a custom property inline — the identity lab does exactly
  that to dress the band — and `--marker` is already reached from JS
  (`src/lib/resultCards.js`). CSS alone was never the whole surface.

`public/learn.css` is checked too. The guide at `/learn` (ADR-0053) keeps its
own copy of the palette and had three kraft rules on a page with nothing sealed
on it.

## Consequences

- The promise is now structural rather than remembered. `--seal` cannot spread
  again without a reviewer being asked why a reveal is possible there.
- **The club band is the one family that wears kraft without a reveal**, and it
  is named as such in the guard rather than smuggled in. The argument is that
  on a club page that underline is the club's own accent, and kraft is the
  fallback for a card no club has coloured. It is the largest single group on
  the allowlist (21 of 61 reads) and the most likely thing a later reader will
  want to revisit. This ADR would not be wrong if they did; it would be one
  more step in the same direction.
- `--marker` went from 24 reads to 64. It is now a real token in the
  system rather than a colour that existed and was barely used, which is what
  finding 9 said it should be.
- Three stale claims in `src/screens/designlab/catalog.js` are corrected, and
  fifty comments across `src/styles/` that described a kraft rule now describe
  what the rule actually paints. A comment that lies about a colour is how the
  colour drifted in the first place.
