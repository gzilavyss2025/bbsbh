# src/api/postseason — the running postseason's bracket

Per-module notes for `src/api/postseason/` and its hook,
`src/hooks/postseason/usePostseasonBracket.js` (#1224, slice 3). The UI slices
(4: the slate cards' series line, 5: the bracket on the home page, 6: the live
series page, 7: the champion) build on the shape below. It is their contract.

Tier-3 reference. `src/api/CLAUDE.md` holds the rule for the directory, and
`src/api/spoiler-manifest.json` classes all three modules `cutoff-gated`.
Siblings: `live-game.md`, `static-data.md`, `account-layer.md`.

## The rule

The bracket shows each series **heading into the cutoff date**.

- A game counts only when it went Final, with a winner, **before** the cutoff
  date. It went Final on its `officialDate`, or on its `resumeGameDate` when it
  was suspended. A game on the cutoff date never counts, Final or not.
- The cutoff is the slate's date, capped at today (the hook does the cap). The
  live series page uses its `?d=` date, capped at today, or today.
- Yesterday's results are not protected. That is a decision, not a gap. There
  is no `SealBox`, no seal and no kraft on any of this.
- Scores Unlocked does not apply. Nothing here reads the switch, and nothing
  writes to storage. `test/postseason/bracket-hook.test.js` scans for both.

## The modules

| File | What it does |
| --- | --- |
| `fetch.js` | The two statsapi reads, the row normalizers, and `loadPostseasonBracket(cutoff, season)`. |
| `bracket.js` | `deriveBracket(skeletonRows, resultRows, cutoffDate)`, pure. Also `seriesForGame` and `isClub`. |
| `text.js` | `recordLine(series)`, `seriesLine(series, gameNumber)`, `cardLines(game, bracket)`. |
| `src/hooks/postseason/usePostseasonBracket.js` | The hook, and `bracketCutoff(date, today)`. |

### The two reads (`fetch.js`)

Both are separate from `fetchSchedule`, like `fetchSlateScores`.

- **Skeleton**, `skeletonUrl(season)`: every postseason game (`gameType=F,D,L,W`)
  with `hydrate=team`. Fields: game ids, dates, `description`,
  `seriesDescription`, `seriesGameNumber`, `gamesInSeries`, and each club's
  `id`, `name`, `abbreviation`, `league`. **No result field**, not even the
  game state.
- **Results**, `resultsUrl(season, cutoff)`: `endDate` is the day before the
  cutoff. Fields: `gamePk`, `officialDate`, `resumeGameDate`,
  `status.abstractGameState`, and each side's `team.id` and `isWinner`. Never
  runs, a score, a linescore, `seriesStatus` or `leagueRecord` (trap 1: the
  last two give the state AFTER a game).

Both keep each game once, under the listing whose `dates[].date` is its
`officialDate` (trap 3). That drops a postponed game's old-date listing and a
resumed game's resume-date listing. A failed read fails the whole load: a
wrong state is worse than none.

Verified against live statsapi on 2026-09-28: the 2025 and 2026 postseason,
2022 ALDS Games 2 and 5 (postponed, gamePks 715752 and 715749) and 2008 World
Series Game 5 (suspended, 243847).

### What the skeleton may say, and what it may not

The skeleton is the live schedule. The moment a series ends, it names the
winner in the next round's rows and it drops that series' unplayed "if
necessary" games. A future row's `ifNecessary` flag also flips when the game
becomes necessary. So `deriveBracket`:

- fills a slot fed by an earlier series from **that series' derived winner**,
  never from the club the skeleton names there;
- works out "if necessary" from the heading-in wins, never from a row;
- gives no date to a later "if necessary" game when the cutoff game can end
  its series (the heading-in leader is one win away and the series plays that
  day), because that is the row that vanishes;
- indexes (`gameIndex`) only games dated on or before the cutoff.

`test/postseason/bracket-cutoff.test.js` pins that the derived bracket is the
same whether or not the skeleton still lists the game that today can drop.

### Wiring and placeholders (traps 4 and 5)

A Division Series slot names its feeder as a placeholder pair ("ATL/PHI") or,
once that series ends, as the winner's club id. `deriveBracket` matches both
against the Wild Card series' clubs, **never the slot letter**: in 2026, NL Wild
Card 'A' (PHI @ ATL) feeds NLDS 'B', and 'B' (CHC @ SD) feeds NLDS 'A'. A
Division Series club that no Wild Card series feeds is a bye. An LCS slot is fed
by the league's two Division Series, and the World Series by the two LCS (AL
first).

Placeholders carry real-looking ids (5528 "HOU/CWS", 5513 "AL Higher Seed",
2711 "Lower Seed League Champion"). `isClub` admits only ids 108–147 and 158
with no "/" or "Seed" in the name. A placeholder is always an empty slot
(`club: null`), so none can reach `teamLogoUrl`, `TeamLink` or the
favorite-team sort.

## The hook

```js
import { usePostseasonBracket } from '../hooks/postseason/usePostseasonBracket.js'

const { bracket, loading, error, cutoff } = usePostseasonBracket(slateDate)
// usePostseasonBracket(null)                   -> no reads, bracket null
// usePostseasonBracket('2027-01-10', { season: 2026 })  -> the offseason row
```

`cutoff` is `slateDate` capped at today. `season` defaults to the cutoff's
year. `bracketCutoff` calls the slate's own cap, `capSlateDate`
(`src/lib/postseason/`, ADR-0087), with no season row. That is the helper's
fail-closed branch, so every future date caps, in the window or out of it.

## The returned shape

`deriveBracket` returns `null` when there are no postseason rows. Otherwise:

```js
{
  season: 2025,
  cutoff: '2025-10-09',
  leagues: {
    AL: { wildcard: [Series, Series], division: [Series, Series], lcs: Series, byes: [Club, Club] },
    NL: { ...same },
  },
  worldSeries: Series,
  champion: Club | null,   // the club with 4 World Series wins before the cutoff
  series: [Series, ...],   // every series: AL WC, NL WC, AL DS, NL DS, ALCS, NLCS, WS
  gameIndex: { [gamePk]: { key, gameNumber } },  // games dated on or before the cutoff
}
```

A `Club` is `{ id, name, abbreviation }`, always a real club.

A `Series`:

| Field | Meaning |
| --- | --- |
| `key` | Stable within a season: Game 1's gamePk, as a string. `feeds` and `slots[].from` use it. |
| `id` | `{year}-{round}-{Game 1 away id}-{Game 1 home id}`, the history file's id. `null` until both clubs are known. |
| `round` | `wildcard`, `division`, `lcs` or `worldseries`. |
| `league` | `'AL'`, `'NL'`, or `null` for the World Series. |
| `name` | statsapi's `seriesDescription`: "NL Wild Card Series", "AL Division Series", "World Series". |
| `label` | Game 1's description without "Game N": "NLDS 'A'". Display only; nothing wires by it. |
| `bestOf`, `winsNeeded` | 3/2, 5/3, 7/4. |
| `slots` | Two `{ club: Club \| null, wins, from: key \| null, bye }`. WC and DS: Game 1's away, then home. LCS and WS: feeder order. `wins` are heading into the cutoff. |
| `gamesPlayed` | Games counted before the cutoff. |
| `decided`, `winner`, `eliminated` | Decided before the cutoff. A club that clinches ON the cutoff date is not decided yet. |
| `playsOnCutoff`, `cutoffGame` | Whether the series plays on the cutoff date, and `{ gamePk, gameNumber }` of that game. |
| `feeds` | The `key` of the series its winner goes to. |
| `games` | Counted games: `{ gamePk, gameNumber, date, winnerId }`. No score. |
| `upcoming` | From the next game to `bestOf`: `{ gameNumber, gamePk, date, ifNecessary }`. `date` and `gamePk` are `null` for a game the cutoff game can remove. |

Example: 2025 NLDS, heading into 2025-10-09.

```json
{
  "key": "813047", "id": "2025-division-112-158", "round": "division", "league": "NL",
  "name": "NL Division Series", "label": "NLDS 'A'", "bestOf": 5, "winsNeeded": 3,
  "slots": [
    { "club": { "id": 112, "name": "Chicago Cubs", "abbreviation": "CHC" }, "wins": 1, "from": "813066", "bye": false },
    { "club": { "id": 158, "name": "Milwaukee Brewers", "abbreviation": "MIL" }, "wins": 2, "from": null, "bye": true }
  ],
  "gamesPlayed": 3, "decided": false, "winner": null, "eliminated": null,
  "playsOnCutoff": true, "cutoffGame": { "gamePk": 813050, "gameNumber": 4 },
  "feeds": "813036",
  "games": [
    { "gamePk": 813047, "gameNumber": 1, "date": "2025-10-04", "winnerId": 158 },
    { "gamePk": 813048, "gameNumber": 2, "date": "2025-10-06", "winnerId": 158 },
    { "gamePk": 813049, "gameNumber": 3, "date": "2025-10-08", "winnerId": 112 }
  ],
  "upcoming": [
    { "gameNumber": 4, "gamePk": 813050, "date": "2025-10-09", "ifNecessary": false },
    { "gameNumber": 5, "gamePk": null, "date": null, "ifNecessary": true }
  ]
}
```

## The text helpers (`text.js`)

- `recordLine(series)`: "Game 1", "CHC leads 1–0", "Series tied 1–1", "Winner
  take all" (each club one win from the series), "TOR won 3–1" (decided).
- `seriesLine(series, gameNumber)`: "Game 2 · NL Wild Card Series".
- `cardLines(game, bracket)`: both lines for a slate game row, by `gamePk`, or
  `null` for a game not in the bracket. The slate model needs no new field.

## The route (`src/lib/route.js`)

- `/postseason-live/{seriesId}?d={ISO}` parses to
  `{ name: 'postseason-live', seriesId, asOf }`. `postseasonLivePath(id, cutoff)`
  builds it.
- `seriesHref(series, cutoffDate, historyIds)` gives the finished page
  `/postseason/{id}` only when the series was decided before the cutoff AND
  `postseason-history.json` holds its id (trap 7: that file gets a season only
  after its World Series, by a hand-run script). Otherwise the live page with
  `?d=`. A series with no id has no link (`null`).
- `App.jsx`'s `postseason-live` branch renders `screens/postseason-live/LiveSeriesPage.jsx`
  (slice 6): a series still in progress, or a decided 2026 series with nowhere
  else to go yet (trap 7). It reads `series.games`/`cutoffGame`/`upcoming` and
  fetches nothing for the cutoff date's own game.

## Tests

`test/postseason/` (fixtures in `test/fixtures/postseason/`, rebuilt by
`capture.mjs` there): `bracket-cutoff`, `bracket-wiring`, `bracket-text`,
`bracket-fetch`, `bracket-hook`, `live-series-selectors` (the live series
page's pure game-bucket sort, slice 6). The route is in `test/route.test.js`,
and the slate model's `seriesStatus`/`leagueRecord` guard in
`test/slate-scores.test.js`.
