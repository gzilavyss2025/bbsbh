# Inventory: every block the innings page can show today (round 4, #1389)

Read from source on `main` at `b24dff28`. Paths are under `src/`. "Reveal" = drawn
inside a `SealBox` reveal render function. "Gated" = outside the seal, clamped by
`revealedThrough`, `revealed || isNextToReveal` or `safeToShowEntering`. "Wide" =
`WIDE_QUERY` (740 px and up). Windowed (one at-bat) is the default on every half;
stacked comes only from "See the whole half" (`inning/focus/focusView.js`).

Page skeleton: `screens/InningViewer.jsx` → `.innings.innings--focus` → `.inningchrome`,
ExtrasBanner, DelayCard, `.innings__grid` (ConsoleBand, `.innings__stage`, ReferencePanel),
InningActionBar. The stage holds FocusTrail → InningPageTurn → `inning/HalfInning.jsx`
(→ `playbyplay/PlayByPlay.jsx` in the seal) → DueUpNextCard → FocusControls → RollingLine.

Every direction in `directions.md` shows each row below, or says in one line where it goes.

## A. Page chrome

| # | Block | File | When it shows | Seal |
|---|---|---|---|---|
| 1 | Pregame board + Refresh | `inning/PregameScoreboard.jsx` | Before first pitch only; replaces the console | Outside |
| 2 | Section tabs + half nav (‹ Back · BOTTOM 6TH · Next ›) | `InningViewer` `.inningchrome`, `.stepnav`, `.inningnav` | Always | Outside |
| 3 | Console band row | `gamehud/ConsoleBand.jsx` `.consolebar` | Always; spans both grid columns on wide | Outside |
| 4 | Scorebug (batter, pitcher, P count, runs, inning, bases, outs) | `gamehud/ScorebugMount.jsx` → `Scorebug.jsx` `.gamehud--console` | Started and live; runs clamped to the half on screen | Gated |
| 5 | Page-turn scene | `page-turn/InningPageTurn.jsx` `.turnscene` | Forward navigation only | Preview stays sealed |
| 6 | Bottom bar | `inning/InningActionBar.jsx` `.pagenav--innings` | Always (states in §H) | Outside |
| 7 | Refresh in the bar | `RefreshButton` `.innings__refresh--float` | Until final | Outside |
| 8 | Cloud reveal sync (draws nothing) | `sync/RevealCloudSync.jsx` | Clerk configured | n/a |

## B. Before the first at-bat (above the seal)

| # | Block | File | When it shows | Seal |
|---|---|---|---|---|
| 9 | Half card + hidden heading | `HalfInning` `.half`, `h3.sr-only` | Always | Outside |
| 10 | Full Now Pitching card: header + flags, season lines, pitch mix, PitchScene, last outing | `playbyplay/pitcherCard/PitcherCard.jsx` (+ `SeasonLines`, `PitchMix`, `PitchScene`, `LastAppearance`) | Fresh arm (`isFreshPitcher`), windowed: before the first step only | Outside |
| 11 | Plain "Pitching for…" header | `playbyplay/PitcherNotice.jsx` | Stacked, arm not fresh | Outside |
| 12 | Deferred final line of the arm who left | `playbyplay/PitcherHandoffCard.jsx` FinalizedLineCard | Next to reveal, ≤ 1 at-bat revealed | Outside |
| 13 | Due up (3 headshots), phone | `playbyplay/UpNextBatters.jsx` `.upnext` | Before the first step; hidden on wide when row 63 shows | Outside |
| 14 | Pre-pitch pinch hitter "Now batting" | `HalfInning` PrePitchChanges → `BatterNotice.jsx` | Same gate as 13 | Outside |
| 15 | Pre-pitch fielder "Now playing RF" | `FielderNotice.jsx` in `.prepitch` | Same gate as 13 (823035 bottom 6th has two) | Outside |
| 16 | Pre-pitch text list (unresolved changes) | `.prepitch__list` | Same gate as 13 | Outside |
| 17 | Extras banner | `inning/ExtrasBanner.jsx` | Extra half with a callouts bundle | Outside |
| 18 | Game delay card | `inning/DelayCard.jsx` | A delay in this half | Outside |

## C. The at-bat card (PlayByPlay in the seal)

| # | Block | File | When it shows | Seal |
|---|---|---|---|---|
| 19 | Feed wrapper / one window | `PlayByPlay.jsx` `.pbp`, `.pbp__entry` | After the first step | Reveal |
| 20 | Card frame | AtBatCard `.pbp__atbat` | Every plate appearance | Reveal |
| 21 | Hero: batter vs pitcher, headshots, # and position, PR chain, "vs" scout link | `playbyplay/AtBatHero.jsx` `.abhero` | Every card | Reveal |
| 22 | Batter portrait filler | `.pbp__batshot` | No zone data, desktop | Reveal |
| 23 | Play sentence | `.pbp__desc` | Always ("At the plate." while live) | Reveal |
| 24 | Interrupted at-bat sub-line | EventCards BaserunningNote | `entry.interrupted` | Reveal |
| 25 | Season callouts (★) | `CalloutNote.jsx` | Bundle dates, first PA / first RISP PA | Reveal |
| 26 | Zone icon → zone modal | StrikeZoneGlyph, StrikeZoneModal | Phone with zone data | Reveal |
| 27 | Watch → clip sheet | `.pbp__hlbtn`, `HighlightSheet.jsx` | Package or raw-clip eligible | Reveal |
| 28 | Replay → replay sheet | `.pbp__replaybtn`, AtBatReplay ReplaySheet | Phone, tracked flights, motion on | Reveal |
| 29 | Pitch ladder (B / S columns, numbers and X) | `scoring/PitchLadder.jsx` | Every PA | Reveal |
| 30 | Result code + RBI chip (with the 180 ms beat) | `.pbp__play`, `.pbp__code--*` | Always | Reveal |
| 31 | Play diamond with leg marks, PR mark | `scoring/PlayDiamond.jsx` | Always | Reveal |
| 32 | Out-number circle | `.pbp__outcircle` | An out | Reveal |
| 33 | Ball-flight handle → flight sheet | `charts/BallFlight.jsx` | Ball in play with coordinates | Reveal |
| 34 | Pitch list | `scoring/StrikeZone.jsx` PitchList | Zone data, wide (phone: in the modal) | Reveal |
| 35 | ABS challenge mark on a pitch | StrikeZone ChallengeMark `.pitchlist__challenge` | A challenged pitch | Reveal |
| 36 | Strike-zone plot | StrikeZone `.strikezone--inline` | Zone data | Reveal |
| 37 | Zone cell with replay picks | AtBatReplay ReplayCell | Wide, tracked, motion on | Reveal |
| 38 | Replay scene in the rail | ReplayRail → `.focusrail__replay` | Wide; last at-bat or the pick | Reveal (portal) |
| 39 | Placed runner card (AR) | `scoring/PlacedRunnerCard.jsx` | First entry of each extra half | Reveal |

## D. Events between and inside at-bats (all in the seal, `.change` / `.notice--event`)

| # | Block | File | When it shows |
|---|---|---|---|
| 40 | Pitching change, full card | PitcherCard `relief` | `pitching_substitution` |
| 41 | Departure line ("Departing", N on base) | DepartureLineCard | After a change with a handoff |
| 42 | Finalized line ("Final line for") | FinalizedLineCard | After the play that resolved inherited runners |
| 43 | Relief repeat ("Pitching for…") | ReliefRepeat | Windowed, head of the reliever's first window |
| 44 | Mound visit with pips | EventCards MoundVisitBar | `mound_visit` |
| 45 | Fielder change / switch | FielderNotice | `defensive_substitution` / `defensive_switch` |
| 46 | Pinch runner | `PinchRunNotice.jsx` | `pinch_running` |
| 47 | Pinch hitter | BatterNotice | `pinch_hitting` |
| 48 | Ejection | EjectionBar | `ejection` |
| 49 | Delay that came to something | DelayNotice | `game_advisory` (ADR-0060) |
| 50 | Steal SB | EventCard | `stolen_base_*` (824624 bottom 3rd) |
| 51 | Caught stealing CS | EventCard | `caught_stealing_*` |
| 52 | Pickoff PK (and pickoff caught stealing) | EventCard | `pickoff_*` |
| 53 | WP / PB / BK | EventCard | `wild_pitch` / `passed_ball` / `balk` |
| 54 | DI / RP | EventCard | Standalone play (rare) |
| 55 | Fallback note | EventNote `.pbp__note` | Unresolved sub or unknown type |
| 56 | Errors | no card: trail cell colour + E column | — |

## E. Trail and stage controls

| # | Block | File | When it shows | Seal |
|---|---|---|---|---|
| 57 | At-bat trail | `inning/focus/FocusControls.jsx` FocusTrail → `AtBatTrail.jsx` `.trailstrip` | > 1 revealed step, above the hero | Gated |
| 58 | Trail cell (code, name, notes like SB, MV) | `.trailcell--*` | Windowed: switch window; stacked: scroll | Gated |
| 59 | "Back to the live at-bat" | `.trailstrip__followbtn` | Cursor not on newest | Outside |
| 60 | "See the whole half" | `.trailstrip__summarybtn` | Revealed and windowed | Outside |
| 61 | Running line / half navigator | `gamehud/RollingLine.jsx` `.rolling` | Always, below the stage; never removed (ADR-0043) | Gated |
| 62 | Half hit chart | `charts/HitChart.jsx` | Half revealed | Gated |

## F. Half close (band companion)

| # | Block | File | When it shows | Seal |
|---|---|---|---|---|
| 63 | Due-up console (3 batters with lines) | `gamehud/DueUpConsole.jsx` | Wide and sealed | Gated |
| 64 | Half tally: R H E LOB, pitches, whiffs, fouls, first-pitch strikes (ink-in at close) | `gamehud/HalfTally.jsx` | Half revealed | Reveal |
| 65 | Between-innings facts | `gamehud/BetweenInnings.jsx` | Revealed half with a fact | Gated |
| 66 | Due up next (other club) | `playbyplay/DueUpNextCard.jsx` | Half fully revealed | Gated |

## G. Reference (`inning/focus/ReferencePanel.jsx`)

| # | Block | File | When it shows | Seal |
|---|---|---|---|---|
| 67 | Wide rail with tabs and the replay slot | `.focusrail` | Wide | Outside |
| 68 | Phone chip row → reference sheet | `.refbar` → `.scrim .sheet` | Below 740 | Outside |
| 69 | LINEUPS (with UP NEXT pill) | `inning/EnteringReference.jsx` | `safeToShowEntering` | Gated |
| 70 | FIELD (defense diamond) | EnteringReference DefenseSection | Same | Gated |
| 71 | ARMS empty state | `ui/state/EmptyState` | No lines yet | Outside |
| 72 | ARMS: Margin Notes | `inning/MarginNotes.jsx` | Notes exist | Gated |
| 73 | ARMS: Pitchers table | `inning/PitchersSection.jsx` | Arms used | Gated |
| 74 | ARMS: Insights stat box (missed calls, ump favour, Statcast) | `gamehud/StatBox.jsx` | Half revealed | Reveal |
| 75 | ARMS: ABS challenges card (bank pips) | StatBox AbsCard | `gameHasAbs` | Reveal |
| 76 | EXTRAS: bench and bullpen | `inning/RosterPanel.jsx` | Always | Gated |
| 77 | EXTRAS: win-probability chart | `charts/WinProbChart.jsx` | Always (empty at MiLB) | Gated |
| 78 | EXTRAS: umpire tendencies | `umpire/UmpireTendenciesFold.jsx` | Swept crews | Outside |
| 79 | EXTRAS: card-header facts | `inning/focus/ExtrasFacts.jsx` | Always | Outside |
| 80 | EXTRAS: "Open the live scorecard" door | `ui/control/Door.jsx` | `onScorecard` passed | Outside |

## H. Bottom bar states (priority order)

| # | State | When |
|---|---|---|
| 81 | "Next at-bat ›" (cursor only, ink) | Revealed half read back from at-bat 1 |
| 82 | Live-edge status | Scores Unlocked, not final |
| 83 | "Caught up — waiting on the next batter" | Sealed, live half, all entries stepped (ADR-0055) |
| 84 | Lone "Next at-bat" | Sealed, half still being played |
| 85 | Next at-bat / Rest of half split | Sealed, finished half |
| 86 | "{Top/Bottom Nth} ›" | Revealed, a next half exists |
| 87 | "Box score ›" / "Close the book ›" | No next half |

## I. Cross-cutting states

| # | State | What changes |
|---|---|---|
| 88 | Sealed half | Rows 13–18 and 63 show; nothing in C–D exists; stage height fixed (ADR-0046) |
| 89 | Stacked half | Every card at once; trail scrolls; write-on on the first 6 cards |
| 90 | Reduced motion | No replay (rows 28, 37, 38); PitchScene still; close sequence skipped |
| 91 | Live half (ADR-0055) | Rows 83–84; the step never commits |
| 92 | MiLB / missing data | No zone, replay, Watch, ABS, win-prob, Statcast; headshots fall back |
| 93 | Extras | Rows 17 and 39; running line window slides (ADR-0008) |

## J. Planned by the spec, not in the app today (must still get a place)

| # | Block | Slice |
|---|---|---|
| 94 | Runners chip + sheet with each runner's #22 box | S4 (Gary's round-2 decision) |
| 95 | Batter and pitcher day lines ("1-for-2 today") | S2 |
| 96 | Bat speed from Savant `/gf`, swing path for finished games | S9, S10 |
| 97 | Review card (manager / crew chief) + ABS bank pips in the band | S7 |
| 98 | Notice "write" line (red rule #, PR #, AR) | S5 |
| 99 | The #22 box itself on this screen (`scoring/AtBatBox.jsx`, today only on `/scorecard`) | new in round 4 |
