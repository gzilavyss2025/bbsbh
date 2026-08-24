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
| all-started-games.test.js | 3 | src/api/schedule.js | TeamPhotosPage's game list — keys on `started`, not `won`, so a live game's photos are reachable before it's Final |
| analytics.test.js | 5 | src/lib/analytics.js | Toggle-consent telemetry allowlist (ADR-0028) |
| api-handlers.test.js | 51 | api/copy.js, api/reveal.js, api/spoiled-days.js, api/stamps.js | Node-runtime request shapes, the Logbook's tombstone read side (ADR-0035), the "pick up your pencil" scorebook index's auto-drop rule |
| between-innings.test.js | 6 | src/api/between-innings.js | Post-half card allowlist, CARD_MAX cap, marginNotes[0] eligibility, quiet-vs-loud spoiler invariant |
| box-score-note-attribution.test.js | 13 | src/api/boxscore.js, src/api/boxscore/gameNotes.js | Which club each info-block row prints under (HBP/IBB follow the BATTER), and the three parse shapes that used to drop a row into the shared foot |
| broadcast.test.js | 6 | src/api/broadcast.js | ESPN broadcast lookup drops the subscription packages (MLB.TV, ESPN Unlmtd) from the displayed summary/national-icon fact |
| callout-ledger.test.js | 8 | src/hooks/useCalloutLedger.js, prehalf-callouts.js, between-innings.js | The shown ledger (distinct halves, never the half a note sits on) and the two capped surfaces that read it — one record note per strip, once-per-game facts dropped |
| callout-repetition.test.js | 9 | src/api/callout-notes/shared.js | rankNotes' three repetition rules (decay, once-per-game, diversity) + the one 0–MAGNITUDE_MAX bonus scale |
| cards.test.js | 38 | api/_lib/cards.js, api/_lib/entity.js, api/preview.js | OG preview card resolveGame race-condition fix, the per-route card set, and the one canonical origin — plus the edge copies of the app's slug helpers, asserted against route.js's own (ADR-0057) |
| career-matchups.test.js | 16 | src/api/careerMatchups.js | Batting order's career-vs-starter notes (TeamInfo) |
| career-register.test.js | 12 | src/api/loadPlayer.js, src/api/person.js | Current-season stat blending across levels + chronological multi-org register rows/subtotals + the Team history rail's org order |
| challenges.test.js | 7 | src/api/challenges.js | ABS challenge tracking |
| comeback-wins.test.js | 13 | scripts/gen-comeback-wins.mjs, src/api/comebackWins.js | Comeback-wins card |
| compute-batter-line.test.js | 5 | src/api/boxscore.js | Spoiler-safe batter line (never live pre-reveal) |
| condensed-day-index.test.js | 14 | scripts/lib/highlights.mjs, src/api/gamePhotos.js | Day-index generation policy: condensed-cut selection (never the recap) + hero-photo pick for the slate's revealed result cards |
| contract-view.test.js | 21 | src/api/person/contract/view.js | The Contract card's reading of one shard record: which regime leads the card, the arbitration/free-agency years read off the out-year codes (Super Two included), who the terms say holds an option, and the salary schedule's cash-only bars |
| copy-registry.test.js | 36 | src/copy/registry.js | Admin-editable consent copy (ADR-0025/0026), MLB + MiLB ballpark field derivation |
| crawl-body.test.js | 18 | api/_lib/crawl.js, api/_lib/cards.js, api/preview.js, scripts/gen-sitemap.mjs | The readable body a rewritten deep link now carries (ADR-0059) — what a player and a club page say, that the layer cannot reach a game and a game route gets no body at all, where the markup sits relative to #root, and the sitemap's club listing |
| dates.test.js | 10 | src/lib/dates.js | Date window/formatting helpers |
| day-highlights.test.js | 46 | src/api/dayHighlights.js, src/lib/resultCards.js | Day Recap signals (multi-HR, game score, cycle, etc.) + the slate's four display tiers (favorite → live → national scheduled → rest) |
| derive-live-state.test.js | 9 | src/api/playbyplay.js | Core spoiler-safe HUD state (cap, bases, batterDone) |
| dev-custom-marks.test.js | 3 | scripts/lib/dev-custom-marks.mjs | Dev-only recolored-mark lab (ADR-0029) |
| dev-data-stores.test.js | 30 | scripts/lib/dev-data-stores.mjs | Dev-lab data-store validators/allowlists |
| due-up.test.js | 8 | src/api/dueup.js | "Due up" pre-pitch preview |
| fielders-choice-force-out.test.js | 2 | src/api/playbyplay.js | force_out eventType scorebook code |
| focus-windows.test.js | 10 | src/api/playbyplay/entriesView.js | Focus mode's display windows: one per at-bat, each card in exactly one window, and the count never drops when a stoppage reaches the feed under an unchanged cap (replayed tap by tap on the captured game) |
| foul-callouts.test.js | 15 | src/api/callout-notes.js | Marathon-AB / steal-streak / bullpen-thin callouts |
| fouls.test.js | 16 | scripts/gen-fouls.mjs, src/api/fouls.js | Foul Tracker stats/leaderboards |
| fresh-pitcher.test.js | 4 | src/api/select.js | selectIsFreshPitcher |
| game-feed-diff.test.js | 6 | src/api/game.js | mergeFeedDiff |
| game-notes-regressions.test.js | 3 | src/api/whatsBrewing.js | "What's Brewing" / Game Notes extraction |
| game-photos.test.js | 20 | src/api/gamePhotos.js | /photos page: photographer/broadcast/graphic classification + subject attribution (unsealed, non-spoiler) |
| gidp-full-chain.test.js | 4 | src/api/playbyplay.js, src/api/scorecardGame.js | Full relay-chain double-play display |
| graceful-degradation.test.js | 6 | select.js, linescore.js, derive.js, pitchers.js, defense.js, battingorder.js, enteringHalf.js | MiLB sparse-feed crash safety |
| half-feed-note-order.test.js | 6 | src/api/playbyplay.js (halfInningFeed, eventTypes) | Same-play notes render in the feed's own playEvents order, not stoppages-then-baserunning; delay advisories reach the feed while the lifecycle "Status Change" lines stay out |
| header-theme.test.js | 11 | headerTheme.js, milbColors.js, contrast.js | Masthead theming + contrast guard |
| hitchart.test.js | 15 | src/api/hitchart.js | The hit chart's data layer — the Gameday-coordinate projection (its scale pinned against the feed's own carry distances) and the reveal-clamped batted-ball walk |
| identity-drawer-fields.test.js | 10 | screens/team/modules/identity/identityFields.js | The team hub gear's field model — which tiles a club offers, which store each row writes into (the logo-art row included), the browser-side contrast gate (ADR-0050) |
| identity-overrides.test.js | 25 | src/lib/identity/*, api/identity.js | The runtime club-identity overlay: the closed field catalog, the merge rules, the seam that puts an override under a pure resolver, and the endpoint's write rule (ADR-0050) |
| identity-lab-stores.test.js | 24 | tuningStore.js, teams.js, brandColors.js, saveStores.js, mlbColorRoles.js, dev-data-stores.mjs | /identity-lab data stores |
| interrupted-at-bat.test.js | 14 | src/api/playbyplay.js, src/api/scorecardGame.js | Interrupted at-bat handling |
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
| manager-page.test.js | 19 | src/api/managers.js, src/api/careerTimeline.js (fetchManagerPlaying) | The manager detail page's data layer — the /coaches jersey-number duplicates that faked "Shared season" rows, the header's role precedence, and a playing career that agrees with the clubs rail under it |
| matchup-arsenal.test.js | 26 | src/api/matchup/arsenal.js, src/api/matchup/savant.js (arsenal readers) | Matchup callouts Family C — a hitter against one pitch type: the four whiff quadrants (one dropped), the pitch-usage/thrown/PA gates living in the generator not the builder, BA as color only past the PA floor, and the shared voice.js mechanics reused rather than reimplemented |
| matchup-callouts.test.js | 24 | src/api/matchup/notes.js, src/api/matchup/savant.js, src/api/matchup/forHalf.js | Matchup callouts Families A/B — a hitter vs. the arm he faces on a chase/whiff/hard-contact or pull/ground-ball axis, the shape rotation and length-aware short form, and the due-up/starting-pitcher resolution for one half |
| milb-color-chain.test.js | 11 | brandColors.js, teams.js, milbColors.js | Affiliate→parent-org→neutral color fallback |
| milb-team-wiring.test.js | 7 | milbColors.js | MiLB tile/logoVariant wiring |
| mono-logo-art.test.js | 4 | scripts/lib/mono-logo-art.mjs | The nightly generator's mono-ink override merge — degrades to the file alone on any fetch failure, an id for another store, or a malformed value (ADR-0054) |
| mound-visit-charging.test.js | 7 | src/api/playbyplay.js | Mound-visit pip row |
| mid-at-bat-batter-change.test.js | 5 | src/api/playbyplay.js (halfInningFeed, shared) | A batter replaced mid-count still owns the strikeout (Rule 9.15(b)) — the card, its name/headshot and its trimmed description follow the CREDITED batter, not `matchup.batter` |
| multi-leg-advancement.test.js | 3 | src/api/playbyplay.js | Multi-runner-per-play bookkeeping |
| node-handler.test.js | 14 | api/_lib/nodeHandler.js | Vercel Node runtime request adapter |
| page-turn-state.test.js | 13 | src/components/page-turn/pageTurnState.js | Forward page-turn transition (ADR-0024) |
| passport-layout.test.js | 46 | src/lib/passportLayout.js | Logbook passport book geometry — tilt hash, page clamps, collision nudge, the ruled 2x4 guide + capacity, the by-date re-order (ADR-0035/0036) |
| pinch-hitter-notice.test.js | 2 | src/api/playbyplay.js | Mid-half PH notice (ADR-0017 tiers) |
| pitch-arsenal.test.js | 8 | scripts/gen-pitch-arsenal.mjs, src/api/pitchArsenal.js | Pitch arsenal aggregation/reader |
| pitch-challenge-marker.test.js | 2 | src/api/challenges.js | ABS challenge marker on one pitch (PR #344) |
| pitch-codes.test.js | 12 | src/api/playbyplay.js (pitchInfo), src/api/derive.js, src/api/callout-notes.js | The pitch call-code table against MLB's own strike/ball flags: which ladder lane a code takes, automatic calls (the count, not the pitches), and the two-strike fouls that END an at-bat |
| pitch-locations.test.js | 7 | src/api/playbyplay.js (pitchInfo) | Whether a park tracked plate locations — gates the strike-zone pane and the at-bat row's second column |
| pitcher-advanced.test.js | 9 | src/api/person.js | Player page Advanced card, situational splits, rank chips, QS flag |
| pitcher-callouts.test.js | 16 | src/api/pitcher-callouts.js, select.js | Margin Notes / Now Pitching card |
| pitcher-handoff.test.js | 10 | src/api/pitchers.js (pitcherHandoffs, pitcherLineAt, isLastHalfOfGame, handoffsResolvingAt, halfClosingPitcher) | Pitching-handoff cards: departure-snapshot/finalized-line spoiler cut, inherited-runner resolution tracking, in-feed vs. deferred-to-next-half placement, and the ordinary closing-pitcher recap |
| pitcher-health.test.js | 4 | src/api/pitcherHealth.js | laboringFor metric (ADR-0009) |
| pitcher-starts.test.js | 6 | scripts/lib/pitcher-starts.mjs | starterRecords' team-attributed tallies stay scoped to a pitcher's CURRENT club through a mid-season trade/option |
| placed-runner.test.js | 11 | src/api/playbyplay.js | Placed-runner card |
| play-diamond-out-geometry.test.js | 5 | src/components/scoring/playDiamondGeometry.js | outLegBases geometry |
| playbyplay-pitching-change.test.js | 7 | src/api/playbyplay.js | Now Pitching card step-boundary logic |
| pre-pitch-selectors.test.js | 12 | src/api/select.js | Caller-gated pre-pitch selectors (ADR-0010) |
| preferred-lineup-team-scope.test.js | 7 | src/screens/team/data/shared.js (preferTeamSplits, preferredLineupFrom) | A position/level-agnostic roster fetch (rosterType=sport level, not per-team) must not credit a rostered-but-unplayed pickup with another team's stats, must still credit a player promoted within the org, and must exclude one the club has since released — pinned on real captured statsapi rows (Bae/Williams/Lara/Marte, 2026-08-21) |
| pregame-avg.test.js | 3 | src/api/boxscore.js | preGameAvg |
| print-sheet.test.js | 14 | src/screens/sheet/sheetModel.js | Tonight's printable scorecard: the pre-pitch model + its MiLB blank-line degradations, and the spoiler boundary — screens/sheet/ imports only select.js, and the printed at-bat grid stays EMPTY (docs/print-sheet.md) |
| preview-resolver.test.js | 6 | src/copy/previewResolver.js, registry.js | Consent-modal copy slot resolution |
| probable-pitcher-fallback.test.js | 10 | src/api/select.js, prehalf-callouts.js, between-innings.js | Fall back to the half's derived starter (its first logged play's pitcher) when gameData.probablePitchers is empty — TeamInfo's Starting pitcher card and both starter-record notes, each still respecting its own reveal gate (issue #851) |
| prospect-trend.test.js | 14 | src/api/prospectTrend.js | vs. Level percentile label + levelTier 5-dot bucketing |
| prospects.test.js | 20 | src/api/prospects.js | Top-100/org-prospect selectors + resolveCurrentLevels' live-roster resolution and MLB/MiLB "Line" split, incl. the "ALL (n)" fallback fix |
| record-ranks.test.js | 10 | src/api/callout-notes/rank.js, checkpoints.js, heldNotes.js | League ranks on the W-L record families — tie/floor math, the no-"#" display rule, a legacy bundle reading byte-identical, and a folded sentence staying bare |
| recent-decided-games.test.js | 4 | src/api/scheduleGames.js | recentDecidedGames' `won != null` cutoff invariant (Last 10 Games) |
| recent-form.test.js | 14 | src/api/recentForm.js | Recent form roster eligibility |
| reveal-only.test.js | 21 | derive.js, linescore.js, pitchers.js | ADR-0001 reveal-only contract |
| reveal-progress-core.test.js | 15 | src/hooks/revealProgressCore.js, select.js | Reveal-progress state machine |
| rookies.test.js | 18 | src/api/rookies.js | Rookie pill + the sharded reads (compact status map, per-id record shard) |
| roster-availability.test.js | 3 | src/api/select.js | The bench/bullpen strike-through's two ceilings (`enteredAsOf`) — the reveal mark AND the half on screen, so a replayed inning shows the bench that half opened with |
| route.test.js | 77 | src/lib/route.js | Full router surface, both hubs' tab tables included (the count was stale at 36; `node --test` reports 77) |
| sac-bunt-double-play.test.js | 4 | src/api/boxscore.js, src/api/scorecard/notation.js, src/api/playbyplay/scorebookCode.js, src/api/scorecardGame.js | sac_bunt_double_play IS an at-bat, unlike sac_fly_double_play — Rule 9.08(c) credits no sacrifice, scored as an ordinary double play (issue #765) |
| sac-reached-notation.test.js | 3 | src/api/playbyplay.js | Sac-bunt error/FC notation edge cases |
| scorecard-game.test.js | 9 | src/api/scorecardGame.js | The live scorecard's reveal clamp, P/TP/LOB agreement with derive/linescore, FINAL block + decisions gating, inning-end diagonals, skipped-half X, pinch-runner run on the origin card — pinned on the captured real feed |
| scorecard-notes.test.js | 6 | src/lib/scorecardNotes.js | Per-cell notation override store: malformed-storage tolerance, trim/cap hygiene, same-reference no-op writes |
| scorecard-placed-runner.test.js | 3 | src/api/scorecardGame.js | Extra-innings placed runner in the inked grid (regression) |
| scorecard-sac-double-play.test.js | 1 | src/api/scorecardGame.js | sac_fly_double_play AB-charging bug (regression) |
| scoreless-dow-callouts.test.js | 21 | src/api/callout-notes.js | Scoreless/day-of-week/pitch-pace callouts |
| scores-unlocked.test.js | 20 | src/lib/scoresUnlocked.js | Scores Unlocked unlock timer + the 8am-anchored game day a consent records (ADR-0026) |
| season-score.test.js | 14 | scripts/gen-season-score.mjs, src/api/seasonScore.js, seasonScoreFormula.js | Season score / Marcel baseline / team-specific home-field factor |
| season-series.test.js | 7 | src/api/seasonSeries.js | Season series cells |
| skipped-bottom-half.test.js | 9 | src/api/select.js | selectSkippedBottomHalf, selectFinalHalfIndex |
| skipped-half-cells.test.js | 3 | src/api/boxscore.js, src/api/derive.js | A never-batted half prints X on the box score's line score and gets no by-inning row at all (the `runs` KEY, never its value) |
| slate-scores.test.js | 13 | src/api/schedule.js, src/lib/slateScoreLine.js | Slate score line normalization |
| spoiled-days.test.js | 21 | src/lib/spoiledDays.js | Spoiled-days consent persistence (ADR-0026) |
| spoiler-gates.test.js | 4 | select.js, enteringHalf.js | Caller-gated pre-pitch rule |
| spray.test.js | 43 | scripts/gen-spray.mjs, src/api/spray.js | The season spray map, both ends of the same stored row: the sweep's per-game fold and season merge, then the reader's split sums, spray-angle/direction math (the switch-hitter majority rule), the home-runs-without-a-landing-point footnote, and the two floors |
| stamp-ink.test.js | 11 | src/lib/stampInk.js, contrast.js | Logbook stamp ink — the winner's darkest brand colour + its contrast floor (ADR-0036) |
| stamps.test.js | 39 | src/lib/stamps.js | Logbook stamp rules — the reveal gate, tombstone sync merge, book placement (ADR-0035) |
| standings.test.js | 15 | src/api/standings.js | Standings shaping/ranks |
| stats-levels.test.js | 5 | src/api/statsLevels.js | sumHitting/sumPitching recomputed rates + combineToPool's raw split passthrough |
| statsapi.test.js | 4 | src/api/statsapi.js | Shared getJson fetch wrapper |
| steal-throwing-error-note.test.js | 3 | src/api/playbyplay.js (halfInningFeed, runnerNotes) | A steal/WP/balk that breaks on a plate appearance's last pitch carries no playEvent of its own — recovered from runners[] into its own leading card, with a same-play throwing-error leg folded in |
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

Last full audit: 2026-07-31 — all 89 files' imports resolved (87 since
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
- **A hook is exercised through one server render.** `callout-ledger.test.js` reads
  `useCalloutLedgerValue` by rendering a probe component with
  `react-dom/server`'s `renderToStaticMarkup`. That is the only React in the suite,
  and it stays node-only — no DOM, no browser, no timers. Prefer a pure module
  (`revealProgressCore.js` is the pattern) when a hook's logic can live in one; use
  the probe only when the value the hook returns IS the thing under test.
- **Prefer asserting the field(s) under test, not the whole object**, when adding new
  cases — `assert.equal(sig.performer.id, 2)` over
  `assert.deepStrictEqual(sig, entireExpectedObject)`. A failing assertion on a whole
  feed/derived object dumps its full diff into context; a narrow assertion fails with
  a one-line diff. Existing broad `deepStrictEqual` calls on small, already-minimal
  fixtures (e.g. `wpa-logo.test.js`) are fine as-is — this is guidance for new tests
  on large objects, not a mandate to rewrite passing assertions.
