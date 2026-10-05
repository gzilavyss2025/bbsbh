# Design brief — Postseason home page

Status: brainstorm done 2026-09-28 with Gary. Design review added 2026-09-28
(job, theme, height limit, states, do-nots, in-progress series page, the
champion). Ready for `/frontend-design`.
The postseason starts 2026-09-29. The matchups are set.

## What it is

During the postseason, the home page (the slate, `src/screens/GameSelect.jsx`)
gets two changes, and the app gets one new page:

1. A **bracket** at the top of the page, above the slate cards.
2. The **slate cards** below it show the series context for each game.
3. A new **in-progress series page**. A tap on a live series opens it.

After the last World Series game, the finished bracket shows the champion on the
home page. When the offseason page starts, the bracket folds into it and stays
for the whole offseason (see "The champion").

## Design direction (read before you design)

**The bracket's job:** show what is at stake in today's games. The full bracket
is one tap away. The slate is what the user came for, so the bracket must help
the user pick a game.

**A theme.** Example: *the bracket you keep in pencil at the back of your
scorebook.* The printed form (round names, boxes, lines) is the structure. Pencil
marks what is still open (the pips). Ink goes over the pencil when a series is
decided (the winner's name and line). A light strike marks a club that is out. A
future slot is a blank ruled line, not the word "TBD". You can use this theme or
bring 2–3 of your own.

**Height limit:** on an iPhone (390×844), the first game card shows without a
scroll. So the bracket needs a folded state (for example, today's series only).
A tap opens the full bracket.

**One bold moment:** the deciding game ("Winner take all", or a club one loss
from out). It comes every round. The heading-in record gives it, so it spoils
nothing. Keep everything else quiet.

**Free for the designer:** the pip form, the connector lines, the fold, the World
Series treatment, the deciding-game moment.

## The spoiler rule for this feature (read first)

The bracket and the cards show the series state **heading into the slate's date**.
Today's games never change them.

- Example: a club trails 0–1 and plays today. All day, the bracket shows
  0–1. That stays true after today's game ends, win or lose. On tomorrow's slate,
  the bracket shows the new state.
- "Today" is the **official game date** from the schedule, not the wall clock. A
  game that ends at 12:40 a.m. counts on its own date.
- The bracket keys on the **slate's date**, not on "now". A past day's slate shows
  the bracket as it was on that morning.
- Off days in the postseason window still show the bracket, with the state after
  the last completed game date.
- A club that clinches today still shows as an empty slot in the next round until
  tomorrow.
- **Decision, not a bug:** yesterday's results are NOT protected. A user who has not
  watched last night's game yet will see its effect on the bracket. Do not "fix"
  this with a seal.
- No seal / kraft tape on the bracket. The date cutoff IS the seal.
- Because of this rule, a "Game 3" card on today's slate spoils nothing: the bracket
  already shows 1–1 heading in.

No exception for **Scores Unlocked** (Gary's decision, 2026-09-28). The switch
does not change the bracket, the cards' series line or the series page. They
always show the state heading into the slate's date. The switch still shows the
slate's own scores, as it does now. This is a deliberate exception to Gary's
standing rule that the switch drops every date cutoff (ADR-0026).

## The bracket

**Layout: a vertical stack.** No sideways scroll on an iPhone.

1. AL tree: Wild Card → ALDS → ALCS
2. NL tree: Wild Card → NLDS → NLCS
3. World Series at the bottom, fed by both trees.

Say which way each league's tree runs: left to right (like `/postseason-race`) or
top to bottom.

**Seven series types:** AL Wild Card, NL Wild Card, ALDS, NLDS, ALCS, NLCS, World
Series. Each must be easy to tell apart. Keep one shared look and change only a
few things (for example, the name and the pip count). The World Series gets its
own special treatment.

**Series wins are pencil pips**, not numbers or text. This is Gary's choice for
the bracket on phones, and the default on wide screens too. If a concept uses
something else on wide screens, show why. Each pip row needs a screen-reader
label (for example, "Cubs 1 win, Brewers 0, best of 3"). The pip count shows the
series length:

| Round | Length | Pips per club |
|---|---|---|
| Wild Card Series | best of 3 | ○○ |
| Division Series | best of 5 | ○○○ |
| LCS / World Series | best of 7 | ○○○○ |

One pip fills in pencil for each win heading into the slate's date. Example:
`MIL ●○  vs  CHC ○○`.

**Base states:**
- Current round: full width, inked.
- Finished rounds: shrink to a compact line. Say where their connector lines go
  when they shrink.
- Future rounds: empty slots (see the theme).
- Eliminated club: gray pencil logo and name with a light strike. The winner's
  connector line is inked toward the next round.
- Byes: the top two seeds in each league wait in the Division Series slot. The
  Wild Card column shows a small "Bye" for them.

**States to design** (draw a mockup of each):
- A series is over, but its round is not (a sweep waits on the other series).
- A club waits for the next round (this can be several days).
- A series plays today, or does not.
- The deciding game.
- An off day (the bracket is the whole page).
- The favorite team is not in the postseason, or is out.
- The champion, on the home page and folded into the offseason page (see below).

**Tap a series:**
- A series still in progress opens the new in-progress series page (below).
- A finished series opens the existing series page (`PostseasonSeriesPage.jsx`).
  For 2026, that works only after the history file carries this season. Until
  then, a finished series opens the new page too (trap 7 in the build prompt).

**No special path for any club.** Do not highlight the favorite team's path.

**Wide screens:** the designer proposes the wide layout. The history page's
mirrored 7-column bracket fits there. Phone comes first.

## The champion

After the last World Series game, the finished bracket shows the champion. This
is the payoff of the whole month, so give it the World Series treatment at full
strength. It follows the spoiler rule: yesterday's results are not protected.
There is no day count. The offseason page's start date decides the switch.

- **From the day after the last World Series game until the offseason page
  starts:** the home page shows the champion bracket, the same as on an off day.
  There are no games, so the height limit does not apply.
- **When the offseason page starts** (statsapi's `offseasonStartDate`, 2026-11-01
  this year): the bracket folds into the offseason page and stays there for the
  whole offseason. It lives in the "Season record" row
  (`src/components/offseason/SeasonRecord.jsx`), the one row already about
  results. The row shows the bracket folded: the champion shows, and a tap opens
  the full bracket.
- The row's kraft tape and its "Opening this shows results" warning do not fit a
  row that shows the champion. Redesign the row. Keep its "Final standings" and
  "The postseason" links.
- MLB level only. The minor levels' offseason pages do not change.
- A past day's slate still shows the bracket as it was that morning.

## The in-progress series page

A new page, like the finished-series page (`PostseasonSeriesPage.jsx`), for a
series that is still going. The finished page does not work mid-series: its
headline is "{winner} win in N", and it needs a winner.

- **Same idea as the finished page:** the series record, a game-by-game log, and
  series leaders, all in the same scorebook look (`35-postseason-series.css`).
- **What only this page has:** the state heading in ("Series tied 1–1", "CHC leads
  2–1"), today's game, and the games still to play, with dates and "if necessary".
- **Spoiler rule:** the same cutoff as the bracket. The page shows the series
  heading into the slate's date. Games before that date show their results.
  Today's game shows as today's game, with no score. Scores Unlocked does not
  change this.
- When the series ends, the tap goes to the finished-series page.

## The slate cards

Reuse the existing cards (`GameCard`, and `PastGameFlipCard` for past finals).
Small changes only:

- A line like `Game 2 · NL Wild Card Series`. Say where it goes on the card.
- The heading-in series record, same state as the bracket. Text only, no pips:
  the cards already have two rows of dots (bullpen dots and lineup-ready pips).
  Wording, neutral to both clubs:
  - "Game 1"
  - "CHC leads 1–0"
  - "Series tied 1–1"
  - "Winner take all"
- The **favorite team's** card stays pinned at the top of the cards, below the
  bracket. This is the user's chosen club (`useFavoriteTeam`), not a fixed club.
  Say "favorite team", never a club name, in code and copy.

## Do-nots

- **No red and green for AL and NL.** The history bracket and `/postseason-race`
  use clay red and field green. In this app those colors mean out and on-base, so
  in a bracket they read as lost and won.
- **No rubber stamps on round headers.** On this page a stamp means Postponed
  (`06-loader-and-cards.css`), and the Logbook stamp is the keepsake.
- **No light grays for "faint".** Only three inks pass contrast on paper:
  `--ink-0`, `--ink-2`, `--graphite`. `--graphite-soft` and `--rule` fail. Make
  "faint" with shape (hollow, dashed, smaller, struck).
- **No bold for "inked"** in the display and mono fonts. They ship one weight. Use
  color or size.
- **No animation on page load.** It would replay yesterday's results on every
  visit. Motion plays only for a change the user just made. Put any new animation
  on `/animation-lab`.

## Reuse

- **Baseline to beat:** `/postseason-race` (`src/screens/PostseasonRacePage.jsx`,
  `src/styles/70-postseason-race.css`). It already stacks AL over NL, each a
  3-column bracket with byes. Put each concept next to it.
- Existing bracket (history, completed seasons): `src/screens/PostseasonHistoryPage.jsx`,
  styles in `src/styles/34-postseason.css`. 7 columns when wide; on a phone it
  already stacks (`BracketStack`). Reuse the parts, not the layout.
- Richer parts that already exist: the series page's inked win cells and navy
  pennant band (`35-postseason-series.css`), mono knockout logos for the gray
  eliminated club (`TeamLogo variant="mono"`), the World Series trophy art
  (`public/brand/`), and `Card` / `SectionHead` in `src/components/ui/frame/`.
- Design system: paper scorebook (manila paper, navy ink, pencil graphite, kraft
  amber). Semantic tokens only, no raw hex. Every word shows in caps. See
  `src/CLAUDE.md`.

## Process

1. Show 2–3 concepts at phone width (390px).
2. Draw each one on the Wild Card state (what users see first) and on a
   mid-Division Series state.
3. Gary picks one.
4. Then build.

## Engineering notes (for after design)

> Superseded by **Build prompt (technical work)** at the end of this file
> (2026-09-28, checked against `origin/main` and live statsapi). Kept for the record.

- Spoiler scope: the slate is inside the rule's scope. Add the new bracket module
  to `src/api/spoiler-manifest.json` with the "heading into the date" reason. Pin
  the cutoff with a unit test (a game on the slate date must not change the pips).
- Future dates: the date arrows can move to tomorrow. Tomorrow's bracket must not
  show today's results. Cap a future date at today's state. An "if necessary" game
  that drops off tomorrow's slate also gives away today's result; check this.
- The champion changes the offseason page. ADR-0081 says that page shows results
  only behind a labelled link. Now the "Season record" row shows the champion for
  the whole offseason, with the full bracket one tap away. This is Gary's decision
  (2026-09-28): it keeps results in the one row built for them. Record it as an
  addendum to ADR-0081. The row's kraft tape must go (ADR-0083: kraft means
  sealed, and the champion is not sealed).
- Check that the history data has this season's finished series. If it does not,
  the in-progress page must also cover finished series until it does.
- Verify series field paths against a live postseason schedule response. Do not
  guess.
- Test with `?nointro` on the dev URL.

## Research

- ESPN mirrors AL / NL around a center World Series and scrolls sideways on a phone:
  https://www.espn.com/mlb/playoff-bracket
- Common mobile patterns: swipe by round, league stacked vertically, or focus on the
  current round. We chose league stacked vertically.
  https://www.newmediacampaigns.com/blog/designing-a-tournament-bracket-mobile-first-approach

## Build prompt (technical work)

Written 2026-09-28 with `/improve-prompt`. It takes the technical work in this
brief and checks each claim against `origin/main` and live statsapi. Paste the
block below into a fresh session. It starts with the design step. Gary answered
all five open decisions on 2026-09-28: design step first (local link, no PR),
two build PRs, the slate stops at today in the postseason, Scores Unlocked does
not apply, and the champion comes from the live schedule.

````markdown
# Build prompt: postseason home page

You make the design concepts, and then you build the data, the spoiler gates,
the routes, the tests and the docs for the postseason home page. Do not run
`npm run e2e` unless Gary asks.

The work has three steps, in this order:

- **Step 0, design (no PR):** 2–3 concepts on a local link. Gary picks one.
- **PR 1:** the bracket, the slate cards' series line and the series page, in
  the look Gary picked.
- **PR 2:** the champion, the Season record row and the ADR-0081 addendum. It
  must be merged by 2026-10-27, the earliest possible last World Series game.

Do sections 1 and 0 first. Do not start PR 1 until Gary picks a concept.

## 0. The design step (no PR)

- Use `/frontend-design` with the design sections of this brief ("What it is"
  through "Process"). Make 2–3 concepts at 390px width.
- Draw each concept on two real states:
  - **Wild Card:** the 2026 bracket heading into 2026-09-29. All series are 0–0,
    with the real clubs, the byes and the empty later-round slots.
  - **Mid-Division Series:** 2025, heading into 2025-10-09. This one date has
    most of the states the brief lists. TOR won its series 3–1 and waits.
    SEA–DET is tied 2–2 and has no game that day (its deciding game is the next
    day). MIL leads 2–1 and LAD leads 2–1, and both play that day.
- Put each concept next to `/postseason-race`, the baseline to beat.
- Use the app's real tokens and fonts, so what Gary sees is what ships. Build
  the concepts as a page that only the dev server serves (gated on
  `import.meta.env.DEV`, so the production build drops it), or as files under
  `.scratch/postseason-home/concepts/`. Do not open a PR for them.
- Give Gary one local link for each concept (add `?nointro` to an app route).
  Open each link yourself first. Say in two or three lines how the concepts
  differ. Then stop until Gary picks.
- Write the pick into this brief under "Process": the concept's name and its
  files. The picked look ships in PR 1, built on the real data. Nothing else
  from this step goes into a PR.

## 1. Start

- Work in the worktree `C:\Users\gzilavy\bbsbh-postseason-home`, branch
  `claude/postseason-home`. The branch is local only. It is one commit ahead of
  `origin/main`: `086516ee6`, a comment in `src/lib/teams.js`. Keep that commit.
- Run `git fetch`. Merge `origin/main` into the branch. List worktrees and open
  PRs. If another branch changes `GameSelect.jsx`, `src/api/schedule.js`,
  `SeasonRecord.jsx` or `src/api/spoiler-manifest.json`, stop and tell Gary.
- The design brief is `.scratch/postseason-home/brief.md`. The look for PR 1 is
  the concept Gary picks in step 0. If that concept needs a value that section 3
  forbids, stop and ask.

Dates from statsapi's 2026 season row (checked 2026-09-28): `postSeasonStartDate`
2026-09-28, first game 2026-09-29, `postSeasonEndDate` 2026-10-31,
`offseasonStartDate` 2026-11-01. The earliest possible last World Series game is
Game 4 on 2026-10-27.

## 2. What to build (MLB only; the minor-level tabs do not change)

1. **The bracket**, above the slate cards in `src/screens/GameSelect.jsx`, on each
   date from `postSeasonStartDate` to the day before `offseasonStartDate`, off
   days included. Read those dates off the season row (`fetchSeasonMeta` in
   `src/api/schedule.js`). Never read the window off the clock or off an empty
   slate (`src/hooks/useOffseason.js` follows the same rule). Today, 2026-09-28,
   is in the window and has no games.
2. **A series line on each postseason slate card** (`GameCard`,
   `PastGameFlipCard`): `Game 2 · NL Wild Card Series`, and the heading-in
   record: "Game 1", "CHC leads 1–0", "Series tied 1–1", "Winner take all". The
   favorite team's card stays pinned at the top of the cards, below the bracket
   (`useFavoriteTeam`). Say "favorite team", never a club name, in code and copy.
3. **A series page for the running postseason**, for a series in progress and
   for a finished 2026 series (see trap 7).
4. **The champion.** From the day after the last World Series game to the day
   before `offseasonStartDate`, the home page shows the finished bracket. From
   `offseasonStartDate`, the bracket folds into the Season record row
   (`src/components/offseason/SeasonRecord.jsx`).

## 3. The spoiler rule (read first)

- The bracket, the cards and the series page show each series **heading into
  the cutoff date**. On the slate, the cutoff is the slate's date, capped at
  today (`todayStr` in `GameSelect.jsx`). On the series page, the cutoff is its
  `?d=` date (ISO), capped at today, or today when there is no `?d=`.
- A game counts only when it went Final **before** the cutoff date. A game went
  Final on its `officialDate`, so a game that ends at 12:40 a.m. counts on its
  own date. Exception: a suspended game went Final on its `resumeGameDate` (see
  `normalizeGame` in `src/api/schedule.js`; test game in `docs/test-games.md`,
  "Suspended and resumed game").
- Yesterday's results are not protected. This is a decision, not a bug. Do not
  add a SealBox, a seal or kraft. The date cutoff is the seal.
- **Scores Unlocked does not apply here** (Gary's decision, 2026-09-28). The
  bracket, the cards' series line and the series page do not read
  `useScoresUnlocked()` or `spoilersOffFor()`. They show the state heading into
  the cutoff date, with the switch on or off. The switch still shows the slate's
  own scores through `fetchSlateScores`, as it does now; do not change that.
  This is a deliberate exception to the standing rule that the switch drops
  every date cutoff (ADR-0026). Record it in the new ADR. The bracket code
  writes nothing to storage.
- **Never fetch a result and then hide it** (root `CLAUDE.md`). The bracket's
  results fetch is separate from `fetchSchedule`, like `fetchSlateScores` (see
  the header of `src/api/schedule.js`). It asks only for dates before the
  cutoff, and only for the fields the state needs (`isWinner`; never runs, a
  score or a linescore). The pure derivation also drops a game that went Final
  on or after the cutoff (the resumed game) before it returns.
- Add the new module to `src/api/spoiler-manifest.json` as `cutoff-gated`, with
  the "heading into the date" reason.

## 4. Traps (checked against live statsapi on 2026-09-28)

1. **`seriesStatus` and `teams.{side}.leagueRecord` on a postseason game give
   the state AFTER that game.** 2025-10-04 NLDS Game 1 reads "MIL leads 1-0" and
   a 1–0 `leagueRecord`. On today's game they change when the game ends. Do not
   read them from a game on or after the cutoff. Do not add them to
   `SCHEDULE_FIELDS` or `normalizeGame`. `seriesStatus.result` uses the same
   words as the card copy. That is the trap.
2. **Safe on the slate's own rows:** `seriesGameNumber`, `gamesInSeries`,
   `seriesDescription`, `ifNecessary`, `description` (for example
   "NL Wild Card 'A' Game 1").
3. **A postponed game reports `abstractGameState: "Final"`.** Count a win only
   for a game with a winner. A postponed game is listed under its old date and
   its new one. Keep only the listing where `dates[].date === officialDate` (the
   same dedupe as `scripts/gen-highlights.mjs`).
4. **Placeholder clubs.** Later rounds list placeholders with real-looking ids:
   5528 "HOU/CWS", 5533 "SD/CHC", 5513 "AL Higher Seed", 2711 "Lower Seed League
   Champion". They are empty slots. Do not send one to `teamLogoUrl`, `TeamLink`
   or the favorite-team sort.
5. **Slot letters cross.** NL Wild Card 'A' (PHI @ ATL) feeds NLDS 'B'
   (ATL/PHI @ LAD). NL Wild Card 'B' (CHC @ SD) feeds NLDS 'A' (SD/CHC @ MIL).
   The AL does the same. Wire the bracket by the placeholder's club pair
   ("ATL/PHI"), then by club id. Never by letter.
6. **Future dates show today's result.** An unplayed "if necessary" game drops
   off the schedule. It is not marked cancelled (2025 NL Wild Card 'A' Game 3 is
   gone). A played Game 3 reads `ifNecessary: "N"`. A placeholder becomes a club
   when its series ends. So the slate for a future date shows today's result,
   even with no bracket. **Gary's decision (2026-09-28):** in the postseason
   window, the slate never shows a date after today. The forward date arrow
   stops at today, and a future date in the URL opens today's slate. Record
   this in the new ADR. If the slate has another way to reach a future date,
   close it too, or stop and ask.
7. **`public/data/postseason-history.json` has no 2026 series, and will not
   until after the World Series.** `scripts/gen-postseason-history.mjs` ships a
   season only when the whole bracket is Final, and it is a hand-run script, not
   a cron. `PostseasonSeriesPage.jsx` finds a series only in that file. So each
   2026 series opens the new page, finished or not.

Re-check traps 1–3 against the first Final 2026 game (2026-09-29, Wild Card
Game 1). If a field reads differently, stop and ask.

## 5. Routes and the series page

- **One id per series.** Build the id the way
  `scripts/gen-postseason-history.mjs` does (line 240):
  `{year}-{roundKey}-{Game 1 away id}-{Game 1 home id}`, round keys `wildcard`,
  `division`, `lcs`, `worldseries` (example: `2025-wildcard-116-114`). A series
  gets an id only when both clubs are known.
- Give the new page its own route in `src/lib/route.js` that takes the series id
  and `?d=`. Add it to the routing test.
- The bracket links a series to the finished page (`/postseason/{seriesId}`)
  only when the series was decided before the cutoff and the history file has
  its id. Otherwise it links to the new page with `?d=`.
- The new page shows the state heading in, a game-by-game log, series leaders,
  today's game (no score) and the games still to play, with dates and "if
  necessary". The log and the leaders read only games before the cutoff. Do not
  fetch `/boxscore` for today's game.
- If you reuse `src/api/postseasonSeries.js` for 2026 games, its manifest `why`
  ("every game in postseason-history.json is already Final") is no longer true.
  Rewrite it. A new screen that imports `src/api/boxscore.js` must join that
  entry's `importers` list, with a reason.

## 6. The champion and the Season record row

- The champion is the club with 4 World Series wins before the cutoff.
- Data source (Gary's decision, 2026-09-28): the live schedule, through the
  same module that draws the bracket. It must work the day after the last World
  Series game with no hand-run step. Do not read the champion from
  `postseason-history.json`.
- Write an addendum to ADR-0081 for Gary's decision of 2026-09-28: the Season
  record row shows the champion on its face for the whole offseason, and the
  full bracket is one tap away. It keeps results in the one row built for them.
- Remove the row's tape and its "Opening this shows results" line. The reason
  is not ADR-0083. On `main` the tape is not kraft: ADR-0083 already moved
  `.srecord__tape` to `--hold-texture` (`src/styles/78-offseason.css`). The
  reason: a warning in front of a result that is already on the face is false.
  In the addendum, also correct ADR-0081's line "the only thing on the page
  wearing kraft tape".
- Keep the "Final standings" and "The postseason" links. MLB only.

## 7. Tests (write each test first and watch it fail, then write the code)

Pure logic in `node:test`. Capture a trimmed, `fields=`-pruned 2025 postseason
schedule into `test/fixtures/` (the 2026 schedule has no results yet), and
capture today's 2026 schedule for the wiring. Pin:
1. A game on the cutoff date never changes the state, Final or not.
2. A suspended game resumed on the cutoff date does not count.
3. A postponed game is not a win, and its second listing counts once.
4. Placeholders are empty slots, and the crossed Wild Card to Division Series
   wiring is correct for 2026.
5. The four record wordings. "Winner take all" when each club is one win from
   taking the series.
6. The champion shows only when 4 World Series wins fall before the cutoff.
7. `normalizeGame` carries no `seriesStatus` or `leagueRecord` (extend
   `test/slate-scores.test.js`).
8. The new route parses and builds.
9. The future-date rule: in the postseason window, a date after today resolves
   to today.

Known answers from 2025: heading into 2025-10-04, the four Division Series are
0–0. Heading into 2025-10-05: MIL leads 1–0, TOR leads 1–0, LAD leads 1–0, DET
leads 1–0.

## 8. Docs

- A new ADR for the bracket's rule: heading into the cutoff date, yesterday not
  protected, no seal, Scores Unlocked does not apply, and the slate stops at
  today in the postseason window.
  0087 was free on every branch on 2026-09-28. Check again before you write it;
  `check-adr-numbers` fails on a duplicate.
- The ADR-0081 addendum (section 6).
- The manifest entries (sections 3 and 5).
- `test/CLAUDE.md`: one index row for each new test file.
- The nested `CLAUDE.md` or `docs/api/` entry for each module you add.

## 9. Lint traps

`check-dir-size` has these directories at their cap on `origin/main`: `src/api`
(114), `src/screens` (46), `src/hooks` (28), `src/styles` (116),
`src/components/game` (12). A new file in one of them fails lint. Put the file
in a subdirectory, or raise that entry by one with a `// +1 for …` reason, as
each entry in `scripts/check-dir-size.mjs` does. If `check-dir-size.mjs` then
passes its own line cap in `check-file-size.mjs`, raise that band. Do not remove
comments to fit. Measure again after each merge of `origin/main`.

## 10. Verify in the browser

Start the first free reserved dev port (`npm run dev`, then `dev:2` to `dev:5`).
Keep it running. Check at 390px width:
- `http://localhost:<port>/10042025?nointro` and `/10052025?nointro`: the
  bracket and the cards match the 2025 answers in section 7. A tap opens the
  right page.
- `/?nointro` (today) and `/09292026?nointro`: all series 0–0, and placeholders
  show as empty slots.
- `/11152025?nointro`: the Season record row shows the 2025 champion.
- Scores Unlocked on today's slate: the bracket and the series lines do not
  change.
- The forward date arrow stops at today, and `/10152026?nointro` opens today's
  slate.

## 11. Done, and what you may not do

Done means: `npm run lint`, `npm test` and `npm run build` pass (read the exit
code), each test in section 7 failed before its code, and the section 10 checks
pass.

Open two PRs. Do not merge them. Do not push to `main`. Gary merges.

- **PR 1** from `claude/postseason-home`: sections 2.1–2.3, 3, 4, 5, the new ADR,
  and tests 1–5 and 7–9.
- **PR 2** from a new branch, `claude/postseason-champion`, based on PR 1's
  branch (it needs PR 1's bracket module). Name PR 1 as its base in the PR body.
  It holds section 2.4, section 6, the ADR-0081 addendum and test 6. After PR 1
  merges, merge `origin/main` into PR 2's branch. PR 2 must be merged by
  2026-10-27.

Stop and ask Gary when: a statsapi field disagrees with section 4; the concept
needs a value that section 3 forbids; CI fails outside this work (report the
output; never skip, delete or loosen a test); another agent's branch touches the
same files.

## 12. Handoff

- Branch, worktree, PR number and state, and whether `origin/main` is merged in.
- The local URLs you checked (with `?nointro`), and the dev server you left
  running.
- Each of Gary's 2026-09-28 decisions, and where the code carries it.
- Follow-ups: run `node scripts/gen-postseason-history.mjs` after the World
  Series, so 2026's finished series open the finished page; anything you could
  not verify.
````
