# Tally Baseball: an offseason home page

Design study, 14 September 2026. Recommendation: **Concept A, One more game**.
This document separates repository findings, external facts and proposed behavior.
All content in the six wireframe images is illustrative, including player affiliation,
records, dates, pairings and report values. The drawings are not implemented screens.

## 1. Current product and opportunity

Tally is a read-only companion to a paper scorebook. Its best offseason asset is
the game flow it already has. A useful visit can end with a person scoring an
archived game, rather than reading another general baseball news page.

The home page shows **one level at a time**, not five stacked level sections.
`GameSelect.jsx` has MLB, AAA, AA, A+ and A navigation; the minor levels use sport
IDs 11, 12, 13 and 14. The level and date live in the URL. Bare `/` is today's MLB
slate; `/aaa` and `/aa/08152026` are existing examples. The club strip opens team
pages; it is not a filter of the daily slate. Favorite clubs and their affiliates
can receive priority in the game list. Do not replace that navigation with a new
offseason dashboard shell.

The current slate has date arrows, game cards, result reveals, search, a Game Log
entry, and a roster wire. On wide screens the wire sits beside the games; on
phones it docks below. Off-day and All-Star break messages can include the next
game date. The next-game search has a ten-day default horizon. An empty return
from that search cannot establish that a season ended.

Team hubs lead to roster, games, numbers and affiliate information. Player hubs
have Overview, Stats, Analytics and History routes. The Stats tab has a game log
with level context. Season-level discovery therefore has real destinations;
it does not need a new player-detail page.

The existing scoring path is `GameSelect → GameView → TeamInfo → InningViewer`.
Game sections have real URLs for away/home lineups, top/bottom halves and box
score. Within a half, **Next at-bat** reveals a plate appearance and its associated
notes; **Rest of half** completes the half. The transient at-bat cursor ultimately
commits the existing half-inning high-water mark. It is not a separate permanent
replay save. In a live half, the flow stops at **Caught up**. Extra innings emerge
only as the reader reaches them. Express Lane is a separate film-oriented flow;
do not promise that its video coverage exists for a random minor-league game.

**Opportunity:** replace the empty current-day games area with a small, dated
archive invitation. Keep a clear path to past daily slates and current club news.
Avoid a new content operation that needs daily manual writing.

Repository evidence: `src/screens/GameSelect.jsx`, `src/components/team/OffDaySection.jsx`,
`src/api/schedule.js`, `src/api/statsLevels.js`, `src/api/minorsLeaders.js`,
`src/api/team.js`, `src/api/standings.js`, `src/screens/StandingsPage.jsx`,
`src/api/postseasonHistory.js`, `src/api/postseasonSeries.js`, `src/lib/route.js`,
`docs/player-hub.md`, `CONTEXT.md`, root and nested `CLAUDE.md`, and ADRs 0016,
0021, 0026, 0034 and 0056. This is source inspection and endpoint verification.
Browser page inspection remained blocked by the browser runtime, despite Chrome
being discoverable. No claim of a completed visual audit of the existing app is made.

## 2. Research and product fit

| Observed external pattern | What suits Tally | What to avoid |
| --- | --- | --- |
| MiLB separates standings by league and half. | A league selector followed by Full season / First half / Second half. Explain qualification separately from overall record. | One level-wide ranking that implies the top teams all qualify. |
| MiLB's postseason page groups competitions by level, league and round, with series state and game links. | Small league-specific series cards; on phones use a vertical round order. | Copying the result-heavy home headlines or one enormous tournament tree. |
| Louisville's season review combines team trends, individual performances and paths to MLB. | One concise fact, its denominator, and a player/game destination. | A long recap requiring an editor to maintain every club. |
| Northwest Arkansas's review includes modest but distinctive achievements such as triples, walks and appearances. | Broaden discovery beyond the top prospects and home-run leaders. | Calling something a franchise record without a complete historical comparison. |
| Baseball Savant's replay archive organizes a specific event type by date, game and a link to evidence. | Give each report a defined question and a route back to the source game. | A generic feed of attractive but unexplained highlights. |

Sources: [MiLB standings](https://www.milb.com/standings/midwest-league),
[MiLB postseason presentation](https://www.milb.com/events/playoffs),
[Louisville season review](https://www.milb.com/news/2025-bats-season-in-review),
[Northwest Arkansas records review](https://www.milb.com/news/2025-in-review-history),
[Baseball Savant replay archive](https://baseballsavant.mlb.com/replay).
These are baseball publishers' own surfaces. The recommendations in the middle
column are design judgments, not evidence that a pattern increases retention.

### Supported leagues and season structure

The following league membership, planned game counts and regular-season end
dates were checked against the MLB Stats API on 14 September 2026. Counts are
scheduled lengths, not promises that every club played every game.

| Home level | Leagues (API ID; clubs) | Planned games per club | 2026 regular-season end |
| --- | --- | --- | --- |
| AAA | International (117; 20), Pacific Coast (112; 10) | 150 | September 20 |
| AA | Eastern (113; 12), Southern (111; 8), Texas (109; 10) | 138 | September 13 |
| A+ | Midwest (118; 12), South Atlantic (116; 12), Northwest (126; 6) | 132 | September 6 |
| A | California (110; 8), Carolina (122; 12), Florida State (123; 10) | 132 | September 6 |

Primary endpoint examples: [AAA leagues](https://statsapi.mlb.com/api/v1/leagues?sportId=11&season=2026),
[AA leagues](https://statsapi.mlb.com/api/v1/leagues?sportId=12&season=2026),
[High-A leagues](https://statsapi.mlb.com/api/v1/leagues?sportId=13&season=2026),
[Single-A leagues](https://statsapi.mlb.com/api/v1/leagues?sportId=14&season=2026),
[AAA season](https://statsapi.mlb.com/api/v1/seasons/2026?sportId=11),
[AA season](https://statsapi.mlb.com/api/v1/seasons/2026?sportId=12),
[High-A season](https://statsapi.mlb.com/api/v1/seasons/2026?sportId=13),
[Single-A season](https://statsapi.mlb.com/api/v1/seasons/2026?sportId=14).

For 2026, AAA has two halves. Each league's half winners meet in a best-of-three
league final; the first-half winner hosts. League champions meet in one national
championship game. AA and both A levels normally send each division's half
winners into best-of-three division series, then a best-of-three league final.
If a club wins both halves, the next-best second-half club qualifies. Northwest
is the exception: its six clubs produce two half qualifiers and one best-of-five
final. No cross-league national final is specified for AA or the A levels.
The published tiebreakers start with head-to-head play in the half, then the last
20 games, then progressively larger windows. Do not derive qualifiers by sorting
full-season wins. [Official 2026 procedures](https://www.milb.com/events/playoffs/procedures).

The procedures page does not explicitly settle AAA's repeated-half-winner
replacement in its AAA section. Before implementing automatic AAA qualification,
confirm that case from the league, or ingest the officially named participants.
Do not transfer an older year's replacement rule without checking it.

The API's AAA `postSeasonEndDate` is September 27; the official national final is
listed for September 26. The postseason page also contains a September 21 summary
beside September 22 series listings. These are concrete reasons to treat schedule
metadata as a planning aid, not as proof of completion. Ingest actual scheduled
games and final competition status; allow a small reviewed season configuration.

## 3. Three wireframe concepts

All six boards appear in `index.html`. Desktop boards use a 1200-pixel canvas;
mobile boards use 390 pixels. They use Tally's manila, navy, thin rules and card
language, with simplified type and club initials. Production should use the real
tokens and Barlow Condensed / Source Sans 3 / JetBrains Mono font roles. The
existing Game Log name remains unchanged; its content and stamp surfaces are
outside this proposal.

### A. One more game — recommended

**Hierarchy:** season state → one strong game action → player discovery → season
record link. Desktop puts player and record cards side by side beneath the game
invitation, with the existing wire at right. Mobile stacks the same order.

**Primary action:** “Open a random game.” It opens the selected game's first
lineup page. From there, the existing navigation leads to the first half and
Next at-bat. If progress exists, show “Resume game” rather than promise a fresh
sealed replay. Do not silently reset progress. A later direct “Start scoring”
shortcut can land at top 1 after lineups remain accessible.

**Player action:** an illustrative Andrew Fischer card says why he is in the
pool: played at this level in the selected season. “Open player” goes to Overview;
“Another player” replaces the choice only on request. It is exploration of a
person, not a promise of a prospect ranking or a particular great game.

**Repeat value:** enough eligible games for many scoring sessions; a second route
to players who are not household names. Low editorial burden. The weakness is
that a uniform random game can be ordinary. That is an acceptable first-version
tradeoff for an outcome-neutral scoring companion.

### B. Season record

**Hierarchy:** season state → league choice → season record → optional game
discovery. The home card opens the record page. The lower portion of each board
shows that destination, explicitly marked “after opening”; those result rows
are not present under the home invitation.

Desktop uses a compact standings table and connected round cards. Mobile uses
Club / W / L / PCT, then vertical series cards. A “View all clubs” link is required
where the wireframe shows an excerpt. A full table must not silently omit clubs.
Each division needs its own caption. Standings and series dates open team/game
destinations. Include season and data-through labels.

For AAA, show separate IL and PCL finals leading to one national game. For
Northwest, show one series. For the other leagues, show two division series
feeding one league final. Keep rounds and games separate: a series win count is
not a game's score. A completed record shows the named finalists and champion;
an active record uses “TBD” only for genuinely undecided slots. Illustrative
wireframe pairings are not real 2026 qualifiers.

**Repeat value:** strong during postseason, modest after results settle. More
useful as a permanent archive destination than as the main offseason invitation.
It costs more because competition structure and qualification need validation.

### C. Season notebook

**Hierarchy:** one report question → manual previous/next → player/game links →
season record. Desktop can pair the two discovery actions; mobile gives each a
full-width row. The lower sample panel sketches the report after opening it.

The sample “patient hitters” report gives a plain denominator: 72 walks in 400
plate appearances equals 18 walks per 100. It links to the player Stats tab.
Game-specific reports get neutral home invitations and explicit result-bearing
destinations. The report title must not expose a team's no-hitter or comeback
on a sealed daily slate.

**Repeat value:** strongest potential for a short daily visit. It also requires
the most selection logic and quality checks. A dozen weak rewordings of the
leaderboard will feel repetitive. Start with a few distinct, deterministic
questions; do not add generated prose just to fill a rotation.

### Comparison

| Criterion | A: One more game | B: Season record | C: Season notebook |
| --- | --- | --- | --- |
| Usefulness | Directly supports paper scoring | Explains the season and qualification | Finds unusual people and games |
| Repeat visits | Many distinct scoring sessions; user-driven | High while series run; then mostly reference | Fresh questions support short visits |
| Accessibility | Few actions; simple reading order | Needs table captions, visible round labels and mobile list order | Needs stable focus and plain definitions; no timed carousel |
| Spoilers | Neutral pool; existing game reveals apply | Result-bearing destination clearly labeled | Separate season aggregates from game-result reports |
| Existing data | Game feed and player stats exist; pools do not | Standings endpoints exist; current UI is MLB-specific | Some season facts exist; broad outlier coverage is not stored |
| Relative effort | Small to medium | Medium to large | Medium for 2 aggregate reports; large for event reports |
| Maintenance | Refresh and validate eligibility | Verify rules each season and resolve exceptions | Audit thresholds, coverage and prose |

Effort includes the common phase/season logic. It is a scope comparison, not a
time estimate. It excludes authentication, new video hosting and a new replay engine.

## 4. Transition and season rules

Use a state keyed by **season + league**, then summarize it for the selected
level. A finished club is not a finished league. A finished league is not always
a finished level. The transition is independent of MLB and other level tabs.

| State | Home behavior |
| --- | --- |
| Regular season, games scheduled | Existing daily slate first. |
| Regular season, no games today | Existing off-day message. Show next verified game; no offseason replacement. |
| Regular season over, postseason upcoming/active | Keep postseason game cards first. On idle days show the next scheduled date and a neutral postseason link. Put archive invitation below. |
| Some leagues at a level finished | Keep remaining live/scheduled games above archive cards. Label the finished league specifically. Do not mark the level complete. |
| Every competition finished | Replace today's empty games area with the selected offseason concept. AAA completion includes the national final. |
| Postponed, suspended, unresolved or missing data | Preserve schedule/status messaging. “Schedule unavailable” is not “Season complete.” Do not guess next season's opener. |
| Next season published but not started | Keep the completed-season archive prominent, plus a dated next-season schedule link. |
| Next season begins | Current daily games regain priority for that level. Keep the archive as a secondary link. |

Historical date navigation always shows that date's slate, including an honest
empty state. Do not replace a July off-day viewed in December with December's
offseason page. A small “Browse the 2026 season” link can remain available.

**Calendar rollover:** use “2026 season,” not an unqualified “previous season.”
Define the default archive as the latest **verified completed competition season**
for the chosen level. In October–December 2026 and January–March 2027 that can
remain 2026. It does not switch to an empty 2027 archive on January 1. When 2027
starts, 2026 remains the archive; while the 2027 postseason is active, label 2027
“postseason” rather than complete. An older year is an explicit selector choice.
If using “previous season” internally, this is its precise meaning. Do not use
`new Date().getFullYear() - 1` or infer a finished season from the absence of games.

For a small first version, a reviewed completion flag for each league/season is
reasonable. Validate it against schedules and official competition results.
Later automate it with fail-closed handling for stale or conflicting evidence.

## 5. Spoiler contract

The repository intentionally limits seals to scoring surfaces. Standalone team,
player, standings and historical postseason pages are open surfaces. Some current
standings code still has date-view behavior; do not remove its controls or assume
all comments reflect the latest ADR. A new minor-league archive needs an explicit
season, not an accidental live-current-year request.

Proposed home behavior respects that boundary:

1. Keep invitations neutral. Standings order, clinch badges, champion marks,
   advancing teams, scores, extra-inning counts, result thumbnails and outcome
   adjectives do not appear in an unsolicited archive invitation.
2. “Open season record — standings and postseason results” opens an ordinary,
   result-bearing record page. This does not mark every game or date revealed.
   A season-report link similarly states what will open. No new global preference
   or blanket season-consent bit is needed in version one.
3. If results are later embedded on the home slate, mount them only after a
   deliberate reveal. Do not render-and-blur. Protect accessible names, image
   alt text, metadata, tooltips and offscreen DOM too. An active day pass does
   not mean consent to display a whole season's results.
4. Archived scoring pages use the existing effective reveal logic: saved
   `revealedThrough`, the active Scores Unlocked override, consented dates,
   stamped games, and persisted box-score consent. A random selection does not
   overwrite or revoke any of these. Labels must not promise “spoiler-free” when
   one of these sources already opens that game's results.
5. Prefer an unstarted, unconsented game when local state can establish one.
   If none remain, offer a game with “Existing progress applies” and a separate
   resume path. Do not build a second resettable replay store in version one.
6. A report about a specific result changes expectations even if its game later
   opens sealed. Say “Open game — this report includes its result.” A neutral
   random-game pool must not be secretly ranked by drama, close scores or extras.

Standings can reveal outcomes by elimination; bracket participants can reveal
earlier-round winners. That is why all three concepts keep them behind a clearly
labeled destination instead of placing a champion banner above the game action.

## 6. Data support and gaps

| Feature | Existing support verified | New work required |
| --- | --- | --- |
| Phase detection | Schedule fetches; season endpoint supplies date bounds | Per-league competition state, freshness, exception handling and a completion manifest. The existing ten-day next-game search is insufficient. |
| Final standings | Stats API returned firstHalf, secondHalf and regularSeason rows for all 11 supported leagues for 2025 | Parameterize league/year, preserve historical team identity, final snapshots and half labels; reconcile qualifications. Current `fetchLeagueStandings` only requests 103/104 (MLB). |
| Postseason brackets | Existing MLB history/series components and finished-game data patterns | MiLB season-specific series map, participants, game IDs, format, series state and national final. Do not pass MiLB into the MLB bracket unchanged. |
| Random completed game | Date schedules and per-game feed; sampled High-A game 784185 returned 83 plays and both boxscore teams | Compact season/level game index; validate completed usable feeds, canonical dates/slugs/doubleheaders; local recent-pick history; failover for unavailable feeds. |
| Random player | `fetchLevelSeasonStats` is roster-independent and includes promoted/released players; player pages exist | Preserve unique season-level IDs, historical club context, adequate-page eligibility; deduplicate batting/pitching identities. A top-25 leaderboard is not a fair player pool. |
| Aggregate reports | Level season stats include PA, BB, SO, extra-base hits, SB and CS; pitching lines can support innings and strikeout rates | Freeze raw component summaries by season/league; thresholds and denominators; quality flags and deterministic report selection. |
| Event reports | Per-game play feeds support at-bats and outcomes for covered games | Season scan or post-game ingestion, feed-completeness audit and compact event index. Existing callout fuel is pruned, not a full-season archive. |

`standings-probe.json` records row-count checks for all 11 leagues. Each returned
the expected club count in all three periods. This verifies endpoint shape and
coverage for one year, not the correctness of every record or historical season.
[Example standings request](https://statsapi.mlb.com/api/v1/standings?leagueId=118&season=2025&standingsTypes=firstHalf,secondHalf,regularSeason).
The sampled [High-A feed](https://statsapi.mlb.com/api/v1.1/game/784185/feed/live)
does not establish complete MiLB pitch coverage. Missing feeds must be skipped or
reported, never described as ready to score.

For game eligibility, start with final regular-season games with chronological
completed at-bats, resolvable teams/date and enough lineup/boxscore data for the
existing flow. Validate completeness against official final outs and game status;
do not assume nine innings or reject legitimate seven-inning games. Do not
require a bottom ninth or pitch-location tracking. Suspended games qualify only
after final resolution; deduplicate by gamePk. Keep a small checked pool at first
rather than promise every game in a season. Postseason can be an explicit later pool.

For player eligibility, propose at least **50 PA or 10 IP at the selected level**.
This is a discovery threshold, not statistical qualification. Sample unique IDs
uniformly; do not choose current rosters, which omit people who moved. Explain
“Played at High-A in 2026” rather than imply the player still belongs to that club.
Open Overview with clear current-context wording. A later season-specific Stats
link must retain the selected year through the existing supported route/query
contract; do not invent a query parameter and assume the page supports it.

Keep indices small and season-addressed. Reuse the repository's static-data
reader and generator conventions. Extend existing callout machinery when the
same family already exists; do not create a parallel rule set. New cross-file
joins should follow ADR-0021's SQLite/text-dump pattern where needed. Store
facts, sources and selection versions; use fixed templates for readable notes.
Freeze completed-season outputs rather than let a January generator overwrite
them with empty current-year data. Recheck corrections periodically, not on
every home-page load. No new Vercel function is necessary for basic discovery.

## 7. Concrete report proposals

The following thresholds are proposed editorial rules, not official qualifiers.
Use regular-season data only, compare within one league and year, include tied
values, and identify the coverage date. For percentile claims require at least
20 eligible players; otherwise show raw counts without a league percentile.
Never average rates across clubs: combine numerators and denominators first.

| Report | Selection and sample rule | Why it belongs / limitation |
| --- | --- | --- |
| The patient hitters | BB / PA >= 15%, at least 250 PA in that league. Sort by rate, then PA; display BB and PA. | Easy-to-understand season profile. Includes intentional walks unless explicitly excluded. Not a talent forecast. |
| Fewer strikeouts | SO / PA in the lowest 10% of hitters with at least 250 PA; show the actual rate and comparison pool. | Finds contact-oriented players beyond slugging leaders. No “best contact” claim without batted-ball evidence. |
| Picking their spots | At least 25 steal attempts and success >= 85%; attempts = SB + CS. | Combines volume and efficiency. This is a chosen reporting floor, not proof of stable future skill. |
| Strikeouts without many walks | At least 60 IP and 250 batters faced; K% minus BB% >= 20 percentage points. Show both rates and BF. | A pitching profile without unstable tiny ERA samples. Convert IP to outs; never treat 60.2 as decimal innings. |
| A busy scorebook | Completed player-games with >= 4 hits and >= 4 PA. Rank by hits, then total bases. One event qualifies; no season-rate inference. | A direct reason to revisit a game. Requires complete boxscores and an outcome-bearing report destination. |
| Working through an at-bat | A completed PA with >= 12 recorded pitches; require complete pitch-event coverage for that PA. | Closely tied to scorekeeping. Call it “12-pitch at-bats in covered games,” not “the season's longest” without a full audit. |

Do not rank raw OPS or ERA across the IL and PCL as though their environments
were identical. Do not call a within-season outlier a historical record. Exclude
missing denominators instead of filling them with zero. Display “No qualifying
performances in the available data” rather than lower thresholds silently.

**Rotation:** A's random actions change on request. Preserve the visible choice
on Back and ordinary re-renders; avoid a recent repeat until the pool is exhausted.
C may suggest a new note on the next calendar day's visit, keyed by level,
season and local date. Never replace a card while the user reads. Supply Previous,
Next and “Browse all notes”; daily scheduling is an aid to discovery, not a lock.
Do not rotate per visit: it makes returning to a note unpredictable. No autoplay,
scroll animation or timer is needed. A tiny report pool should use manual browsing
until it has enough distinct notes to support meaningful daily rotation.

## 8. Focused first version and decisions

Ship A for the current-day slate of a completed minor-league level. Include a
clear season label, one random-game action over a modest verified pool, one
player action, and clearly labeled links to official season records where the
app has no MiLB record page yet. External links must say they open MiLB results.
Keep historical daily slates, the club strip, search and roster wire intact.
Use a reviewed per-league completion manifest. Archive the season pool before
calendar rollover. No video requirement, automated recap writing, new account
setting or replay-reset system.

Then add final standings inside Tally if use justifies it. Add correct league
series cards next, including Northwest and the AAA national final. Add two season
aggregate reports after the data can be frozen and checked. Add game-event
reports only after feed coverage can be stated honestly.

Accessibility acceptance criteria for implementation: native buttons and links,
44-pixel action targets, visible focus, no color-only status, table headers and
captions, full club names available, DOM reading order matching mobile order,
200% zoom and 320-pixel checks, and a polite announcement when a requested pick
changes. Keep focus on the requesting control. Wire-dock padding must leave the
last action reachable. Empty/loading/error states need explicit text and retry.

Validate the eventual implementation with phase fixtures for a normal off-day,
mixed leagues, postponed final, stale data, December 31/January 1, and next-season
opening. Add spoiler DOM checks for sealed home invitations, reports, archived
games with existing progress, and each consent override. Test canonical links,
doubleheaders, missing feeds and player moves. Run relevant unit, lint and E2E
checks when production code is written; these wireframes do not change that code.

Decisions before implementation:

1. Choose A as the home default, or make B/C the primary purpose.
2. Accept neutral home invitations with clearly labeled result-bearing destinations,
   rather than adding a new season-wide spoiler preference.
3. Start with regular-season games and one completed season per level; confirm
   whether a small verified pool is sufficient for launch.
4. Accept a reviewed completion manifest and external MiLB record links for version
   one, or fund internal standings/series pages immediately.
5. Choose manual-only notes initially, or add daily suggestions after enough
   distinct reports exist. My recommendation is manual-only until then.
