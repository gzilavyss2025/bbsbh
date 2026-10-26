# src/api/gameday — Gameday's new data modules

The one home for the data half of the Gameday rebuild (#2566; decided 2026-10-26). Every
module here reads the innings viewer's own half-inning cards, so assume **reveal-only**
(ADR-0001): call it only inside a `SealBox` reveal render function (ADR-0002), never at
render top level or in an eager `useMemo`. Classify each new file in
`../spoiler-manifest.json`; the guard fails on a module with no entry.

Two rules every module here keeps:

- **Step k never sees step k+1.** The reader's cursor is computeHalfInningFeed's `stepCap`
  (ADR-0016). Build the current half WITH that cap and slice at it: the cap stops a later
  play writing back onto an earlier card, the slice drops the cards past the cursor. No
  uncapped variant. A half past `revealedThrough + 1` answers null.
- **Fresh start.** Import none of the old visual pieces #2566 lists as reference only. The
  engine (feed readers, `pitchers.js`, `../expresslane/runners.js`) is fine.

Data only: no drawing, no component, no screen text. The wireframes in #2568 decide how
each value looks. Pure physics goes in `src/lib/gameday/`, not here.

| File | What |
| --- | --- |
| `dayLine.js` | The batter's and the pitcher's line for today, as of the step (#2606). |
