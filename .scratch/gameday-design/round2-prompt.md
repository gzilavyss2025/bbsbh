# Round 2 prompt: Gameday design round (#2568)

Written 2026-10-26 with the `write-prompt` skill, from round 1's handoff. Paste the block below
into a new cloud session that Gary watches.

| # | What it does | Model | Effort | Depends on | Parallel with |
| --- | --- | --- | --- | --- | --- |
| 1 | Round 2 of the design round: interview, a new artifact, Gary's verdicts, the record | Opus 5.5 | high | `.scratch/gameday-design/` on `main` (or its branch) | none |

Why this rung: it is a design-decision round on a scoring surface (the checkpoint, sub-steps and
the event card must keep ADR-0046 and ADR-0123), with a long interview. Rung 7 in the
`write-prompt` design table ("Design decision or ADR"). Spend the effort on checks, not on more
directions.

## Prompt 1 of 1 — Opus 5.5, effort high

```text
Run round 2 of the Gameday design round (#2568) in a session that Gary watches. This is design
work only. Do not change app code (src/, api/, test/, e2e/).

READ FIRST
- .scratch/gameday-design/README.md: the round 1 handoff. If the folder is not on main, fetch the
  branch claude/gameday-design-round1 and read it there.
- #2568 and all its comments (GitHub MCP tools; there is no gh CLI). Most important: the comment
  "Design round 1: Gary's locked choices (2026-10-26)". Also #2566 (the umbrella), #2572 (the
  checkpoint), #2570 and docs/adr/0123-sub-step-stepping-inside-an-at-bat.md (sub-steps), and
  #2569 (the chase camera).
- src/api/gameday/CLAUDE.md, src/api/gameday/checkpoint.js (PAGE_ORDER), src/api/between-innings.js
  and src/lib/gameday/flightPath.js. These are the engine that a build will use.
- .claude/skills/design-brief/references/design-rules.md and src/styles/CLAUDE.md. Use the
  design-brief skill's interview pattern and its rules. Do the design yourself: that skill's normal
  output is a prompt, and here the output is the artifact.
- The round 1 artifact, https://claude.ai/artifact/BCZgTVQDbXUheJiypLsXtu. Read it with the
  Artifact tool (action "read"), not WebFetch. Read Gary's saved feedback with the ArtifactData
  tool (action "list", collection "feedback").

SETTLED IN ROUND 1 (do not reopen; ask Gary before you change any of it)
- Layout direction B: panels around the stage. The size ladder is in
  .scratch/gameday-design/prototype/ladder.js (DIRS.panels).
- The stage look: 16-bit sprites (prototype/concept-sprites.js) is the baseline. Paper diorama,
  broadcast flat and low-poly 3D are dropped. 2D, not 3D.
- The ranking of the 99 blocks (prototype/ranking.js and see.js), with Gary's notes on rows 12, 20
  and 35.
- The scorebook box: two columns, B and S, with pitch numbers and an X; the diamond; the code; the
  RBI; the out number. It shows at every size, large enough to copy from. Never one row of pips.
- Square corners. No sound and no haptics. No vertical or horizontal scroll at the four sizes.
- A ground out shows the throw from the fielding credits (for example 4-3).

ROUND 2 COVERS
1. The swing stills. Ask Gary for a verdict on each of the five poses first (approve or needs
   work). Until he approves, the 2026-10-07 rule holds: no bat drawing in the app.
2. Tokens. Show the 16-bit stage and layout B two ways, side by side: in the app's paper tokens
   (the "Tally Baseball" design system, https://claude.ai/artifact/LC1nH3QEJ5BFpK4briDanu), and in
   one new palette for the stage only. Gary chooses after he sees both. A new palette must become
   tokens, because npm run lint fails on raw values (scripts/check-raw-values.mjs).
3. What replaces "See the whole half". Show two or three candidates: the checkpoint's at-bats page;
   one line per play with a star on scoring plays (The Show 13's post-game list); nothing.
4. The checkpoint (#2572). Draw the four pages in PAGE_ORDER (tally, pitching, atBats, gameSoFar) at
   each size, with real numbers from checkpoint.js for gamePk 824716, top 2nd. Show how the pages
   cycle (tap, arrows or swipe), whether the advance control says "Bottom 2nd ›" with a page strip,
   the end-of-game checkpoint before the box score ("Close the book ›"), and where the score-free
   facts from between-innings.js go: a fifth page, the menu, or nowhere.
5. ADR-0123's wireframe questions: the advance control's words, the place and look of the
   pitch-by-pitch button, how a sub-step looks on the stage, and how a mid-at-bat event card looks.
   Keep ADR-0123 decision 3 (one label in every state) and decision 4 (no count of taps, one sealed
   height; ADR-0046).
6. The ESPN candidates (#2568 step 0, item 8). The batter zone map as the stage's resting state:
   before you show one, check whether the hotColdZones season total includes the game being scored.
   The batter silhouette: Gary decides whether it counts under the bat rule.
7. The breakpoints between the four sizes, and the order in which blocks fold.

HOW TO WORK
- Read Gary's saved round 1 feedback before you ask anything, so you do not ask what he answered.
- Interview Gary before you build: one AskUserQuestion per call, your recommendation first and
  marked "(Recommended)", until you know the order and scope of round 2.
- Build a NEW artifact, "Gameday Design Round 2", from the round 1 source in
  .scratch/gameday-design/prototype/. Keep the db and user capabilities and the feedback pattern
  (collection "feedback", one document per item). Do not change the round 1 artifact.
- Use real data only: gamePk 824716 and the pinned games in docs/test-games.md. Check every number
  against the feed before you show it. Sizes: 390 x 763, 760 x 1024, 1180 x 820, 1440 x 900.
- Keep the spoiler rule in every wireframe: a value that reveals the play exists only after the
  reveal tap; one sealed height per size; the checkpoint reads only a half at or under the reveal
  mark, and its last half keys on revealedThrough against finalHalfIndex (ADR-0043), not on
  selectIsFinal.
- Check your own screenshots before Gary sees a version: the tools are in
  .scratch/gameday-design/tools/ (README, "Tools"). The page must not scroll sideways at 390 px.
- Show Gary the link early and update it as you go. Read his feedback store after each round of
  his edits.

DONE MEANS
- The round 2 artifact is published and Gary has said his choices are locked.
- A comment on #2568, "Design round 2: Gary's locked choices (<date>)", with the artifact link,
  each decision in Gary's words where he gave them, what you found, and what is still open. If Gary
  approved the swing stills, say that the bat rule is met.
- .scratch/gameday-design/README.md has a round 2 section, and the round 2 source is in
  .scratch/gameday-design/round2/. Leave prototype/ as round 1 published it.
- One draft PR from a task branch with those files. Run npm run lint before you push. Never push
  to main and never merge. Remove the wip label when CI is green.
- End your report with "Blocked on me", "Changed" and "Found". Mark what you could not confirm.

STOP AND ASK GARY WHEN
- A choice would change a decision settled in round 1.
- A design needs data the app does not fetch.
- You cannot read the artifact's feedback store: ask him to paste his choices in chat.
```
