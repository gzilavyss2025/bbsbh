# World Series scouting report: wireframe (#2316, step 0)

A wireframe prototype. It is not product code and does not merge as a feature.
The build waits for PR #2317 (ADR-0117) to merge and read "Accepted".

## How to open it

```bash
npm run dev
# off day (2026-10-22, before gamePk 849805):
http://localhost:5173/.scratch/ws-scouting/index.html?day=off&nointro
# game day (2026-10-23, gamePk 849805, Milwaukee):
http://localhost:5173/.scratch/ws-scouting/index.html?day=game&nointro
```

Phone below 740px, wide at 740px and up (resize the window). `shot.mjs <dir>` writes
all four screenshots.

## What is real and what is a placeholder

- **Opponent:** the Rays (they lead the ALCS 3–2; Game 6 is tonight).
- **Real:** the three meetings (`823809`, `823807`, `823806`, from the MLB feed by
  `fetch-meetings.mjs` into `meetings.json`): score, hits, errors, decisions, plate
  umpire, both starters' lines and pitch mix, scoring plays, lineups. Nine Keys ranks
  (`public/data/nine-keys.json`). Misiorowski's pitch mix on the Pitch by pitch card.
- **Placeholder:** every other number. Each such card carries a "Placeholder numbers" tag.
- Existing cards (Hero, Ledger, Reel, Probables, Tale of the tape, Hot bats, Played,
  The trip, Home and road, Bullpen) are grey stubs. They do not change.
- The dashed blue tags on each card (slice, day types, verdict) are wireframe notes.

## Proposed order

All new cards sit under one band head, **Scouting report**, after the existing cards
that lead the page. The band carries one door: **One-sheet** (view 8, the print sheet).

**Off day** (phone order; wide pairs in brackets):

1. Hero, [Ledger], Reel (existing)
2. Scouting report band, with the One-sheet door
3. [Nine Keys | Glove and legs]
4. [Matchup edges | Pitch by pitch] for the next game (849805)
5. [Platoon | Park fit]
6. Film room (phone: a snap rail of three games; wide: three across)
7. Played (phone), The trip, [Home and road | Bullpen] (existing)

**Game day:**

1. Hero, [Ledger], Reel, Probables (existing)
2. Scouting report band
3. [Matchup edges | Umpire edge] for tonight
4. [Pitch by pitch | Platoon]
5. [Tale of the tape | Hot bats] (existing)
6. Film room, compact (score and decisions only, plus the Box score door)
7. [Park fit | Bullpen]. Park fit shows only when tonight's park is Milwaukee.

Why the game-day cut: tonight's cards (matchups, umpire, pitch types, platoon) sit
next to Probables. Season-long cards (Nine Keys, Glove and legs) repeat Tale of the
tape on a game day, so they are off-day only. Film room stays but shrinks.

## Verdict style per card

| Card | View | Slice | Verdict | Day types | Player links on game days |
| --- | --- | --- | --- | --- | --- |
| Nine Keys (as built) | 4 | 1 | Numbers on a 1–30 track; a failed key is struck | Off days | No |
| Glove and legs | 4 | 2 | Mark on the leader (stamped box on the better figure) | Off days | No |
| Matchup edges (as built) | 2 | 1 | Numbers only; Hitter/Pitcher pill | Both | **Yes** (`PlayerLink`) |
| Umpire edge (as built) | 7 | 1 | Numbers only (the five-tier lean) | Game days, once posted | No |
| Pitch by pitch | 3 | 2 | Edge mark ("Arm" or "Bats") with the xwOBA behind it | Both | No (Door to Scout) |
| Platoon | 5 | 2 | Mark on the leader (`ww-best`); the row for the opposing starter's hand is highlighted | Both | No |
| Park fit | 6 | 2 | Numbers only | Off days; game days at MIL | No |
| Film room | 1 | 1 | Numbers only | Off days full, game days compact | No (Box score door) |
| One-sheet door | 8 | 2 | — | Both | No |

## Notes for the build

- Series Starters is not mounted: it overlaps Probables (the issue says pick one).
- Matchup edges on an off day reads the next game's gamePk (849805). Confirm
  `career-matchups.json` has a row for it before Game 1.
- Glove and legs has no confirmed source. Nine Keys holds no defense or baserunning
  key (its nine: runs, runs against, rotation, bullpen, on base, power, contact, WHIP,
  talent). Check `src/api/savantPercentiles.js` next; else a new generator.
- Film room's Box score door is a plain link. It sets no flag and writes no
  `bbsbh:boxreveal:*` key (ADR-0117, Alternative D).
- Park fit for Games 3 to 5 needs the Rays' or Guardians' park panel beside Milwaukee.
