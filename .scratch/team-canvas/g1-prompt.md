# G1 prompt, filled in (paste into Claude Design)

Source: `.scratch/team-canvas/audit.md` (rows S4, S5, S5c, and section 3.2). Real Brewers (158) numbers are from the audit's measurements on 2026-10-15.
Add your own screenshots of `/team/158?nointro` at 390 px where the prompt says "screenshots".

```
Design the STANDING band of the team page, in the "Player Detail Page - Pitcher and Batter"
canvas look (https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK). Same house colours and
faces, square corners, stamped cards with the hard offset shadow, stat tiles, fact strip,
jump bar. Do not invent a new style. The look is fixed; only the LAYOUT varies.

Elements to draw:
1. HERO AND TILES (the first screen). Today the first screen at 390 px is about 420 px of
   chrome and then a division table. The season grade, run differential and form sit
   1,600 px or more down. Put the answer to "how is this club doing, and why" above the fold.
   Parts: one hero card (club logo plate in the club tint, name, level pill, fact strip with
   Manager / Ballpark / League · Division), then stat tiles: a lead ink tile for the record,
   plus run differential, form, season grade and an optional "Now" tile.
2. TEAM SCORE. The one number that says how good the club is (9.5, "Making it look easy",
   1st of 30) is today the sixth card, 2,068 px down, inside a card of reference rows. Split it:
   the grade leads in the hero; the league rails, rank strips and folded breakdowns stay as a
   stamped card.
3. RECORDS INDEX. The Records card is 3,236 px (61 rows, about 12 groups), 70% of the band.
   It has no way to see which group holds what. Draw a closed state with an index that
   unfolds, about 826 px closed.
4. INNING SCORING GRID inside Records: 9 innings x top/bottom, 4 lines per cell (W-L, pct,
   last date, result). 620 px at 390. Top and bottom of one inning are two columns apart and
   the cells are too tall to compare down a column.

Material to use (Brewers, club 158, 2026):
- Record 103-59, .636, 1st NL Central, 1st of 30 MLB-wide, clinch "z"
- Runs scored 832, allowed 618, differential +214
- Last 10: 8-2, streak W5
- Season grade 9.5 "Making it look easy", 1st of 30
- Screenshots of today's elements: <paste screenshots of /team/158?nointro at 390>
- MiLB version (club 249, Single-A): 4 tiles, no season grade, rank is division only.

Match the nearest player-page board for each part: hero -> the player header board;
tiles -> SeasonStats; fact strip -> the player fact strip; Records index -> Splits.

Step 1: for EACH element, draw 3 different layouts at phone width (390). The layouts must
differ in what leads and what is secondary, not in colour or type. Label them A, B, C.
Say in one line what each one makes easy to see. STOP here. Do not draw wide boards yet.
Step 2 (after Gary picks): draw the picked layout at 390 and 1180, for the Brewers, then the
reduced band for a Single-A club (249).

The first screen must answer: "what is going on with this team right now?"
Check yourself: view your own output at 390 and zoom in on each stamped card. Compare each
to its matching player-page board. List three differences and fix them before you hand back.
```

Send the picks to the orchestrator as one message, for example "Hero: B. Team score: A. Records index: C. Inning grid: A."
