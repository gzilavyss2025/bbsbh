# src/components/worldseries — the World Series home (#1906)

`WorldSeriesHome` is mounted by `GameSelect` on every postseason-window date and draws
nothing unless `lib/postseason/worldseries/mode.js` says the Series is on (both clubs
known, not decided heading into the slate date). It replaces the bracket fold and the
series primer then. Hero on a phone; hero plus `Ledger` table from 740px.

- **Spoiler rule (ADR-0087).** Past games show their runs; today's game shows no score
  slot at all (no seal, no button: ADR-0116). The gate is
  `lib/postseason/worldseries/ledger.js`, never a component: pass it everything, read
  only its cells. Every read ends the day before the
  slate date (`api/postseason/worldSeriesHome.js`).
- **Parts, not copies.** Cards are stamped `Card`, figures `StatStrip`/`Table`, legends
  `Key`, controls `Button`/`Door`. New shapes (schedule strip, fence overlay, pitch bars)
  live here under the `ww-` namespace in `styles/worldseries/`. No new token: the mockup's
  two fills are `--surface-stamped-tint` and `--accent-tint`.
- `Reel` ("Series reel", or "Road here" before Game 1 is played) is a snap rail with a Chips filter; clip and photo logic is `lib/postseason/worldseries/reel.js`.
- `cards/` holds Probables, Tale of the tape and Hot bats: `leadSide` marks the tile that leads the two clubs with `.ww-best` (`--surface-stamped-tint`).
- `cards/` also holds Bullpen, The trip, Home and road and Played. Stamp is a door to the Game Log flow (`logbookNewPath`), so no stamp part is imported.
- `ScoutingReport` (#2316, ADR-0034 open surface) is the navy band, a sticky jump bar (`HubTabBar variant="anchor" badges={false}`) and the scouting cards. Mounted once in `WorldSeriesHome`: after `Reel` on an off day, after `Probables` on a game day. The card list, its order and the day-type rule are `lib/postseason/worldseries/scouting.js` (`scoutingModel`, `nextGamePk`): off day = Nine keys, Matchup edges; game day = Matchup edges, Umpire edge (once a plate umpire is posted). A card with no data drops, and its button with it. The edges read the NEXT game's gamePk on an off day, today's on a game day. A new card is one entry in `scouting.js` plus one renderer in `ScoutingReport.jsx`. It keys on `clubIds`, never on a club.
