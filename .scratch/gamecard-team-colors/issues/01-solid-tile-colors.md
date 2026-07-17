Status: needs-triage

# Solid per-team logo-tile colors on the slate card — parked, revisit Monday 2026-07-20

## Summary

The slate's `GameCard` logo tiles (`.gamecard__logobox`) currently fill with
a soft ~22%-alpha wash of each team's brand color (`teamTintColor`,
`src/lib/teams.js`). The user asked for a SOLID (no alpha) fill instead,
hand-specifying one color per MLB club. Implemented as a draft
(`GAMECARD_TILE_COLORS` + `gameCardTileColor(teamId)` in `src/lib/teams.js`),
but **not wired into `TeamMark`** (`src/components/GameCard.jsx`) — reverted
back to the `teamTintColor` wash for now.

## Why it was reverted

At full brightness/no alpha, at least one club's mark reads badly: the
Yankees' interlocking NY is large and dense enough (the tile already
overscales every mark past its own frame — `.gamecard__logobox .teamlogo`'s
`transform: scale(1.32)`, so marks bleed to the tile edges like a printed
badge) that it visually reads as "the whole tile is navy," even though the
fill underneath is the requested white (`#FFFFFF`). Other dense/large marks
(Reds' wishbone C, Pirates' P, Diamondbacks' A, Giants' SF) likely have the
same problem to varying degrees — wasn't checked past the Yankees case before
the user called a stop.

The user's word-for-word color picks (verified against real hex where
possible via the app's existing `TEAM_COLOR_PAIRS`/`TEAM_COLORS` maps in
`src/lib/teams.js`) are preserved in `GAMECARD_TILE_COLORS` so this doesn't
need re-deriving:

| Team | Color word | Hex |
| --- | --- | --- |
| Angels | blue | `#003263` |
| Diamondbacks | black | `#000000` |
| Orioles | black | `#000000` |
| Red Sox | blue | `#0C2340` |
| Cubs | red | `#CC3433` |
| Reds | black | `#000000` |
| Guardians | red | `#E50022` |
| Rockies | purple | `#333366` |
| Tigers | orange | `#FA4616` |
| Astros | orange | `#EB6E1F` |
| Royals | white | `#FFFFFF` |
| Dodgers | white | `#FFFFFF` |
| Nationals | blue | `#14225A` |
| Mets | blue | `#002D72` |
| Athletics | yellow | `#EFB21E` |
| Pirates | black | `#27251F` |
| Padres | yellow | `#FFC425` |
| Mariners | blue | `#0C2C56` |
| Giants | black | `#27251F` |
| Cardinals | blue | `#0C2340` |
| Rays | yellow | `#F5D130` |
| Rangers | white | `#FFFFFF` |
| Blue Jays | red | `#E8291C` |
| Twins | white | `#FFFFFF` |
| Phillies | blue | `#002D72` |
| Braves | white | `#FFFFFF` |
| White Sox | white | `#FFFFFF` |
| Marlins | light blue | `#00A3E0` |
| Yankees | white | `#FFFFFF` |
| Brewers | navy blue | `#12284B` |

MiLB clubs deliberately keep the existing `teamTintColor` soft wash — the
user confirmed "the minor league teams can stay as is for now."

## What "fixed" looks like

Needs a design pass before re-enabling — a few directions worth trying, none
picked yet:

- Shrink the mark's overscale (or drop it entirely) for tiles with a
  particularly dense/large logo, so more of the fill color shows at the
  edges.
- Reconsider some of the picks — some MLB club colors are more "dominant
  ink" than others by nature of the mark's own art, not just the fill choice.
- Add a visible ring/border/inset so the fill reads as an intentional frame
  even when the mark itself covers most of the tile.
- Or: the wash (current, live) might just be right and the solid ask doesn't
  hold up in practice — worth confirming that read before spending more time.

## Where the code is

- `src/lib/teams.js` — `GAMECARD_TILE_COLORS` + `gameCardTileColor(teamId)`,
  defined but unused (kept as the color reference above, not dead-code
  cleanup fodder).
- `src/components/GameCard.jsx` — `TeamMark` has a comment pointing here;
  the one-line change to re-enable is
  `const tint = gameCardTileColor(team.id) ?? teamTintColor(team.id)`.

## Comments
