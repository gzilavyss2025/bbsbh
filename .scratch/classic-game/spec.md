# Score a classic game: draft spec

Issues: gzilavyss2025/bbsbh#1525 (score a classic game) and gzilavyss2025/bbsbh#1527
(classic of the day on a day with no games). Written 2026-10-21 in a shape session. Updated the same day with Gary's answers (section 10). This
spec builds nothing. A note marked **(inference)** is my reading, not a measured value.
A number with no mark is my own measurement in this session, against the live MLB Stats API.

## 1. The goal, in Gary's words

From #1525: "Let the user pick an old game and score it by hand. The seal covers each
half-inning until the user reveals it."

From #1527: "On a day with no games, the slate offers one old game from today's date to
score. It gives the offseason something to do."

Gary's scope decision (2026-10-21): the MLB Stats API only, games from 1960 on, no
Retrosheet. The score stays sealed through the reveal-only modules (ADR-0001).

## 2. What exists today

**The scoring flow already works for a 1980 game.** I opened gamePk 180442
(MIL @ CAL, 1980-10-01, a cycle row in `public/data/notable/cycles.json`) on the
existing route, `/10011980/milcal/{section}?nointro`:

| Surface | What it shows | Screenshot |
| --- | --- | --- |
| Slate, `/10011980` | 12 cards, each "Final · Box score ›". No score. | (not kept) |
| Lineup page, `lineup1` | Lineups, park, attendance, manager. Stats as of the game date (Molitor .298). Umpires: "Not in the record for this game." | (not kept) |
| Half-inning, `top1` | Sealed. The scoreboard shows 0–0 in the top of the 1st. Next at-bat and Rest of half work. | `00-today-top1.png` |
| Box score, `boxscore` | **Open, with no tap.** 10–7, the scoring summary and "Cycle: Charlie Moore". | `00-today-boxscore.png` |

The feed for 180442 has 89 plays. The feed for 67696 (CIN @ BOS, 1975 World Series
Game 6) has 102 plays and 370 pitch events.

**What a reader can use to pick a game:** nothing that reaches back years. The slate
date pager steps one day at a time. A reader must type the URL. The notable-games index
(`public/data/notable/`) is a list of results. ADR-0101 section 4 forbids a dealing card
to import it. `PickedGame.jsx` (MiLB offseason, ADR-0080) is the pattern for a dealt
game: a seeded deck, "Deal another", a careers-only reason line and a skip for games
this device has started (`readRevealMarkFor`).

## 3. What blocks the idea

1. **The BOX tab shows a classic's score.** ADR-0117 opens every past-dated box score with
   no tap. A classic is always past-dated, so its final score is one tap away in the tab
   row. **Gary decided on 2026-10-21 to keep ADR-0117 as it is (S0).** A reader who scores
   a classic does not open the BOX tab. The half-inning pages stay sealed.
2. **No way to pick.** See section 2.
3. **"From today's date" fails in winter.** I read the schedule for every season from
   1960 to 2025 (66 calls). Games fall on 232 calendar dates, from Mar 18 to Nov 5.
   **134 calendar dates (Nov 6 to Mar 17) have no MLB game in any of those seasons.**
   The slate's empty days are mostly those dates. So #1527 cannot deal "by date"
   alone in the offseason. In season, the median calendar date has 776 games.
4. **A dealt game must not come from the notable index** (ADR-0080, ADR-0101 s.4). The
   deck must be the plain schedule.
5. **The schedule carries scores.** A plain `schedule` call returns `score` and
   `isWinner`. The rule says "never fetched-then-hidden". A `fields=` filter fixes this:
   with `fields=dates,date,games,gamePk,gameType,officialDate,gameNumber,seriesGameNumber,teams,away,home,team,id,name,abbreviation,venue,status,detailedState`
   the response for the 1982 Brewers holds 0 `score`, `isWinner` or `leagueRecord`
   keys and is 57,590 bytes for a whole club season.
6. **The feed's batting order is end-of-game.** For 180442, `boxscore.battingOrder`
   lists Ed Romero second. The starting lineup (`schedule?hydrate=lineups`) lists Robin
   Yount. A substitution is a result. A reason line must read `hydrate=lineups`, not
   the feed. No probable pitcher is in the record for 1980.

Smaller gaps that do not block (out of scope, section 8): modern headshots (Charlie
Moore's row shows Paul Molitor's current photo), modern logos for old clubs, an MLB.tv
link on a 1980 game, no umpires before about 1990.

## 4. The options, and what Gary chose

Mockups are in `mockups/`, 390 px wide, rendered with `?nointro` in the preinstalled
Chromium against the dev server and the live API. **What is mocked:** each red
"MOCKUP" strip names it. The cards, the year strip, the `/classics` pages, the sealed
BOX tab and the seal card are DOM that I injected. The slates, the game pages and every
game row are real API data. The e2e mock (anchor 823035) has no 1960-2025 game, so I
did not use it. The mockups of the options Gary did not choose stay in the folder as a
record.

| Question | Options shown | Gary's answer (2026-10-21) |
| --- | --- | --- |
| How a reader picks a classic | F1 year strip on the slate (`20-flow1-slate-by-year.png`); F2 club-and-season list (`21-flow2-classics-page-list.png`); F3 a dealt card on `/classics` (`22-flow3-classics-deal.png`) | **F3**, the dealt card |
| The box score of a classic | S0 no change (`00-today-boxscore.png`); S1 a sealed BOX tab (`30-seal-S1-box-tab-sealed.png`); S2 the one-tap seal again (`31-seal-S2-box-score-tap-seal.png`) | **S0**, no change to ADR-0117 |
| Postseason rows in a list | Only for F2 | Not needed (F2 is not built) |
| How the off-day card picks | By club (`10-offday-card-A-favorite-club.png`); by date, then club (`11-offday-card-B-date-then-club.png`) | **A random roll from the whole classics pool.** Not tied to the date or the club. |
| The card on a club's in-season off day | `12-offday-card-C-club-off-day.png` | **Offseason only.** In season is later work. |
| Names | — | **"Score a classic"** for the page and the button. **"A classic to score"** for the card. |

What the build looks like: the `/classics` page is `22-flow3-classics-deal.png`, titled
"Score a classic". The off-day card is `10-offday-card-A-favorite-club.png` with the
kicker "A classic to score" and a game from any club and any era.

## 5. How a game is chosen, and which eras are eligible

- **Eligible (the classics pool):** a game with `gameType` R, F, D, L or W,
  `officialDate` from 1960-01-01 to the end of the last finished season, `detailedState`
  "Final", and both clubs in the AL or the NL that season. Leave out "Forfeit",
  "Postponed", "Cancelled", spring training (S), exhibitions (E) and the All-Star Game
  (A). The current season stays on the slate.
- **On `/classics`:** the reader filters by era (60s to 20s) and by club ("Any club" or
  one club, with the favorite club first). The deal is a seeded roll inside the filter.
  "Deal another" steps the deck.
- **On the off-day card:** a random roll from the whole pool, with no era or club
  filter and no link to the date. To make two tabs on the same day agree, the roll uses
  a seed from the slate date, as `PickedGame` does (`seedFrom('{date}|classic')`).
  "Deal another" rolls again. **(inference: Gary said "randomized"; the date seed only
  keeps one day's tabs in step, and it does not pick a game from that date.)**
- **How a roll works with no pool file:** pick a seeded season (1960 to last season),
  read that season's AL and NL clubs (`teams?sportId=1&season=Y`), pick a seeded club,
  read that club's season schedule with the score-free `fields=` list (block 5, about
  57 KB), and pick a seeded game that passes the eligibility rule. Two small calls per
  deal. A club filter skips the club step. **(inference: a roll by season, then club,
  then game does not weight every game the same; the difference is small and I did not
  measure it.)**
- **A game this device has started** (`readRevealMarkFor(pk) >= 0`) shows "Pick up
  where you left off", not a fresh deal. This follows `PickedGame`.
- **Never chosen by** a result, a feat, a score or a length (ADR-0080). The notable index
  is not read.
- **Reason line:** careers and the calendar only. Source: `schedule?hydrate=lineups`
  (starting lineups) and the club's first season. Examples: "Paul Molitor leads off.",
  "The Brewers' first season in Milwaukee." The mockups' "LaPoint vs Halicki" came from
  the feed. A build must not read the feed for it (block 6).
- **No play-by-play check in a generator.** 6 of 6 sampled games per season from 1960
  to 2010 had plays (#1525). The game page already handles a feed with no plays
  (ADR-0101, D14).

## 6. Slices

Each slice is at most 5 files. **No slice changes the spoiler rule now.** Gary chose
S0, so the re-seal slice and its ADR-0117 amendment are gone. No slice needs Opus. If a
later change adds a seal or an opener, that slice moves to Opus 5.5.

### Slice 1. The deck: a score-free classics reader

- Files: `src/api/classics/deck.js` (the two fetches with the `fields=` list in block 5,
  the eligibility filter, the seeded roll with optional era and club filters),
  `src/api/spoiler-manifest.json` (class `spoiler-free`, with a `why` that names the
  `fields=` list), `test/classics-deck.test.js`, `docs/api/classics.md`,
  `docs/adr/0080-…md` (an addendum: the dealt-game rule now covers MLB history).
- Pattern: `src/api/milbPool.js` (`seedFrom`, `pickGame`, `isStarted`) and its manifest
  entry.
- Done test: a node test feeds a fixture schedule (copied from the 1982 Brewers
  response) and proves: forfeits and postponements drop; a pre-1960 row drops; the same
  seed deals the same game; an era filter keeps only that decade; the request URL holds
  `fields=` and no `hydrate=linescore`. `npm run lint` passes the manifest check.
- Model: Sonnet 5.5.

### Slice 2. The classic card

- Files: `src/components/classics/ClassicCard.jsx`, its CSS file under `src/styles/`,
  `src/api/classics/reason.js` (the careers-only line from `hydrate=lineups`),
  `test/classics-reason.test.js`, the manifest entry for `reason.js`.
- Pattern: `src/components/offseason/PickedGame.jsx` (card, "Deal another", started
  check, link to `lineup1`) and `reasonLine` in `src/api/milbPool.js`.
- Done test: the reason test proves the line names only lineup and season facts. In
  Chromium the card renders at 390 px like `22-flow3-classics-deal.png`, and "Score a
  classic" opens `/{MMDDYYYY}/{matchup}/lineup1`.
- Model: Sonnet 5.5.

### Slice 3. The `/classics` page, "Score a classic"

- Files: `src/lib/route.js` (a `classics` route; check `parseRoute` for collisions),
  `src/App.jsx` (mount), `src/screens/classics/ClassicsPage.jsx` (era and club chips
  around `ClassicCard`), the route test in `test/`, `src/CLAUDE.md` (one routing line).
- Pattern: a standalone page such as `/notable` (ADR-0101 s.3), and the chip rows of the
  leader boards **(inference: I did not open the leader-board chip code)**.
- Done test: the route test parses `/classics`. In Chromium, `/classics?nointro`
  matches `22-flow3-classics-deal.png`, and "Deal another" changes the game.
- Model: Sonnet 5.5.

### Slice 4. "A classic to score" on the offseason slate (#1527)

- Files: `src/components/offseason/OffseasonLead.jsx` (mount the card above
  Transactions, MLB only), `src/api/classics/deck.js` (a `rollAny` with no filter and a
  date seed), `test/classics-deck.test.js` (new cases),
  `src/components/offseason/CLAUDE.md` (one line).
- Pattern: `OffseasonSlot` and `LevelOffseason` mount `PickedGame` the same way.
- Done test: a node test proves the same date gives the same roll and two dates can give
  different clubs and eras. In Chromium, `/12152026?nointro` shows the card above
  Transactions, as in `10-offday-card-A-favorite-club.png`, with the kicker "A classic
  to score". An in-season date with games shows no card.
- Model: Haiku 5.5, after slices 1 and 2 land (it wires two existing parts).

## 7. ADRs

- **ADR-0080 addendum (slice 1):** a classic is dealt on who played, never on what
  happened. The rule that governs the MiLB pool now also covers MLB games from 1960.
- **No change to ADR-0117** (Gary, 2026-10-21). A classic's box score opens by its date.
- Read before building: ADR-0001, 0002 (the seal), 0080 (dealing), 0101 (old games,
  D14), 0116 (no slate-wide reveal), 0117 (open by date).

## 8. Spoiler-rule impact

- **None to the rule.** The half-inning pages, the scorecard and the lineup page already
  seal an old game through `revealedThrough` and the reveal-only modules. They need no
  change.
- **Accepted by Gary:** the BOX tab of a classic shows the final score with no tap
  (ADR-0117, S0). The reader who scores avoids that tab.
- The deck and the card fetch no score field (block 5). They import no reveal-only
  module and no notable-index reader. The manifest's `spoiler-free` class and its `why`
  make that a lint fact.
- A postseason game's title ("World Series, Game 6") stays open, as ADR-0101 keeps the
  title open.

## 9. Out of scope

Retrosheet and pre-1960 games; the YouTube full-game pairing; era-correct logos and
headshots; umpires before about 1990; the MLB.tv link on an old game; a generator or a
static pool file; Negro league games (D6 of the old-games plan); the current season;
a club-and-season list (F2); the card on a club's in-season off day; any re-seal of a
classic's box score.

## 10. Decisions

Gary answered every question on 2026-10-21 (relayed by the parent session). Section 4
has the table. No decision is open.
