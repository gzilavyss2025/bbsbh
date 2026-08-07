# The lineup page wears the club's jersey — and theming's only inputs are (teamId, treatment)

Until now every surface in the app wore the same chrome: navy bars with a
kraft-gold tape edge, the scorebook metaphor from `src/CLAUDE.md`. Two
hand-tuned tables — `TREATMENT_HEADER_COLOR_OVERRIDES` (`src/lib/teams.js`) and
`MILB_HEADER_COLOR_OVERRIDES` (`src/lib/milbColors.js`) — held per-club
recolorings of that chrome and were commented, accurately, "design-lab preview
only — no real component reads this table yet."

This records shipping them, and the rule that keeps shipping them safe.

## What changed

The **lineup page** (`screens/TeamInfo.jsx` — the per-game away/home staging
sheet, *not* the club hub) now dresses its club-name bar and that side's section
mastheads in the header colors of the jersey the club is actually wearing that
game: `jerseyTreatmentFor` → `defaultTreatmentFor` → the header table, resolved
by `src/lib/headerTheme.js`.

The payoff is specific. `GameView` pages you through away → home → innings, and
the two lineup pages were previously distinguishable only by the word "Away" or
"Home" in the corner. Now each reads as that club's own sheet.

Three mechanical decisions came with it:

- **The triad is named `{ bar, accent, onBar }`**, not the `{ blue, gold, font }`
  it started as. Those names described the *default navy chrome's* own colors,
  which stops meaning anything the moment a club's bar is red. Semantic names
  are what let a resolver, a guard, and a lab editor all talk about the same
  three values.
- **`scripts/check-contrast.mjs` now asserts every entry in both stores**:
  `onBar` must clear WCAG AA (4.5:1) against `bar`. This is the whole reason the
  feature is shippable rather than a lab curiosity. A triad is authored by eye,
  one club at a time, by someone who has already decided they like the two
  colors; nothing else would catch a pair that is unreadable to anyone else. 15
  of the 67 landed entries failed on first run and were retuned — the guard
  doing its job before a single one reached a user. `test/header-theme.test.js`
  repeats the assertion so a store edit fails the unit suite too.
- **`accent` is deliberately NOT asserted.** It is the bar's 3px kraft-tape
  bottom edge — a rule against the page, not text against the bar — and holding
  it to a ratio against `bar` would forbid the tone-on-tone edges several clubs'
  actual liveries use.

## The invariant — write it down before someone proposes the violation

> **Theming's only inputs are `(teamId, treatment)`.** Never anything derived
> from game state.

Uniform, logo, and colour data is **identity, not state**. Every input is a
static per-club table or `public/data/jerseys.json`'s
`gamePk:teamId → treatment NAME`. None of it carries runs, hits, errors,
innings, outs, or win probability. **A colour cannot encode a score.** And
`jerseyTreatmentFor` is already unsealed today, on the slate card and the in-game
masthead — knowing a club wore City Connect tells you nothing about the result.

The rule exists because the tempting *next* idea is obvious, and it would be a
real spoiler: "tint the page by whoever's leading", "warm the bar as the lead
grows", "swap the accent once it's out of hand". Any of those turns a colour
into a score channel and breaks the app's core invariant (root `CLAUDE.md`).
Nothing in `src/lib/` may read a score, an inning, or a win probability to decide
a colour. `test/header-theme.test.js` asserts the resolver is pure in its two
arguments and that `headerTheme.js` imports no feed, linescore, reveal, or
derivation module — so wiring one in fails a test rather than a review.

## Scope, and why it stops where it does

Themed: `.teaminfo__head` and the `.metricbar` mastheads *inside* a `.teaminfo`
page. The mechanism is three CSS custom properties scoped to that subtree,
which is also the containment.

**Not themed: the innings viewer and the box score.** Those carry the seal
metaphor — kraft amber on manila, navy around it — and a club's brand recoloring
them would fight the spoiler UI's own visual language, which is the one thing on
screen that has to stay legible as *itself*. The properties simply never reach
them.

Also unchanged: `buildJerseyCombos`'s per-jersey W-L, which is the one place
uniform data touches a result and is already gated by the schedule cutoff.

## Coverage is partial, and the resolver says so

67 (club, treatment) pairs are tuned out of several hundred possible.
`headerThemeFor` returns **null** for the rest and the page keeps default navy
chrome — it does not synthesise a triad from a club's brand colours. A
synthesised bar would be an unreviewed colour pair on a real page, and the WCAG
guard can only assert pairs that actually exist in a store. `/identity-lab` marks
each tile "Themed" or "Default chrome" and shows the live contrast ratio, so the
gap is visible where the tuning happens.

## The one thing that surprised us: the club mark

A themed masthead carries the club's **mono** mark — the one-colour knockout art
of ADR-0031, drawn white for a navy bar. On a light bar (several clubs' greys and
creams) that mark disappears, and no text-contrast rule would catch it.

The fix is `filter: brightness(0)` on the mark when the theme's ink is dark
(`onBarTone`). **This is not the filter-whitening ADR-0031 exists to forbid.**
That failure mode is filtering *full-colour* art: a mark whose interior detail is
drawn in a light fill flattens into an unreadable blob. The mono asset has
already been through exactly that reduction — it is one opaque shape plus
transparency — so darkening it is exact and loses nothing there was left to lose.
Applied only to art that is already a silhouette, only on a themed bar.

## Consequences

- A per-club colour change is now a **user-visible** change, not a lab preview.
  It lands through `/identity-lab`'s Save (ADR-0029) into
  `src/lib/data/{mlb,milb}-treatment-tuning.json`, and `npm run lint` refuses an
  unreadable pair.
- The two vocabularies stay separate (`src/lib/CLAUDE.md`): MLB clubs are keyed
  by treatment, MiLB affiliates by game side. `headerThemeFor` reads whichever
  table the id belongs to rather than merging them into one fake vocabulary.
- Adding a themed surface later means setting the same three properties on it
  and adding a fallback — not inventing a second resolver. If a new surface
  wants a colour that depends on anything but `(teamId, treatment)`, that is a
  new ADR, not a new argument.
- **The Starting pitcher card is the one masthead on the page themed to the
  OTHER club.** It shows the opposing starter, not this page's own team, so it
  resolves `headerThemeFor` a second time against `(oppMeta.id, oppTreatment)`
  and applies the result to just that `<section>` — same resolver, same three
  properties, scoped narrower than the page. Still only `(teamId, treatment)`
  in, still null-safe: with no curated pair for the opponent it falls through
  to whatever the page's own theme (or default navy) already set.

## Amendment (2026-08-07): a bar may also size the mark it draws

The triad above answers what colour a bar is. It now carries a fourth field,
`markScale`, answering how big that bar draws the club's mark — same store, same
per-bar record, same `(teamId, treatment)`-only inputs, so the invariant at the
top of `headerTheme.js` is untouched.

**Why it is needed at all.** A club's knockout mark is letterboxed into the
bar's height, and marks carry wildly different amounts of their own internal
whitespace. A cap logo drawn tight to its viewBox and a roundel with a wide
margin are the same file, at the same nominal size, and read at very different
weights on the bar. Nothing in the pipeline can tell those apart — the whitespace
is inside art nobody controls — so it is picked by eye, like every other value
in these stores.

- **It scales the ART, not the theme, so it applies without one.** A club with
  no curated triad still wears default navy chrome, still draws its mark there,
  and may still need it sized. `headerThemeStyle(theme, markScale)` therefore
  emits a style object when EITHER is present: an unthemed bar with a scale
  carries only `--masthead-mark-scale`, a themed bar with no scale only the three
  colours. `mastheadMarkFor(teamId, treatment)` is what resolves both halves of
  what a bar's mark is — `{ url, scale }`.
- **A crop, not an overflow.** `.teamlogo-crop-bar` already clips
  (`overflow: hidden`), so `transform: scale()` on the mark inside it zooms past
  the art's own margin and trims what leaves the bar. The property defaults to
  `1` in the `var()` itself, which is what keeps every untuned bar — and every
  other `crop="bar"` caller, like the pre-game cards — byte-identical.
- **Floored as well as raised** (`MARK_SCALE_LIMITS`, 0.5–2.5): the fix for a
  mark drawn tight to its edges is to pull it in, and a control that only grows
  would have no answer for that. Clamped in the resolver as well as the input,
  the same belt-and-braces the stamp placement fields keep.
- **The default is DROPPED, never written.** `withMarkScale` is the one rule both
  lab profiles share for landing the value, so MLB and MiLB cannot disagree: an
  identity entry and an absent one render the same, and the shorter store is the
  one that says which bars actually needed a hand.
- **The field shows `1`, not a blank.** Unlike the hex fields beside it, there is
  no such thing as "no size" — an untuned mark is drawn at exactly 1, so showing
  it is accurate rather than presumptuous. It also fixes a real papercut: a
  number input with no value steps from its `min`, so the first click on the
  stepper jumped a bar straight to 0.5. Clearing the field is still how the
  tuning is dropped.
