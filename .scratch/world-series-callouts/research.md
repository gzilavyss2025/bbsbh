# World Series callouts: what commentators say, and what our data can say

Part of gzilavyss2025/bbsbh#2235. Read with `contract.md` and `plan.md` in this folder.

This file answers one question. What kinds of "history" notes do broadcasters and
writers attach to a World Series game, and can the MLB Stats API data build each one?

## How this was done (and what it cannot claim)

- **External reading, 2026-10-16.** Web search, then page fetches. MLB.com refuses a
  direct fetch (HTTP 406). For MLB.com and ESPN I used the search snippets, not the full
  page. Fox Sports "7 stats" was read in full. A claim from a snippet is second-hand.
- **Elias.** Many claims name the Elias Sports Bureau. I did not see an Elias document.
  Every Elias claim here comes from a news site that quotes it.
- **Our data.** On 2026-10-16 I fetched the schedule and the play-by-play of every World
  Series game, 1903 to 2025. That is 717 schedule rows and 707 distinct `gamePk`s in 121
  Series. All 707 have plays, and every play has an event.
- **Oracle.** An *oracle* is a published claim that our data must reproduce. If our
  count matches the published count, the rule is probably right. If it does not match,
  the rule or the data is wrong, and an agent must find out which before it ships a note.

## The patterns

Eight pattern types appear again and again in 2024 and 2025 coverage. "Built" means the
plan builds it. "Menu" means the data can do it but the plan does not.

| # | Pattern | Example claim (source) | Data it needs | Plan |
| --- | --- | --- | --- | --- |
| P1 | **Series-state odds** | "Teams trailing entering the ninth in winner-take-all games are 3-33" ([MLB.com](https://www.mlb.com/news/dodgers-blue-jays-world-series-game-7-facts-and-figures)); home teams are 19-22 in Game 7 ([MLB.com](https://www.mlb.com/news/all-the-facts-to-know-about-history-of-game-7-c259223702)); visitors won five straight Game 7s | Game results, final scores, running score by inning | **Built** (rows 2, 3, 4, 5) |
| P2 | **"First X in World Series history"** | First walk-off grand slam (Freeman, 2024 G1, [AP](https://arizonasports.com/story/3562527/world-series-freddie-freeman/)); first pinch-hit grand slam (Barger, 2025 G1, [ESPN](https://www.espn.com/mlb/story/_/id/46824017/2025-world-series-dodgers-blue-jays-greatest-ever-tim-kurkjian)); first game to open with back-to-back home runs (2025 G5) | Each play: event, runs batted in, inning half, substitution events | **Built** (rows 4, 5) |
| P3 | **"First X since Y"** | First pitcher with a hit in a Game 7 since Jesse Orosco, 1986 ([Fox](https://www.foxsports.com/stories/mlb/7-stats-from-game-7-world-series-dodgers-beat-blue-jays)); first repeat champion since the 2000 Yankees ([CBS News](https://www.cbsnews.com/news/los-angeles-dodgers-win-world-series-defeat-toronto-blue-jays-game-7/)) | Same as P2, plus champions by season | **Built** (rows 2, 3, 4, 5) |
| P4 | **Single-player repeat** | First player with two walk-off home runs in a World Series (Freeman, 2024 and 2025, [Fox](https://amp.foxsports.com/stories/mlb/blue-jays-vs-dodgers-10-unreal-facts-from-18-inning-world-series-classic)) | A player id on every event row | **Built** (row 5) |
| P5 | **Most in one game** | Ohtani reached base nine times in Game 3, 2025 ([Fox](https://amp.foxsports.com/stories/mlb/blue-jays-vs-dodgers-10-unreal-facts-from-18-inning-world-series-classic)); 19 pitchers used in one game | Plays (times on base); pitcher ids | **Built** (times on base). Pitchers used: menu. |
| P6 | **Game length** | 18 innings ties the record (2018 and 2025); 6:39 is the second-longest by time ([Fox](https://amp.foxsports.com/stories/mlb/blue-jays-vs-dodgers-10-unreal-facts-from-18-inning-world-series-classic)) | Innings: linescore. Time: the box score `info` list, `T` | Innings **built**. Time and attendance: menu (slice 4). |
| P7 | **Comeback rank** | The 2025 Game 7 comeback from three runs down is "tied for third-largest in a winner-take-all game" ([Fox](https://www.foxsports.com/stories/mlb/7-stats-from-game-7-world-series-dodgers-beat-blue-jays)) | Running score in every play | **Built** (deficit, club) |
| P8 | **Matchup and club history** | First World Series between these two clubs; first appearance since 2001 ([CBS Sports](https://www.cbssports.com/mlb/news/2023-mlb-world-series-fun-facts-and-oddities-as-diamondbacks-and-rangers-face-off-in-fall-classic)) | Series list by club | **Built** (row 3) |

Patterns that need data we do not have. Do not build them:

- **Innings caught** (Will Smith, 73, a record). Plays hold no defensive innings by player.
- **Age gaps and "youngest Game 1 starter"** (Yesavage, [CBS Sports](https://www.cbssports.com/mlb/news/2025-world-series-dodgers-to-start-blake-snell-in-game-1-blue-jays-trey-yesavage-takes-mound-friday/)). Needs a birth date per starter. Possible with `/people` calls. Menu.
- **Award lists** ("eighth pair of Cy Young winners to start consecutive games"). Needs award history by player. Menu.
- **Fielder credit on a double play** ("first game-ending double play with an outfielder involved", [ESPN](https://www.espn.com/mlb/recap/_/gameId/401809302)). MLB.com words the same play more broadly ("first game-ending 7-4 double play in postseason history"). Two outlets disagree on scope, so there is no safe oracle. Game-ending double play itself is built; the fielder part is not.
- **Regular-season context** (a negative run differential, a seed). Not World Series data.
- **A steal of home.** The description wording is not checked. Build it only if row 4 confirms the exact words on a real play.

## The oracles

Each row is a published claim and what our scratch scan produced on 2026-10-16. Tests in
rows 2 and 4 must reproduce every "match" row from the real data. A row marked "check" is
a claim our scan has not confirmed. The agent reports what it finds and does not force a
match.

| # | Claim | Published | Our scan | Status |
| --- | --- | --- | --- | --- |
| O1 | Winner-take-all games: club trailing entering the 9th, record | 3 won, 33 lost ([MLB.com](https://www.mlb.com/news/dodgers-blue-jays-world-series-game-7-facts-and-figures)) | 3 won, 33 lost, 4 tied | match |
| O2 | Game 7 results, home club | 19-22 across 41 games ([MLB.com](https://www.mlb.com/nationals/news/history-of-world-series-game-7-c39984458)) | 19 home wins in 41 | match |
| O3 | Road clubs won the last five winner-take-all games | five straight ([MLB.com](https://www.mlb.com/nationals/news/history-of-world-series-game-7-c39984458)) | 2014, 2016, 2017, 2019, 2025 road; 2011 home | match |
| O4 | Pitchers with a hit in a winner-take-all game | 1975 (Gullett, Lee), 1986 (Orosco), 2025 (Ohtani) ([Fox](https://www.foxsports.com/stories/mlb/7-stats-from-game-7-world-series-dodgers-beat-blue-jays)) | The same, plus 1967 (Gibson) and 1973 (Holtzman, Fingers) | match |
| O5 | Longest game by innings | 18, in 2018 and 2025 | 18 twice; next is 14 | match |
| O6 | Time of game, Game 3 of 2018 and of 2025 | 7:20 and 6:39 | box score `T` strings `7:20.` and `6:39.` | match |
| O7 | Times on base by one player in a game | 9 (Ohtani, 2025 G3) | 9 | match |
| O8 | Walk-off grand slams | 1, Freeman, 2024-10-25 | 1, on 2024-10-25 | match |
| O9 | Players with two walk-off home runs | Freeman only | Freeman only (2024-10-25, 2025-10-27) | match |
| O10 | Games that opened with two home runs in a row | 1, in 2025 | 1, on 2025-10-29 | match |
| O11 | Repeat champion | 2025 Dodgers, first since the 2000 Yankees | 2025 follows 2000 with no repeat between | match |
| O12 | Pinch-hit grand slams | 1, Barger, 2025 G1 | Detectable: the slam play holds an `offensive_substitution` event, "Pinch-hitter Addison Barger replaces..." | check the count is 1 |
| O13 | Winner-take-all games that went to extra innings | six Game 7s plus the 1912 Game 8 ([MLB.com](https://www.mlb.com/nationals/news/history-of-world-series-game-7-c39984458)) | five before the tie fix | check |

## Traps this research found (all are in `contract.md` as rules)

- **Ties.** Three games ended level and were replayed or suspended: 1907 G1 (3-3, 12 innings),
  1912 G2 (6-6, 11 innings), 1922 G2 (3-3, 10 innings). A tie has no winner. My first scan
  gave it to the home club, which put Game 1 winners at 77 of 121. With ties handled the
  number is 76 of 120. The 1912 Series needed a Game 8, which is the "Game 8" MLB.com counts
  in its 41 winner-take-all games.
- **Duplicates.** 10 of 717 schedule rows repeat a `gamePk`.
- **`event: "Triple"`** is a hit.
- **`/stats/leaders` ignores `gameType=W`.**

## Corrected proof-of-concept figures

Replace the figures in the first version of #2235 with these. Tests must still derive them.

- 121 Series, 707 distinct games, 3 tied games.
- Game 1 winner (Game 1 decided) won the Series 76 of 120 times.
- The club leading 2-0 won 46 of 57 times.
- Clubs trailing 3-1 after four decided games came back 7 of 51 times (1903, 1925, 1958,
  1968, 1979, 1985, 2016). 1903 was a best-of-nine.
- Winner-take-all games: 41. Home club won 19.
- Walk-off home runs: 19 once duplicates are removed.
