Question 1 asked which plate umpires get the most and fewest challenges per game. The page **already ships that board** — "The plate umpires", six columns, `UMPIRE_SORTS` chips, and the 15-game floor in its column head. This is not a seventh section; it is that board revised.

**Design:** https://claude.ai/artifact/DdXwqNvni67o4MrJB3wkgY — artboard "Q1 - The plate umpires, revised".

## What changes

1. **A fourth sort, "Drawn fewest".** `UMPIRE_SORTS` has "Challenges drawn" high-to-low and nothing for the quiet end. The least-challenged end does not exist today.
2. **The per-game column becomes a bar measured from the league rate, not from zero.** 4.18 a game in MLB, 4.37 in Triple-A. A bar that starts at the league line says "more" or "less" in one glance; a bare 5.40 does not. This needs a diverging variant of `.barcell`, which is a real addition to `BroadcastBar.jsx` rather than an inline style.
3. **Both tails on one board.** A diverging bar whose view only ever shows one end leaves half of every track empty and buys nothing over a plain bar.

## The numbers, MLB, from the season on file

- 87 of 91 umpires clear the 15-game floor
- Most challenged: John Bacon at 5.40 a game from 15 games. He worked Triple-A the same way, 5.24 from 25
- Fewest: Adam Hamari at 3.13 from 30 games
- The whole spread is **2.27 challenges a game**, 3.13 to 5.40

## Keep

- `UmpireLink` on every name. The shipped board has it.
- "Minimum 15 games - challenged pitches only" in the column head. That sub-line is the one thing stopping a reader taking this for the `/umpire-rankings` figure, which scores every called pitch rather than the self-selected few somebody thought were wrong.

## Acceptance

- Needs no new data. `byUmpire` already ships games, n, success, rate and perGame
- Tests for the new sort and the floor
- Verified in a browser at 390px and 960px, local URL in the handoff
