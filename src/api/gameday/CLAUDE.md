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

Tests pin these on trimmed real games (`test/fixtures/game-*.gameday.json`), rebuilt by
`.scratch/gameday-engine/build-fixture.mjs`.

Data only: no drawing, no component, no screen text. The wireframes in #2568 decide how
each value looks. Pure physics goes in `src/lib/gameday/`, not here.

| File | What |
| --- | --- |
| `stepCut.js` | The shared step cut: the at-bat cards on screen, and the last one's `atBatIndex`. |
| `dayLine.js` | The batter's and the pitcher's line for today, as of the step (#2606). |
| `checkpoint.js` | The half-end checkpoint's five pages: tally, pitching (with fouls), at-bats, game so far, notes (#2605, #2572). |
| `moments/` | The moments engine: `moments.js` scores one revealed play (four kinds, three dial cut-offs); `thresholds.js` holds the measured floors (#2608). |
| `defense.js` | The Field tab: the fielding side's alignment and pitcher as of the step; a change counts once its entry is on screen. |
| `reviews.js` | Manager, crew-chief and ABS reviews, and each club's ABS bank, as of the step (#2607). Never `gameData.absChallenges`. |
| `subSteps.js` | The sub-steps inside one at-bat (ADR-0123): changes, pitches, automatic calls, events, then the result; `stop` marks at-bat mode's. |
| `zones.js` | The zone map's data: a batter's AVG and temp by zone 01-09, season through the day BEFORE the game (#2568). **Spoiler-free**, the one exception to the reveal-only rule above: no game data, `endDate` = `dayBefore(officialDate)` (ADR-0088). |
