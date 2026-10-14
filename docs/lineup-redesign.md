# Lineup page redesign: the plan

Status: **slice S0** (2026-10-14). The new page lives behind `?look=new` on
`/{date}/{matchup}/lineup1` and `/lineup2`. The live page does not change until one swap PR.

This plan moves the away and home lineup pages to the new look of the player page
([player-redesign.md](player-redesign.md), ADR-0109). The design is a mockup that Gary
approved on 2026-10-14. It is kept in `.scratch/lineup-redesign/`.

## Decisions (Gary)

- No matchup-notes toggle on the batting order. No per-row pills.
- Delete the three doors: the preview card, the blank scorecard, and Express Lane.
- Box weather is not shown. It stays only as the fallback when the weather is missing.
- Keep the live Former teammates design (the real Ladder). Only tweak its CSS to the new fonts.
- The pitch-arc scene shows inline on wide screens and in a sheet on a phone.
- The postseason series mark sits in the banner.
- Ballpark and uniform open in sheets. Umpire Tendencies is a sheet.
- The bullpen board uses one colour (pitched, rested, today).
- The starter card has career and last-start strips.
- The defensive field shows names only, on the real park layout.
- Former teammates and the bullpen are folded by default.

## Spoiler footing

The lineup pages are a scoring surface. The new page keeps the rules of the live page:
season series blanks the current and later games; pitcher lines end the day before the
game (ADR-0088); a completed game's career and starter lines exclude the game itself;
nothing is fetched and then hidden.

## Slices

| Slice | Content | State |
| --- | --- | --- |
| S0 | Plan, `?look=new` flag, page shell | in progress |
| S1 | Hero, fact grid, umpires, jump bar, dock | |
| S2 | Starting pitcher card, pitch mix, scene | |
| S3 | Batting order, bench, roster fallback | |
| S4 | Defensive field, former teammates | |
| S5 | Season series, bullpen | |
| S6 | Uniform, ballpark and umpire sheets | |
| S7 | Tests, docs, swap PR (deletes the old code) | |
