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
| `ui/` | `Loader`, `SectionMasthead`, `SectionTitle`, `ChevronLink`, `CopyBox`, `ModalPortal`, `InfoPopover`, `MasonryColumns`, `FlipCard`, `BreakableLocation`, `AsyncGate`, `BuildStamp` | **No baseball knowledge.** No `api/` import, no feed access, no team or game concept. Safe to reach for from anywhere |
| `badges/` | `ProspectPill`, `RookiePill`, `DebutPill`, `MilestonePill`, `InjuredMark`, `RadarPill`, `TierPill`, `UmpireTierPill`, `UmpireTierGlyph` | An inline mark that adorns a name in a dense row, and **renders nothing when inactive** — so a caller can splice it in unconditionally |
| `charts/` | `WinProbChart`, `UsagePips`, `PitchMix`, `BattedBallMix`, `PitchArsenalMix`, `StatcastPercentiles`, `PercentileStrip`, `HitChart` | Draws a quantity. Every value arrives **already reveal-gated by its caller** — nothing here decides what may be shown |
| `account/` | `AccountButton`, `AccountPitch`, `FavoriteTeamModal`, `LogbookAccountGate`, `LogbookLanding` | Clerk sign-in/account-menu surfaces and the signed-out Game Log pitch |
| `allstar/` | `AllStarGameResult`, `DerbyCard` | All-Star Game / Derby result cards (ADR-0019's plain-score exception) |
| `ballpark/` | `BallparkDiagram`, `BallparkModal` | Park diagram + its modal |
| `chrome/` | `SiteHeader`, `SiteFooter`, `SiteMenu`, `SiteSearch`, `ReportFooter`, `FooterParts`, `GuideLink`, `LogbookButton`, `TallyBrand`, `BackBtn` | Global site frame — header/footer/menu/search, not any one screen. `BackBtn` sits here rather than in `ui/` because it's page furniture that knows about route history, not a context-free primitive. `FooterParts` holds the two blocks both footers end with (the grouped directory, the legal blurb) — the page LIST is passed in as a prop, so each footer keeps its own `lib/reportPages.js` import and `check-report-pages.mjs` keeps guarding both |
| `game/` | `GameCard` (+ `GameCardParts`, split out to stay under the file-size cap), `GameFinder`, `GameFinderModal`, `GameStoryCard`, `GameResultFace`, `GamePhotosStrip`, `PastGameFlipCard`, `ContinueScoring`, `BoxScoreSkeleton`, `WhatsBrewingModal` | The slate/game-selection layer — a game before you're inside its innings |
| `gamehud/` | `RollingLine`, `Scorebug`, `ScorebugMount`, `ConsoleBand`, `DueUpConsole`, `HalfTally`, `BetweenInnings`, `StatBox` | Persistent live-game heads-up widgets shown while scoring. `ConsoleBand` is focus mode's whole top row (ADR-0043) — the placed scorebug plus exactly one companion: `DueUpConsole` while the half is being scored, or once it is over, `BetweenInnings` — one card that opens on `HalfTally`'s grid and cycles on tap through up to 5 score-free facts (`api/between-innings.js`) before returning to the grid |
| `highlights/` | `HighlightClipCard` | Purely presentational video-clip cards — no fetching, no game-shape knowledge; the caller precomputes the caption and owns the `HighlightSheet` it opens |
| `inning/` | `HalfInning`, `PitchersSection`, `RosterPanel`, `EnteringReference`, `ExtrasBanner`, `DelayCard`, `MarginNotes`, plus `focus/` (`ReferencePanel`, `AtBatTrail`, `FocusControls`, `ExtrasFacts`) | The innings-viewer shell around the at-bat feed — one layout for every half now (ADR-0043's unify amendment), built by `focus/`. `ReferencePanel` is the tabbed shelf (LINEUPS / FIELD / ARMS — which also holds the stat-line row — / EXTRAS, which carries the WPA chart above the umpire Tendencies drawer); `ExtrasFacts` is the card-header block at the foot of EXTRAS |
| `logbook/` | `GameStamp`, `StampGameButton`, `StampInButton` | The Logbook stamp (ADR-0035) — `check-stamp-surfaces.mjs` allowlists the first two by path. `StampInButton` is the Stamp In page's plain mint control (ADR-0042): it may mint, never draw, so it sits on that guard's `FORBIDDEN_ART_FILES` instead |
| `logo/` | `TeamLogo`, `LogoModal`, `TeamTreatmentMark`, `JerseyCombos` | Club-mark rendering and its sketch/print modal |
| `player/` | `Headshot`, `PlayerLink`, `Ledger`, `CareerRegister`, `PerformerCard`, `CareerTimeline`, `TrophyCase`, `AdvancedStatsCard`, `LevelProgressionCard`, `PositionInnings`, `PlayerPhotosRail`, `PlayerHighlightsRail` | Player-identity primitives and career-level cards |
| `playerstats/` | `RecentFormCard`, `SplitsVsTeam`, `FoulCard`, `MilestoneWatchCard`, `PitcherWorkloadCard` | Player statistical cards (as distinct from `charts/`'s plotted quantities) |
| `playbyplay/` | `PlayByPlay`, `BatterNotice`, `PitcherNotice`, `FielderNotice`, `PinchRunNotice`, `CalloutNote`, `DueUpNextCard`, `UpNextBatters`, `HighlightSheet` | The at-bat feed's notification-card family (ADR-0017) |
| `scoring/` | `AtBatBox`, `ScorecardSheet`, `ScorecardCellEditor`, `PlayDiamond`, `BaseoutDiamond`, `BaseState`, `DefenseDiamond`, `PlacedRunnerCard`, `StrikeZone`, `PitchLadder`, `playDiamondGeometry.js` | The scorebook-diamond drawing family |
| `seal/` | `ConsentModal`, `AsOfBanner` | Spoiler-consent surfaces that aren't `SealBox` itself |
| `sync/` | `RevealCloudSync`, `BoxRevealCloudSync` (+ `BoxRevealSyncMount`, its Clerk boundary), `SpoiledDaysCloudSync`, `StampsCloudSync`, `BooksCloudSync`, `PreferencesCloudSync`, `SyncStatusProvider`, `BoxRevealOwnerGuard` | Headless multi-device cloud-sync components (ADR-0022/0026/0035/0036/0041/0049). `BoxRevealOwnerGuard` is the odd one: it makes no request at all — it acts on the sign-in transition to decide whether this device's `bbsbh:boxreveal:*` bits belong to the account now signing in, and clears them if not (ADR-0049's amendment). App-wide on purpose; its header says why a per-screen guard would decide too late |
| `team/` | `TeamLink`, `TeamSearchBox`, `TeamFilterStrip`, `LevelNav`, `ManagerLink`, `OffDaySection` | Team-identity/navigation primitives |
| `teamstats/` | `TeamLeaders`, `TeamLeadersLedger`, `TeamScoreCard`, `SeasonSeriesStrip`, `BullpenBoard`, `DeckNudge`, `PostseasonOddsModal`, `StarterMatchups` | Team-level statistical cards. The two leader renderings share `computeLeaders` and the descriptors, not a box model: `TeamLeaders` is the headshot-card board the dedicated leader pages render, `TeamLeadersLedger` the two-block ruled ledger the team hub renders |
| `transactions/` | `TeamTransactionsCard`, `TradeCard`, `TransactionTimeline` | Roster-move surfaces |
| `umpire/` | `UmpireAccuracyModal`, `UmpireLink`, `UmpireTendencies`, `UmpireZoneMap`, `UmpiresCard`, `UmpireTendenciesFold` | Umpire-specific surfaces: the Tendencies card and its hosts — the modal, the lineup page's top zone (TeamInfo renders it beside the factgrid + crew section `UmpiresCard`), and focus mode's EXTRAS-tab drawer (`UmpireTendenciesFold`). The tier pill/glyph live in `badges/` — shared with Game Score rankings |

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
