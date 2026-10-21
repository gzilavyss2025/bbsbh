# Score a classic game: draft spec

Issues: gzilavyss2025/bbsbh#1525 (score a classic game) and gzilavyss2025/bbsbh#1527
(classic of the day on a day with no games). Written 2026-10-21 in a shape session. This
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

1. **The BOX tab spoils a classic.** ADR-0117 opens every past-dated box score with no
   tap. A classic is always past-dated. So the final score is one tap away on every
   page of the game, in the tab row. ADR-0117 saw this ("a reader who scores it can
   avoid that tab"). For a feature whose whole point is the reveal, that is a weak
   protection **(inference)**. This is the only spoiler-rule change in this spec.
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

## 4. The options

Mockups are in `mockups/`, 390 px wide, rendered with `?nointro` in the preinstalled
Chromium against the dev server and the live API. **What is mocked:** each red
"MOCKUP" strip names it. The cards, the year strip, the `/classics` pages, the sealed
BOX tab and the seal card are DOM that I injected. The slates, the game pages and every
game row are real API data. The e2e mock (anchor 823035) has no 1960-2025 game, so I
did not use it.

### Picking a game (#1525)

| | Flow | Screenshot | For | Against |
| --- | --- | --- | --- | --- |
| F1 | The slate travels by year: "‹ 1974 · Oct 21 · 1975 · 1976 ›" under the date. | `20-flow1-slate-by-year.png` | Smallest. Uses the slate as it is. | Needs a date first. An old slate shows 20+ "Off day" club cards (current clubs). Useless on 134 winter dates. |
| F2 | `/classics`: pick a club (favorite first), a season, regular or postseason, then a game from a list. | `21-flow2-classics-page-list.png` | The reader chooses the exact game ("the 1982 World Series"). | A postseason list shows how long each series went (ALCS 5, WS 7). That is a result of the earlier games **(inference: a series length reads as a result)**. |
| F3 | `/classics` deals one game: era chips, club chips, "Deal another". | `22-flow3-classics-deal.png` | Same card as #1527. No list to leak. Follows `PickedGame`. | The reader cannot ask for one exact game. |

**Recommended: F3 first, then F2's regular-season list later.** F3 shares its card and
its data with #1527.

### The seal on the box score (#1525)

| | Option | Screenshot | Rule |
| --- | --- | --- | --- |
| S0 | No change. | `00-today-boxscore.png` | ADR-0117 as it is. The score is one tap away. |
| S1 | The BOX tab shows "Box · sealed" in kraft and opens by itself after the last half. | `30-seal-S1-box-tab-sealed.png` | Needs the game's last half, which is a length read from the linescore (reveal-only). More code. |
| S2 | **Recommended.** A past game that this device has started (or dealt as a classic) seals its box score again with the old one-tap seal. | `31-seal-S2-box-score-tap-seal.png` | `openByDate` becomes false when `readRevealMarkFor(pk) >= 0` or the `bbsbh:classic:{pk}` bit is set. The tap writes `bbsbh:boxreveal:{pk}` as ADR-0049 does. |

S2 only adds a seal. It fails closed: a missing or unreadable mark leaves ADR-0117 as it
is. The `bbsbh:classic:{pk}` bit is written by "Score it ›", so the box score is sealed
before the first half too. A shared link carries no bit, so the receiver gets
ADR-0117's open box score. That direction is safe for the sender and the same as today
for the receiver.

### The classic of the day card (#1527)

| | Card | Screenshot | How it picks |
| --- | --- | --- | --- |
| C-A | "A classic to score · Brewers · 1980" above Transactions on the winter slate. | `10-offday-card-A-favorite-club.png` | Favorite club, any season 1960 to last season, seeded by the date. |
| C-B | Same card. Its kicker says "No game was ever played on Dec 15". | `11-offday-card-B-date-then-club.png` | **Both:** this calendar date in a seeded year when the date has games; else the favorite club. |
| C-C | "Brewers off today · on this date" above the Off-day grid in season. | `12-offday-card-C-club-off-day.png` | The favorite club's games on this calendar date. In season only. |

**Recommended: C-B.** It keeps Gary's "from today's date" where history has a game, and
it still fills the 134 empty winter dates. C-C can follow later. It is a second home.

## 5. How a game is chosen, and which eras are eligible

- **Eligible:** a game with `gameType` R, F, D, L or W, `officialDate` from 1960-01-01 to
  the end of the last finished season, `detailedState` "Final", and both clubs in the AL
  or the NL that season. Leave out "Forfeit", "Postponed", "Cancelled", spring training
  (S), exhibitions (E) and the All-Star Game (A). The current season stays on the slate.
- **Chosen by:** date first, then the favorite club (C-B). The seed is
  `seedFrom('{MMDDYYYY}|classic')`, as `PickedGame` seeds `{date}|{sportId}`. "Deal
  another" steps the deck. A game with a reveal mark on this device shows "Pick up
  where you left off", not a fresh deal.
- **Never chosen by** a result, a feat, a score or a length (ADR-0080). The notable index
  is not read.
- **Reason line:** careers and the calendar only. Sources: `schedule?hydrate=lineups`
  (starting lineups) and the club's first season. Examples: "Paul Molitor leads off.",
  "The Brewers' first season in Milwaukee." The mockups' "LaPoint vs Halicki" came from
  the feed. A build must not use the feed for it (block 6).
- **No play-by-play check in a generator.** 6 of 6 sampled games per season from 1960
  to 2010 had plays (#1525). The game page already handles a feed with no plays
  (ADR-0101, D14). A client-side deal costs 1 schedule call (about 57 KB for a club
  season) **(inference: a whole-league date is smaller; I did not measure it)**.

## 6. Slices

Each slice is at most 5 files. Model per slice: Sonnet 5.5 or Haiku 5.5, unless the
slice changes the spoiler rule.

### Slice 1. A started past game seals its box score (S2)

- Files: `src/lib/dates.js` (`boxScoreOpensByDate` gains a `started` input, or a new
  pure helper beside it), `src/screens/BoxScore.jsx` (passes the mark and the classic
  bit), `test/` (one unit file for the helper), `docs/adr/0117-…md` (addendum),
  `src/CLAUDE.md` (one line, if the opener list there names `openByDate`).
- Pattern: ADR-0117 section 2 (`openByDate` as a render-only flag; `onReveal` rule) and
  ADR-0049 (the tap bit).
- Done test: a node test proves the helper returns `false` for a past date when the mark
  is `>= 0` or the classic bit is set, and `true` when neither is set. The test fails
  before the change. In Chromium, `/10011980/milcal/boxscore?nointro` after one revealed
  half shows the seal, and with a cleared `localStorage` shows the open box score.
- Model: **Opus 5.5.** It changes the spoiler rule's openers.

### Slice 2. The deck: a score-free classic schedule reader

- Files: `src/api/classics/deck.js` (fetch with the `fields=` list in block 5, filter
  per section 5, seeded pick), `src/api/spoiler-manifest.json` (class `spoiler-free`,
  with a `why` that names the `fields=` list), `test/classics-deck.test.js`,
  `docs/api/classics.md`.
- Pattern: `src/api/milbPool.js` (`seedFrom`, `pickGame`, `isStarted`) and its manifest
  entry.
- Done test: a node test feeds a fixture schedule (copied from the 1982 Brewers
  response) and proves: forfeits and postponements drop; a pre-1960 row drops; the same
  seed deals the same game; the request URL holds `fields=` and no `hydrate=linescore`.
  `npm run lint` passes the manifest check.
- Model: Sonnet 5.5.

### Slice 3. The classic card

- Files: `src/components/classics/ClassicCard.jsx`, its CSS file under `src/styles/`,
  `src/api/classics/reason.js` (careers-only line from `hydrate=lineups`),
  `test/classics-reason.test.js`, the manifest entry for `reason.js`.
- Pattern: `src/components/offseason/PickedGame.jsx` (card, "Deal another", started
  check, link to `lineup1`), and `reasonLine` in `src/api/milbPool.js`.
- Done test: the reason test proves the line names only lineup and season facts. In
  Chromium the card renders inside a temporary host at 390 px like
  `22-flow3-classics-deal.png`. "Score it ›" writes `bbsbh:classic:{pk}` and opens
  `/{MMDDYYYY}/{matchup}/lineup1`.
- Model: Sonnet 5.5.

### Slice 4. The `/classics` page (F3)

- Files: `src/lib/route.js` (a `classics` route; check `parseRoute` for collisions),
  `src/App.jsx` (mount), `src/screens/classics/ClassicsPage.jsx` (era and club chips
  around `ClassicCard`), the route test in `test/`, `src/CLAUDE.md` (one routing line).
- Pattern: a standalone page such as `/notable` (ADR-0101 s.3), and the chip rows of the
  leader boards **(inference: I did not open the leader-board chip code)**.
- Done test: the route test parses `/classics`. In Chromium,
  `/classics?nointro` matches `22-flow3-classics-deal.png`, and "Deal another" changes
  the game.
- Model: Sonnet 5.5.

### Slice 5. Classic of the day on the empty slate (#1527, C-B)

- Files: `src/components/offseason/OffseasonLead.jsx` (mount the card above
  Transactions), `src/api/classics/deck.js` (a `byDateThenClub` deal),
  `test/classics-deck.test.js` (new cases), `src/components/offseason/CLAUDE.md` (one
  line). The in-season empty day (`showOffDayBanner` in `GameSelect.jsx`) is a sixth
  file, so it is slice 6 if Gary wants it.
- Pattern: `OffseasonSlot` / `LevelOffseason` mount `PickedGame` the same way.
- Done test: a node test proves Dec 15 falls back to the favorite club and Oct 21 deals a
  game dated Oct 21. In Chromium, `/12152026?nointro` matches
  `11-offday-card-B-date-then-club.png`.
- Model: Haiku 5.5 after slices 2 and 3 land (it wires two existing parts).

## 7. ADRs

- **New ADR (with slice 1):** "A classic is dealt on who played, and a game you started
  seals its box score." It amends ADR-0117 (one more condition on `openByDate`) and
  extends ADR-0080 (the dealt-game rule) from the MiLB pool to MLB history.
- Read before building: ADR-0001, 0002 (the seal), 0049 (the tap bit), 0080 (dealing),
  0101 (old games, D14), 0116 (no slate-wide reveal), 0117 (open by date).

## 8. Spoiler-rule impact

- The half-inning pages, the scorecard and the lineup page need no change. They already
  seal an old game through `revealedThrough` and the reveal-only modules.
- Slice 1 adds a seal to a surface ADR-0117 opened. It adds no opener. It persists one
  bit per game that says "I am scoring this", never a score.
- The deck and the card fetch no score field (block 5). They import no reveal-only
  module and no notable-index reader.
- A postseason game's title ("World Series, Game 6") stays open, as ADR-0101 keeps the
  title open. F2's series lists are the open question (D3).

## 9. Out of scope

Retrosheet and pre-1960 games; the YouTube full-game pairing; era-correct logos and
headshots; umpires before about 1990; the MLB.tv link on an old game; a generator or a
static pool file; Negro league games (D6 of the old-games plan); the current season.

## 10. Questions for Gary

[DECISION: How does a reader pick a classic? Recommended: F3, a dealt card on `/classics` (`22-flow3-classics-deal.png`). Other options: F2, a club-and-season list (`21-flow2-classics-page-list.png`); F1, a year strip on the slate (`20-flow1-slate-by-year.png`).]

[DECISION: Does a classic you are scoring seal its box score again? Recommended: S2, yes, the old one-tap seal once you start or deal the game (`31-seal-S2-box-score-tap-seal.png`). Other options: S1, a sealed BOX tab that opens after the last half (`30-seal-S1-box-tab-sealed.png`); S0, no change, the box score stays open by date (`00-today-boxscore.png`).]

[DECISION: If F2 is built, may a postseason list show every game of a series (so "WS 7" shows the series went seven)? Recommended: no, regular season only in F2. Other option: yes, show them all.]

[DECISION: How does the off-day card pick its game? Recommended: "both", this date when history has a game, else your favorite club (`11-offday-card-B-date-then-club.png`). Other options: favorite club only (`10-offday-card-A-favorite-club.png`); this date only, which leaves 134 winter dates empty.]

[DECISION: Also show the card on your club's in-season off day? Recommended: not now, later (`12-offday-card-C-club-off-day.png`). Other option: yes, in slice 6.]

[DECISION: The name of the page and the card. Recommended: "Score a classic" and "A classic to score". Other words: "From the vault", "Classic of the day".]
