# src/components — buckets, and why SealBox sits alone

This directory reached **126 files** before anyone noticed, against a root
`CLAUDE.md` rule that says to subdivide at roughly ten. It is now fully bucketed
by feature/domain (not by UI type); `check-dir-size.mjs` (ADR-0038) enforces that
no bucket grows past 12 files.

## `SealBox.jsx` stays at the top level, on purpose

It is the core spoiler invariant (ADR-0002), cited by literal path from the root
`CLAUDE.md`, `src/CLAUDE.md`, and the ADR itself. Leaving it where it is costs no
edit to the 199/200-line-capped root file — and once every other component sits
in a bucket, being **the one unbucketed file** is the loudest available signal
about what it is. Do not tidy it into a folder.

## The buckets

| Bucket | Holds | The test for "does it belong here?" |
| --- | --- | --- |
| `ui/` | see `ui/CLAUDE.md` | **No baseball knowledge.** No `api/` import, no feed access, no team or game concept. Safe to reach for from anywhere |
| `badges/` | `ProspectPill`, `RookiePill`, `DebutPill`, `MilestonePill`, `InjuredMark`, `RadarPill`, `TierPill`, `UmpireTierGlyph` | An inline mark that adorns a name in a dense row, and **renders nothing when inactive** — so a caller can splice it in unconditionally |
| `charts/` | `WinProbChart`, `UsagePips`, `PitchMix`, `BattedBallMix`, `PitchArsenalMix`, `StatcastPercentiles`, `PercentileStrip`, `HitChart`, `BallFlight`, `SprayMap` | Draws a quantity. Every value arrives **already reveal-gated by its caller** — nothing here decides what may be shown.  |
| `account/` | `AccountButton`, `AccountPitch`, `FavoriteTeamModal`, `LogbookAccountGate`, `LogbookLanding` | Clerk sign-in/account-menu surfaces and the signed-out Game Log pitch. **`ClubPicker.jsx` (`components/account/`) is the one club strip.** It takes `teams` as a prop and fetches nothing; `/profile` and the first-visit intro both render it, from different sources on purpose. Do not grow a second one. |
| `allstar/` | `AllStarGameResult`, `DerbyCard` | All-Star Game / Derby result cards (ADR-0019's plain-score exception) |
| `ballpark/` | `BallparkDiagram`, `BallparkModal` | Park diagram + its modal |
| `boxlines/` | `BoxLinesDoor`, `BoxLinesSheet`, `BoxLineRow`, `BoxLinesList` | see `boxlines/CLAUDE.md` |
| `bracket/` | `PostseasonBracket`, `BracketFold`, `FullBracket`, `BracketRail`, `BracketDock`, `SurvivorsBoard`, `bracketParts.jsx` (`Pips`, `ClubMark`, `BlankSlot`, `Trophy`) |  |
| `postseason/` | `SeriesParts.jsx` (`SeriesPlayOfTheGame`, `SeriesLeaderBoard` and its leader-figure door, `RosterCard`), `SeriesMark.jsx`, `SeriesFlow.jsx`, `SeriesTotals.jsx`, `SeriesNineKeys.jsx`; live page only: `StillToPlay.jsx`, `SeriesStarters.jsx` (7 of 12 files) | The parts both series pages draw the same way: the finished page (`PostseasonSeriesPage.jsx`) and the live page (`postseason-live/LiveSeriesPage.jsx`, #1224). Draw-only; each page keeps its own spoiler footing (ADR-0087's 2026-10-01 addendum).  |
| `chrome/` | `SiteHeader`, `SiteFooter`, `SiteMenu`, `SiteSearch`, `ReportFooter`, `FooterParts`, `GuideLink`, `LogbookButton`, `TallyBrand`, `BackBtn` | Global site frame — header/footer/menu/search, not any one screen. see `chrome/CLAUDE.md` |
| `game/` | `GameCard` (+ `GameCardParts`, split out to stay under the file-size cap), `GameFinder`, `GameFinderModal`, `GameStoryCard`, `GameResultFace`, `GamePhotosStrip`, `PastGameFlipCard`, `ContinueScoring`, `BoxScoreSkeleton`, `WhatsBrewingModal` | The slate/game-selection layer — a game before you're inside its innings |
| `gamehud/` | `RollingLine`, `Scorebug`, `ScorebugMount`, `ConsoleBand`, `DueUpConsole`, `HalfTally`, `BetweenInnings`, `StatBox` | Persistent live-game heads-up widgets shown while scoring.  |
| `highlights/` | `HighlightClipCard` | Purely presentational video-clip cards — no fetching, no game-shape knowledge; the caller precomputes the caption and owns the `HighlightSheet` it opens |
| `inning/` | `HalfInning`, `PitchersSection`, `RosterPanel`, `EnteringReference`, `ExtrasBanner`, `DelayCard`, `MarginNotes`, plus `focus/` (`ReferencePanel`, `AtBatTrail`, `FocusControls`, `ExtrasFacts`) | The innings-viewer shell around the at-bat feed — one layout for every half now (ADR-0043's unify amendment), built by `focus/`.  |
| `logbook/` | `GameStamp`, `StampGameButton`, `StampInButton`, `StampSheet`, `ClubsSeen`, `StampDetailModal` | The Logbook stamp (ADR-0035) and its shelves; rules: `logbook/CLAUDE.md` |
| `logo/` | `TeamLogo`, `LogoModal`, `TeamTreatmentMark`, `JerseyCombos` | Club-mark rendering and its sketch/print modal |
| `player/` | `Headshot`, `PlayerLink`, `PlayerHoverCard`, `Ledger`, `CareerRegister`, `PerformerCard`, `CareerTimeline`, `TrophyCase`, `AdvancedStatsCard`, `LevelProgressionCard`, `PositionInnings`, `PlayerPhotosRail`, `PlayerHighlightsRail` | Player-identity primitives and career-level cards.  |
| `playerstats/` | `RecentFormCard`, `SplitsVsTeam`, `GameLinesCard`, `FoulCard`, `MilestoneWatchCard`, `PitcherWorkloadCard`, `SprayMapSection` | Player statistical cards (as distinct from `charts/`'s plotted quantities). `SprayMapSection` is the odd one: a self-fetching MOUNT for a `charts/` card, so the player page carries one line and the whole block — title, fetch and every reason to render nothing — moves together. **`GameLinesCard` is a REGISTRY, not a card to copy** — rules: `src/api/boxlines/CLAUDE.md` |
| `playbyplay/` | `PlayByPlay`, `BatterNotice`, `PitcherNotice`, `FielderNotice`, `PinchRunNotice`, `CalloutNote`, `DelayNotice`, `DueUpNextCard`, `UpNextBatters`, `HighlightSheet` | The at-bat feed's notification-card family (ADR-0017). rules: `playbyplay/CLAUDE.md` |
| `scoring/` | `AtBatBox`, `ScorecardSheet`, `ScorecardCellEditor`, `PlayDiamond`, `BaseoutDiamond`, `BaseState`, `DefenseDiamond`, `PlacedRunnerCard`, `StrikeZone`, `PitchLadder`, `StruckLine`, `playDiamondGeometry.js`, plus `lens/` — the scorecard's phone lens (`useLens`, `LensFrame`, `LensBar`, `LensCards`, `PitcherSheet`, `CarryStrip`, `useCarry`, and `motion/` — `LensTear`, `useLensMotion`, the tap-gated motion; ADR-0092) | The scorebook-diamond drawing family.  |
| `seal/` | `ConsentModal`, `AsOfBanner` | Spoiler-consent surfaces that aren't `SealBox` itself |
| `sync/` | `RevealCloudSync`, `BoxRevealCloudSync` (+ `BoxRevealSyncMount`, its Clerk boundary), `SpoiledDaysCloudSync`, `StampsCloudSync`, `BooksCloudSync`, `PreferencesCloudSync`, `SyncStatusProvider`, `OwnerGuards` | Headless multi-device cloud-sync components (ADR-0022/0026/0035/0036/0041/0049).  |
| `team/` | `TeamLink`, `TeamSearchBox`, `TeamFilterStrip`, `LevelNav`, `ManagerLink`, `OffDaySection` | Team-identity/navigation primitives |
| `teamstats/` | `TeamLeaders`, `TeamLeadersLedger`, `TeamScoreCard`, `SeasonSeriesStrip`, `BullpenBoard`, `DeckNudge`, `PostseasonOddsModal`, `StarterMatchups` | Team-level statistical cards.  |
| `transactions/` | `TeamTransactionsCard`, `TxStory`, `TradeCard`, `TransactionTimeline`, `MoveRow`, `WireRail`, `WireDock` | Roster-move surfaces. rules: `transactions/CLAUDE.md` |
| `umpire/` | `UmpireAccuracyModal`, `UmpireLink`, `UmpireTendencies`, `UmpireZoneMap`, `UmpiresCard`, `UmpireTendenciesFold` | Umpire-specific surfaces |
| `workload/` | `DayStrip`, `ThresholdBullets`, `PenDots`, `StaffGrid`, plus `ProjectedStarters` (the Starting pitcher card's "Likely starters" guess when no probable is announced, ADR-0089: a labeled list, never an announced-looking card) | The four marks that draw `api/workload.js` without a sentence |

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
full path, and `check-report-pages.mjs` names `components/chrome/SiteMenu.jsx`,
`SiteFooter.jsx`, `ReportFooter.jsx`. Moving any of those means editing the guard
**in the same commit**. They fail loudly rather than silently if you forget,
which is the point — read ADR-0035 before touching the stamp list.

## No barrel files

No `index.js` re-exporting a bucket. A barrel makes every consumer import the
whole bucket's module graph, which is how a lazily-loaded chunk quietly becomes
an eager one. Import the component's own path.
