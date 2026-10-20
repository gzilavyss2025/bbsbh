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
