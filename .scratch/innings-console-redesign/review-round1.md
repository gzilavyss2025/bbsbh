# Round 1 design review (subagent report, 2026-10-02)

A design-review subagent wrote this report after round 1. It judged the four
studies (A console tuned, B scorebook box, C night broadcast, D card deck) against
the #22 constraint, and it proposed the harmonized design H. It is kept as the
reasoning record.

**Gary overrode parts of it in rounds 3–5.** Where this file and `README.md`
disagree, `README.md` wins. The main overrides:

- A4's pip shapes and legend (open ring, solid, foul tick) are gone. Pips are
  numbers and X only.
- The "runner deck" became the three-slot bases strip, which folds when empty.
- "Rest of half" is removed.
- The Next button no longer names the batter. The batter is named once, in the
  at-bat card.

Source tags in the original report: **[repo]** means a repo file says so;
**[feed]** means the claim was checked against live gamePk 818039; **[inferred]**
means the reviewer's own judgment. The reviewer could not confirm the #22 layout
on the web. Its #22 claims come from `AtBatBox.jsx` and `ScorecardSheet.jsx`.

## Verdicts by change ID

| ID | Verdict | Reason |
|---|---|---|
| S1 one-row header | keep | About 170px saved. `RollingLine` must stay reachable: its cells are the only way to jump more than one half (ADR-0043 §4). |
| S2 Next names the batter | keep, then dropped in round 4 | Must read the same whether or not the next at-bat ends the half. |
| S3 linescore fits at 390px | keep | Fixes a real clipping bug. |
| S4 pre-pitch changes up front | keep | ADR-0010 already does it. |
| A1 status line | keep (later trimmed to the pitch count) | |
| A2 scorebook tiles | keep, slot added (slots removed again in round 4) | |
| A3 code inside a diamond | drop | On the #22 the outcome goes top-left and the fielding chain in the diamond center. B1 does this correctly. |
| A4 pitch pips | adapt | Replaces the letter string. |
| A5 batted-ball line | keep, one quiet line, after reveal | Helps judge hit vs. error. Not a #22 field. |
| B1 scorecard box as hero | keep | Render the real `AtBatBox` scaled, not a new drawing. |
| B2 inning column beside the hero | drop | About 40% of the width at 390px. Repeats the trail and `/scorecard`. |
| B3 handwriting font | drop | 6-3 vs 8-3 must read at a glance. The repo uses JetBrains Mono for notation. |
| B4 Retrosheet pitch string | drop | Gary asked for this. |
| C1 dark stage | drop | A theme concern, not a layout one. |
| C2 strike zone and pitch list | adapt | An optional tap to open. Its numbers match the ladder's. |
| C3 lower-third banner | drop | ADR-0043's 180ms denotation beat already marks the reveal. |
| C4 spray chart | drop from the console | A whole-half view. |
| D1 card stack | drop | Gary asked for this. The trail does the job. |
| D2 envelope | adapt | Became a still kraft seal on the hero box, with no flip. |
| D3 closing card | adapt | Became the band's foot-row ink-in. |

## Runner movement, as the reviewer specified it

- Each runner box is that man's own `PlayDiamond`: a path traced one segment per
  base, the mark written outside the base reached, a solid fill when he scored
  (red outline if unearned), and an out drawn as a half-leg capped by a clay tick
  with the out code beside it. [repo]
- Ordering: `runners[].details.playIndex` indexes `playEvents[]`. Count `isPitch`
  events before it to get the pitch number. In 818039, B5, the WP action sits at
  index 4 after pitch 4 and the steal of 3rd at index 6 after pitch 5; the
  batter's legs sit at index 7, the in-play pitch. [feed]
- Wording follows `runnerPitchLabel`: SB, CS, WP, PB and BK are "Pitch 5 · SB …";
  a pickoff is "After pitch 2". [repo]
- Runners keep the marks from their own earlier plate appearances; this one adds
  segments. A pinch runner adds a red "PR" and his number by the base. [repo]
- Possible bug flagged [inferred]: an error leg right after a steal takes the
  batter's slot superscript, because `error` is not in
  `NO_SLOT_CREDIT_EVENT_TYPES`. The design session confirmed it on 823166 bot 1st
  (`E2³`). The reviewer suggested also checking gamePk 817477.

## Pitch sequence, as the reviewer specified it

A two-lane ladder, the #22 strip laid on its side: a BALL lane and a STRIKE lane,
each pitch at its sequence position, numbered exactly as `pitchLadder` numbers
it (thrown pitches only; `A` for an automatic call; `X` in play). Under the
track: this at-bat's P / WH / FO and the half's running totals, so the foot row
can be filled. Throw-over attempts (`type: 'pickoff'` events) are optional and
not #22 fields.

## Spoiler rules the reviewer set

- Build runner boxes from `computeHalfInningFeed` capped at the CURRENT mark,
  never cap + 1 (ADR-0072 proves the pattern).
- The sealed layout must not depend on the hidden plate appearance (ADR-0046):
  a fixed-height track with no placeholder pips, no space reserved for flags.
- The Next label must not reveal the third out.
- Counts run only through revealed entries; the half's P/WH/FO inks on commit
  (ADR-0047, "mid-step, only cards").
- A pinch runner or a change after pitch 1 stays sealed until the reveal
  (ADR-0010's `halfIndex <= revealedThrough + 1`).
- Departed boxes appear only after the reveal and fall away at the next sealed state.
