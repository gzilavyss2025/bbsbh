# Lineup page redesign: the plan

Status: **swapped** (2026-10-14). The new page is the lineup page on `/{date}/{matchup}/lineup1`
and `/lineup2`. It was built behind `?look=new` first, and one swap PR removed the flag and the old
page (`screens/TeamInfo.jsx`).

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
| S0 | Plan, `?look=new` flag, page shell | done |
| S1 | Hero, fact grid, umpires, jump bar, dock | done |
| S2 | Starting pitcher card, pitch mix, scene | done |
| S3 | Batting order, bench, roster fallback | done |
| S4 | Defensive field, former teammates | done |
| S5 | Season series, bullpen | done |
| S6 | Crest, ballpark and umpire sheets on one frame | done |
| Fidelity pass | Hero, facts, crew strip sized to its count, page grid and rail, dock, starter strips, pitch mix card, order rows, bullpen, series, sheets: matched to the artifact | done |
| S7 | Tests, docs, swap PR (deletes the old code) | |

## After the swap

- The old page, `TeamInfo.jsx`, is deleted. `RefreshButton` moved to `components/ui/control/`, and
  the small parts both pages shared moved to `screens/lineup/parts.jsx`.
- Gary's decision to delete the three doors means nothing on the lineup page links to the preview
  card, the blank scorecard sheet or Express Lane now. Their routes still exist. The e2e test for
  the preview-card door was deleted with the door.
- Old CSS that only the deleted page used (`.lineup__*`, `.starter__*`, `.teaminfo__*` in
  `10-lineup.css`, `09-team-info.css`, `44-pre-game-cards.css`) is not removed yet. Several tests pin
  those rules, so removing them is its own change.
- Components that only the old page used (`StarterMatchups`, the live `FormerTeammates` card) are
  still in the tree. Check each for other callers before deleting. (`ExpressLaneDoor` went with
  Express Lane in the Gameday swap, #2566.)
