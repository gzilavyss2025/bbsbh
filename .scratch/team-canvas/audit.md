# Team page audit: every element, one verdict (#1107, row 1)

Read-only audit. No product code changed. Written 2026-10-15 for the run plan in
`.scratch/team-canvas/run-plan.md` (row 1). Rows 3 to 7 and the G1 gate use this file.

**Inputs.** ADR-0082 (bands, absent-never-disabled, request budget), #1107,
`.scratch/team-one-scroll/design.md` (sections 3, 13, 14) and `scope.md` (2B, 2F) for
*which element goes in which band* and the data decisions. ADR-0109 and
`docs/player-redesign.md` (sections 3, 6) for the look. The September boards in
`.scratch/team-one-scroll/canvas/` were **not** used for the look.

**Evidence tags.** **[C]** read in code this session. **[D]** stated in a doc. **[M]**
measured this session: dev server, Chromium, `?nointro`, live statsapi, 2026-10-15
(the MLB postseason is running, so 158 shows a full 162-game season plus October).
**[I]** my inference. Treat an [I] as a question, not a fact.

## 1. Verdict key and the shared parts

| Verdict | Meaning |
| --- | --- |
| **RE-SKIN** | Same layout, new parts. The reason says why the layout already works. |
| **RE-DESIGN** | The layout fails at something. The reason says what. "Board" = needs a canvas board in G1. "Parts" = can be built from shared parts with no new board. |
| **MERGE/CUT** | The element stops existing as itself. The reason says "cut" or "merge into X". |
| **KEEP** | Not part of the look change. |

**The shared parts (what a row can map to)** [C]:

| Part | Where | Notes for this audit |
| --- | --- | --- |
| Stamped Card | `ui/frame/Card.jsx` `frame="stamped"` with `label` (name tab), `count` tag, `tone` plain/tint/ink, `stampIn` | `label` and `head` cannot both be passed: `Card` throws. See gap G-2. |
| Stat tile and rank mark | `ui/frame/StatTile.jsx` | Built for about five hero figures. No dense variant. See gap G-4. |
| Fact strip | `ui/frame/FactGrid.jsx` `look="strip"` | Three cells across at 390, six wide. |
| Jump bar | `chrome/HubTabBar.jsx` `variant="anchor"` | Already built: counts, scroll-spy, keeps the current button in view (`scrollLeftToShow`). Player page uses it. |
| Table | `ui/table/Table.jsx` | `frame` sheet or bare, `sticky` first column. |
| Segmented, MenuRail | `ui/control/` | `Segmented` is a row of 44px toggles. `MenuRail` folds menu cards into a rail with a panel. |
| Pill, Door, Button | `ui/control/` | Pill roles: control, tag; `figure` for numbers. |
| EmptyState, Notice | `ui/state/` | Dashed "not posted yet" block; a message with a tone. |
| SectionHead | `ui/frame/SectionHead.jsx` | Looks: `label`, `rule`, `band` only. **The page head and sub-head looks do not exist yet** [C]; ADR-0082 "Trued up" says row 3 adds them. |
| Stack, Cluster, Grid | `ui/layout/` | Layout for new code (ADR-0108). |
| Near-view hook | `hooks/scroll/useNearView.js` | Shared. The player page's `Slot.jsx` (hold height, hide when empty, stamp-in) is private to `screens/player/next/`. See gap G-3. |

**Gaps in the shared parts that this audit found (feed row 3):**

- **G-1. Page head and sub-head.** `SectionHead` has no 2px-rule 21px head and no 1px 17px
  sub-head [C]. ADR-0082 already assigns this to #1107.
- **G-2. A stamped card has no action slot.** Seven cards today carry a control in the head
  bar: Postseason Odds pill (S2), Stamp In (G1a), Season/Current toggle (RO1a), `See all` and
  `Org leaders` (R5a, R5b), `How this is calculated` link (S4e), the transactions arrows
  (RO6b). `Card` refuses a name tab plus a head [C]. Decide: toolbar row inside the body, or a
  stamped card that takes a `head`. One decision covers all seven.
- **G-3. No shared band wrapper.** Each band needs: load when near, hold its height, hide when
  empty, stamp in when the jump bar lands on it. The player page has this as `Slot.jsx`, private
  to `screens/player/next/`. ADR-0109 says a copy in `screens/team/` is a review failure, so
  lift it, do not copy it.
- **G-4. No dense tile.** Team batting and pitching are 22 ranked cells; Season counts are 18.
  A stamped `StatTile` at about 130px a row would turn the 466px of the two rank boards into roughly 1,300 to 1,500px [I]. Either
  keep a ledger grid on a stamped card for these, or add a compact tile. Do not use `StatTile`
  for them as it ships.
- **G-5. Club colour.** About 20 card heads are club-coloured bars today (ADR-0030).
  A stamped name tab is ink. Moving to stamped cards removes club colour from every card head;
  the hero is then the only club-coloured surface. Confirm this is wanted (open call 2).

## 2. Summary

**Verdict counts** (section 4; a row is one element or one named sub-element): 92 rows: **RE-SKIN 55**, **RE-DESIGN 10**, **MERGE/CUT 11**, **KEEP 16**.

**RE-DESIGN rows (the G1 input).** Nine need a board in Claude Design: H3 hero and tiles, S4 Team
Score, S5 Records index, S5c inning grid, R3 Run value, R4 ABS challenges, RO1 Roster
projection with the bullpen, M3 contract grid on a phone, A1 Ballpark with the degraded state.
One (H16, band loading state) needs no board.

**What the audit found, in order of weight:**

1. **The top of the page does not answer "how is this club doing".** First screen at 390
   today: a logo, a name, `103–59`, `1st · National League Central`, a manager, two buttons,
   a 66px strip of 30 logos, a tab bar, then a division table. About 420px of the 844px window
   is chrome before the first data card [M]. The strongest facts about the club (season grade
   9.5 of 10, first of 30; run differential; form) sit 1,600 to 2,000px lower or on another tab.
   All of them are in data the page already fetches. See section 3.
2. **The Records card is the one real scale problem.** 3,236px, 61 rows, 68% of Standing at 158
   [M]. ADR-0082 and design.md 10 already decided the answer: a sub-head, and the card becomes
   an index that unfolds (826px closed). It needs a board in the new look.
3. **Same people, far apart, in Roster.** The projection card lists the bullpen (9 names, WAR).
   The Bullpen health card, 425px later, draws the same relievers with seven days of usage. The
   40-man list below repeats both [M]. This is the clearest "related facts far apart" case on
   the page, and it is not in ADR-0082's list of problems.
4. **Two numbers disagree.** The Last 10 rail says `9-1`; the standings row says `L10 8-2` on
   the same page at 158 [M]. The rail counts October games, the standings split counts the
   regular season only. When the rail is cut and its number moves into a tile, pick one and
   label it.
5. **Most cards are RE-SKIN, because they already use `Card` + `SectionHead`.** Almost every
   card is built on the shared `Card` [C]. Five blocks sit under a `SectionHead` with no `Card`:
   the transactions deck, the leaders ledger's frame, Made The Show's frame, the games grid and
   the commitment cliff. Affiliation history is a sixth, drawn by `CareerTimeline` [I: design.md 14·A·c].
   A re-skin is mostly `frame="stamped"`, a name tab
   in place of the band head, and a count tag. The cost sits in G-2 (actions) and G-4 (dense
   boards), not in the cards.
6. **One element has no band in the signed-off plan: Franchise history** (`FranchiseHistory`,
   MLB only). ADR-0082, scope.md and design.md never name it [C: grep]. I placed it in
   **About** by ADR-0082's own test (change `?d=` and it does not move; it is the MLB
   counterpart of Affiliation history). That makes About three cards on an MLB club, not two.
   This needs a one-line amendment to ADR-0082. I did not stop for it (open call 1).
7. **The ADR counts six `PreviewDoor` links; the code has four** (`TeamPage.jsx` lines 147,
   181, 198, 230). The other two "doors" are the leaders ledger's own `See all ›` and the
   photos rail's own `Full season ›`. Both survive. Nothing is lost.
8. **Three doors drop `?d=` today.** `RecordsCard` passes `s` only; `TeamRunValueCard` calls
   `runValuePath()` and `TeamChallengeCard` calls `absChallengesPath()` with no options [C].
   scope.md 2H says every door carries `{ d, s }`. See section 5.

## 3. The top of the page

### 3.1 What a reader learns in the first screen at 390 today

Route `/team/158?nointro`, 390x844 [M, screenshot `team-158-390-fold.jpg`]:

| y (px) | What | What it tells the reader |
| ---: | --- | --- |
| 0–96 | Site bar, Back | Nothing about the club |
| 100–286 | Hero: logo 104px, name, `103–59`, `1st · National League Central`, `Manager: Pat Murphy`, Game Notes, Notes archive | Name, W-L, division place, manager. Record text is the smallest thing in the card. Buttons take a full row (70px) |
| 294–360 | Club strip, 30 logos | Nothing about this club |
| 372–406 | Tab bar (the sixth tab, Minors, is off screen at 390; Contracts is clipped) | Navigation |
| 422–690 | NL Central table, 5 rows: W, L, GB, Streak, L10 | Division race. **RD (run differential) is clipped by the table's sideways scroll** at 390 on all four clubs (158, 556, 249, 675): the RD header's right edge sits at 395, 381, 419 and 368px, past the card edge [M, DOM check] |
| 708+ | Ballpark head, a stadium photo | Nothing about the season |

At 1180 the hero is a 930px banner with the text at the left and two buttons at the right,
and about 300px of empty tinted ground between them [M, `team-158-1180-fold.jpg`].

What the reader does **not** learn without scrolling or changing tab: win percentage, run
differential, current form (Last 10, streak: only in the table), season grade and league
rank, postseason odds, where the club stands in the whole league (not just the division),
what is next on the schedule, the ballpark's name.

The winter club (675) is thinner: `0–1`, no division line (no division exists), a WINTER pill,
and the standings table [M]. The affiliate (556, 249) adds the level pill and an Affiliate
chip, and still no run differential on a phone.

### 3.2 What the header and the tiles could hold, from data the app already fetches

No new request in any row below. The page's cold load already pays for these (the standings
response; the Standing band's two static score files; the page-level schedule; the identity
shell). ADR-0082 says the header shapes its record off the Standing band's own standings
response, not a second fetch [D].

**Source facts.** The standings record row carries more than `teamRecordFor` keeps. Verified
against the live response for league 104, 2026 [M, node fetch]: `leagueRecord` (so win
percentage), `runsScored`, `runsAllowed`, `streak`, `divisionRank`, `leagueRank`, `sportRank`,
`gamesBack`, `wildCardGamesBack`, `clinchIndicator`, `eliminationNumber`, and `records` (home,
away, last ten, and more). `teamRecordFor` keeps four of these (wins, losses, division rank, division name).
`standingsRowsFor` adds games back, streak, the last-ten, home and away splits and the run
differential, and drops win percentage, runs scored and allowed, `leagueRank`, `sportRank` and
the clinch fields [C, `data/shared.js` lines 110–137]. For 158 the live values are win pct
`.636`, 832 runs scored, 618 allowed, clinch `z`, `sportRank` 1 [M]. So the gap for the tiles is a wider **shaper**,
not a wider fetch.

**Stat tiles** (stamped, ADR-0109): five on MLB, four on MiLB, three or four on winter.

| Tile | MLB 158 | Affiliate 556 / 249 | Winter 675 | Source and gap |
| --- | --- | --- | --- | --- |
| **Lead (ink): record** | `103–59`, caption `.636 · 1st NL Central`, rank `1 of 30` (MLB-wide) | same, rank is division only | `0–1`, no division caption | Standings. Needs win pct and `sportRank` in the shaper. Winter has no division, so no caption (the code already hides the line). |
| **Run differential** | `+214`, caption `832 RS · 618 RA` | same | same | Standings `runsScored`, `runsAllowed`. `diff` is already shaped. |
| **Form** | `8–2` last 10, caption `W5` | same | same | Standings split and streak: already shaped (`l10`, `streak`). **Use this, not the rail's `9-1`** (finding 4). |
| **Season grade** | `9.5`, caption `Making it look easy`, rank `1 of 30` | absent | absent | `teamScore` and `seasonScore` files: Standing's loader already reads them. MLB only. |
| **Now** (optional) | `NLCS vs LAD`, next game or series result state | same | same | The page-level schedule includes unplayed rows (the schedule strip draws an empty cell for the unplayed LCS game [M]) [I]. Needs a small `nextGame` shaper. |
| Postseason odds (optional) | MLB in season only | absent | absent | `fetchPostseasonOdds` already runs for the Standing band. Meaningless in the offseason, so conditional. |

**Fact strip** (three cells across at 390, six wide): Manager (already fetched), Ballpark
(`team.venue.name`, already on the page), League · Division (already), Level (MiLB: already),
Affiliate of (MiLB: `parentOrgIdOf`, already), and, optional, Capacity (static park table in the
bundle, MLB only, no request) and Founded (one franchise shard, about 1 KB: a real request, so
the About band could own it instead).

**Recommended first screen at 390** [I]: site bar, then **one hero card** (logo plate in the
club's tint, name, level pill, three fact cells), then the **lead tile** full width, then a
2x2 of tiles. Jump bar sticks under it. That puts the answer to "how is this club doing, and
why" above the fold with no card, no scroll. The club strip leaves the first screen (open call 3).

**Cautions** [I]. (a) The hero must keep the `wearing` / `identity.editing` path in
`TeamHubShell` (line 146) so the owner's identity drawer still previews through the hero.
(b) The `entering {date}` note (line 231) must survive: when `?d=` is set, show it as a Notice
or tile caption. (c) The as-of control sits at the foot of a roughly 20,000px page; with the
page this long the only way to *change* `?d=` is out of sight (row H12).

## 4. The audit table

Columns: **ID** · **Element** · **File** (all under `src/`) · **Band** · **Shared part it maps
to** · **Verdict** · **Reason** · **Data gap**. "Board" and "Parts" are explained in section 1.
Heights are at 390 on `/team/158` [M] unless said. A "(code)" height note means the card does
not render on 158 today (offseason or data) and the row comes from code.

### H. Page frame and header (above the bands)

| ID | Element | File | Band | Part | Verdict | Reason | Data gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| H1 | Site bar | `components/chrome/SiteHeader.jsx` | Header | none | **KEEP** | Site chrome on every page. Not the team page's look. | none |
| H2 | Back button | `components/chrome/BackBtn.jsx` | Header | none | **KEEP** | Same. | none |
| H3 | Identity hero (`header.team-hub__id`: club-tint ground, 104px logo, name, record, manager, actions) | `screens/team/TeamHubShell.jsx:204` | Header | Stamped Card + FactGrid strip + StatTile row | **RE-DESIGN** (Board) | Fails hierarchy: the record is the smallest text in a 186px card, and the facts that answer "how is the club doing" are 1,600px lower (section 3.1). At 1180 the card is mostly empty ground. Replace with hero + fact strip + tiles (section 3.2). Keep the club tint on the logo plate only (ADR-0030). | Wider shaper (win pct, RS/RA, `sportRank`). No new request. |
| H4 | Level pill (AAA, A, WINTER) | `TeamHubShell.jsx:221` | Header | `Pill role="tag"` | **RE-SKIN** | Already a `Pill`. Sits in the name row as a tag. `SPORT_LABEL[17]` exists since #1143. | none |
| H5 | Record line (`W–L`, `1st · division`, `entering {date}`) | `TeamHubShell.jsx:225` | Header | StatTile (lead) | **MERGE/CUT** | Merge into the lead tile (record, rank) and the fact strip (division). `entering {date}` becomes a Notice or caption when `?d=` is set. | none |
| H6 | Manager line + interim flag | `TeamHubShell.jsx:234` | Header | FactGrid strip cell | **RE-SKIN** | A label and a linked value is exactly a fact cell. `ManagerLink` stays. | none (`fetchManager` already runs) |
| H7 | Affiliate chip (parent logo, 34px, link) | `TeamHubShell.jsx:246` | Header | FactGrid strip cell + `TeamLink` | **RE-SKIN** | A level fact plus a link: a strip cell "Affiliate of" with the logo. At 390 it today sits on its own row (see 249 and 556 screenshots). | none (`parentOrgIdOf`) |
| H8 | Game Notes + Notes archive buttons (MLB only) | `TeamHubShell.jsx:73, 256` | Header (open call 4: or About) | `Button` | **RE-SKIN** | Two doors to club documents. Layout works; they take a 70px row at 390. Put them in the hero foot. | `resolveGameNotes` is fetched once per tab today (×6, ADR-0082); fetch once per page. |
| H9 | Identity admin bar, drawer, draft hook (`modules/identity/*`, about 1,500 lines) | `screens/team/modules/identity/*` | Header | none | **KEEP** | Owner-only editor. Needs a mount point in the new hero and the `wearing` preview path. No visitor sees it. | none |
| H10 | Club strip (browse clubs of this level) | `components/team/TeamFilterStrip.jsx` | Header | none (shared with the slate) | **KEEP** | Shared control. Placement is the open item (call 3): it costs 66px of the first screen. | none |
| H11 | Tab bar (six route tabs) | `screens/team/TeamTabBar.jsx` | Header | JumpBar (`HubTabBar variant="anchor"`) | **MERGE/CUT** | Cut `TeamTabBar.jsx`. The jump bar is built; row 3 supplies the band list and `hiddenTeamSections`. 44px (Gary, 2026-10-07). | Counts for lazy bands are unknown before they load: use the dot, or a count only where the page-level schedule knows it (Games). |
| H12 | As-of banner (foot) and the `datable` prop | `components/seal/AsOfBanner.jsx`, `TeamHubShell.jsx:320` | Header | none | **KEEP** | One banner for the page; Money states it does not date (ADR-0082). [I] At the foot of a 20,000px page it is the only way to change `?d=`: consider a door in the hero. | none |
| H13 | Per-tab document title (`TAB_TITLE`) | `TeamHubShell.jsx:55` | Header | none | **MERGE/CUT** | Cut the suffix. One page, one title: the club name. | none |
| H14 | `hiddenTeamTabs()` | `screens/team/data/shared.js:434` | Header | none | **MERGE/CUT** | Replaced by `hiddenTeamSections(team)`; the `league?.id` test comes before the sport test (ADR-0082, #1143). | none |
| H15 | Four `PreviewDoor` links (`Season numbers`, `Season schedule`, `Full roster`, `All transactions`) | `screens/TeamPage.jsx:39, 147, 181, 198, 230` | Header | `Door` | **MERGE/CUT** | Cut. A preview never sits above the thing it previews (scope.md 2A). The ADR says six; two more "doors" (leaders `See all ›`, photos `Full season ›`) survive and are not `PreviewDoor`s. | none |
| H16 | Loading and error states (`AsyncGate` page gate; `AsyncStatus` line) | `components/ui/AsyncGate.jsx` | Header | `Notice` + held height | **RE-DESIGN** (Parts) | Today one gate covers the page. A band needs its own held height and an error row. design.md 17 lists this as "to design". The player `Slot` hold plus `Notice` cover it; no board needed. | none |

### S. Standing: "How is the season going?"

Order inside the band (scope.md 2B): standings, Team Score, then sub-head *Record, split every
way*: Records, day of week, Comebacks, Last Time. The band head carries the page's only sub-head.

| ID | Element | File | Band | Part | Verdict | Reason | Data gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | Division standings table (270px; 5 to 10 rows) | `screens/team/modules/StandingsCard.jsx` | Standing | Stamped Card + `Table` | **RE-SKIN** | A table is the right shape for a division race, and it is already on `Table`. The card, not the table, changes. One fix: at 390 RD is clipped and Streak is shown; swap so RD shows (RD is the most informative column) [I]. | **Winter (675): leaders print `-1.0` GB** (feed value `-1.0` on a 1–0 club) [M]. Normalise to `—`. |
| S2 | Postseason Odds pill | `StandingsCard.jsx:51` | Standing | `Pill role="control"` | **RE-SKIN** | Already a `Pill`. Needs a slot on a stamped card (G-2). MLB only. | `divisionPostseasonOdds` is empty when no snapshot exists |
| S3 | Postseason Odds modal | `components/teamstats/PostseasonOddsModal.jsx` | Standing | sheet + `Table` | **RE-SKIN** | A sheet with a table. Layout works. | none |
| S4 | Team Score card (`Season report`, 433px) | `components/teamstats/TeamScoreCard.jsx` | Standing | StatTile (lead, in hero) + stamped Card | **RE-DESIGN** (Board) | The one number that answers "how good is this club" (`9.5`, `1st of 30`) sits as the sixth card, 2,068px down, inside a card whose other parts (a Form row, two folded driver rows, a breakdown, a modal) are all reference [C]. Split it: the grade becomes the lead tile in the hero; the league rails and rank strips stay as a stamped card; the breakdowns stay folded. | MLB only. Files are already loaded by Standing. |
| S4a | Grade hero (grade, storyline, rank) | `TeamScoreCard.jsx` `GradeHero` | Standing | StatTile | **MERGE/CUT** | Merge into the hero tile (S4). | none |
| S4b | League track and rank strip (beeswarm of 30 clubs; 9-club logo strip) | `TeamScoreCard.jsx`; `lib/beeswarm.js` | Standing | stamped Card | **RE-SKIN** | A chart that no table can replace (design.md 14·D: chart kept). Layout works. | none |
| S4c | Breakdown disclosure (`dl` of quality, adjustment, expectation) | `TeamScoreCard.jsx` `ScoreDetail` | Standing | none | **RE-SKIN** | Folded detail. Works. | none |
| S4d | `Form` row (last-10 score with rails) | `TeamScoreCard.jsx` `ScoreRow` | Standing | stamped Card | **RE-SKIN** | Second rail for current form. Works. | none |
| S4e | `How this is calculated` link + explainer modal | `TeamScoreExplainer.jsx` | Standing | `Door` in head slot + sheet | **RE-SKIN** | A door to a sheet. Needs a slot (G-2). | none |
| S5 | Records card (3,236px; 61 rows; about 12 groups [D]) | `screens/team/modules/records/RecordsCard.jsx` | Standing | stamped Card + fold index (MenuRail or a fold row) | **RE-DESIGN** (Board) | 68% of the band and the largest object on the page by a factor of three. It fails at scale: four screens of splits, no way to see which group holds what. The decision exists (design.md 10: sub-head, plus an index that unfolds, 826px closed). It needs a board in the new look. ADR-0109 d4 allows a stopgap: ship today's content in a stamped card, build the index later. | none. 556: 3,102px; 249: 2,975px [M]. Winter: absent (ledger incomplete). |
| S5a | Half toggle (Full / Pre / Post All-Star) and month pills (All + up to 12) | `RecordsCard.jsx:121–150` | Standing | `Segmented` (halves); month row open | **RE-SKIN** | Hand-built pill rows today (about 29px, under the 44px minimum, design.md 14·K). Halves map to `Segmented`. The month row (up to 13 pills, wraps to two lines at 390) may not fit `Segmented`: check on the board. | none |
| S5b | Group rows (`RecordRows`: label door, W-L, pct) | `RecordsCard.jsx:38` | Standing | none (ledger rows) | **RE-SKIN** | A ledger of label, figure, figure is the right shape; the dotted label = "opens a page" (design.md 14·F). | none |
| S5c | Scoring by inning grid (9 innings × top/bottom; 4 lines per cell; 620px at 390) | `records/InningScoringGrid.jsx` | Standing | `Table` | **RE-DESIGN** (Board) | One group takes about 20% of the card. Each cell stacks four lines (W-L, pct, last date, result) so 18 cells need 620px. Related facts (top vs bottom of one inning) are two columns apart but the cells are too tall to compare down a column. | none |
| S5d | Season counts (18 count buttons in a `Grid`, 411px) | `RecordsCard.jsx:65` | Standing | ledger rows, not `StatTile` | **RE-SKIN** | design.md 14·E: counts become ledger rows (411 to 363px). Do **not** use `StatTile` (G-4). | none |
| S5e | Per-row door to `/situational-records` (every Records row and count) | `RecordsCard.jsx:47, 79` | Standing | `Door` underline | **KEEP** | The row is the door; keep. Must carry `{ d, s }` (section 5): today it passes `s` only. | none |
| S6 | Record by Day of Week (7 cells, 171px, today's day highlighted) | `modules/TeamStatsCard.jsx` (`TeamStats`) | Standing | stamped Card, ledger | **RE-SKIN** | Seven short rows that answer one question. Layout works. Highlight of today's weekday stays. | none |
| S7 | Comeback wins (3 dot-plot rails, MLB avg tick, postseason rows; 486px) | `modules/ComebackCard.jsx` | Standing | stamped Card | **RE-SKIN** | The rail is a chart a table cannot replace (design.md 14·D). Layout works. Fix on the way: the gloss paragraph is shouted caps inside the card; house rule is natural case at the foot (design.md 14·G) [D]. MLB only. | none |
| S8 | Last Time (droughts: slot, date, chances since) | `records/LastTimeCard.jsx` | Standing | stamped Card, ledger | **RE-SKIN** | Ledger rows (event, date, count). Works. MLB only. (code: not rendered on 158 on 2026-10-15) | none |
| S9 | `Season numbers` door under Team Score | `TeamPage.jsx:147` | Standing | none | **MERGE/CUT** | Cut with the other `PreviewDoor`s (H15). | none |

### R. Ranks: "Where does this club sit among the rest?"

Absent below Triple-A except the leaders ledger. Never empty: the ledger always renders
(ADR-0082).

| ID | Element | File | Band | Part | Verdict | Reason | Data gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | Team batting ranks (9 tinted cells, 2 columns, 202px) | `modules/TeamStatsCard.jsx` | Ranks | stamped Card, dense grid | **RE-SKIN** | A dense two-column board answers "where do we rank on nine stats" in 202px. Keep the green/clay tint (it matches the tile tints). Do not use `StatTile` (G-4). One fix: ranks read `2ND`; the house rule is `2 of 30`, no ordinal word (design.md 14·B) [D]. | MLB only |
| R2 | Team pitching ranks (13 cells, 264px) | `modules/TeamStatsCard.jsx` | Ranks | same | **RE-SKIN** | Same as R1. | MLB only |
| R3 | Run value card (520px: total, rank, split bar, 4 components, top-6 list, prose, door) | `modules/TeamRunValueCard.jsx` | Ranks | StatTile row + stamped Card | **RE-DESIGN** (Board) | Related facts are in one card but not one hierarchy: the total (`+158`), its rank (`3rd of 30`) and its four parts (bat 54, def 6, run 12, pitch 86) are one set of figures drawn as a heading, a bar and a text row. That is a lead tile plus four small tiles, then the list. It is also one of two cards with a bar-less head (design.md 3, variant b). | MLB only (Savant). |
| R3a | Run value split bar (stacked, one scale) | `components/around-the-game/RunValueParts.jsx` (via `RunValueSplit`) | Ranks | stamped Card | **RE-SKIN** | A chart (design.md 14·D). Keep. | none |
| R3b | Top 6 players list | `TeamRunValueCard.jsx:59` | Ranks | `Table` or ledger | **RE-SKIN** | Rank, name, position, figure. Works. | none |
| R3c | `League run value board ›` door | `TeamRunValueCard.jsx:81` | Ranks | `Door` | **KEEP** | Door out. Must carry `{ d, s }`: `runValuePath()` takes no options today. | `runValuePath` needs `opts` (section 5) |
| R4 | ABS challenges card (1,068px: rate, unit, rank, league, view toggle, scatter, table, prose, door) | `modules/TeamChallengeCard.jsx` | Ranks | StatTile + `Segmented` + stamped Card | **RE-DESIGN** (Board) | Ten children, 1,068px, one subject. The top four lines (`4.99`, `per 1,000 pitches`, `30th of 30`, `League 6.67`) are a tile spread over four paragraphs. The scatter and the player table below it are two views of the same 14 players, 400px apart. Bar-less head (variant b). | MLB and Triple-A only |
| R4a | Batter / Catcher view toggle | `TeamChallengeCard.jsx:127` | Ranks | `Segmented` | **RE-SKIN** | A two-way switch inside a card. Exactly `Segmented`. | none |
| R4b | Scatter chart (pitches seen vs reviews; trend line) | `components/charts/*` via `ScatterChart` | Ranks | stamped Card | **RE-SKIN** | A chart (design.md 14·D). Keep. | none |
| R4c | Player table (name, seen, called, rate) | `TeamChallengeCard.jsx:163` | Ranks | `Table` | **RE-SKIN** | Already `Table frame="bare"`. | none |
| R4d | `League challenge board ›` door | `TeamChallengeCard.jsx:218` | Ranks | `Door` | **KEEP** | Door out. Must carry `{ d, s }`: `absChallengesPath(season)` takes a season, not `d`/`s`. | `absChallengesPath` needs `opts` (section 5) |
| R5 | Team leaders ledger (two sub-cards, Batting and Pitching, 569px) | `components/teamstats/TeamLeadersLedger.jsx` | Ranks | two stamped Cards (name tabs `Batting`, `Pitching`) + `Table` | **RE-SKIN** | Category, leader, figure is the right shape. Today it is a page-level label over two cards whose bars are the app navy, not the club's (design.md 14·A·c). Two stamped cards fix that. Stays in Ranks (Gary, 2026-09-21). | Winter and below Triple-A: it is the whole band |
| R5a | `See all ›` door (to `/team/{id}/leaders`) | `TeamLeadersLedger.jsx:83` | Ranks | `Door` | **KEEP** | Door to a page that stays a page. Slot needed (G-2). | none |
| R5b | `Org leaders ›` door | `screens/team/NumbersTab.jsx:118` | Ranks | `Door` | **KEEP** | Same. | none |

### G. Games: "What have they played, and where?"

| ID | Element | File | Band | Part | Verdict | Reason | Data gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G1 | Season schedule (series strip: opponent logo, abbreviation, one dot per game; 831px) | `modules/SeasonSchedule.jsx` | Games | stamped Card | **RE-SKIN** | The only series-level view of the season. One glance shows streaks, sweeps and the All-Star break. Works. Known: cells are about 14px, under the touch minimum (pre-existing). Duplicates the grid below only at game level. | none |
| G1a | `Stamp In` pill (only door to `/team/{id}/stamp-in`, ADR-0042) | `SeasonSchedule.jsx` | Games | `Pill role="control"` | **KEEP** | One entry by design (ADR-0042). Needs a slot (G-2). Must carry `{ d, s }`; it does today. | none |
| G1b | All-Star break chip | `SeasonSchedule.jsx:58` | Games | none | **RE-SKIN** | Part of the strip. | none |
| G2 | Games grid (`AllGames`: ticket stubs, 3 across at 390, 24 at a time, newest first; 1,342px) | `modules/TeamGames.jsx:232` | Games | stamped Card, `Grid` | **RE-SKIN** | Date, result band, logo, score is already a small tile; the grid works at 3-up on a phone and wide. It is the only block on the page with no head (design.md 14·A·e): add a name tab `Games` and a count tag. | Includes postseason rows (`gameType`); a count tag should say so. |
| G2a | `Show more` door (24 per step) | `TeamGames.jsx:247` | Games | `Door layout="block"` | **KEEP** | Works. | none |
| G3 | Game stub card (shared by Last 10 and the grid) | `TeamGames.jsx` `GameStubCard` | Games | `StatTile`-like (not a tile today) | **RE-SKIN** | Square corners, stamped edge. Layout works. | none |
| G4 | Highlights rail (MLB only, 261px) | `modules/media/TeamHighlightsRail.jsx` | Games | stamped Card | **RE-SKIN** | A sideways rail of video stills. 16:9 needs a rail. Works. | MLB only (`isMlbTeamId`); static per-club clip file |
| G5 | Photos rail, capped, with `Full season ›` door (238px) | `modules/media/TeamPhotosRail.jsx` | Games | stamped Card + `Door` | **RE-SKIN** | A rail of photos. Works. Use the capped copy; the uncapped walk is #1142. | MiLB has no photographer stills (#1142); gate stays MLB only. |
| G5a | Rail arrow buttons (three hand-built copies: `last10__nav`, `teamphotos__nav`, `seasonseries__nav`) | `TeamGames.jsx`, `TeamPhotosRail.jsx`, `SeasonSeriesStrip.jsx` | Games | `IconButton` | **RE-SKIN** | Three drawings of one control. Collapse to one when the rails are re-skinned [I]. | none |
| G6 | Last 10 rail (10 stubs, header `9-1`; 232px) | `modules/TeamGames.jsx:203` (`LastTenGames`); only caller `TeamPage.jsx` | Games | none | **MERGE/CUT** | Cut (scope.md 2D, cut 1): the grid's first row is the last three, 1,500px away on one page. Its `9-1` moves into the Form tile (section 3.2). **The rail and the standings disagree today** (`9-1` vs `8-2`) because the rail counts October. | Pick regular-season L10 for the tile. |

### RO. Roster: "Who plays here?"

| ID | Element | File | Band | Part | Verdict | Reason | Data gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RO1 | Roster projection card (`Roster`, 1,206px: toggle, diamond, 4 substitutes, starting pitchers, bullpen; two columns at wide) | `modules/RosterProjection.jsx` | Roster | stamped Cards (Lineup; Pitching staff) | **RE-DESIGN** (Board) | Fails two ways. (1) Its title `Roster` repeats the band name, and a second card below is called `Current Roster`: three "Roster"s in a row. (2) The bullpen list (9 names, WAR) is drawn again 425px later as Bullpen health (the same 9 arms, seven days of use) and a third time in the 40-man. Draw lineup and substitutes as one card, and the whole staff (starters, bullpen, health) as one. | none: all three lists read data the Roster loader already has. |
| RO1a | Season / Current toggle | `RosterProjection.jsx:45` | Roster | `Segmented` | **RE-SKIN** | Hand-built `role="tablist"`; a two-way switch inside a card is `Segmented`. Needs a slot (G-2). | `hasRecentRoster` hides it when there is no recent window |
| RO1b | Defense diamond (nine names on the field) | `components/scoring/DefenseDiamond.jsx` | Roster | none | **KEEP** | Shared drawing (the lineup page uses it). Draw-only. | none |
| RO1c | Top substitutes, starting pitchers, bullpen lists | `RosterProjection.jsx` + `RosterList.jsx` | Roster | ledger rows | **RE-SKIN** | The row (jersey, name, star, injury mark, WAR pill, chevron) is dense and works. | none |
| RO1p | Overview's preview variant (`preview`: diamond, top-5 SP, closer) | `RosterProjection.jsx` `preview` prop; `TeamPage.jsx:190` | Roster | none | **MERGE/CUT** | Cut. The full card renders once (scope.md 2A). `previewStartingPitchers` and `previewCloser` leave the Overview loader. | none |
| RO2 | Roster row (`RosterList`: jersey, name, ★, injury, prospect, rookie, WAR pill, badge, chevron) | `modules/RosterList.jsx` | Roster | ledger row, `Pill` | **RE-SKIN** | One row, three cards use it. Works. Its `thub-*` classes are on the naming ledger. | none |
| RO3 | Bullpen health (7-day staff grid; 425px; MLB only) | `modules/BullpenHealthCard.jsx` | Roster | stamped Card + count tag (`6 available`) | **RE-SKIN** | The grid works as a unique view. Move it next to the pitching staff (RO1) when that card is redrawn. Self-fetching and self-hiding today: it stays so. | `workload.json` has no MiLB rows: absent below MLB |
| RO4 | Current Roster (40-man: Position players, Pitchers; 1,203px) | `modules/CurrentRosterCard.jsx` | Roster | stamped Card | **RE-SKIN** | A full roster is a long list; two groups with role and WAR is the right grain. The hierarchy problem was solved by the band. | none |
| RO5 | Injured List | `modules/InjuredListCard.jsx` | Roster | stamped Card + count tag | **RE-SKIN** | A short list with an IL chip. Works. Dead code: the `Door` "Show N injured" branch never renders (`showInjured` is always true) [C]. Delete it. | none (offseason: 233px) |
| RO6 | Transactions deck, capped at 3, with `All transactions ›` (231px) | `components/transactions/TeamTransactionsCard.jsx` | Roster | stamped Card, rail inside the body | **RE-SKIN** | A sideways deck of story cards answers "who arrived and left". Works. design.md 14·A·d says the deck "bleeds past the gutter"; a stamped card has a 2px ink edge, so the deck must scroll *inside* the card body. Moves from Games to Roster (scope.md 2B). | MLB only (no MiLB feed) |
| RO6a | Day tab, story cards, move rows | `components/transactions/TxStory.jsx`, `MoveRow.jsx`, `TradeCard.jsx` | Roster | paper cards inside the stamped card | **RE-SKIN** | Shared with the ledger page. Keep as paper cards, not stamped (20 stamped cards in a rail is too heavy [I]). | none |
| RO6b | Deck arrows (`DeckNudge`) | `components/transactions/DeckNudge.jsx` | Roster | `IconButton` | **RE-SKIN** | Another rail arrow (see G5a). Needs a slot (G-2). | none |
| RO6c | `All transactions ›` door | `TeamPage.jsx:230`; `GamesTab.jsx:96` | Roster | `Door` | **KEEP** | Door to a page that stays a page. Must carry `{ d, s }`; it does. | none |

### FA. Farm: "Who is coming, and where does this club sit in the org?"

Absent when the club has no parent org (winter). On an affiliate it shows the parent's ladder.

| ID | Element | File | Band | Part | Verdict | Reason | Data gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FA1 | Affiliates (link cards: level pill, logo, name, city; 547px) | `modules/minors/AffiliatesCard.jsx` | Farm | stamped Card + link cards | **RE-SKIN** | A grid of link tiles. Works. Note: the three Brewers complex clubs share one logo and read as repeats [M]. | none |
| FA2 | On the horizon (Promotion watch tiles + rehab Milestones tiles) | `modules/minors/HorizonCard.jsx` | Farm | stamped Card + tiles | **RE-SKIN** | Headshot, name, move, stat grid: already tile-shaped. Renders nothing when empty (code: not rendered on 158 today). | none |
| FA3 | Prospects (3 headshot cards, then a ranked table of the org; 1,135px) | `modules/minors/ProspectsCard.jsx` | Farm | stamped Card + `Table` | **RE-SKIN** | Faces for the top three, a table for the rest: the right split. Uncapped (`showAllProspects`) per ADR. | none |
| FA4 | Depth chart (position pills; Scouting vs Performance columns; 402px) | `modules/minors/DepthChartCard.jsx` | Farm | stamped Card + `Segmented` | **RE-SKIN** | The compare is the point and both columns are visible side by side at wide. The position pills are a selector: `Segmented` or the pill row, check width on the board (up to 9 positions) [I]. At 390 the two lists stack, which separates the compared facts: note, not a blocker. | none |

### M. Money: "What does it cost?" (MLB only; does not move with `?d=`)

| ID | Element | File | Band | Part | Verdict | Reason | Data gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M1 | Four payroll tiles (payroll, committed after, option years, arbitration years; 171px) | `screens/team/ContractsTab.jsx:27` (`Tile`) | Money | `StatTile` | **RE-SKIN** | Already a label, a big number, a caption. The closest match to `StatTile` on the page. Payroll is the lead (ink) tile; `22nd of 30` is a rank mark. | none |
| M2 | Commitment cliff (bar chart by season; 172px) | `components/salaries/CommitmentCliff.jsx` | Money | stamped Card | **RE-SKIN** | A chart (design.md 14·D). Today it has its own head bar, not a card. | none |
| M3 | Contract grid (players down, seasons across; sticky name and age columns; 1,792px) | `components/salaries/ContractGrid.jsx` | Money | `Table sticky` in a stamped Card | **RE-DESIGN** (Board) | Fails its own question on a phone. The point of the grid is the *shape* of each contract (how long, how much). At 390 the sticky name and age columns take about 60% of the width and one season column shows (read off the screenshot) [M]; the rest hides behind a sideways scroll. | none |
| M3a | Position chips (`ctr__code`) and contract-term line | `ContractGrid.jsx:43` | Money | `Pill role="tag"` | **RE-SKIN** | Works. | none |
| M4 | Contract key (legend) | `ContractGrid.jsx` `ContractKey` | Money | card foot | **RE-SKIN** | Fold into the grid card's foot. | none |
| M5 | Hint line `The book falls $X between 2026 and 2028` | `ContractsTab.jsx:121` | Money | caption on the cliff card | **MERGE/CUT** | Merge into the cliff card (M2). The chart and its one-sentence reading are 600px apart today. | none |
| M6 | Source line (`A season's book, not a day's…`) | `components/salaries/SourceLine.jsx` | Money | band note + `Notice` info | **RE-SKIN** | ADR-0082 keeps it: it is what says the band does not date. | none |
| M7 | MiLB empty state (`published for the major leagues only`) | `ContractsTab.jsx:78` | Money | none | **MERGE/CUT** | Cut. The band is absent below MLB, never an apology (ADR-0082). | none |
| M8 | MLB "ledger not published yet" empty state | `ContractsTab.jsx:82` | Money | `EmptyState` | **KEEP** | An MLB club always shows the band (ADR-0082 forbids fetching to decide). This is its empty state. | none |

### A. About: "What is this club?" (every club)

Four cards on an affiliate, three on MLB (with Franchise history, A2), two at winter.

| ID | Element | File | Band | Part | Verdict | Reason | Data gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | Ballpark card (hero photo and name, diagram, facts, ranked dimensions, note; 1,006px MLB, 428px 556/249, 89px 675) | `modules/ballpark/BallparkCard.jsx` | About | stamped Card + FactGrid strip + `EmptyState` | **RE-DESIGN** (Board) | On MLB the capacity, roof, surface, built and attendance facts (a fact strip) sit in the card's lower half, under a full-width photo, far from the park's name. On an affiliate and at winter it is a head, a name and nothing else: "the page's one undrawn empty" (design.md 14·H). Draw the strip, and draw the empty state. | MiLB: no hand-verified dimensions, so no diagram (#1859 draws some). `team.venue` has no capacity on the static shape [C]; MLB reads a bundled table. |
| A1a | Park diagram + dimensions | `components/ballpark/BallparkDiagram.jsx` | About | stamped Card | **RE-SKIN** | A drawing. Keep. | MLB, plus MiLB parks the registry can draw |
| A1b | Ballpark admin editor (gear, edit fields, draft hook) | `modules/ballpark/BallparkAdminBar.jsx`, `BallparkEditFields.jsx`, `useBallparkDraft.js` | About | none | **KEEP** | Owner-only. | none |
| A2 | Franchise history (name and park spans; MLB only; 330px) | `modules/ballpark/FranchiseHistory.jsx` | About (**not named in ADR-0082**) | stamped Card | **RE-SKIN** | A strip of spans and park lines. Works. No band in the plan names it; About is the fit (call 1). | One 1 KB shard, `franchiseFor`: MLB only. A request About's loader owns. |
| A3 | Logos & jerseys deck (MLB: record by jersey; MiLB: home and away; 258px) | `components/logo/JerseyCombos.jsx` | About | stamped Card (flush body) | **RE-SKIN** | A drag-scrolled deck of club-tinted tiles: already tile-shaped. Works. Moves from Numbers to About (Gary, 2026-09-21). | MLB: two `/uniforms/game` batches; MiLB: none (reads standings splits). **The ADR says the jersey tiles do not move with `?d=`; the code says they do** (`loadNumbers.js` joins only games whose `won` is set, which is cutoff-gated) [C]. Decide in row 6f. |
| A4 | Affiliation history (MiLB; 101 to 185px) | `components/player/CareerTimeline.jsx` via `MinorsTab.jsx:49` | About | stamped Card | **RE-SKIN** | A shared timeline with the player page's History. Works. Moves from Minors to About. | `/data/milb-history.json` plus one logo read per era |
| A5 | Made The Show (MiLB alumni cards; 911px) | `components/teamstats/MilbAlumni.jsx` | About | stamped Card + tile cards | **RE-SKIN** | Page-level label with no card today (design.md 14·A·c). Each alum is already a small "baseball card" tile. | `/data/milb-alumni/{id}.json`; 675 has none: self-hides |

### X. On disk, not on the page (no verdict needed for #1107)

| ID | Element | File | Note |
| --- | --- | --- | --- |
| X1 | `BullpenBoard`, `StarterMatchups`, `SeasonSeriesStrip` | `components/teamstats/` | Not used by `/team/{id}`. The lineup and series surfaces use them. **KEEP**, out of scope. |
| X2 | `TeamLeaders` (headshot card board) | `components/teamstats/TeamLeaders.jsx` | Used by `/team/{id}/leaders` and the league leaders pages. **KEEP**, out of scope. |
| X3 | `/team/{id}/leaders`, `/photos`, `/transactions`, `/stamp-in` | `screens/TeamLeadersPage.jsx`, `team/TeamPhotosPage.jsx`, `team/TeamTransactionsPage.jsx`, `team/StampInPage.jsx` | Stay pages (ADR-0082). The band links to each. They wear the new look in later work. **KEEP**, out of scope. |

**Verdict counts** (computed from the rows of section 4 H to A by script): 92 rows: **RE-SKIN 55**, **RE-DESIGN 10**, **MERGE/CUT 11**, **KEEP 16**.

## 5. Doors out: `?d=` and `?s=`

Rule (ADR-0082, scope.md 2H): every door goes through `linkQuery({ d, s })`; the page renders
inside `LinkScope asOf sportId`. A redirect from an old tab route must keep the query string.

| Door | Row | Builder today | Carries `d`? | Carries `s`? | Action for the band row |
| --- | --- | --- | :---: | :---: | --- |
| Records row and count (to `/situational-records`) | S5e | `situationalRecordsPath({ metric, half, month, s })` | **no** | yes | Pass `d`. Check the page honours it. |
| `League run value board ›` | R3c | `runValuePath()`: takes no options | **no** | **no** | Give the builder `opts`. |
| `League challenge board ›` | R4d | `absChallengesPath(season)`: takes a season | **no** | **no** | Give the builder `opts`. |
| `See all ›` (to `/team/{id}/leaders`) | R5a | `teamLeadersPath(id, { d, s })` | yes | yes | Keep. |
| `Org leaders ›` | R5b | `orgLeadersPath(id, { d, s })` | yes | yes | Keep. |
| `Stamp In` | G1a | `teamStampInPath(id, { d, s })` | yes | yes | Keep. |
| `All transactions ›` | RO6c | `teamTransactionsPath(id, { name, d, s })` | yes | yes | Keep. |
| `Full season ›` (photos) | G5 | `teamPhotosPath` | not checked | not checked | Check in row 6b. |
| Game Notes, Notes archive | H8 | `gameNotesPath(teamId)`; the PDF is external | **no** | **no** | The archive is a notes page, not a stats page. Confirm it needs neither. |
| Schedule cell (to a game) | G1 | `gamePath(date, away, home, 'lineup1', n)` | n/a | n/a | A game is a scoring surface with its own seal. No change. |
| Standings row, affiliate card, club strip, player names, manager | S1, FA1, H10 | `TeamLink`, `PlayerLink`, `ManagerLink` read `LinkScope` | yes | yes | Keep. The page must stay inside `LinkScope`. |
| Old tab routes (`/team/{id}/roster` and the others) | row 3 | redirect | — | — | Must land on `/team/{id}?d=…#roster`. A redirect that drops the query is a spoiler bug (ADR-0082). |

## 6. MiLB and winter degradation: which element renders where

`✓` renders. `—` absent (the band or card does not render; never a disabled stub). `cond`
depends on data. From code and from measured card lists on 158, 556, 249 and 675 [M, C].

| Band and element | 158 MLB | 556 AAA | 249 A (572 A+ the same) | 675 winter |
| --- | :---: | :---: | :---: | :---: |
| Hero, fact strip, tiles (record, RD, form) | ✓ | ✓ | ✓ | ✓ (no division line) |
| Tile: season grade | ✓ | — | — | — |
| Standing: division table | ✓ | ✓ | ✓ | ✓ (league table, 10 clubs) |
| Standing: Team Score, Comebacks, Last Time | ✓ / ✓ / cond | — | — | — |
| Standing: Postseason Odds pill | ✓ (in season) | — | — | — |
| Standing: Records | ✓ | ✓ | ✓ | — (ledger incomplete) |
| Standing: day of week | ✓ | ✓ | ✓ | ✓ |
| Ranks: batting, pitching, run value | ✓ | — | — | — |
| Ranks: ABS challenges | ✓ | ✓ | — | — |
| Ranks: leaders ledger | ✓ | ✓ | ✓ | ✓ |
| Games: schedule, grid | ✓ | ✓ | ✓ | ✓ |
| Games: highlights, photos | ✓ | — | — | — |
| Roster: projection, 40-man | ✓ | ✓ | ✓ | ✓ |
| Roster: bullpen health, transactions | ✓ | — | — | — |
| Roster: injured list | cond | cond | cond | — |
| Farm: all four cards | ✓ | ✓ (parent's ladder) | ✓ (parent's ladder) | — (no parent org) |
| Money | ✓ | — | — | — |
| About: ballpark | ✓ (full) | ✓ (name only) | ✓ (name only) | ✓ (name only, 89px) |
| About: franchise history | ✓ | — | — | — |
| About: jerseys | ✓ (record by jersey) | ✓ (home, away) | ✓ (home, away) | ✓ (home, away) |
| About: affiliation history, Made The Show | — | ✓ | ✓ | — |
| Jump bar buttons | 7 | 6 | 6 | 5 |

## 7. Build order, and is Standing a good pilot?

### 7.1 Order of work

1. **Foundation (row 3), and fix the gaps first.** Page head and sub-head looks (G-1), the
   band wrapper (G-3), the action-slot decision (G-2), the band list and `hiddenTeamSections`,
   redirects. Row 4's review is where G-2 and G-3 get checked.
2. **Standing, with the hero and tiles (row 5, the pilot).** See 7.2.
3. **Wave 5, three at a time (cap 3).** Start the one with the most open design with two
   cheap ones, so its long tail overlaps:
   - **Wave A: Roster (6c), Money (6e), Farm (6d).** Roster holds RO1, the biggest RE-DESIGN
     after Standing, and moves Transactions in. Money is near one-to-one (tiles, chart, grid).
     Farm is all RE-SKIN.
   - **Wave B: Games (6b), Ranks (6a), About (6f).** Games and Ranks are mostly RE-SKIN. About
     must exist before the swap because every club's page ends on it, and it holds A1
     (RE-DESIGN) plus the degraded state. Ranks holds R3 and R4 (RE-DESIGN).
   If Gary wants one wave of six, nothing here blocks it: the rows share only the append-only
   `src/index.css` imports.
4. **Swap and delete (row 7).**

### 7.2 Is Standing a good pilot?

**Yes, with one change to its scope.**

For:

- It is the first screen and the only band that loads at page load, so it tests the shell, the
  header and tiles, the `loadStanding` split, and the cold request budget (≤ 20) in one go
  [D: ADR-0082 2F].
- ADR-0082 says "if this band does not work, the whole idea does not". It is where the
  grammar (band head, the page's only sub-head, cards in a band) is proved.
- It has the widest spread of element types: a table (S1), a modal (S3), a chart card (S4b),
  rails (S7), ledger rows (S6, S8), a toggled index (S5). A pilot that passes here has used
  most of the parts.
- It is where the club-colour change (G-5) first shows.

Against:

- It is the longest band (about 4,600px at 158) and its bulk is one card (Records, 3,236px).
  A pilot that has to redraw Records is judged on Records, not on the grammar.
- Its two real RE-DESIGNs (S4 Team Score, S5 Records) both need G1 boards, so the pilot waits
  on Gary's layout picks.
- On the floor (675) Standing is only S1 and S6. The pilot proves the MLB shape; it does not
  prove the thin shape unless 675 is rendered too.

**The change:** cut the pilot's scope to the band head, hero and tiles (H3–H7), S1, S2/S3,
S4 (hero tile + rails card), S6, S7, S8, and ship **Records as today's content in a stamped
card** (ADR-0109 decision 4 allows this). Build the Records index as its own row after the
pilot. That keeps the pilot judgeable at 390 and 1180 on 158, 556, 249 and 675, and it removes
the one card that could swallow the review. This adds one row to the run plan (after row 5).

## 8. Open calls for Gary (none blocks the audit)

1. **Franchise history has no band.** Put it in About (my pick, by ADR-0082's `?d=` test).
   Needs a one-line ADR-0082 amendment: About is three cards on MLB, not two. [Needs a yes.]
2. **Club colour.** Moving to stamped cards removes club colour from card heads (G-5). My
   default: the hero's logo plate keeps the club tint and nothing else does.
3. **Club strip placement.** It costs 66px of the first screen. My suggestion: move it to the
   page foot, after About. [I]
4. **Game Notes and Notes archive.** Hero foot (my pick) or About.
5. **Stamped card action slot (G-2).** One decision for seven cards.
6. **Dense tile (G-4).** Keep a ledger grid for the 22 rank cells and 18 counts (my pick), or
   add a compact tile.

## 9. Method and measurements

**How it was done.** Read the signed-off plan and the look spec. Listed every file the six tabs
render: `screens/TeamPage.jsx`, `screens/team/*Tab.jsx`, `TeamHubShell.jsx`,
`screens/team/modules/**`, `components/teamstats/**`, and the shared components they import
(`TeamTransactionsCard`, `JerseyCombos`, `salaries/*`). Read every module's markup. Measured
top-level block heights with a Playwright script (390px wide, scrolled once to wake lazy
content). Screenshots with `.claude/skills/run/shot.mjs`. All on the dev server (StrictMode), so
no request counts were taken: those need a production build and belong to rows 3 and 5.

**Block heights at 390, `/team/158` [M].** Page total (Overview): 4,795px; Roster tab 3,605;
Games 3,503; Numbers 7,680; Contracts 2,918; Minors 2,606. Chrome above the first card: 422px.

| Band | Elements and heights (px) | Sum |
| --- | --- | ---: |
| Standing | Standings 270 · Team Score 433 · Records 3,236 · Day of week 171 · Comebacks 486 | 4,596 |
| Ranks | Batting 202 · Pitching 264 · Run value 520 · ABS 1,068 · Leaders 569 | 2,623 |
| Games | Schedule 831 · Grid 1,342 · Highlights 261 · Photos 238 | 2,672 |
| Roster | Projection 1,206 · Bullpen health 425 · 40-man 1,203 · Injured 233 · Deck 231 | 3,298 |
| Farm | Affiliates 547 · Prospects 1,135 · Depth chart 402 | 2,084 |
| Money | Tiles 171 · Cliff 172 · Grid 1,792 · Key 70 · Hint 45 · Source 132 | 2,382 |
| About | Ballpark 1,006 · Franchise history 330 · Jerseys 258 | 1,594 |
| Cut | Last 10 232 · four `PreviewDoor`s 88 | — |

The sum of the seven bands is about 19,250px before band furniture. ADR-0082 measured 17,594px
of cards and 19,148px of page on 2026-09-21; the difference is the offseason data and the
postseason rows in the grid [I].

**Other clubs, same method [M].** 556: Overview 3,641, Records 3,102, Contracts 844 (empty
state). 249: Overview 3,521, Records 2,975. 675: Overview 2,050, Ballpark 89, Roster tab 2,822.

**Screenshots** (in the session's scratchpad `shots/`, sent to Gary with the PR): fold at 390
and at 1180 for `/team/158`, `/team/556`, `/team/249`, `/team/675`; a player page
(`/player/660271`) for the look reference.
