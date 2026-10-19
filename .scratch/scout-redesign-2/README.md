# Matchup Scout: fix the visual differences (round 2): run plan and slice specs (#2319)

Gary compared the live page with the design canvas and marked each difference. This plan
fixes the ones he marked "Needs a fix". It is the second pass of #2319; the first plan is
`.scratch/scout-redesign/README.md` and the decisions are ADR-0118. Every slice agent
reads this file and `.scratch/scout-redesign/README.md` ("Shared rules") first.

- **Canvas:** https://claude.ai/artifact/XFBPUYkP8Xf8VSs4dvV7rm. Phone board `Main.dc.html`
  (390 px), desktop board `Desktop.dc.html` (1280 px). Read it with the Artifact tool
  (`action: "read"`). If it does not open, stop and report; do not guess the look.
- **The report:** `.scratch/scout-redesign/compare/report.md`. Each item `Vnn` has a canvas
  and a live description, and a paired screenshot in `.scratch/scout-redesign/compare/shots/`
  (`Vnn-canvas.png`, `Vnn-live.png`). Look at both pictures before you change anything.
- **Data is not design.** The canvas used frozen 2026 numbers. Do not copy its numbers, its
  four "things to watch", or its "Chourio saw no cutters" sentence. Copy the look.

## Gary's answers (settled; do not reopen)

| Fix these | Items |
| --- | --- |
| Matchup card | V01 (phone), V22 (desktop) |
| Where map and layout | V04, V20 (map scale, frame, figure), V19 (desktop: map first) |
| Where controls and readout | V09, V15, V16, V17 |
| Pitch rows | V13 |
| Edge | V11 (headshots), V21 (desktop row) |
| Meetings | V05, V25 (card and desktop layout), V06 (colours), V10 (facts grid) |
| Corners | No rounded corners anywhere on the Scout page |

**Leave alone (Gary said OK):** V02 (scene place), V03 (no section headings), V07 (jump bar
scrolls on phone), V08 (verdict type size), V12 (uppercase pitch-row labels), V14 (pushes
card), V18 (no threshold note), V23 (four desktop tabs), V24 (an odd count leaves a gap),
V26 (page header). A slice that finds itself editing one of these stops and reports.

**Settled design calls:**

- **Corners.** All square: cards, tiles, chips, pills, buttons, headshots and bars. Pitch
  marks (circle, diamond) and the map swatch dots keep their shapes, because the shape is
  data. Slice F does this with the radius tokens (below); the other slices write no
  `border-radius` at all.
- **V17, a cell picked at load.** At load, pick the hitter's hottest region (the one where he
  does the most damage), so the readout shows real numbers. If there is no map data, pick
  none and keep "Tap a region for its numbers". Never pick a region with too few pitches to
  show a value.

## Run plan

Slice 0 is this folder plus the report on `main`: `/stack-prs` lands PR 2367 (the report and
screenshots) and the PR that carries this file. It must be on `main` before any slice starts.

| # | Slice | Items | Model | Effort | Depends on | Parallel with |
| --- | --- | --- | --- | --- | --- | --- |
| B1 | Where map: scale, frame, figure; desktop map first | V04, V20, V19 | Sonnet 5.5 | high | 0 | D, E |
| D | Edge: square sage headshots; desktop verdict row | V11, V21 | Sonnet 5.5 | medium | 0 | B1, E |
| E | Meetings: card, facts grid, pitch colours, desktop layout | V05, V06, V10, V25 | Sonnet 5.5 | high | 0 | B1, D |
| B2 | Where controls: answer strip, Show/Metric rows, Locations tint and counts, readout, tiles, cell at load | V09, V15, V16, V17 | Sonnet 5.5 | high | B1 merged | A, C |
| A | Matchup card | V01, V22 | Sonnet 5.5 | medium | 0 | B2, C |
| C | Pitch rows: All pitches and selected states | V13 | Sonnet 5.5 | medium | 0 | A, B2 |
| F | Square corners across the Scout page | corners | Sonnet 5.5 | low | all of the above merged | — |

**Waves** (cap: 3 child sessions at once; Gary allowed one extra for a short time before):

1. B1, D and E start together.
2. When B1 is merged: B2, A and C start together.
3. When all six are merged: F.

The model picks follow `.claude/skills/write-prompt/SKILL.md`:

- **B1, B2 and E** carry layout and restructure judgment across several files: Sonnet 5.5 at high.
- **A, C and D** follow a spec and an existing pattern: Sonnet 5.5 at medium.
- **F** is one token override plus a check: Sonnet 5.5 at low.
- **If a result comes back weak,** raise the effort on the same model first. Change the model only after that.

**Why this order.** B1 and B2 both edit `zones/ZonesPanel.jsx`, `zones/MapParts.jsx` and
`where.css`, so B2 waits for B1. D, E, C and A each own their own folder and sheet. A and B2
both touch `scout.css` in different rules; the stack merge handles it, and each slice
lists the open PRs and their files before it edits. F goes last because it changes shared
radius values that every other slice's screenshots depend on.

Each slice is one PR. Its body says `Part of #2319`, never `Closes`. Gary closes #2319 by
hand after the last slice lands. The PRs land through `/stack-prs`.

## File ownership

| Slice | Owns |
| --- | --- |
| B1 | `src/screens/scout/zones/MapParts.jsx`, `src/screens/scout/zones/ZonesPanel.jsx` (layout and frame only), `src/styles/scout/where.css`, `src/styles/scout/panels.css` (the desktop grid block), `src/components/scout/ScoutMap.jsx` |
| B2 | `src/screens/scout/zones/ZonesPanel.jsx` (controls, readout), `src/screens/scout/zones/callout.js`, `src/components/scout/Choice.jsx`, `src/screens/scout/ScoutPage.jsx` (the Where wrapper lines and the picked-at-load state only), the Where control rules in `src/styles/scout/scout.css` |
| D | `src/screens/scout/edge/*`, `src/styles/scout/edge.css` |
| E | `src/screens/scout/meetings/*`, `src/styles/scout/meet.css` |
| A | `src/components/scout/Matchup.jsx`, `src/screens/scout/ScoutPage.jsx` (the Matchup and chip lines only), `src/screens/scout/FilterSheet.jsx`, the head and chip rules in `src/styles/scout/scout.css` |
| C | `src/screens/scout/pitches/PitchRows.jsx`, `src/styles/scout/pitches.css` |
| F | the radius token overrides, in `src/styles/scout/panels.css`; no other file unless a hard-coded radius needs it |

`Matchup.jsx` and `Choice.jsx` are also used by the design lab (`src/screens/designlab/scout/`).
A slice that changes them must keep that page rendering. If the design lab needs a change
to stay valid, make it, and say so in the PR.

## Shared rules (every slice)

Read `.scratch/scout-redesign/README.md`, "Shared rules", and follow all of it: CSS guards,
copy and colour, contrast pairs, caps on files, no `SealBox`, test discipline, the
screenshot helper, the test pairs, and the handoff. These additions apply to round 2:

- **Compare, then change.** For each item, open `Vnn-canvas.png` and `Vnn-live.png`, and read
  the item in `report.md`. Fix the difference the item names. Do not fix a difference that
  is not on your list.
- **No `border-radius`.** Write none in any CSS you add or change. Slice F squares the page.
- **Pitch colours** come from `pitchMark(code)` in `src/lib/pitch/pitchTypes.js`, never chosen
  in a screen (`docs/pitch-types.md`).
- **Verify.** Run the tests you wrote or changed, the tests that import a file you changed,
  and `npm run lint`. Start `npm run dev` and screenshot your route at 390 px and 1280 px
  (1280 x 1000) for Pivetta 601713 vs Chourio 694192:
  `/scout/nick-pivetta-601713/jackson-chourio-694192?nointro`. Send the live shot next to
  the canvas shot for each item with `SendUserFile`, naming the item id.
- **Retired and missing-data pairs** (slice 7b) must keep working: check Bonds 111188 vs
  Maddux 118120 at 390 px if you touch Meetings or the page wrapper.

## Slice specs

### B1. Where map: scale, frame, figure (V04, V20, V19)

- **V04 (phone).** The report's canvas numbers: a full-bleed cream panel with ink rules above
  and below; rows 72 / 44 / 58 / 58 / 58 / 44 / 42 px; the six columns use the full width
  (a 104 px figure column plus five cells); the batter figure about 203 x 430 px; a thin
  vertical line marks the batter's box; the share squares go up to 20 px; a panel header with
  the title on the left and "All · 263 pitches" style count on the right. Today the map is
  about 280 px wide with 30 px rows. Scale it to the canvas. Remove the extra "1,644 pitches
  seen" line only if the canvas count in the header replaces it.
- **V20 (desktop).** Same panel, filling the right column, a big grid and a large figure. The
  readout and key stay with B2 (they move inside the panel in B2).
- **V19 (desktop).** The right column starts with the map card. The scene (V02: stays above the
  jump bar, do not move it) must no longer push the map down on desktop: if the scene sits
  at the top of the right column today, move it out of the way as the canvas does (hot and cold
  tiles left, scene right, under the map) without moving it on phone. Fill the empty space
  beside the map.
- Keep the left-handed figure (slice 6b) and retired handling working.
- **Do not** add the readout, key, tiles, answer strip or controls. B2 owns them.

### B2. Where controls and readout (V09, V15, V16, V17)

- **V15.** The answer strip is a sharp 2 px ink box: "Expected xwOBA (est.)" and "All pitches
  · 72% of pitches mapped" on the left, the number at 30 px on the right with "league .308"
  under it. Show and Metric are two full-width segmented rows: a 58 px label and equal
  44 px buttons. Chips are 44 px high. Keep the existing "Leaves out curveball (30): too few
  for a map" information, in the new strip.
- **V16.** Locations mode paints each cell with a neutral ink-grey tint that grows with the
  pitcher's share, shows the share and the pitch count under it, and the title is
  "Where Pivetta throws" with the count at the right. Remove the salmon tint. Register any
  new contrast pair.
- **V17.** With a pitch selected, the answer strip's sub-line says "on his spots" where the
  canvas does. Pick the hitter's hottest region at load (see "Settled design calls") and
  show its readout.
- **V09.** The readout box for the picked region (name, "Pivetta 6% · 15 of 263 pitches",
  "Chourio .604 · 31 PA-ending pitches"), a five-swatch key bar with "◀ Pivetta's side ·
  league · Chourio's side ▶", and two tiles side by side: "Into his hot spots 14%" and
  "Into his cold spots 26%", each with a one-line list of regions. Replace today's single
  hot-spots paragraph and text key. The cold-spot share comes from the same region data as
  the hot-spot share in `zones/callout.js`; write its test first.
- Selected states of the pitch rows are slice C's, not yours.

### D. Edge (V11, V21)

- **V11.** In "Things to watch", the headshot is a 56 px square with a sage background and an
  ink border. The text is 12 px per the canvas only if a `--fs-*` token matches; otherwise
  keep 13 px (`--fs-small`).
- **V21 (desktop).** The verdict card is wide and short, with "Even" beside its sub-line on one
  row and the scale below. "What pushes it" is a narrower card on the right. The long note
  ("xwOBA (est.) counts every plate appearance …") runs across the full width under both
  cards, outside the pushes card. Remove the empty dark area. Phone (390 px) is unchanged.
- Do not change the verdict type size (V08 is OK), the pushes card style (V14 is OK) or the
  odd-count gap in the grid (V24).

### E. Meetings (V05, V06, V10, V25)

- **V05.** The plate-appearance card is two columns. Left: a scorebook cell with the inning
  ("1st"), a small diamond with the scoring mark inside ("6-3", "L8", "L6"), and the result
  under it ("Groundout"). Right: the pitch rows first (number, pitch mark, name and mph,
  "Count b-s", the call tag), then a three-column "Exit velo · Launch · xwOBA" line, then the
  play text (the last-name rule from PR 2363 stays). The game header reads, for example,
  "Sep 22, 2025 … Regular season · 3 PA", right-aligned label. The scoring mark comes from
  the play's fielders; if the feed has none, draw the diamond with the result code instead.
  A test for the scoring-mark function comes first.
- **V06.** Meetings uses the same pitch marks and colours as the Pitches section, from
  `pitchMark(code)`, in the mix bars, the legend and the pitch rows. No green fastball, no
  hatched types. Keep today's sentence "Chourio saw no cutters in their meetings. …" (better
  copy than the canvas).
- **V10.** The facts are one square 3 x 2 grid of six facts: Line, Pitches, K · BB, Slash,
  Avg EV, xwOBA con (caps label, 15 px bold value), under a "Past meetings" title. The
  wrapping grey stat line goes away.
- **V25 (desktop).** The facts grid and the "What Chourio saw" bars sit at the left, and the
  plate-appearance cards in a three-column row at the right. The section is about 600 px tall
  instead of about 1000 px.
- The PitchModal and the retired-player path (slice 7b) keep working.

### A. Matchup card (V01, V22)

- **V01 (phone).** One stamped card: hard 4 px shadow, ink border, an ink "Matchup" name tab and a
  "Change pair" button on its top edge. Inside: a 56 px square headshot with a sage
  background and an ink border for each player, the last name in 22 px caps, "Throws R" /
  "Bats R" with the club logo, and a 4 px side bar under each name (pitcher blue, hitter
  amber, the side colours in the shared rules). A "Filters · Both hands · Regular season ▾" row
  sits inside the card, replacing the separate chips and button.
- **V22 (desktop).** One wide card: Pivetta at the left, Chourio at the right, "vs" in the middle,
  names about 34 px next to the headshots (the plan's slice 8 said 96 px headshots; use the
  canvas: read it), side bars, the filters row along the bottom with "Change pair" at the
  right end.
- Keep the filter sheet, the "Change" flow and the pickers working. Keep the design lab
  (`ScoutLab.jsx`) rendering.

### C. Pitch rows (V13)

- "All pitches" at load is an ink-filled button (cream text) with the count ("330 to righties"
  style, as the canvas words it for today's data). A selected pitch row keeps its 2 px ink
  border and gets a 4 px hard ink shadow (offset down and right). The chip and "All"
  invert to ink when selected. Remove the green ring. Do not change the row labels
  (uppercase stays, V12), the bar outline, or the 1 px / 2 px row border except on the
  selected row, if the canvas shows 2 px there.
- The Where chip strip's selected state is B2's if the canvas differs; do not touch it.

### F. Square corners

- **Method.** Scope a rule to the Scout page root (`.screen.scout`) in `panels.css` that sets
  `--radius-xs`, `--radius-sm`, `--radius-md`, `--radius-lg` and `--radius-pill` to
  `var(--radius-square)` (0). Every shared component under it then draws square.
- **Then check by eye and by code.** Grep `src/styles/scout/` and `src/components/scout/` for
  a hard-coded `border-radius` (a px value or `50%`) and fix each one that is not a pitch
  mark or a map swatch dot. Screenshot at 390 px and 1280 px for both the Pivetta/Chourio
  page and Bonds/Maddux. Check the design lab page and one other page that shares a
  component (the team page) is not squared: the override must stay inside `.screen.scout`.
- Pitch marks (circle, diamond), map swatch dots and the batter figure keep their shapes.
- The headshots (A and D make them square already) and every chip, pill, tile and button are
  square. Report any element you chose to leave rounded, with the reason.

## Prompts

Paste each prompt into one cloud session. Every prompt starts with the same lines, then its
own. Titles start `orch:` (the orchestrate skill adds them).

### Common head (every prompt)

```
Use the ponytail skill at level full. Reuse what the repo already has before you write
anything new.

Read CLAUDE.md, src/CLAUDE.md, src/styles/CLAUDE.md, docs/adr/0118-*, and these two
files in full: .scratch/scout-redesign-2/README.md and the "Shared rules" in
.scratch/scout-redesign/README.md. Read the design canvas with the Artifact tool:
https://claude.ai/artifact/XFBPUYkP8Xf8VSs4dvV7rm . If it does not open, stop and write
"NEEDS PARENT: the canvas did not open". List the open PRs and their files; stop and report
if one touches a file you own. Work on the branch the session gives you, cut from current
origin/main. Open a draft PR with the body "Part of #2319" (never "Closes"), push, and when
the work is done and CI is green remove the wip label. Never merge. Never push to main.
Do not run npm test or npm run build in full: CI does. Run the tests you wrote or changed,
the tests that import a file you changed, and npm run lint.

Keep working until everything asked for is done. Stop to ask only when you cannot go on
without the user, or before a risky step. When the work is done and checked, stop and
report; do not add features, tests, files or docs that were not asked for. Tests, docs and
checks that this prompt or CLAUDE.md names count as asked for. Write [DECISION: ...] for any
design choice this plan does not settle, and carry on with your recommendation.
```

### Prompt B1 — Sonnet 5.5, effort high

```
<common head>
Your slice is B1 in .scratch/scout-redesign-2/README.md: items V04, V20 and V19. Follow
its spec and its file ownership. Look at V04, V19 and V20 canvas and live pictures first.
```

### Prompt D — Sonnet 5.5, effort medium

```
<common head>
Your slice is D: items V11 and V21. Follow its spec and its file ownership.
```

### Prompt E — Sonnet 5.5, effort high

```
<common head>
Your slice is E: items V05, V06, V10 and V25. Follow its spec and its file ownership. Write
the test for the scoring-mark function first and watch it fail. Change a test whose
behaviour this slice changes on purpose in the same commit, and say which one in the PR.
```

### Prompt B2 — Sonnet 5.5, effort high (start after B1 is merged)

```
<common head>
Your slice is B2: items V09, V15, V16 and V17. B1 is on main: build on its map and panel.
Follow the spec and the file ownership. Write the test for the cold-spot share and for the
hottest-region pick first and watch each fail.
```

### Prompt A — Sonnet 5.5, effort medium

```
<common head>
Your slice is A: items V01 and V22. Follow its spec and its file ownership. Keep the design
lab page (src/screens/designlab/scout/) rendering.
```

### Prompt C — Sonnet 5.5, effort medium

```
<common head>
Your slice is C: item V13. Follow its spec and its file ownership.
```

### Prompt F — Sonnet 5.5, effort low (start after A, B1, B2, C, D and E are merged)

```
<common head>
Your slice is F: square corners. Follow its spec. Send Gary a before and after pair for
each of the four pages named in the spec.
```

## After all slices

Gary closes #2319 by hand. The nits listed on #2319 (the 157-against-154 badge, the missing
note for players absent from the season data, the design lab view animation, the "+.000"
count-up, the stuck pulse, the eager head-to-head fetch, old `?tab=` links) are not in this
plan; a later plan can take them.
