# The report parts, square corners and no checkmark

**Status:** Accepted
**Date:** 2026-10-15
**Issue:** none; Gary's design session of 2026-10-15
**Amends:** ADR-0109, the shared parts list

## Context

A scan of about 35 report pages (`src/lib/reportPages.js`) found the same small shapes
drawn by hand: a big-number tile on nine screens (`.slab`), a ranked row five ways, a
filter chip at three heights, a rank box in eight or more classes, three meters and five
legends. Each one was a copy of a part the system already had, or a part it lacked.

Gary reviewed one proposal page for each part, as a private artifact, and decided the
points below. The artifact had comment threads; each decision here came from one of them.

## Decision

1. **New shared parts.** They sit on the stamped Card and the stamped look of ADR-0109.
   Their styles are in `src/styles/system/report/` (a subfolder, since `system/` is at
   the 12-file cap). Their components are in `src/components/ui/frame/` and `control/`.
   - **Stat band and strip.** `StatTile look="band"` (one tile: an ink column head, a
     mono figure; `lead` heads it in the negative accent and puts the marker stroke
     under the figure) and `StatStrip` with `StatCell` (all the figures of a row in one
     box, cells split by hairlines; one `lead` cell is ink). Both replace `.slab`. Use
     the strip for three or four figures that read together, the band for a figure
     that stands alone. Gary kept both forms.
   - **Leader list and row.** `LeaderList` (a stamped, named Card) and `LeaderRow`
     (rank pill, a 36px mark slot, name over a sub line, a figure). States: `lead` and
     `mine`. `--surface-mine` is the one token for the reader's own club.
   - **Result card.** From the focus-mode scorebug. For a finished game on a history
     page only. It draws the score it is given and gates nothing. A current-season
     score never goes in it.
   - **Meter and key.** The player page's pitch mix bar as a shared part, and one
     legend. They replace three meters and five legends.
   - **Corner badge, chips, stepper, switch.** `Chips` (layouts `rail` and `wrap`; a
     full-width pick-one row stays `Segmented`), `Stepper`, `Switch`, and `Button block`
     with a `hint` for a full-width row.
   - **Pill mark and marker fill.** `Pill mark` is a square box for one figure or one
     or two letters. `fill="marker"` is the highlighter fill for the one pill that
     leads a row.
   - **Soft tone.** `Card frame="stamped" tone="soft"` takes the graphite offset
     shadow, for a small tile.
2. **No rounded corners.** `Pill` and `Button` are square (`border-radius: 0`). The
   icon button stays a circle, since its mark is a circle.
3. **The switch is the one round shape.** It is the standard on and off switch (51 by 31
   track, round knob, green when on). Gary chose it over a square one on 2026-10-15.
4. **No checkmark.** A selected button, pill or chip is an ink fill and a marker
   underline, the mark the scorebug puts under the club at bat. The underline is an
   inset shadow, so it adds no height. `test/report-parts.test.js` fails if a
   checkmark glyph returns to `src/`.

## Consequences

- Every pill and button in the app changes shape, and every selected one loses its tick.
- The report pages still draw their own copies. Each page moves onto these parts in its
  own PR; the old rules (`.slab`, `.payboard__row`, `.rpt-chip` and the rest) leave
  with it. Nothing here edits a report page.
- `docs/design-system-naming.md` has the old names. They are history until a page moves.
- The design project (`docs/design-sync.md`) carries the new parts after a rebuild:
  six new preview cards, the pill, segmented and button styles, and the report styles.
