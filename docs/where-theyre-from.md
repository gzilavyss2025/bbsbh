# Where they're from (`/from`)

Every big leaguer, grouped by the college or high school he played at, or the town he was born
in, and by the decade of his MLB debut. Issue #1526. The build spec is
`.scratch/where-theyre-from/SPEC.md`: it is the contract, and it wins over this file.

It is a standalone page outside the scoring flow, so it opens live (ADR-0034). No `SealBox`, no
reveal-only module. A school or a birthplace says nothing about a game.

## Routes

`src/lib/from/route.js` parses them and `src/lib/from/path.js` builds them. `route.js` calls the
parser next to Scout's. Every path under `/from` is a from route, so none falls through to the game
branch.

| Path | Page |
|---|---|
| `/from`, `/from/{st}` | the picker, `src/screens/from/FromPage.jsx` |
| `/from?list=hometown`, `/from/{st}?zone={zone id}&list=...` | the picker, opened on that list, state and zone |
| `/from/college/{slug}`, `/from/high-school/{slug}` | one school, `FromPlacePage.jsx` |
| `/from/{st}/{city}` | one US town, `FromPlacePage.jsx` |
| `/from/country/{country}` | one country's towns, `FromCountryPage.jsx` |
| `/from/country/{country}/{city}` | one town abroad, `FromPlacePage.jsx` |

`?list=` is `college`, `high-school` or `hometown`. `?zone=` is a zone id, `{st}-{slug}` (`ga-atlanta`).
Both set the page's opening state only. The page keeps its own picks and writes them back with
`history.replaceState`. It does not go through the router, because a route change would remount the
page and cut the map's zoom short.

## The picker

- The US map is one inline `<svg>` (`UsMap.jsx`), no map library. A tap on a state zooms the map to
  it (`src/lib/from/zoom.js`) and draws that state's zones over it.
- The map is a picture of the controls. The State `<select>` and the zone chips do everything a tap
  does, so the `<svg>` is `aria-hidden`.
- With a search, the list shows every matching place. With a state (and a zone), it shows that
  state's places, the most big leaguers first. With nothing picked, it shows every place A to Z, 40
  at a time.
- Copy is in `src/lib/from/copy.js`, from SPEC §3.

## Data

`public/data/from/`, written by two generators: `gen-where-from.mjs` (nightly) and
`gen-where-from-map.mjs` (hand-run). The files and their shapes are in `docs/api/static-data.md`, the
generators in `docs/scripts/generators.md`. The reader is `src/api/from/whereFrom.js`.

## A place

`FromPlacePage.jsx` loads one place (`fetchFromPlace` in `src/api/from/whereFrom.js`: a school looks its
state up in the lookup file first). The hero (`PlaceHero.jsx`) has two tiles, the name, a "Change"
door back to the picker, a locator map (`Locator.jsx`, the same `map/us.json` at a zoom of 0.6, with a
dot where the place is) and the fact strip. Below it is one stamped card to a decade, the newest first
(`DecadeList.jsx`), each a table of Player, Pos and Debut with a link to the player's page.

- The numbers come from `src/lib/from/facts.js` (SPEC §7.4). The second tile is the busiest decade, or
  the span when every decade has exactly one player.
- A phone shows one column under a sticky jump bar. From about 740px the cards sit in two columns, each in
  the column with fewer rows so far, and the bar is not sticky (it wraps to two rows and would cover the
  card it jumps to).
- A place with no point (a college the IPEDS match could not place, or a town whose birth point fell in
  another state) shows no dot. A place with no state, and any place abroad, shows no locator.

## Zones

A zone is a Census metro area (in-state population of 500,000 or more, at most 6 to a state), or a
part of the rest of the state split by compass direction. Georgia is Atlanta metro, Northern, Central
and Southern Georgia. SPEC §7.2 has the rule.

## Known limits (v1)

- A college the IPEDS match cannot place is not on the map. Search finds it. The list is
  `scripts/data/from/college-overrides.json` and the nightly run's report.
- Towns stay as the API spells them: Brooklyn is not New York, and `Republic of Korea` and
  `South Korea` are two countries.
- Small states (RI, DE, DC) are a few pixels wide on a phone. The select covers them.
