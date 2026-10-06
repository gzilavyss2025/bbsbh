# Old games, prompt 2a: Step 1 survey

Written 2026-10-06 on `origin/main` at `a4857797`. **Stop gate reached.** More than 3 cards
are false, and the fixes would touch more than 8 files. This file holds the survey only.
No product code changed.

## How it was made

- `npm run dev` on port 5173. A throwaway Playwright script in the scratchpad launched the
  preinstalled Chromium at 390 px, with `?nointro` on every URL. No `npm run e2e`, no
  `playwright test`. The script is not committed.
- Chromium could not reach `statsapi.mlb.com`. The script served each request through Node
  `fetch` with `page.route`, as `e2e/fixtures/mock-api.js` does.
- Routes come from `gamePath` (`src/lib/route.js`).
- Each route was loaded sealed. For the box score I also tapped the seal once, in a fresh
  browser context, and read the text. I did **not** commit those screenshots. The
  box-score rows marked "(revealed)" come from that text.
- Facts from the feeds (`/api/v1.1/game/{pk}/feed/live`):

| | PHA@BOS 1927 | BRO@NYY 1956 | DET@CWS 1979 |
| --- | --- | --- | --- |
| gamePk | 102436 | 67524 | 177426 |
| Route | `/07041927/phabos/lineup1` | `/10081956/bronyy/lineup1` | `/07121979/detcws-2/lineup1` |
| `gameData.game.season` | 1927 | 1956 | 1979 |
| `status.detailedState` (feed) | Final | Final | `Forfeit: Unplayable` (the schedule says `Forfeit`) |
| `status.startTimeTBD` | true | true | false |
| Plays | 0 | 56 | 0 |
| Officials | 0 | 2 | 0 |
| Batting orders | 9 and 9 | 9 and 9 | 0 and 0 |
| Linescore innings | 9 | 9 | 0 |

## Legend

- **fine**: true data, or the card hides itself.
- **empty**: nothing useful, but nothing false.
- **false**: data that is not true for this game.

## The table

### Lineup pages (`lineup1`, `lineup2`)

| Card or section | 1927 | 1956 | 1979 forfeit |
| --- | --- | --- | --- |
| Date, ballpark | fine | fine | fine |
| First pitch | **false**: "3:33 AM" (`datetime.time` is a placeholder; `startTimeTBD` is true) | fine: "12:00 PM" matches the box score's own "First pitch" row | fine: "7:00 PM" |
| Weather, box weather, attendance | empty ("—") | fine (attendance 64,519); weather empty | empty |
| Manager | fine (season-keyed coaches call) | fine | fine (interim tag shown) |
| Uniform, broadcast | empty ("—") | empty | empty |
| Umpires (`UmpiresCard`) | empty (hides on `officials` empty; reads "later" on a finished game) | fine (2 names from the feed) | empty (hides) |
| Umpire tendencies | fine (hides) | fine (hides; no 1956 file) | fine (hides) |
| Season series strip | **false**: later games show "3:33 AM" placeholder times | **false**: this game's own cell shows "3:33 AM" | **false**: two cells show "3:33 AM" |
| Starting pitcher card | **false**: "Not posted yet." on a finished game | fine (Larsen) | **false**: "Not posted yet." |
| Batting order card | fine (9 names) | fine (9 names) | **false**: "Not final — posts close to first pitch (7:05 PM)", then the 1979 roster as a pregame fallback |
| Rookie pill ("R") | **false**: today's `rookies/status.json` flag, shown on a 1927 lineup row | fine (none shown) | **false**: four "R" pills on the roster list |
| Defensive alignment | fine | fine | fine (hides) |
| Former teammates, org ties | fine (no shard for 111-133) | fine (no shard) | fine (no shard) |
| Career matchups, callouts, prospects, workload board | fine (all keyed by gamePk, date or MiLB, or hidden by the 3-day gate) | fine | fine |
| Game Notes button | fine (hides) | fine (hides) | fine (hides) |
| Club logos and masthead marks | **false**: the Athletics show today's mark | **false**: the Dodgers show today's script mark and an "LA" mark in the Batting order masthead | empty: modern marks; the 1979 marks were not checked |

### Innings page (`top1`)

| Card or section | 1927 | 1956 | 1979 forfeit |
| --- | --- | --- | --- |
| Half page with plays | n/a | fine (56 plays) | n/a |
| Half page with no plays | empty: "Next at-bat" and "Rest of half" buttons that reveal nothing | n/a | empty: same dead end (the 1960 rule keeps it as today) |

### Box score (`boxscore`)

| Card or section | 1927 | 1956 | 1979 forfeit |
| --- | --- | --- | --- |
| Sealed shell | fine | fine | fine |
| Pitching stats by inning (revealed) | **false**: every cell is 0 (the feed has no pitches) | fine | fine (hides) |
| Pitcher lines (revealed) | **false**: Grove's line reads 0.0 IP, but the totals row reads 9.0 IP | fine | empty |
| Time of game, game end (revealed) | fine: 2 HRS 0 MINS | fine | **false**: 0 HRS 0 MINS and a game end of 7:00 PM CDT |
| Scoring summary, win probability (revealed) | fine (absent) | fine | fine (absent) |

Not surveyed: `preview`, `sheet`, `scorecard` and `express`. The prompt names four sections.

## False cards, counted

The gate counts cards. There are **nine**: First pitch (1927), Season series strip, Starting
pitcher card, Batting order card (forfeit), Rookie pill, Club logos, Pitching stats by inning,
Pitcher lines, Time of game. The limit is 3.

## Why each one is false (source)

1. **First pitch, Season series strip.** `selectGameInfo` builds `scheduledTime` from
   `gameData.datetime.time` and `ampm` (`src/api/select.js`). `GameTime` in
   `src/components/teamstats/SeasonSeriesStrip.jsx` formats `gameDate`. On a game with
   `startTimeTBD: true` both are placeholders.
2. **Starting pitcher card.** `TeamInfo.jsx` prints "Not posted yet." whenever no starter
   resolves. On a finished game that line is false.
3. **Batting order card.** `needsRoster` in `TeamInfo.jsx` is true when the lineup is
   empty. `fetchTeamRoster(meta.id, season)` reads the game's own season, so the roster is
   the 1979 roster. The line "Not final" is the false part. A forfeit is not "played" by the
   rule in the prompt, so the planned fix 4 would not reach it. See "For Gary".
4. **Rookie pill.** `showRookiePill` reads `public/data/rookies/status.json`
   (`generatedAt` 2026-10-06, 21,509 players). The flag means "still under the rookie limit
   today". It carries no season, so it cannot be read for a past game.
5. **Club logos.** `teamLogoUrl(teamId)` and `TeamLogo` key on the franchise id. 119 is
   the Los Angeles Dodgers, and 133 is today's Athletics.
6. **Box score cards.** `InningTally.jsx` draws the pitching-by-inning table from plays.
   With 0 plays, every cell is 0.

## The fixes I propose, and the file count

| Fix | Files |
| --- | --- |
| "Played" selector (`Final` or `Completed Early` on `detailedState`) and its test | `src/api/select.js`, `test/select-played.test.js` |
| Umpires line on a played game | `src/components/umpire/UmpiresCard.jsx` |
| Batting order notice on a played game | `src/screens/TeamInfo.jsx` |
| Starting pitcher: "not in the record" on a played game | `src/screens/TeamInfo.jsx` |
| Rookie pill off for a game outside the current season | `src/screens/TeamInfo.jsx`, `src/api/rookies.js` |
| Placeholder times hidden when `startTimeTBD` | `src/screens/TeamInfo.jsx` (First pitch), `SeasonSeriesStrip.jsx` |
| No-plays notice, innings button to the box score | `src/screens/GameView.jsx`, `src/screens/InningViewer.jsx`, `test/no-plays-notice.test.js` |
| Zero pitch table and zero pitcher lines hide | `src/screens/boxscore/InningTally.jsx`, the pitcher-lines component, `BoxScore.jsx` |
| Forfeit time of game | the box score fact component |
| Club logos | an issue, not a fix. A correct 1927 or 1956 mark needs art the repo does not hold. |

That is more than 8 files. Gary splits the work. A split I suggest:

- **2a-1:** the selector, umpires, batting order, starting pitcher, and the no-plays notice
  (the prompt's own steps 1 to 5). About 7 files and 2 tests.
- **2a-2:** placeholder times and the rookie pill (open surface, no seal).
- **2a-3:** the revealed box score cards. These sit inside the seal's render function, so
  ADR-0101 and the reveal rules apply. Do not start before 2a-1 lands.

## For Gary

1. The prompt's "played" rule says `Forfeit` is not played. So the forfeit page keeps the
   pregame roster fallback and its line "Not final — posts close to first pitch". I read
   that line as false for a finished game. Do you want the forfeit to say "The batting order
   is not in the record for this game" too? It would need a second test on `detailedState`
   that starts with `Forfeit`.
2. No page labels a forfeit. The 1979 box score also shows 0 R, 0 H, 0 E. The feed
   holds 0-0. I did not check what the official ruling was, so I did not call that false.
3. A "false" mark on the Rookie pill is my reading of the data file. I did not check each
   player's own record.

## Spoiler-safety

No seal changed. No code changed. The committed screenshots are all sealed views (the box
score screenshots show "Tap to reveal"). The season series strip shows the scores of
games before this one. It does that today for every game.
