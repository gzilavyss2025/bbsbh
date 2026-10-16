# World Series callouts: the contract

Part of gzilavyss2025/bbsbh#2235. Every row of `plan.md` reads this file first. It fixes
the file shapes, the names and the rules, so rows that run in parallel cannot drift apart.
If a row finds that this file is wrong, it stops with `NEEDS PARENT`. It does not
change this file on its own.

Values marked *example* show a shape. They are not data.

## 1. Settled design (approved by the maintainer on 2026-10-16)

1. Finished Series live in a frozen file in `public/data/world-series/`. A hand-run
   generator writes it after each World Series.
2. The current Series reaches the app only through the nightly callouts shard
   (`scripts/gen-callouts.mjs`), cut at the slate date.
3. Every history lookup takes the game's own date as `before`. It returns only rows with
   `date < before`. It fails closed when `before` is missing.
4. No read of Scores Unlocked (`useScoresUnlocked`, `spoilersOffFor`).
5. The reader is `cutoff-gated` in `src/api/spoiler-manifest.json`, with an importer list.
6. One classifier decides what a tag means. The generator and the live builder import it.

A row that thinks it must loosen any of these stops with `NEEDS PARENT`.

## 2. The data traps (each one needs a test)

1. **Key every game by `gamePk`.** 717 schedule rows are 707 games. A postponed or
   suspended game appears under its old date and its played date. Keep the played date
   (the last listing).
2. **Three tied games exist** (1907 G1, 1912 G2, 1922 G2). A tie has no winner. A tie is
   not a win for either club and is not a Game 7. It still takes a game number.
3. **Take the final score from the last play** (`result.awayScore`, `result.homeScore`).
   Three schedule rows have no score or no `isWinner`.
4. **Order games by `(date, gamePk)` and number them 1..n yourself.** Game 1 of 2006 has no
   `seriesGameNumber`. `n` counts tied games, so 1912 has an `n` of 8.
5. **Read the series length from the data.** `winsNeeded` is the most wins by the Series
   winner (4 or 5). Never use a constant. 1903 had five wins needed.
6. **`event: "Triple"` is a three-base hit.** A triple play is `result.eventType ===
   'triple_play'`, or a description that says "triple play".
7. **Use `result.eventType` for tags, not the display `event`.** Check each value on a
   fixture. `home_run`, `double_play`, `grounded_into_double_play`,
   `strikeout_double_play`, `triple_play` and `offensive_substitution` were seen in 2026-10-16
   data.
8. **`/stats/leaders` ignores `gameType=W`.** Never use it.
9. **2020 had one neutral site.** Leave 2020 out of any home-club statistic.
10. **Reach statsapi through `scripts/lib/statsapi.mjs` `getJson` only.**
11. **Pitch data is not real before about 2008.** Build no pitch fact.

## 3. `public/data/world-series/series.json` (written by row 2, read by row 3)

```json
{
  "coverage": { "from": 1903, "through": 2025, "seasons": 121, "games": 707, "ties": 3 },
  "series": [
    {
      "season": 2025,
      "winsNeeded": 4,
      "clubs": [119, 141],
      "winner": 119,
      "games": [
        { "pk": 0, "n": 1, "date": "2025-10-24", "away": 119, "home": 141,
          "awayRuns": 0, "homeRuns": 0, "innings": 9, "venue": 0, "tie": false }
      ]
    }
  ]
}
```

- `clubs` lists Game 1's away club, then its home club. Ids are franchise ids.
- `winner` is a club id. A series with no winner does not exist in the range.
- `awayRuns` and `homeRuns` come from the last play. `innings` is the linescore length.
- `venue` is the venue id from the schedule row, or `null`.
- `tie` is `true` for a tied game. A tied game has no winner and counts for no club.
- No `generatedAt`. The `coverage` block is the file's own clock. Add an `EXCEPT` entry
  with a reason in `scripts/check-data-freshness.mjs`.
- Budget: 80 KB. A test fails past it.

## 4. `public/data/world-series/events.json` (written by row 4, read by row 5)

```json
{
  "coverage": { "from": 1903, "through": 2025, "games": 707 },
  "events": [
    { "tag": "grandSlam", "pk": 0, "date": "2025-10-24", "season": 2025, "n": 1,
      "club": 141, "player": 0, "value": null, "wta": false }
  ]
}
```

- `club` is the club that did it. `player` is a person id or `null`. `value` is a number
  or `null`. `wta` is `true` when the game was winner-take-all.
- Sort by `(date, pk, tag)`. Budget: 120 KB. A test fails past it.
- Winner-take-all (`wta`): the last decided game of a Series, where both clubs had
  `winsNeeded - 1` wins before it. Ties do not count as wins. There are 41 such games.

### The v1 tags. Each rule is exact.

A "play" is one entry of `allPlays`. The *last play* is the one with the highest
`atBatIndex`. Run counts come from `result.awayScore` and `result.homeScore`.

| Tag | Rule | `value` |
| --- | --- | --- |
| `grandSlam` | `eventType === 'home_run'` and `rbi === 4` | `null` |
| `walkOffHr` | last play; `about.isTopInning === false`; `eventType === 'home_run'`; home club wins | `null` |
| `walkOffGrandSlam` | `walkOffHr` and `rbi === 4` | `null` |
| `openingHrPair` | the first two plays of the game are both `home_run` | `null` |
| `pinchHitHr` | `home_run` and the same play holds an `offensive_substitution` event, "Pinch-hitter" for the batter | `rbi` |
| `pinchHitGrandSlam` | `pinchHitHr` with `rbi === 4` | `null` |
| `extraInningHr` | `home_run` with `about.inning >= 10` | `null` |
| `multiHrGame` | one batter, 3 or more home runs in the game | count |
| `pitcherHit` | `wta` games only. The batter's id is also a `matchup.pitcher.id` in the game. Result is `single`, `double`, `triple` or `home_run`. One row per hit | `null` |
| `gameEndingDp` | last play `eventType` contains `double_play` | `null` |
| `triplePlay` | any play with `eventType === 'triple_play'` or a description with "triple play" | `null` |
| `extraInnings` | `innings >= 10` | innings |
| `shutout` | decided game; one club has 0 runs. `club` is the club that shut out | the winner's runs |
| `bigScore` | one club has 10 or more runs | runs |
| `bigComeback` | the winner trailed by 4 or more at some point (running score after each play) | the largest deficit |
| `reachedBase` | one batter, 5 or more of `single double triple home_run walk intent_walk hit_by_pitch` in one game | count |
| `wtaTrailing9` | `wta` games. Score after the last play with `about.inning <= 8`. If level, no row. `club` is the trailing club | `1` if the trailing club won, else `0` |

Expected results the tests must reproduce (the oracles in `research.md`):
`wtaTrailing9`: 3 rows with `value` 1, 33 with `value` 0. `walkOffGrandSlam`: 1 row (2024-10-25).
`openingHrPair`: 1 row (2025-10-29). `pitcherHit`: 1975 (2 rows), 1986 (1), 2025 (1, Ohtani),
plus 1967 and 1973. `walkOffHr` by one player twice: Freeman only. `pinchHitGrandSlam`:
report the count; the published claim is 1.

Do **not** build `stealOfHome` or a fielder-credit double play in v1.

## 5. Names (so rows agree)

| Thing | Name and path |
| --- | --- |
| Series generator (row 2) | `scripts/gen-world-series.mjs`; pure half `scripts/lib/world-series/series.mjs` |
| Events generator (row 4) | `scripts/gen-world-series-events.mjs`; pure half `scripts/lib/world-series/events.mjs` |
| Classifier (row 4) | `src/lib/worldSeries/classify.js`, exports `classifyGame(playByPlay, { innings, wta })` returning event rows |
| Odds helpers (row 3) | `src/lib/worldSeries/odds.js` |
| Lookup helper (row 3) | `src/lib/worldSeries/lastBefore.js`, exports `lastBefore(rows, { before, tag, filter })`; throws a plain `Error` when `before` is not an ISO date string |
| Reader (row 3) | `src/api/worldSeries/history.js`; `loadSeriesHistory()` and, later, `loadEventHistory()` |
| Series-state note builder (row 3) | `src/api/callout-notes/worldSeries.js` |
| Event note builder (row 5) | `src/api/callout-notes/worldSeriesEvents.js` |
| Note kinds | `wsSeriesOdds`, `wsLastTime`, `wsLastTimeGame`, `wsWtaTrailing9` |
| Test folder | `test/world-series/` (new; `check-dir-size` caps a folder near 12 files) |
| Fixture folder | `test/fixtures/world-series/` |
| ADR | one new ADR. Take the next free number when you write it (`node scripts/check-adr-numbers.mjs`) |

A note is a plain object, as in `buildDayOfWeekNote` (`src/api/callout-notes/checkpoints.js`):
`{ text, personId, side, kind, dedupeKey, score }`, with `oppSide` optional. Its roll-up twin is
`buildDayOfWeekNotes` in `src/api/callout-notes/heldNotes.js`. Score is
`clampScore(SCORE_BASE.<kind> + bonus)` from `src/api/callout-notes/shared.js`.

## 6. How a World Series game is recognised

`gameData.game.type === 'W'` in the live feed, or `gameType === 'W'` on a schedule row
(`ROUND_BY_GAME_TYPE` in `src/lib/postseason/seriesMarks.js`). Fetch both history files only
for such a game. A game that is not a World Series game costs zero extra requests.

## 7. Tense (ADR-0014, ADR-0087, ADR-0088)

| Kind | Where | Rule |
| --- | --- | --- |
| `wsSeriesOdds` | Margin Notes and the pre-half strip (first half only) | Entering. Uses the series heading into the game's date (`deriveBracket`). No score from tonight. |
| `wsWtaTrailing9` | Pre-half strip, entering the top of the 9th | Reads tonight's score, so it uses the same `revealedThrough` self-gate as `buildAfterInningNote`. Only in a `wta` game. Only for the trailing club. |
| `wsLastTime` | Play card | Only on a revealed play. |
| `wsLastTimeGame` | Box score roll-up | Only when the game is Final (`gameResult(feed).final`). |

Between Innings: add a kind to `BETWEEN_INNINGS_ALLOWED_KINDS` only if its builder reads no
score from tonight. `wsSeriesOdds` qualifies. The others do not.
`wsSeriesOdds` is in `ONCE_PER_GAME_KINDS`. None of these kinds is in `RECORD_KINDS`.

## 8. Words (`docs/callouts.md`, "Voice")

- State the evidence. No verdict word ("historic", "rare").
- Whole numbers. A date reads "Oct. 24, 2025", or the year alone. Never "last year".
- Do not name the subject. The card shows him. A club may be named.
- A club is named as it was that season (the schedule gives that season's name).
- "postseason", never "playoffs".
- The floor: the data is complete from 1903. If no earlier row exists, write
  "the first in World Series history". Do not write "the first since at least".
- A `wsLastTime` note fires only when the gap is 3 seasons or more, or when no earlier row
  exists. Name the numbers as constants: `WS_MIN_GAP_SEASONS = 3`.
- Starting scores (tune in row 6): `wsSeriesOdds` 45, `wsLastTime` 50, `wsLastTimeGame` 45,
  `wsWtaTrailing9` 55. Magnitude: full credit at a 25-season gap.

Example copy (shape only; build it from data):

- `wsSeriesOdds`: "Teams that trail 3-1 have won the World Series 6 times in 50. The last was the 2016 Cubs."
- `wsWtaTrailing9`: "Teams trailing entering the 9th of a winner-take-all game are 3-33."
- `wsLastTime`: "The last World Series grand slam came on Oct. 24, 2025."
- `wsLastTimeGame`: "The first World Series game of 12 or more innings since Oct. 27, 2025."

## 9. Shared files that two rows may both edit (append only)

`docs/scripts/generators.md`, `docs/callouts.md`, `docs/api/static-data.md`,
`src/api/spoiler-manifest.json`, `scripts/check-data-freshness.mjs` (the `EXCEPT` list),
`src/api/callout-notes/shared.js` (`SCORE_BASE`, kind sets). `/stack-prs` keeps both sides.
No other file may be edited by two rows of one wave.
