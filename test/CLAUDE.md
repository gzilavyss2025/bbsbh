# test/

`node:test` unit suite — pure logic only, no browser, no live network. CI-gated via
`npm test` (see root `CLAUDE.md`). `test/fixtures/` holds shared captured-feed JSON;
most files keep their fixtures inline (see "Fixtures" below for why).

## Index

One line per file so a future audit or "does X still have coverage?" question can be
answered by reading this table instead of opening all ~87 files. Keep it in sync when
a test file is added, renamed, or removed — a stale index is worse than none.

| File | Tests | Modules under test | Feature |
|---|---|---|---|
| analytics.test.js | 5 | src/lib/analytics.js | Toggle-consent telemetry allowlist (ADR-0028) |
| api-handlers.test.js | 51 | api/copy.js, api/reveal.js, api/spoiled-days.js, api/stamps.js | Node-runtime request shapes, the Logbook's tombstone read side (ADR-0035), the "pick up your pencil" scorebook index's auto-drop rule |
| broadcast.test.js | 6 | src/api/broadcast.js | ESPN broadcast lookup drops the subscription packages (MLB.TV, ESPN Unlmtd) from the displayed summary/national-icon fact |
| cards.test.js | 5 | api/_lib/cards.js | OG preview card resolveGame race-condition fix |
| career-matchups.test.js | 16 | src/api/careerMatchups.js | Batting order's career-vs-starter notes (TeamInfo) |
| career-register.test.js | 2 | src/api/loadPlayer.js, src/api/person.js | Current-season stat blending across levels |
| challenges.test.js | 7 | src/api/challenges.js | ABS challenge tracking |
| comeback-wins.test.js | 13 | scripts/gen-comeback-wins.mjs, src/api/comebackWins.js | Comeback-wins card |
| compute-batter-line.test.js | 4 | src/api/boxscore.js | Spoiler-safe batter line (never live pre-reveal) |
| condensed-day-index.test.js | 14 | scripts/lib/highlights.mjs, src/api/gamePhotos.js | Day-index generation policy: condensed-cut selection (never the recap) + hero-photo pick for the slate's revealed result cards |
| copy-registry.test.js | 22 | src/copy/registry.js | Admin-editable consent copy (ADR-0025/0026) |
| dates.test.js | 10 | src/lib/dates.js | Date window/formatting helpers |
| day-highlights.test.js | 46 | src/api/dayHighlights.js, src/lib/resultCards.js | Day Recap signals (multi-HR, game score, cycle, etc.) + the slate's four display tiers (favorite → live → national scheduled → rest) |
| derive-live-state.test.js | 9 | src/api/playbyplay.js | Core spoiler-safe HUD state (cap, bases, batterDone) |
| dev-custom-marks.test.js | 3 | scripts/lib/dev-custom-marks.mjs | Dev-only recolored-mark lab (ADR-0029) |
| dev-data-stores.test.js | 24 | scripts/lib/dev-data-stores.mjs | Dev-lab data-store validators/allowlists |
| due-up.test.js | 8 | src/api/dueup.js | "Due up" pre-pitch preview |
| fielders-choice-force-out.test.js | 2 | src/api/playbyplay.js | force_out eventType scorebook code |
| foul-callouts.test.js | 15 | src/api/callout-notes.js | Marathon-AB / steal-streak / bullpen-thin callouts |
| fouls.test.js | 16 | scripts/gen-fouls.mjs, src/api/fouls.js | Foul Tracker stats/leaderboards |
| fresh-pitcher.test.js | 4 | src/api/select.js | selectIsFreshPitcher |
| game-feed-diff.test.js | 6 | src/api/game.js | mergeFeedDiff |
| game-notes-regressions.test.js | 3 | src/api/whatsBrewing.js | "What's Brewing" / Game Notes extraction |
| game-photos.test.js | 20 | src/api/gamePhotos.js | /photos page: photographer/broadcast/graphic classification + subject attribution (unsealed, non-spoiler) |
| gidp-full-chain.test.js | 4 | src/api/playbyplay.js, src/api/loadScorecard.js | Full relay-chain double-play display |
| graceful-degradation.test.js | 6 | select.js, linescore.js, derive.js, pitchers.js, defense.js, battingorder.js, enteringHalf.js | MiLB sparse-feed crash safety |
| header-theme.test.js | 11 | headerTheme.js, milbColors.js, contrast.js | Masthead theming + contrast guard |
| identity-lab-stores.test.js | 24 | tuningStore.js, teams.js, brandColors.js, saveStores.js, mlbColorRoles.js, dev-data-stores.mjs | /identity-lab data stores |
| interrupted-at-bat.test.js | 14 | src/api/playbyplay.js, src/api/loadScorecard.js | Interrupted at-bat handling |
| invariant-real-game.test.js | 6 | linescore.js, derive.js, pitchers.js, select.js | Spoiler invariant pinned on captured real feed |
| jerseys.test.js | 10 | scripts/gen-jerseys.mjs, src/api/jerseys.js | Nightly jerseys export |
| json-patch.test.js | 8 | src/lib/jsonPatch.js | JSON patch utility |
| leg-advance-codes.test.js | 2 | src/api/playbyplay.js | ADVANCE_CODES (catcher-interference labeling) |
| lib-helpers.test.js | 14 | format.js, dates.js, statTiers.js, runExpectancy.js | General lib grab-bag |
| live-edge.test.js | 17 | liveEdge.js, select.js, revealProgressCore.js, scoresUnlocked.js | Follow-live-edge + reveal/unlock mechanism |
| logbook-stats.test.js | 27 | src/api/logbookStats.js | Logbook retrospective Tier 1 — records, streaks, aggregates (ADR-0035) |
| logo-mono.test.js | 25 | logoMono.js | Mono logo editor (ADR-0031) |
| logo-recolor.test.js | 9 | logoMono.js, logoRecolor.js | Logo recolor editor (shares shape numbering w/ logo-mono by design) |
| logo-tint.test.js | 8 | src/lib/logoTint.js | Logo tint wash |
| logo-upload.test.js | 26 | src/lib/logoArt.js, scripts/lib/dev-logo-upload.mjs | Dev logo upload endpoint (ADR-0029) |
| manager.test.js | 4 | src/api/game.js (fetchManager) | Interim-manager precedence |
| milb-color-chain.test.js | 11 | brandColors.js, teams.js, milbColors.js | Affiliate→parent-org→neutral color fallback |
| milb-team-wiring.test.js | 7 | milbColors.js | MiLB tile/logoVariant wiring |
| mound-visit-charging.test.js | 7 | src/api/playbyplay.js | Mound-visit pip row |
| multi-leg-advancement.test.js | 3 | src/api/playbyplay.js | Multi-runner-per-play bookkeeping |
| node-handler.test.js | 14 | api/_lib/nodeHandler.js | Vercel Node runtime request adapter |
| page-turn-state.test.js | 13 | src/components/page-turn/pageTurnState.js | Forward page-turn transition (ADR-0024) |
| passport-layout.test.js | 46 | src/lib/passportLayout.js | Logbook passport book geometry — tilt hash, page clamps, collision nudge, the ruled 2x4 guide + capacity, the by-date re-order (ADR-0035/0036) |
| pinch-hitter-notice.test.js | 2 | src/api/playbyplay.js | Mid-half PH notice (ADR-0017 tiers) |
| pitch-arsenal.test.js | 8 | scripts/gen-pitch-arsenal.mjs, src/api/pitchArsenal.js | Pitch arsenal aggregation/reader |
| pitch-challenge-marker.test.js | 2 | src/api/challenges.js | ABS challenge marker on one pitch (PR #344) |
| pitch-locations.test.js | 7 | src/api/playbyplay.js (pitchInfo) | Whether a park tracked plate locations — gates the strike-zone pane and the at-bat row's second column |
| pitcher-advanced.test.js | 9 | src/api/person.js | Player page Advanced card, situational splits, rank chips, QS flag |
| pitcher-callouts.test.js | 10 | src/api/pitcher-callouts.js, select.js | Margin Notes / Now Pitching card |
| pitcher-health.test.js | 4 | src/api/pitcherHealth.js | laboringFor metric (ADR-0009) |
| placed-runner.test.js | 11 | src/api/playbyplay.js | Placed-runner card |
| play-diamond-out-geometry.test.js | 5 | src/components/scoring/playDiamondGeometry.js | outLegBases geometry |
| playbyplay-pitching-change.test.js | 7 | src/api/playbyplay.js | Now Pitching card step-boundary logic |
| pre-pitch-selectors.test.js | 12 | src/api/select.js | Caller-gated pre-pitch selectors (ADR-0010) |
| pregame-avg.test.js | 3 | src/api/boxscore.js | preGameAvg |
| preview-resolver.test.js | 6 | src/copy/previewResolver.js, registry.js | Consent-modal copy slot resolution |
| recent-form.test.js | 14 | src/api/recentForm.js | Recent form roster eligibility |
| reveal-only.test.js | 21 | derive.js, linescore.js, pitchers.js | ADR-0001 reveal-only contract |
| reveal-progress-core.test.js | 15 | src/hooks/revealProgressCore.js, select.js | Reveal-progress state machine |
| rookies.test.js | 18 | src/api/rookies.js | Rookie pill + the sharded reads (compact status map, per-id record shard) |
| route.test.js | 32 | src/lib/route.js | Full router surface |
| sac-reached-notation.test.js | 3 | src/api/playbyplay.js | Sac-bunt error/FC notation edge cases |
| scorecard-placed-runner.test.js | 3 | src/api/loadScorecard.js | Extra-innings placed runner in printable grid (regression) |
| scorecard-sac-double-play.test.js | 1 | src/api/loadScorecard.js | sac_fly_double_play AB-charging bug (regression) |
| scoreless-dow-callouts.test.js | 21 | src/api/callout-notes.js | Scoreless/day-of-week/pitch-pace callouts |
| scores-unlocked.test.js | 16 | src/lib/scoresUnlocked.js | Scores Unlocked unlock timer |
| season-score.test.js | 14 | scripts/gen-season-score.mjs, src/api/seasonScore.js, seasonScoreFormula.js | Season score / Marcel baseline / team-specific home-field factor |
| season-series.test.js | 7 | src/api/seasonSeries.js | Season series cells |
| skipped-bottom-half.test.js | 9 | src/api/select.js | selectSkippedBottomHalf, selectFinalHalfIndex |
| slate-scores.test.js | 13 | src/api/schedule.js, src/lib/slateScoreLine.js | Slate score line normalization |
| spoiled-days.test.js | 21 | src/lib/spoiledDays.js | Spoiled-days consent persistence (ADR-0026) |
| spoiler-gates.test.js | 4 | select.js, enteringHalf.js | Caller-gated pre-pitch rule |
| stamp-ink.test.js | 11 | src/lib/stampInk.js, contrast.js | Logbook stamp ink — the winner's darkest brand colour + its contrast floor (ADR-0036) |
| stamps.test.js | 39 | src/lib/stamps.js | Logbook stamp rules — the reveal gate, tombstone sync merge, book placement (ADR-0035) |
| standings.test.js | 15 | src/api/standings.js | Standings shaping/ranks |
| statsapi.test.js | 4 | src/api/statsapi.js | Shared getJson fetch wrapper |
| team-franchise-name.test.js | 3 | src/api/select.js (selectTeamMeta) | franchiseName vs locationName bug fix |
| team-score.test.js | 19 | scripts/gen-team-score.mjs, src/api/teamScore.js, seasonGradeFormula.js, teamScoreFormula.js | Quality/Current Form readers, strength-of-schedule adjustment, per-game park adjustment |
| team-transactions.test.js | 31 | src/api/teamTransactions.js | Team transactions dedupe/story grouping |
| team.test.js | 28 | src/api/team.js | Team fetch/roster/affiliates/standings |
| teams-static.test.js | 2 | src/api/teams-static.js | fetchStaticTeams |
| teams.test.js | 51 | src/lib/teams.js | Team id/logo/color static data (60+ exports) |
| uniforms.test.js | 31 | src/api/uniforms.js | Jersey treatment classification (PR #343) |
| vs-team-splits.test.js | 7 | src/api/vsTeamSplits.js | SPLITS VS TEAM card + the per-club shard merge |
| war.test.js | 6 | src/api/war.js | WAR reader |
| winprob-atbat-step.test.js | 5 | src/api/playbyplay.js | lastVisibleAtBatIndex |
| winprob.test.js | 17 | src/api/game.js, src/api/winprob.js | Win probability chart |
| workload.test.js | 11 | src/api/workload.js | Rolling pitcher workload |
| worktrees.test.js | 15 | scripts/worktrees.mjs | Git-worktree staleness classification |
| wpa-logo.test.js | 18 | src/lib/wpa/wpaLogo.js, teams.js, logoArt.js | WPA band logo resolver/recolor guard |

Last full audit: 2026-07-31 — all 88 files' imports resolved (87 since
lineup-strength.test.js went with its feature), all features traced to
a currently-documented behavior, no dead code found. Two soft consolidation
candidates noted, not acted on: `milb-color-chain.test.js` +
`milb-team-wiring.test.js` (adjacent MiLB color concerns), and
`scorecard-placed-runner.test.js` + `scorecard-sac-double-play.test.js` (same
`scorecardPlays` entry point, different filed bugs).

## Working with this suite without burning context

- **Run narrow when debugging.** `node --test test/foo.test.js` (or
  `npm run test:verbose -- test/foo.test.js`-style single-file invocation) instead of
  the full `npm test` when chasing one failure — keeps output to one file's worth of
  noise instead of ~1000 tests' worth.
- **`npm test` uses the `dot` reporter** (one char per test, not one line) to keep a
  full-suite passing run's output small. `npm run test:verbose` reruns with the
  per-test `spec`-style reporter when you actually want test names (e.g. finding
  which specific case is slow or silently skipped).
- **Fixtures stay inline on purpose.** Several of the largest files
  (`team-transactions.test.js`, `day-highlights.test.js`) embed real captured feed
  rows directly in the test body with comments explaining *why* each row matters
  (which bug it pins, which real gamePk/date it came from). That provenance is the
  point — moving the data into a bare `test/fixtures/*.json` would strip the
  comments that make the fixture legible and wouldn't reduce total tokens read once
  you need both files open anyway. Don't extract a fixture just because the file is
  long; only extract if the data itself (not its rationale) is reused across files.
- **Prefer asserting the field(s) under test, not the whole object**, when adding new
  cases — `assert.equal(sig.performer.id, 2)` over
  `assert.deepStrictEqual(sig, entireExpectedObject)`. A failing assertion on a whole
  feed/derived object dumps its full diff into context; a narrow assertion fails with
  a one-line diff. Existing broad `deepStrictEqual` calls on small, already-minimal
  fixtures (e.g. `wpa-logo.test.js`) are fine as-is — this is guidance for new tests
  on large objects, not a mandate to rewrite passing assertions.
