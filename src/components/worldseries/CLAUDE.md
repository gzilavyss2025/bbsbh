# src/components/worldseries — the World Series home (#1906)

`WorldSeriesHome` is mounted by `GameSelect` on every postseason-window date and draws
nothing unless `lib/postseason/worldseries/mode.js` says the Series is on (both clubs
known, not decided heading into the slate date). It replaces the bracket fold and the
series primer then. Hero on a phone; hero plus `Ledger` table from 740px.

- **Spoiler rule (ADR-0087).** Past games show their runs; today's game is a seal until
  `live` (Scores Unlocked). The gate is `lib/postseason/worldseries/ledger.js`, never a
  component: pass it everything, read only its cells. Every read ends the day before the
  slate date (`api/postseason/worldSeriesHome.js`).
- **Parts, not copies.** Cards are stamped `Card`, figures `StatStrip`/`Table`, legends
  `Key`, controls `Button`/`Door`. New shapes (schedule strip, fence overlay, pitch bars)
  live here under the `ww-` namespace in `styles/worldseries/`. No new token: the mockup's
  two fills are `--surface-stamped-tint` and `--accent-tint`.
- Stamp actions, the played list and the cards after the ledger land in later slices.
