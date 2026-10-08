# src/components — buckets, and why SealBox sits alone

This directory reached **126 files** before anyone noticed, against a root
`CLAUDE.md` rule that says to subdivide at roughly ten. It is now fully bucketed
by feature/domain (not by UI type); `check-dir-size.mjs` (ADR-0038) enforces that
no bucket grows past 12 files, except the two budgeted ones: `player/` (17) and
`charts/` (13).

## `SealBox.jsx` stays at the top level, on purpose

It is the core spoiler invariant (ADR-0002), cited by literal path from the root
`CLAUDE.md`, `src/CLAUDE.md`, and the ADR itself. Leaving it where it is costs no
edit to the line-capped root file — and once every other component sits
in a bucket, being **the one unbucketed file** is the loudest available signal
about what it is. Do not tidy it into a folder.

## The buckets

"Holds" names a few anchors, not every file: `ls src/components/<bucket>/` is the list.
A bucket with a `CLAUDE.md` of its own has rules there. Per-bucket detail: `docs/components.md`.

| Bucket | Holds | The test for "does it belong here?" |
| --- | --- | --- |
| `ui/` | `Loader`, `SectionMasthead`, `ModalPortal`, and the `control/`, `frame/`, `table/`, `state/`, `layout/`, `dock/` primitives (`ui/CLAUDE.md`) | **No baseball knowledge.** No `api/` import, no feed access, no team or game concept. Safe to reach for from anywhere |
| `account/` | `AccountButton`, `AccountPitch`, `FavoriteTeamModal`, `LogbookAccountGate`, `ClubPicker` | Clerk sign-in/account-menu surfaces and the signed-out Game Log pitch. **`ClubPicker.jsx` is the one club strip.** It takes `teams` as a prop and fetches nothing; `/profile` and the first-visit intro both render it, from different sources on purpose. Do not grow a second one |
| `admin/` | `AwardOrderEditor`, `contracts/` | Editors only an admin sees |
| `allstar/` | `AllStarGameResult`, `DerbyCard` | All-Star Game / Derby result cards (ADR-0019's plain-score exception) |
| `around-the-game/` | `BroadcastBar`, `BroadcastMasthead`, `StatSlab`, `RunValueParts` | The parts the Around the game report pages share. Draw-only; the data is spoiler-free (`src/api/around-the-game/CLAUDE.md`) |
| `badges/` | `ProspectPill`, `RookiePill`, `InjuredMark`, `TierPill`, `UmpireTierGlyph` | An inline mark that adorns a name in a dense row, and **renders nothing when inactive** — so a caller can splice it in unconditionally |
| `ballpark/` | `BallparkDiagram`, `BallparkModal` | Park diagram + its modal |
| `boxlines/` | `BoxLinesDoor`, `BoxLinesSheet`, `BoxLineRow`, `BoxLinesList` | The reusable drilldown behind a summary stat line (ADR-0069). **"Box Lines" is internal and never renders.** Rules: `boxlines/CLAUDE.md` |
| `bracket/` | `PostseasonBracket`, `FullBracket`, `BracketRail`, `BracketDock`, `BracketNow`, `SurvivorsBoard` | October's bracket on the home slate. Nothing here fetches a score outside `src/api/postseason/bracket.js`'s cutoff-gated reads (ADR-0087) |
| `charts/` | `WinProbChart`, `PitchMix`, `HitChart`, `BallFlight`, `SprayMap` | Draws a quantity. Every value arrives **already reveal-gated by its caller** — nothing here decides what may be shown |
| `chrome/` | `SiteHeader`, `SiteFooter`, `SiteMenu`, `SiteSearch`, `BackBtn` | Global site frame — header/footer/menu/search, not any one screen. Rules: `chrome/CLAUDE.md` |
| `game/` | `GameCard`, `GameFinder`, `PastGameFlipCard`, `ContinueScoring`, `BoxScoreSkeleton` | The slate/game-selection layer — a game before you're inside its innings |
| `gamehud/` | `RollingLine`, `Scorebug`, `ConsoleBand`, `HalfTally`, `BetweenInnings` | Persistent live-game heads-up widgets shown while scoring |
| `history/` | `BornNearPark`, `PeopleList` | History about people (ADR-0100): the preview's "Born near the park" line. Open surface, no SealBox |
| `highlights/` | `HighlightClipCard` | Purely presentational video-clip cards — no fetching, no game-shape knowledge; the caller precomputes the caption and owns the `HighlightSheet` it opens |
| `inning/` | `HalfInning`, `PitchersSection`, `RosterPanel`, `MarginNotes`, and `focus/` | The innings-viewer shell around the at-bat feed — one layout for every half (ADR-0043's unify amendment), built by `focus/` |
| `logbook/` | `GameStamp`, `StampGameButton`, `StampInButton`, `StampSheet` | The Logbook stamp (ADR-0035) and its shelves. `check-stamp-surfaces.mjs` names these by path. Rules: `logbook/CLAUDE.md` |
| `logo/` | `TeamLogo`, `LogoModal`, `TeamTreatmentMark`, `JerseyCombos` | Club-mark rendering and its sketch/print modal |
| `offseason/` | `LevelOffseason`, `SeasonRecord`, `MovedUp`, `WinterRail` | The empty-slate page state (ADR-0074, ADR-0079, ADR-0080, ADR-0081). Rules: `offseason/CLAUDE.md` |
| `player/` | `Headshot`, `PlayerLink`, `PlayerHoverCard`, `Ledger`, `CareerTimeline` | Player-identity primitives and career-level cards |
| `playerstats/` | `RecentFormCard`, `SplitsVsTeam`, `GameLinesCard`, `SprayMapSection` | Player statistical cards (as distinct from `charts/`'s plotted quantities). `SprayMapSection` is the odd one: a self-fetching MOUNT for a `charts/` card, so the player page carries one line and the whole block — title, fetch and every reason to render nothing — moves together. **`GameLinesCard` is a REGISTRY, not a card to copy.** Rules: `src/api/boxlines/CLAUDE.md` |
| `playbyplay/` | `PlayByPlay`, `BatterNotice`, `PitcherNotice`, `FielderNotice`, `pitcherCard/` | The at-bat feed's notification-card family (ADR-0017). `PitchScene` never uses React state per frame. Rules: `playbyplay/CLAUDE.md` |
| `postseason/` | `SeriesParts`, `SeriesMark`, `SeriesFlow`, `SeriesTotals`, `SeriesLeadersLedger` | The parts both series pages draw the same way: the finished page and the live page. Draw-only; each page keeps its own spoiler footing (ADR-0087's 2026-10-01 addendum) |
| `preview/` | `SavePosterButton` | Saves the finished poster out of the canvas (`docs/preview-poster.md`) |
| `profile/` | `ClubSeal`, `ProfileAccount`, `SyncReceipt`, `MergeReceipt`, `EraseDataDialog` | My Tally's parts. They render no game data (`src/screens/profile/CLAUDE.md`) |
| `salaries/` | `SalaryBoard`, `ClubPayrolls`, `ContractGrid`, `Money` | The money pages (ADR-0052): open surfaces, no seal |
| `scoring/` | `AtBatBox`, `ScorecardSheet`, `PlayDiamond`, `DefenseDiamond`, `StrikeZone`, `StruckLine`, `lens/` | The scorebook-diamond drawing family. `StruckLine` is the one strike wrapper. `StrikeZone` is drawn from the camera behind the pitcher (ADR-0077) |
| `scout/` | `Matchup`, `ScoutMap`, `Choice` | The Matchup Scout's parts (`docs/scout-design.md`) |
| `season/` | `SeasonPicker`, `SeasonStack` | The season views' shared parts (ADR-0086, #1202). **`SeasonPicker` is the one season picker**; a page that takes a season renders it, never a second one |
| `seal/` | `ConsentModal`, `AsOfBanner` | Spoiler-consent surfaces that aren't `SealBox` itself |
| `situational/` | `SituationalBoard`, `SituationalIndex`, `TeamRecordsList` | The situational team-record boards: every club ranked on one split |
| `sync/` | `RevealCloudSync`, `StampsCloudSync`, `SyncStatusProvider`, `OwnerGuards` | Headless multi-device cloud-sync components (ADR-0022/0026/0035/0036/0041/0049). `OwnerGuards` is app-wide on purpose |
| `team/` | `TeamLink`, `TeamSearchBox`, `TeamFilterStrip`, `LevelNav`, `OffDaySection` | Team-identity/navigation primitives |
| `teamstats/` | `TeamLeaders`, `TeamLeadersLedger`, `TeamScoreCard`, `BullpenBoard` | Team-level statistical cards |
| `transactions/` | `TeamTransactionsCard`, `TxStory`, `MoveRow`, `WireRail`, `WireDock` | Roster-move surfaces. Rules: `transactions/CLAUDE.md` |
| `umpire/` | `UmpireAccuracyModal`, `UmpireLink`, `UmpireTendencies`, `UmpiresCard` | Umpire-specific surfaces |
| `winter/` | `LeaguePicker` | The WINTER tab's league picker: four leagues share one rail tab (ADR-0078) |
| `workload/` | `DayStrip`, `ThresholdBullets`, `PenDots`, `StaffGrid`, `ProjectedStarters` | The four marks that draw `api/workload.js` without a sentence. Their ink is global (`styles/76-workload-marks.css`), not component-imported |

Three untouched subdirectories predate this bucketing and follow their own
internal convention rather than the domain-bucket one above: `page-turn/` (the
forward inning-transition animation), `passport/` (the Logbook's passport-book
UI, ADR-0036/0041), `playercard/` (the player page's similar-players cards).

## Two constraints that outrank tidiness

**The Clerk-gated components must stay dynamically imported.** `AccountButton`,
`AccountPitch`, `LogbookAccountGate`, `ContinueScoring`, and every `*CloudSync` component are
reached through `import()` so `@clerk/clerk-react` (~110 KB gz) stays out of the
entry chunk. Moving them is fine; converting one of those specifiers to a static
import is not, and it would still build cleanly — so check the built output, not
just that the build passed.

**Some components are named by literal path in a guard.** `check-stamp-surfaces.mjs`
holds an allowlist keyed on `components/logbook/GameStamp.jsx` /
`components/logbook/StampGameButton.jsx`, plus eight `FORBIDDEN_SURFACES` by
full path and `FORBIDDEN_ART_DIRS` (`screens/profile`, `components/profile`,
`components/account`), and `check-report-pages.mjs` names `components/chrome/SiteMenu.jsx`,
`SiteFooter.jsx`, `ReportFooter.jsx`. Moving any of those means editing the guard
**in the same commit**. They fail loudly rather than silently if you forget,
which is the point — read ADR-0035 before touching the stamp list.

## No barrel files

No `index.js` re-exporting a bucket. A barrel makes every consumer import the
whole bucket's module graph, which is how a lazily-loaded chunk quietly becomes
an eager one. Import the component's own path.
