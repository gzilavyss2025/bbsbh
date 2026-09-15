The "Longest runs" section on `/abs-challenges`. Depends on the streaks export cut and the page split.

**Design:** https://claude.ai/artifact/DdXwqNvni67o4MrJB3wkgY — artboard "Q4 - Longest runs".

## What it is

- A won/lost chip pair and a role chip row (everyone, catchers, batters, pitchers). **One chip scale only** — `.rpt-chip`'s: a 3px square chip on card paper, navy when on. A second, smaller scale with a different on-state makes a reader relearn the control halfway down the page
- Rows: the run length, the player, a pip row showing the run's shape, and the season total in a column headed **"Won of called, all season"**. That column head is what lets 10 of 14 and 16 of 88 read differently, so the table needs no sentence explaining itself
- Two slabs for the in-game board: longest run of wins is 5, longest run of losses is 2 — with the one sentence saying 2 is the rule and not a record

## Build notes

- Player and club names are links
- The pip cap must exceed the longest run in the data, or a record-holder draws short with no mark
- Pitchers are 172 of MLB's 9,413 challenges. Thin, but a real population and the only one where a man went 0 for 5, so the chip stays. State any minimum in the column head

## Acceptance

- Reads the `summary` it is given, so the level chip works
- Verified in a browser at 390px and 960px, local URL in the handoff
