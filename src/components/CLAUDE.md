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
| `charts/` | `WinProbChart`, `UsagePips`, `PitchMix`, `BattedBallMix`, `PitchArsenalMix`, `StatcastPercentiles`, `PercentileStrip`, `HitChart`, `BallFlight` | Draws a quantity. Every value arrives **already reveal-gated by its caller** — nothing here decides what may be shown. `BallFlight` is `HitChart`'s per-play sibling: the base diamond in the at-bat feed is its handle (hover on a pointer, tap on a phone), and it adds the PATH from the plate that a chart of thirty dots cannot draw. Same marks, same 95-mph ring, one stylesheet (`69-hit-chart.css`) |
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
| `player/` | `Headshot`, `PlayerLink`, `PlayerHoverCard`, `Ledger`, `CareerRegister`, `PerformerCard`, `CareerTimeline`, `TrophyCase`, `AdvancedStatsCard`, `LevelProgressionCard`, `PositionInnings`, `PlayerPhotosRail`, `PlayerHighlightsRail` | Player-identity primitives and career-level cards. `PlayerHoverCard` is the one PlayerLink triggers (desktop only, `lib/playerHoverStore.js`), mounted once in `App.jsx` and portalled to `<body>` |
| `playerstats/` | `RecentFormCard`, `SplitsVsTeam`, `FoulCard`, `MilestoneWatchCard`, `PitcherWorkloadCard` | Player statistical cards (as distinct from `charts/`'s plotted quantities) |
| `playbyplay/` | `PlayByPlay`, `BatterNotice`, `PitcherNotice`, `FielderNotice`, `PinchRunNotice`, `CalloutNote`, `DelayNotice`, `DueUpNextCard`, `UpNextBatters`, `HighlightSheet` | The at-bat feed's notification-card family (ADR-0017). `DelayNotice` cards a stoppage only when it came to something, and names the man who left rather than the batter the feed names (ADR-0060) |
| `scoring/` | `AtBatBox`, `ScorecardSheet`, `ScorecardCellEditor`, `PlayDiamond`, `BaseoutDiamond`, `BaseState`, `DefenseDiamond`, `PlacedRunnerCard`, `StrikeZone`, `PitchLadder`, `playDiamondGeometry.js` | The scorebook-diamond drawing family |
| `seal/` | `ConsentModal`, `AsOfBanner` | Spoiler-consent surfaces that aren't `SealBox` itself |
| `sync/` | `RevealCloudSync`, `BoxRevealCloudSync` (+ `BoxRevealSyncMount`, its Clerk boundary), `SpoiledDaysCloudSync`, `StampsCloudSync`, `BooksCloudSync`, `PreferencesCloudSync`, `SyncStatusProvider`, `OwnerGuards` | Headless multi-device cloud-sync components (ADR-0022/0026/0035/0036/0041/0049). `OwnerGuards` is the odd one: it makes no request at all — on the sign-in transition it asks, per channel and against that channel's OWN owner key, whether this device's reveal marks, box-score bits and spoiled-day consent belong to the account now signing in, and clears each that does not. App-wide on purpose, because all three are render overrides read synchronously as a scoring surface paints; its header says why a per-screen guard would decide too late. Stamps and books guard themselves inside their own pulls instead, correctly — their adopt replaces a document, which needs the remote |
| `team/` | `TeamLink`, `TeamSearchBox`, `TeamFilterStrip`, `LevelNav`, `ManagerLink`, `OffDaySection` | Team-identity/navigation primitives |
| `teamstats/` | `TeamLeaders`, `TeamLeadersLedger`, `TeamScoreCard`, `SeasonSeriesStrip`, `BullpenBoard`, `DeckNudge`, `PostseasonOddsModal`, `StarterMatchups` | Team-level statistical cards. The two leader renderings share `computeLeaders` and the descriptors, not a box model: `TeamLeaders` is the headshot-card board the dedicated leader pages render, `TeamLeadersLedger` the two-block ruled ledger the team hub renders |
| `transactions/` | `TeamTransactionsCard`, `TxStory`, `TradeCard`, `TransactionTimeline`, `MoveRow`, `WireRail`, `WireDock`, `dockPhysics.js` | Roster-move surfaces. The home slate's rolling three-day league feed (issue #772, `api/transactions/leagueFeed.js`) has **two presentations split by width, and never both at once** — and **neither stands in the slate's flow**, which is the whole shape of the split: wide, `WireRail` runs down the right of the games — one column, no scroller of its own, so the wheel always belongs to the slate (ADR-0062); on a phone there is no sideways room, so `WireDock` is a bottom-anchored sheet with three detents (rail / half / full) that puts the wire under a thumb (ADR-0061). Either way the games keep the fold — the in-flow card these replaced ran 658px of a 900px window and pushed every game card below it. `GameSelect` picks at `WIDE_QUERY`. **`MoveRow` draws a move for both**, so the two can't drift; the rail asks for its `compact` variant (no photo rail, banner up in the kicker — 288px will not hold a face column and a readable sentence). **The rail fits itself to the games column** and puts the rest behind one control, so the wire fills the page and never lengthens it — a three-day window runs 41-65 stories against a games column of ~1,900px. `dockPhysics.js` is the drag's arithmetic, pure and unit-tested (`test/dock-physics.test.js`) because a sheet's feel is otherwise only assessable by flicking a phone. Neither reuses `TeamTransactionsCard`: that deck sits under a club's own name, so `stripLeadingClub` takes the club out of every cutline — drop those cards on a league-wide feed and half read "Sent LHP Kent Emanuel outright to Louisville Bats" with no subject at all. Naming the club is the sentence's missing half here, which is why each row leads with a colour spine, a mark and an abbreviation. Both are a ledger rather than a deck because a real 48 hours holds ~35 stories and the worst of a measured month held 125 — the wrong shape for a swipe on the busiest page in the app. Two things only a browser can see, and both have specs: the rail's layout — that the games start level with it, that its fit ends on a whole row at the games' foot, and that the shell widens only for a rail that exists (`e2e/wire-rail.spec.js`) — and the dock's floor, where the slate pads its bottom by the rail's MEASURED height so the Reveal all results bar, a seal control, can never end up under it (`e2e/wire-dock.spec.js`). **The club surfaces reuse the primitives, never the layout.** `MoveRow` is where the tone maps, the dateline and the cutline renderer live for every surface, wire and club alike — the deck and the club ledger page (`screens/team/TeamTransactionsPage.jsx`) held byte-identical private copies until they were folded in. A club's card is `TxStory`, shared BY the deck and that page, and it carries no dateline of its own: both surfaces group by day around it (the deck's `DayTab`, the page's heading), which took 950 of 3,199 repeated datelines off the club surfaces — 29.7% of cards restated the date of the card before them. The wire's club chip goes to that page, not to the Games tab: the deck IS on that tab, as its last section under four others |
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
