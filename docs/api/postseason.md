# src/api/postseason — the running postseason's bracket

Per-module notes for `src/api/postseason/` and its hook,
`src/hooks/postseason/usePostseasonBracket.js` (#1224, slice 3). The UI slices
(4: the slate cards' series line, 5: the bracket on the home page, 6: the live
series page, 7: the champion) build on the shape below. It is their contract.

Tier-3 reference. `src/api/CLAUDE.md` holds the rule for the directory, and
`src/api/spoiler-manifest.json` classes `fetch.js`, `bracket.js` and `text.js`
`cutoff-gated`, and `roster.js` and `upcoming.js` `spoiler-free`.
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
| `text.js` | `recordLine(series)`, `seriesLine(series, gameNumber)`, `gameStatusLine(series, gameNumber)` (the lineup band's "Game 2 · Braves Lead 1–0"), `bestOfLine(series)` (the live page's "Best of 3" banner before Game 1), `cardLines(game, bracket)`. |
| `roster.js` | A club's declared postseason roster: `rosterUrl`, `seriesRosterDate`, `shapeRoster`, `fetchSeriesRoster`. Spoiler-free. |
| `upcoming.js` | The live series page's games still to play: `upcomingUrl`, `handsUrl`, `shapeUpcoming`, `fetchUpcomingSeriesGames(gamePks)`. Each game's park and announced probable pitchers, and their hand. Spoiler-free. |
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
- gives no date or gamePk to ANY "if necessary" game, live or historical —
  whether the skeleton still lists it reflects how the real series played out
  AFTER the cutoff, not the cutoff itself, so trusting that row on an old
  `?d=` would leak how many games the series took;
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
| `upcoming` | From the next game to `bestOf`: `{ gameNumber, gamePk, date, ifNecessary }`. `date` and `gamePk` are `null` for every `ifNecessary` game — its date is never taken from the live skeleton, since presence there depends on how the real series turned out after the cutoff. |

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
- `roundTitle(series)`: "NL Wild Card", "ALDS", "NLCS", "World Series".
  The series pages' leader sheets use it for their note.
- `seriesLine(series, gameNumber)`: "Game 2 · NL Wild Card", "Game 3 · ALDS",
  "Game 5 · NLCS", "Game 1 · World Series". Its own `roundTitle` drops the word
  "Series" from every round but the World Series itself (slice 4, Gary's copy
  decision 2026-09-28) — never read `series.name` (statsapi's
  `seriesDescription`) for this line.
- `cardLines(game, bracket)`: both lines for a slate game row, by `gamePk`, or
  `null` for a game not in the bracket. The slate model needs no new field.
  It returns `{ seriesLine, gameLine, recordLine, mark }`. `mark` is the
  series' art (`{ src, alt }`) from `src/lib/postseason/seriesMarks.js`, or
  `null` for a season with no art on file. A card that draws the mark prints
  `gameLine` ("Game 2") beside it, not `seriesLine`.

## The series primer's rules (`src/lib/postseason/primer/`)

Pure, and no UI yet (ADR-0087, 2026-10-08 addendum).

- `primerSeriesFor(bracket, slateDate, slateGamePks)`: the LCS and World Series
  playing on the cutoff, or `[]` unless each slate game maps to one of them and
  each has exactly one slate game. `defaultPrimerSeries(list, opts)` picks the
  first tab.
- `seriesStatus(series)`: `{ head, chip }`. The head is `bestOfLine` before
  Game 1, else `recordLine`. The chip is "MIL facing elimination", or `null`.
- `ribbonNodes(series, { scoresByPk })`: one node per game, `played`, `today`,
  `ahead` or `ifNecessary`. Its header holds the shared shape of one finished game.
- `leaderRows(entries)`: three or fewer show, high to low; more show the leader.
- `matchupEdges(sides)`: the Matchup edges card's rows, from `starterMatchupsFor` sides. The
  thresholds are named constants Gary tunes. The rows hold no total bases, so the line has no OPS.
- `wpSpark(wp, { flip })`: the ribbon's win-chance line, as SVG point strings. `wpLine(winProb, homeId)`
  (same file) builds the `wp` a game carries, for the nightly block and the live read alike.
- `bracketNow(bracket)`: the small bracket's `{ boxes, links }`: ALCS, NLCS and World
  Series boxes (club rows with wins and `eliminated`, a `decided` flag, a foot line),
  and one connector per LCS, inked once that series is decided. A World Series slot
  with no club keeps `club: null`. `null` when an LCS or the World Series is missing.
  `BracketNow.jsx` and `SeriesLeadersLedger.jsx` draw it, with no wiring yet.

## The primer's data

The primer needs the finished games of one series. It gets them from the nightly
shard first and from statsapi for what the shard does not have (ADR-0087,
2026-10-08 addendum, decision d). Only games that went Final before the cutoff
date can come in. The bracket decides which games these are.

- `useSeriesPrimerData(series, cutoff)` (`src/hooks/postseason/`) returns
  `{ games, stats, source, loading, error }`. `error` is the live read's. `source` is `"shard"`, `"live"` or
  `"mixed"`. `series` is a bracket series read without `{ live: true }`.
- It reads the callouts bundle of **today's** game with `fetchCallouts`. The
  bundle can hold a `series` block: `{ id, gamePks, games, stats? }`. `gamePks` is
  required, because `stats` carry no game ids. A game is
  the slice 1 shape in `ribbonNodes.js`. `seriesBlockFor(bundle, seriesId)` gives
  the block, or `null` when the id does not match.
- The rules are in `primerGames.js` (`src/lib/postseason/primer/`):
  - The block names the same games as the bracket: use it (`"shard"`).
  - The block lacks a counted game, or has no `stats`, or its `gamePks` are not
    exactly the counted games: use the games it has, and read the rest live
    (`"mixed"`). The live stats cover every counted game, so a missing game means
    live stats as well.
  - The block names a game that the bracket does not count: drop the whole block
    and read live (`"live"`). This keeps a stale or early file from bringing in
    today's result.
  - No block, or a block of the wrong shape: read live. `source` names what was
    used, so a block that gives no game is `"live"`.
- The live read is `useSeriesLog(games)`. It is the same read that
  `LiveSeriesPage` makes: box scores (`loadSeriesStats`), game cards and
  win-chance signals. `loadSeriesStats` has one new output field,
  `runsByGame`: `{ [gamePk]: { awayId, homeId, runs: { away, home } } }`. It is
  folded from the box scores that the function already fetches. A game with no
  box score has no entry, and the live path then leaves that game out.
- `wp` is cut to at most 26 home win-chance points.
- `recordAfterGame(series, index)` (`primer/recordAfter.js`) gives the record
  line after one game. The game log and the ribbon share it.
- `fetchPlateUmpires(dateStr)` (`src/api/postseason/plateUmpire.js`) returns
  `{ [gamePk]: { id, name } }` for the home plate umpires of one date. It makes
  one schedule call with `hydrate=officials` and a narrow `fields` list that has
  no result field. It returns `{}` on any failure. A game with no posted umpire
  has no entry. Assignments post about two hours before first pitch.

## Series marks (`src/lib/postseason/seriesMarks.js`)

MLB's round art, per season, in `public/postseason-marks/{season}/`: 2026 is
the first season on file. Each mark prints its year, so a season with no art
gets `null` and the surface keeps its words. Never fall back to another year.
The art is white-on-navy: `SeriesMark.jsx` draws it on a navy band the host
already has, or on its own navy plate (`plate`). It is drawn on the slate
card's series line, the full bracket (each league's current round, and the
World Series band), both series pages' banners, the history bracket's round
labels, and a band under the game masthead on both lineup pages and the box
score (not the innings view). A mark names the round only, so no seal applies.

The game masthead's band is also a link to its series' **live** page, heading
into the game's own date (`gameSeriesHref` in `src/lib/route.js`). It is never
the finished page, which shows how the series ended, and the game on screen can
be the game that ended it. GameView reads the bracket for a postseason game
only, with the game's date as the cutoff, and takes the series id from
`seriesForGame`. Until the bracket loads, or when it has no id for the game (a
game after today, whose date the cutoff cap cuts off), the band is not a link.

## The declared roster (`roster.js`)

statsapi has **no postseason roster type** (`/api/v1/rosterTypes`, checked
2026-09-28). A club's declared series roster is its **active** roster
(`/teams/{id}/roster?rosterType=active&date=`) on a date the series plays:

- 26 players, named by the morning of Game 1. The day before, the same call
  answers the September roster (28 or more).
- It can change between rounds and, for an injury, inside a series. The
  transaction wire shows only "roster status changed".
- A beaten club is back on its 40-man roster the next day.

So `seriesRosterDate(series, cutoff)` picks the last date the series played by
the cutoff (null before Game 1 day). Before that, `rosterReadDate` falls back
to the cutoff: the club's CURRENT roster stands in (Gary, 2026-09-28), and the
page says the club names its roster by Game 1. `shapeRoster` marks a roster
`declared` only on a series date with 26 or fewer players. The live series page
falls back to the box-score roster (`postseasonSeries.js`) when a read fails.
Spoiler-free: a roster move is not a result.

## The route (`src/lib/route.js`)

- One address for both series pages (Gary, 2026-09-28):
  `/postseason/{seriesId}?d={ISO}` parses to
  `{ name: 'postseason-series', seriesId, asOf }`. `postseasonLivePath(id, cutoff)`
  builds the dated form. `seriesPageFor(id, asOf, historyIds)` picks the page:
  the finished page for a `postseason-history.json` id with no `?d=`, the live
  page otherwise.
- `seriesHref(series, cutoffDate, historyIds)` gives the finished page
  `/postseason/{id}` only when the series was decided before the cutoff AND
  `postseason-history.json` holds its id (trap 7: that file gets a season only
  after its World Series, by a hand-run script). Otherwise the live page with
  `?d=`. A series with no id has no link (`null`).
- `App.jsx`'s `postseason-series` branch renders `screens/postseason-live/SeriesRoute.jsx`,
  which reads the history file and opens `PostseasonSeriesPage.jsx` or
  `screens/postseason-live/LiveSeriesPage.jsx`. The live page covers
  (slice 6): a series still in progress, or a decided 2026 series with nowhere
  else to go yet (trap 7). It reads `series.games`/`cutoffGame`/`upcoming`. For the cutoff
  date's own game it reads only schedule rows with no result field (the slate
  card, `upcoming.js`): never its box score, feed or win probability.

## The games still to play (`upcoming.js`)

`fetchUpcomingSeriesGames(gamePks)` reads `/schedule?gamePks=…&hydrate=probablePitcher,venue`
and one `/people?personIds=…` for the hands. It returns
`{ [gamePk]: { date, awayId, homeId, venue: { id, name }, away, home } }`, where
`away`/`home` is `{ id, name, hand }` or `null` (no probable announced).
Any failure returns `{}`, and the page draws its rows without the extra lines.

- The caller hands it today's gamePk and the DATED upcoming ones only. An "if
  necessary" game has no gamePk, so it never gets a park, a pitcher or a date.
- The field list has no game state, score, winner, linescore, `seriesStatus`
  or `leagueRecord`, so a wrong pk brings back no result.
  `test/postseason/upcoming-games.test.js` pins both URLs.
- Checked against live statsapi on 2026-10-01: the schedule's
  `probablePitcher` has no hand; `people[].pitchHand.code` has it.

## The series pages' parts

The live page (`screens/postseason-live/LiveSeriesPage.jsx`) draws, top to
bottom: the banner, Today, the starting pitchers (`SeriesStarters`), Still to
play (`StillToPlay`), How the games went (`SeriesFlow`), Game by game (with
each game's park), Series totals (`SeriesTotals`), the leader boards, the
Regular season strip, Nine Keys (`SeriesNineKeys`), Former teammates and the
rosters. The finished page (`PostseasonSeriesPage.jsx`) draws the parts that
need only counted games: the flow, the park line, the totals, the leader doors,
the Regular season strip and Nine Keys. From 740px the live page is a two-column
grid (`styles/postseason/series-live.css`).

| Part | Reads | Spoiler footing |
| --- | --- | --- |
| Still to play | `series.upcoming`, `upcoming.js` | A park, an off-day line (`lib/postseason/dayShape.js`) and probables for a DATED game only. Probables only when the cutoff is today: on a past `?d=` the schedule names the starter picked after that date. |
| Starting pitchers | `upcoming.js`, `fetchPitcherSeasonLine`, `fetchPitcherPostseasonCareer` (`postseason/pitcherCareer.js`), `fetchPitcherLastGame`, `projectFromLiveLogs` | Today's game, or the next dated game on today's page only. Every line ends the day before the cutoff (ADR-0088). Rows: season, then `{year} postseason`, then `All-time postseason` (earlier Octobers from `yearByYear` plus this year's gated line; never `stats=career`, which counts a game in progress). Never `PitcherCard`, which reads the game's feed. |
| How the games went | `gameSignals` the log already loaded | A line for a counted game only (`lib/postseason/seriesFlow.js`). Today and later games are empty slots. The slot count is the bracket's own. |
| Series totals | `loadSeriesStats(games).totals` | `{ [clubId]: { batting, pitching, games, whiffs } }`, summed from the counted games' box scores (`lib/postseason/seriesTotals.js`). Whiffs are not in a box score: `foldWhiffs` counts them from one `fields=`-pruned `feed/live` read per counted game (about 20 KB), credited to the club on the mound; one failed read makes the row show "—". |
| Leader doors | the `club` facet with `postseasonFrom` (`api/boxlines/facets.js`) | The sheet gets the page's cutoff (the finished page: the day after the last game) and Game 1's date as `postseasonFrom`, so its rows are this series only. |
| Regular season | `fetchSeasonSeries(…, 'R')` | Regular season only. See ADR-0087's 2026-10-01 addendum for why. |
| Nine Keys | `public/data/nine-keys.json` | Regular-season ranks. Only when the file's season is the series' season (`lib/postseason/keysVerdict.js` writes the verdict). |

## Tests

`test/postseason/` (fixtures in `test/fixtures/postseason/`, rebuilt by
`capture.mjs` there): `bracket-cutoff`, `bracket-wiring`, `bracket-text`,
`bracket-fetch`, `bracket-hook`, `live-series-selectors` (the live series
page's pure game-bucket sort, slice 6), `series-roster` (the declared roster's
date and its 26-player check), `upcoming-games`, `day-shape`, `series-flow`,
`series-totals`, `keys-verdict`, `primer` and `primer-edges` (the series primer's rules). `bracket-hook` also scans the series pages'
parts for a seal or a Scores Unlocked read. The route is in `test/route.test.js`,
and the slate model's `seriesStatus`/`leagueRecord` guard in
`test/slate-scores.test.js`.
