# Old games: the plan

Written 2026-10-06 (prompt 15b). It is built on `findings.md` in this folder. Each number
below comes from `findings.md` unless the line says **(15b)**. A **(15b)** number is mine,
from 5 API calls or from arithmetic on the `findings.md` numbers. A note marked
**(inference)** is my reading, not a measured value.

**Scope.** Three features that need old games:

1. a notable-performances shelf (no-hitters, cycles, triple plays);
2. old-game pages (box score, lineups, umpires, park);
3. a callout that names the last time a rare play happened.

Not in scope, and not planned here: gzilavyss2025/bbsbh#1525 (score a classic game) and
gzilavyss2025/bbsbh#1527 (classic of the day). This plan must not block them. Section 5
says how.

**Gary answered all 13 decisions on 2026-10-06.** `decisions.md` has the table. Three
answers differ from the recommendation: a shelf row shows the score (D5), Negro league
games stay off the shelf (D6), and the callout always names the club and adds the
player and the league only when notable (D10). This plan is updated to match.

Companion files: `decisions.md` (the decisions, with the recommended option first),
`build-prompts.md` (one outline for each build prompt), and the DRAFT
`docs/adr/0101-an-old-game-seals-like-a-new-one-and-a-feat-is-a-result.md` (the seal).

## 1. The recommendation in five lines

1. **One data path.** An event index built from the MLB Stats API alone. It has a gamePk
   on every row, so it needs no join. It is three static files, one for each kind of
   event. Retrosheet lists are only a cross-check.
2. **No new game page.** An old game opens on the existing game route,
   `/{MMDDYYYY}/{matchup}/{section}`. The work is to degrade thin eras with care.
3. **The seal stays where it is.** The teams, date, park and title are open. The score,
   the box score and the feat label stay sealed on the game page. The box score's own
   `SealBox` holds them, and ADR-0049 remembers the tap.
4. **The app does not guess what a reader knows.** Age, arrival and URL never open a
   seal. The shelf is a labelled door (ADR-0081). It names results in the open and
   links into the game sealed.
5. **The callout fires only after the reveal.** A triple play or a cycle fires on the
   revealed play. A no-hitter fires in the Final roll-up. It claims "last time" only
   inside the years where the index has a measured recall.

## 2. The shared data path

### What it is

A hand-run generator writes `public/data/notable/{kind}.json`, one file for each kind:
`nohitters`, `cycles`, `tripleplays`. The shelf is "Notable games" at `/notable`
(D4). Each row holds the gamePk, the official date, the game type, the two
clubs (team id plus the abbreviation and name **of that season**), the players, and
the event kind and the final score (D5). Only AL and NL games are kept (D6).

| Event | API route (method b in `findings.md`) | Rule |
| --- | --- | --- |
| No-hitter | Season schedule with `hydrate=linescore` | A played game where a team had 0 hits. Drop `detailedState` `Forfeit`. Dedupe by gamePk. |
| Triple play | `teams/{id}/stats?stats=gameLog&group=fielding`, field `triplePlays` | `triplePlays` > 0. |
| Cycle | `sports/1/players` then batched `people?...hydrate=stats(gameLog)` with `fields=` | 4+ hits, with at least one single, double, triple and home run. |

### Why the API, not Retrosheet plus a join

- **The join costs the most and gives nothing back.** The join rate is 175 of 198
  (88.4%). From 1960 it is 114 of 114. Every miss is a game the API also lists, but
  under a team code my table did not have, or with a different score or home team. An
  API row needs no join. It has the gamePk that the game page needs.
- **Recall is the same or better.** For 1960 to 2025, regular season, the API alone
  found 196 of 196 no-hitters, 265 of 266 triple plays and 198 of 198 cycles.
  Retrosheet has no cycle list today (`cycles.zip` is a copy of `3HR.zip`).
- **Retrosheet stays useful as a check.** The 2023-08-18 TBA@ANA triple play (gamePk
  716945) is only in the box score text. A cross-check against `nohitters.zip` and
  `tripleplays.zip` finds a miss like that. A miss goes into a hand-seeded additions
  file. The rule in `src/api/CLAUDE.md` holds: edit the seed, never the output.

### Cost

| Item | Calls | Bytes | Source |
| --- | --- | --- | --- |
| No-hitters, 1901 to 2025 | 125 | 77,660,212 | `findings.md` (66 + 59 calls) |
| Triple plays, 1901 to 2025 | 3,054 | 45,186,690 | `findings.md` (1,762 + 1,292) |
| Cycles, 1901 to 2025 | 817 | 679,708,831 | `findings.md` (470 + 347) |
| **One full sweep** | **3,996** | **about 803 MB** | **(15b)** sum of the three rows |
| Output, three files | — | 84,671 raw | `findings.md` (24,738 + 37,121 + 22,812) |
| One season, refreshed | about 38 | about 8 MB | **(15b)** full-sweep figures divided by 66 seasons; an estimate |

The plan does **not** sweep game feeds. The game page reads statsapi from the browser,
as every game page does today (root `CLAUDE.md`: "Game data is client-direct"). So the
105.6 GB feed sweep and the 1,594 MB of per-game shards in `findings.md` are not needed.
The three files fit every repo, Vercel and GitHub limit that `findings.md` lists.

### When it runs

- **Finished seasons: hand-run, then frozen.** The pattern is ADR-0100 (hand-run, no
  cron, no `generatedAt`) and ADR-0080 (frozen per season). The file carries an
  `EXCEPT` entry in `check-data-freshness.mjs`.
- **The current season: nightly.** The callout compares tonight with the last event.
  A stale file would say "first since 2019" after a triple play in May. One season
  costs about 38 calls **(15b, estimate)**. D9 in `decisions.md` holds the choice.
- **Postseason.** The sweeps in `findings.md` are regular season only. **(15b)** The
  player game log answers `gameType=D`: Brock Holt's 2018-10-08 ALDS cycle came back
  (gamePk 563375; 4 hits, 1 double, 1 triple, 1 home run). The schedule rule takes a
  `gameType` too. The team fielding log with `gameType` is not tested. Retrosheet shows
  0 postseason triple plays for 1960 to 2025, so no case exists to test against. The
  batched `hydrate=stats(...)` form with `gameType` is not tested either.

### How the app reads it

One reader, `src/api/notable/`, through `staticJsonBy`. Its class in
`spoiler-manifest.json` is **`reveal-only`, with an importer allowlist**: the shelf
page, the box score's reveal module, and the callout builder. This follows
`boxscore.js`, which is reveal-only and lists `PostseasonSeriesPage.jsx`, an open
page. The class is not `spoiler-free` (the class `postseasonHistory.js` has). The
reason: a gamePk-to-feat lookup is one import away from a slate card that says
"no-hitter" on a sealed game. The allowlist makes each new reader a diff that someone
must approve.

## 3. Era rules

The three eras are the ones the task names. "API" means the MLB Stats API.

### Which source serves each era

| Feature | 1901 to 1949 | 1950 to 1959 | 1960 onward |
| --- | --- | --- | --- |
| 1. Shelf | API index, AL and NL only. Retrosheet cross-check, rows that join only. | API index. Retrosheet cross-check. | API index. Retrosheet cross-check. |
| 2. Game page | API, from the browser (box score, lineups, park). | API, from the browser. | API, from the browser. |
| 3. Callout | API index. A triple play claim has a floor (below). | API index. Same floor. | API index. |

Retrosheet never serves a page or a row by itself. A Retrosheet row with no API game
cannot open a page, so it does not go on the shelf. That leaves out pre-1901 games and
the 28 no-hitter rows with non-MLB codes (Federal League and other clubs, by the codes;
**inference**). D7 in `decisions.md` holds the choice.

### Recall by era (the API rule against Retrosheet)

| Event | 1901 to 1959 | 1960 to 2025 |
| --- | --- | --- |
| No-hitter | 108 of 108 joinable | 196 of 196 |
| Triple play | 305 of 316 joinable (96.5%) | 265 of 266 (99.6%) |
| Cycle | 106 of 107 joinable (the 1 miss is the 1904 doubleheader order) | 198 of 198 |

`findings.md` does not split 1901 to 1959 into 1901 to 1949 and 1950 to 1959. I did
not split it either.

### What each feature shows when data is thin

**1. Shelf.**

- A row shows what the index holds, with the final score (D5).
- **Negro league games (1920 to 1948) are left off the shelf (D6).** The API lists them
  in the `sportId=1` schedule **(15b: 1927-07-04 has 12 Negro league games beside 16 AL
  and NL games)**. The generator keeps a row only when both clubs played in the AL or
  the NL that season. This drops the 9 Negro league cycles that only the API found. The
  game route still opens these games; only the shelf and the callout leave them out.
  The shelf says in one line that it lists AL and NL games.
- **Old doubleheaders.** The API numbers some old doubleheaders in a different order
  from Retrosheet. The index uses the API's own gamePk, so its row and its page agree.
  Only the Retrosheet cross-check must accept either game of that day, as
  `findings.md` did for 1901 to 1959.
- **Shortened no-hitters.** 7 of the 197 API candidates for 1960 to 2025 ran under 9
  innings. Retrosheet counts them too. D8 holds the choice of label.

**2. Game page.** Each section reads the feed and prints a plain line when a part is
missing. This follows the MiLB pattern in root `CLAUDE.md`.

| Part | 1901 to 1949 | 1950 to 1959 | 1960 onward |
| --- | --- | --- | --- |
| Box lines, park | Present (42 of 42 sampled) | Present | Present |
| Batting orders | 41 of 42 sampled had 9 and 9. A 1940 game had none. | Present | Present |
| Umpires | None before 1950 | 0 to 2 in 1950 to 1980; 5 of 12 games had none | 1 to 3 in 1990; 4 from 2000 |
| Play-by-play | 0 plays (15 of 15 games, 1901 to 1940) | 74 to 78 plays in three 1950 games; 3 of 6 in issue #1525 | 66 to 102 plays |

- No umpires: the umpire card prints "Umpires are not in the record for this game."
- No batting order: the lineup page prints the box lines and says the order is not in
  the record.
- **No plays, before 1960: the page offers no half-inning pages (D14).** From 1960 on, a
  played game with 0 plays is almost always a forfeit, so it keeps its sealed pages. An empty half-inning page is a
  dead end, and an empty half would invite a tap that reveals nothing. The box score
  and the lineup pages stay. Scoring a game with no plays is #1525's work (Retrosheet
  plays), not this plan's.
- **Names.** The schedule gives the abbreviation of that season (**15b**: `PHA` 133,
  `BRO` 119, `NYG` 137 in 1927 and 1956). So the route slug works with no table. Logos
  and club colours read the team id. A 1927 Athletics game may show today's mark
  **(inference; not checked)**. Build prompt 2 checks it first.

**3. Callout.**

- "Last time" is wrong if the index missed an event between the last found one and
  tonight. So the claim stays inside the measured years:
  - no-hitters and cycles: back to 1901;
  - triple plays: back to 1960 (96.5% recall before it).
- If the last found event is older than the floor, the callout says "the first since
  at least {floor}". If the index has no event for the club, it says nothing. It
  never invents a span.
- **Three lines (D10).** The club line always shows. The player line shows for cycles
  and no-hitters, and only when the event is not the player's first. The league line
  shows only after a long league-wide gap; build prompt 4 sets that threshold with the
  worthiness rubric in `docs/callouts.md`. The era floors apply to all three lines.
- The club is named as it was that season. The API team id is the franchise. The
  Brewers' id may hold Seattle Pilots seasons **(inference; not checked)**.

## 4. The seal on an old-game page

The full design is DRAFT ADR-0101. The short form:

| Item | Sealed? | Why |
| --- | --- | --- |
| Title, teams, date, park, lineups, umpires | Open | They say who played. They do not say what happened (ADR-0080). The matchup is in the URL, so a seal on the teams would be fiction. |
| Score, line score, box score | Sealed | The box score's `SealBox` (ADR-0002). A tap is remembered (ADR-0049). |
| Feat label ("No-hitter: Don Larsen") | Sealed on the game page; open on the shelf | It names the result. On the game page it renders inside the box score's reveal function. The shelf is a labelled door (ADR-0081). |
| Half-inning pages | Sealed, as today | Only where the feed has plays. |

**The hard case: a reader may already know this game.** The app cannot know what a
reader knows. A shared link, a typed URL and a link from the shelf all arrive at the
same address. A gate that reads the door has a hole in it (ADR-0042, part 2). So the
page asks once, with one tap, and ADR-0049 remembers the answer on every device the
reader owns. A wrong guess the other way puts a score in front of a reader who wanted to
score the game by hand. That cannot be undone.

Two alternatives are in the ADR and in D1: open by arrival (a flag on the shelf's
link), and open by age (games before a cutoff year render open).

## 5. How this leaves room for #1525 and #1527

- #1525 needs the same game route and the same seal. A half-inning page for an old game
  appears when the feed has plays. Retrosheet plays would add more halves later. This
  plan adds no second game page that #1525 would have to merge.
- #1527 deals a game to score. It must use ADR-0080's rule (who played, never what
  happened). So it must not deal from the notable index. The index is a list of
  results. ADR-0101 says this.

## 6. Build order

Outlines and models are in `build-prompts.md`.

1. **The event index** (1a generator and nightly step, 1b Retrosheet cross-check, 1c full
   history). The reader comes in 2b, with its first importer.
2. **Old-game pages** (thin-era degrade, then the feat label in the box score seal, then
   ADR-0101 goes from DRAFT to accepted).
3. **The shelf** (the labelled-door page).
4. **The callout** (a new family in the existing callout system).

The index goes first because the other three read it. The pages go before the shelf,
because each shelf row links to a page. The callout goes last, because it is the
smallest and it can wait for a full season of nightly data.

## 7. What this plan does not settle

- Ground truth. Retrosheet and the API agree from 1960. A game both miss is invisible.
- The postseason team fielding log, and the batched game-log form with `gameType`.
- Where API coverage starts before 1901.
- Which side is right when the API and Retrosheet disagree on a Negro league score.
  (D6 leaves these games off the shelf, so this no longer blocks a build.)
- How a 1927 club's logo renders.
