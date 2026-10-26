## Design round 2: Gary's locked choices (2026-10-26)

Artifact (private to Gary): https://claude.ai/artifact/KQnaidLRwyBnVJYXrg9AYa (version 5 is round 2 as locked)

Round 2 ran in two drops. Every frame is layout B at round 1's boxes, in the app's tokens, on real data from gamePk 824716: the top 2nd, the bottom 6th (Duran's at-bat with the wild pitch) and the bottom 9th (the end of the game). Source and tools: `.scratch/gameday-design/round2/` and `tools/` (README, "Round 2").

**Decisions (Gary, 2026-10-26, saved in the artifact)**

- **Swing: the bat rule is met.** Approved: Stance, Launch, Contact, Load, and the first two follow-through frames (extension, over the shoulder). Gary on the bat rule: "Met; redo the two" (the bat may be drawn in the app). The finish pose is not approved. Gary: "bad, will fix in later session." The first redraw swept the bat backward after contact ("the follow-thru is wrong on the swing animation"); the second turns it the same way as the swing.
- **Colours: "B: bright game colours".** The panels stay in paper tokens; the stage keeps the 16-bit palette as 34 new `--stage-*` tokens that only the stage reads (29 stage slots, 5 zone-map temperatures). `npm run lint` passes on tokens.
- **Checkpoint (#2572).** All the pages that fit (the phone cycles), labelled tabs. After the third out the advance control names the next half ("Bottom 2nd ›"). End of game: the checkpoint, then "Close the book ›", then the box score. The score-free notes (`between-innings.js`) are a **fifth page**. Gary on the pages: "needs pitches thrown in that inning, whiffs and foul balls". The tally page now shows the half's pitches, whiffs and fouls, and page 2 has a fouls column per pitcher.
- **"See the whole half": nothing replaces it.** The trail and the navigator reach every at-bat; the desktop keeps the event log.
- **ADR-0123's wireframe questions.** The advance control reads "Next play ›" in at-bat mode and "Next pitch ›" in pitch mode, the same on every tap within a mode (decision 3). The pitch-by-pitch control is a two-way switch in the bar: "At-bat | Pitch". A pitch sub-step plays that pitch, keeps its numbered mark, and adds its number to the open box's B or S column; the diamond and code stay under tape. A mid-at-bat event is a lower third on the stage with the runner's box and the new leg (Durbin, WP). Both "right as drawn". One sealed height throughout (decision 4).
- **ESPN ideas.** The zone map at rest: the tint in the pixel zone and the numbers in a corner card, batting average, pre-game numbers. Gary: "have the ability to dismiss the zone in the top right." The silhouette is not used: "the espn theme shows the batter facing the screen, where our concepts show the batter facing away". Gary wants it filed "as an example for future reference"; where it lives is in the README (ESPN's art is not copied into the repo).
- **Breakpoints and fold order: as proposed.** Largest size whose minimum the window meets: Desktop ≥ 1200 × 780; iPad landscape ≥ 1000 × 700 and landscape; Tablet portrait ≥ 740 × 900; else Phone. The widths are already on the width guard's list. Fold order: event log, pitches panel, batting order and reference tabs, trail, navigator. Never: band, stage, hero with the scorebook box, bar.
- **Field tab.** Gary's artifact comment: "replace the "field" list with the svg of the field and the defensive alignment like it is on the lineups page today". Done: FieldCard's park with surnames at the spots.

**Found**

- The zone map's plain season total includes the scored game (and later games). With `endDate` = the day before, it is pre-game: for Arozarena, 8/31 to 9/1 changes exactly the five zones of his 9/1 at-bats (zone 5, the home run: .250 to .261). MiLB not checked.
- The notes need a callout bundle, which the nightly job keeps only for recent dates (10/17 to 10/27 now). 824716 has none, so today's app shows no notes for it; the Notes page borrowed 849817's.
- `checkpoint.js` page 2 has no fouls. Counting `FOUL_CODES` gives 4 for 824716 top 2nd, matching today's tally. #2605's model needs a `fouls` field.
- A wild pitch is its own action event after the pitch (824716, atBatIndex 57), so it is its own sub-step; a mound visit trails pitch 1.
- A called third strike carries `calledLooking: true` and no `code` (824716 atBatIndex 55, Sogard): the app draws the backwards K from that flag, so the Gameday scorebook box must too.
- Today's FieldCard shows one alignment per game; Gameday's Field tab needs the defense as of the cursor (824716 changes it in the 7th).

**Decided after the round (Gary, interview)**

- Finish pose: ship today's finish for now ("Use today's finish for now"); replace it when Gary fixes it.
- Zone map dismiss: closed for this game, through a reload (per gamePk, like the pitch-mode flag).
- Notes with no callout bundle: hide the Notes tab.
- Field tab: the defense as of the reader's cursor, revealed substitutions only.
- Other event cards follow the wild-pitch card; the build PR sends a screenshot of each.
- ADR-0123 gets a short amendment in the first build PR: the advance words follow the mode and never change within it.
- Fouls go into `checkpoint.js` in the first checkpoint build slice (#2572), with a test (824716 top 2nd: 4).

**Still open**

- The swing's finish pose (Gary, later session).
- Height breakpoints have no guard.

---
_Generated by [Claude Code](https://claude.ai/code)_
