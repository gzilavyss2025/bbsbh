# Ponytail audit — whole repo, 2026-11-04

Run on `origin/main` at `ee422f26`. Report only: no product code, tests or config changed.

**Method.** I ran `npm run knip` (raw output: `knip.txt`). It found 6 unused files, 263 unused
exports, 2 duplicate exports and 0 unused dependencies. Six subagents each audited one
area: src/api, src/components, src/screens, src/lib + src/hooks, scripts and api. I merged
their results, removed duplicates and dropped protected items. Then I read the code for the
largest findings.

- **checked** means I read the code and grepped for callers in `src api scripts test e2e`
  myself.
- **reported** means only a subagent checked it. The line estimate is the subagent's.
- **repeat** means `docs/audits/ponytail-2026-09-30.md` already listed it and it is still open.

**The ranking.** Section A comes first: cuts that touch no protected file and no staged
plan, biggest first. Section B follows, also biggest first: cuts that need Gary's call
because they delete or edit a test in `test/`, touch `spoiler-manifest.json`, or remove a
documented one-off or lab.

Format: `<tag> <what to cut>. <replacement>. [path] ~-N lines (status)`

## A. Safe cuts (no protected file touched)

1. delete: `BallFlight`'s `facts`/`arc`/`head`/`hover` options, which both callers set to `false` (`useGamedayStage.jsx:126`, `heroMarkup.js:144`). Also its hover-popover path, `FlightFacts`, the head block and the view toggle, all of `ElevationArc.jsx`, and the `.bflight__*` rules for them. Keep the sheet and the plan view. The side-view maths in `lib/ballpark/ballFlight.js` stays, because `test/elevation-arc.test.js` covers it. [src/components/charts/BallFlight.jsx:203-386, src/components/charts/ElevationArc.jsx] ~-360 (checked)
2. delete: the `HitChart` `variant="half"` branch: the dot-number overlay, the list block, the `isHalf` ternaries, `hardHitMph`, `NUMBER_OFFSET_X`, `RIGHT_EDGE`, `veloText` and `plotPercent`, plus `.hitchart--half`, `__dotnum*` and `__list*` in `69-hit-chart.css`. Nothing replaces it. Its only caller, `HitChartCard.jsx`, passes no variant, and the half-inning page was removed in #2747. [src/components/charts/HitChart.jsx] ~-180 (checked)
3. stdlib: `dirname(fileURLToPath(import.meta.url))` (103 sites) and `fileURLToPath(new URL('.', import.meta.url))` (26). Use `import.meta.dirname`. Also replace `import.meta.url === pathToFileURL(process.argv[1]).href` (21 files) with `import.meta.main`. Each change also drops `node:url` imports. `import.meta.main` needs Node ≥ 22.18; CI and `.nvmrc` say `22`, and the local version is 22.23. [scripts/**] ~-155 (checked counts)
4. delete: props that no caller passes. `GameCard.dateLabel`, `PostseasonBracket.autoOpen`, `BracketDock.onPresence`, `PitchList.pick` (the "at-bat replay" it names does not exist), `ScorecardSheet.templateInnings`, `StaffGrid.showDots`/`showKey`, `LevelNav.levels` and `levelnav--six`, `PitcherCard` `entering`/`after`, `TeamSearchBox.label`, and their CSS. Nothing replaces them. [src/components/{game,bracket,scoring,workload,…}] ~-95 (checked for the first six props; reported for the rest)
5. shrink: helpers copied across files. Give each one shared home:
   - `dayBefore` ×4 (`game.js:357`, `postseason/fetch.js:73`, `player/context.js:54`, `boxlines/rows.js:100`)
   - `ranked()` ×3 (`around-the-game/gate.js:63`, `absChallenges.js:63`, `doubleheaders.js:126`)
   - `num` ×5 (repeat)
   - `sum`/`clamp` in about 14 screen files
   - `median` ×4, `isoDay` ×5 and about 13 `round2`/`round3` in scripts
   - `rgbToHsl`/`hexToRgb` (`logoTint.js` and `logoMono.js`, byte-identical)
   - WCAG luminance ×2 (`contrast.js` and `design/contrastPairings.js`; keep `ratio` exported for `check-contrast.mjs`)
   - `dayAfter` = `shiftDays(d, 1)`

   [many] ~-150 (reported)
6. shrink: 13 hand-rolled recursive directory walks in the guards (`listSheets` ×6, `cssFiles`, `jsxFiles`, `sourceFiles` ×2, …). Use `lib/walk.mjs` or `readdirSync(dir, {recursive: true})`. The guards stay and only their insides shrink. [scripts/check-*.mjs] ~-90 (reported)
7. shrink: the screen-level wrappers.
   - The two `<LineupNextPage>` blocks in `GameView.jsx:313-373`: build them from one `side()` props builder.
   - `gameview/InningsHeader.jsx`, a one-caller 14-prop pass-through: inline it into `InningViewer`.
   - `ContenderDiaryPage`/`ResearchDiaryPage`: make them config objects.
   - The `lazy(() => import(x).then(m => ({default: m.X})))` shim, five times in `GameView.jsx` and in about 10 more files: share `lazyNamed` from `App.jsx` (repeat).

   [src/screens/…] ~-82 (reported)
8. stdlib: about 17 local `MONTHS` arrays and hand-built "Jul 3, 2019" / "Monday, October 5" formatters. Use `Intl.DateTimeFormat` / `toLocaleDateString('en-US', {…, timeZone:'UTC'})` or `monthDayName` from `lib/dates.js`. Examples: `LastTimeCard.jsx:40`, `ProspectsPage.jsx:22`, `slate/ladder.js:71`, `stampArt.js:318`, `heritage/pass.js:11` and `MoveRow.jsx:85-106`. `apDate.js` (AP style) stays. [many] ~-67 (reported, repeat)
9. shrink: the admin hash-store flow, written three times. `identity.js` and `contract-identity.js` are the same GET/PATCH. `copy.js` and `page.js` repeat the read and write halves. There are also one-line wrappers: `reply()` and `copyRedis`/`identityRedis`/`overridesRedis`. Use `readHash`/`writeHash` in `_lib/redis.js`, and call `jsonResponse`/`getRedis` directly. [api/identity.js, contract-identity.js, copy.js, page.js] ~-75 (reported; `reply()` is a repeat)
10. shrink: 14 generators chunk ids by hand around `/api/v1/people?personIds=`. Add `getPeople(ids, {hydrate})` to `scripts/lib/statsapi.mjs`. [gen-run-value:133, gen-rehab:87, gen-hof-pace:46, …] ~-60 (reported)
11. shrink: the two blob-upload endpoints share about 40 lines, and each hand-rolls `del` for `replaces` instead of calling `reclaimBlobs`. Extract `uploadImage()` into `_lib/blob.js`. [api/ballpark-photo.js:174-245, api/identity-logo.js:49-118] ~-52 (reported)
12. shrink: `sweepFouls` reimplements `runSweep`, and three hand-written worker pools re-do `mapConcurrent`. [scripts/lib/fouls/sweep.mjs, gen-postseason-leaders:326, gen-milb-alumni:121, lib/fouls/rebuild.mjs:67] ~-50 (reported)
13. stdlib: hand-rolled argv parsing: 4 local parsers and about 25 `argv.find(a => a.startsWith('--x='))` sites. Use `util.parseArgs({strict:false})` behind `scripts/lib/args.mjs`. [scripts/gen-*.mjs] ~-50 (reported)
14. yagni: guarded localStorage read/write pairs that `lib/account/localStore.js` exists to replace. Use `localStore(KEY, parse, serialize)`. [usePromptDismiss.js, useMilestoneCelebration.js, useRecentSearches.js, useScorecardNotes.js, mergeReceiptFlag.js, identity/hydrate.js] ~-45 (reported, repeat)
15. shrink: `lib/dates.js` repeats one regex-split-`new Date(y,m-1,d)` parse in about 8 formatters, and `monthDayShort` duplicates `monthDayName`. Use one private `localDate()` and one `fmt(opts)`. [src/lib/dates.js:101-165] ~-43 (reported, repeat)
16. shrink: three Savant CSV fetchers do the same thing, and `lib/savant.mjs:97` defines a second `withRetry` with a different signature from `lib/net/retry.mjs`. Use `fetchSavantCsv` and build on `net/retry.mjs`. [scripts/lib/savant.mjs, gen-run-value.mjs:72] ~-40 (reported)
17. shrink: small api cuts, about 70 lines in all.
    - `firstNonNull`: use `Promise.any` (repeat).
    - `esc()` ×2: `preview.js` and `_lib/crawl.js`.
    - The SPA shell fetch and memo ×2: `page.js` and `preview.js`.
    - `overRevealLimit` and `overMintLimit`: one `overLimit()`.
    - `MLB_SLUG`, 30 lines, one entry per line.
    - `new Response(JSON.stringify…)`: use `Response.json`.
    - The lazy `import('@vercel/blob')` guards, though it is a hard dependency.

    [api/**] ~-70 (reported)
18. delete: `useIntroFlag.js`. It has zero importers, according to both knip and grep. [src/hooks/preferences/useIntroFlag.js] ~-32 (checked). The rest of the intro chain is B3.
19. yagni: the per-user handler preamble (method guard, Redis 501, `authenticateUser`, 4xx) copied into 5 functions. Use `withUser(methods, fn)` in `_lib/auth.js`. [api/account.js:160, books.js:221, preferences.js:145, reveal.js:170, stamps.js:498] ~-28 (reported). The reveal ratchet itself is untouched.
20. delete: 28 re-exports that nobody imports through their facade: 16 in `person.js`, 10 in `callout-notes.js` and 2 in `playbyplay.js`. Nothing replaces them, and the facades stay. [src/api/person.js, callout-notes.js, playbyplay.js] ~-28 (reported)
21. yagni: three admin save helpers that differ only in URL, method and messages. Use one `adminFetch()`. [src/lib/admin/save{Copy,Identity,ContractIdentity}Patch.js] ~-25 (reported, repeat)
22. delete: `export default GamePreview` and `export default ScoreSheetPage`, the duplicate exports knip flagged. `GameView` uses the named exports. [src/screens/GamePreview.jsx:219, sheet/ScoreSheetPage.jsx:77] ~-4 (knip, reported)
23. delete: the `export` keyword on about 250 symbols that only their own file uses (the rest of knip's list). This is 0 lines and only a narrower API. Do it as one mechanical commit, or skip it. [see knip.txt] ~-0 (reported)

## B. Ask Gary (touches a protected file, a staged plan or a documented keep)

1. delete: the What's Brewing PDF parser and its QA page: `src/api/whatsBrewing.js` (1,596), `whatsBrewingClubs.js` (57), `components/game/WhatsBrewingModal.jsx` (89) and `screens/GameNotesDebugPage.jsx` (136). Also remove its route and its two `spoiler-manifest.json` entries. Nothing replaces it: every game surface already links straight to the PDF, and its own header calls it a "calibration sandbox, reachable only from the unlisted /game-notes-debug QA page". **Needs:** a decision on `scripts/scan-game-notes-insights.mjs` and `test/game-notes-regressions.test.js`, which import `extractForTeam`. `pdfjs-dist` stays, possibly as a dev dependency. [src/api/whatsBrewing.js] ~-1,880 (checked)
2. delete: the src/api exports that only tests call. Each has 0 importers in `src api scripts e2e` and no same-file caller:
   - `pitchers.js` handoff helpers (`pitcherLineAt`, `isLastHalfOfGame`, `halfClosingPitcher`, `handoffsResolvingAt`, `pitcherHandoffs`, `resolveHandoffRunners`, `HANDOFF_BASE_NUM`, lines 32 and 197-382), ~185
   - `expresslane/clipIndex.js` tail (`clipPosterUrl`, `buildClipIndex`, `entryFor`, `durationFor`, the IndexedDB `loadClipIndex`/`saveClipIndex`, lines ~136-321), ~185. `parseSportyVideoHtml` and `resolveClipUrl` stay.
   - `hitterForm.js` `hitterFormView` and `hitterFormWindows` with their constants, ~150
   - `spray.js` (`directionCaption`, `directionMix`, `splitBalls`, `hrNote`, `sprayScopeOf`, `sprayParks`, `parkSubview`), ~125
   - `person/contract/history.js` `contractHistoryView` with its private `collapseSeasons`/`namesTheSeason`/`SEASONS_VISIBLE`, ~100

   **Needs:** deleting the matching tests (`pitcher-handoff`, `express-lane-clip-index`, `hitter-form`, `hitter-form-window`, `spray`, `spray-parks`, `contract-history-ledger`). `scripts/check-dead-exports.mjs` counts a test import as a use, which is why these never tripped lint. [src/api/…] ~-745 (checked)
3. delete: the dead first-visit intro chain. `FavoriteTeamModal.jsx` (216), `AccountPitch.jsx` (140) and `IntroPassportMark.jsx` (24) have no importers; only comments name them. Also delete `styles/56-my-tally-intro.css` (204) with its `@import` at `index.css:210`, and the `.favteamsheet*` rules in `08-site-shell.css:594+` (about 60). Possibly also `lib/account/intro.js` (79), which is kept only for `markIntroSeenIn` in `EraseDataDialog.jsx:109`. Root CLAUDE.md already says the welcome modal is gone. **Needs:** removing the `introsheet__*` rows in `test/stack.test.js:151-152` and `test/card-cascade.test.js`, and the stale `e2e/intro-two-step.spec.js` (133). [src/components/account/] ~-644, ~-723 with intro.js (checked)
4. delete: the Design Lab's Matchup Scout prototype (`designlab/scout/ScoutLab.jsx`, `HeadToHead.jsx`, `fixture.js` and `model.js`, 546 lines) and its PROTOTYPES entry in `catalog.js:342-349` and `index.jsx:14,164`. Nothing replaces it: `catalog.js:339-341` says it "leaves when the real page ships", and `/scout` shipped (ADR-0118). Its CSS already moved to `styles/scout/scout.css`. **Needs:** editing `test/scout-design.test.js` and `test/empty-state-e8.test.js:29`. [src/screens/designlab/scout/] ~-560 (checked)
5. delete: `scripts/migrate-contract-row-keys.mjs`, the one-off ADR-0070 migration. Nothing replaces it. The 2026-09-30 audit said to delete it "if the migration ran", and I cannot see from the repo whether it did. [scripts/migrate-contract-row-keys.mjs] ~-392 (checked, repeat)
6. delete: `src/api/expresslane/rail.js`. No screen imports it since Gameday replaced Express Lane (#2566). It stays only because `test/express-lane-runners.test.js` drives `expressDeck` through it. **Needs:** a `spoiler-manifest.json` edit and moving those runner tests onto their own fixture rows. [src/api/expresslane/rail.js] ~-279 (checked)
7. shrink: incident-history comment blocks in `api/_lib/redis.js` (about 85 of 112 lines), `auth.js` (about 125 of 173) and `nodeHandler.js` (about 45). Move them to an ADR and keep a 3-line header. Docs only. [api/_lib/] ~-200 comment lines (reported)
8. delete: `scripts/gen-og-image.mjs` (56) and `scripts/og-image.html` (119). Nothing replaces them: `docs/scripts/generators.md:2273` says "NOT currently used … kept in case we go back to it", and no npm script or workflow runs them. [scripts/gen-og-image.mjs] ~-175 (checked)
9. delete: `components/transactions/TxStory.jsx` (81) and its `.txstory*` CSS (about 90). Nothing renders it; the club page uses `MoveItems`. **Needs:** the row at `test/card-cascade.test.js:551`. `transactions/CLAUDE.md:43` and two e2e specs still mention it, and they are stale. [src/components/transactions/TxStory.jsx] ~-170 (checked)
10. delete: `scripts/season-marks/fetch.mjs` (163) and its seed. `docs/identity-lab.md:90` calls it a one-time bootstrap. [scripts/season-marks/fetch.mjs] ~-163 (reported)
11. delete: `components/scoring/PitchLadder.jsx`, the `WriteOnDemo` in `animlab/motionDemos.jsx:150` and `.pbp__ladder*` CSS. It is now only an animation-lab demo of a deleted feed. [src/components/scoring/PitchLadder.jsx] ~-140 (reported)
12. delete: `screens/team/modules/RosterList.jsx` (40, unused file per knip) and its `.thub-roster`/`.thub-row`/`.thub-jersey` CSS (about 65; check `.thub-name*` first). **Needs:** the source-text test at `test/team-next-cleanup.test.js:33-38`. [src/screens/team/modules/RosterList.jsx] ~-105 (checked)
13. yagni: the player page's `tbd` module. It is a multi-card host that returns one card, and 4 of its 5 SLOTS render nothing. Use one `command-received` slot. **Needs:** `test/player-next-tbd.test.js` and `BUILT` in `player-next-sections.test.js`. [src/screens/player/next/modules/tbd/] ~-75 (reported)
14. delete: `ui/frame/ResultCard.jsx`. Only the design-lab catalog renders it, and it is a design-system catalog part. [src/components/ui/frame/ResultCard.jsx] ~-65 (reported)
15. delete: `cachedGetJson` and the `cacheDir` branch of `createStatsapiClient`. Only `.scratch` spikes and its tests use them. [scripts/lib/statsapi.mjs:~125-162] ~-40 (reported)
16. delete: `reviewsAtStep` (test-only) and further test-only exports in about 14 src/api files. One of them is `derive.js`'s `rollingPitches`/`rollingMissedCalls`; that file is reveal-only, so delete the dead functions only and keep the file. [src/api/gameday/reviews.js:112-150, pitchArsenal.js, comebackWins.js, …] ~-180 (reported)
17. yagni: the Web-shape branches in `_lib/nodeHandler.js`. All 12 node functions take the Node shape. **Needs:** edits to `test/node-handler.test.js`. [api/_lib/nodeHandler.js:36-140] ~-35 (reported, repeat)
18. delete: `lib/motion/playOnce.js` and the test-only `passPage`, `drawCol`, `resetSiloMisses`, `allBallparkLayouts` and `fenceProblems`. [src/lib/…] ~-39 (reported)
19. yagni: the re-export stubs `player/next/modules/{contact,form,firsts}/index.jsx`. Point `sections.js` at the components. Note this bends the module-folder contract. [src/screens/player/next/modules/] ~-8 (reported)
20. yagni: `stepWords = (_pitch) => 'Next'`. Inline `'Next'`. Needs a one-line test edit. [src/screens/gameday/next/steps/subStep.js:31-33] ~-4 (reported)
21. native: DEV-gate `/animation-lab`, `/design-lab` and `/wire-lab` as identity-lab is. That takes about 5.3K lines out of the production bundle, but 0 source lines. e2e tests and CLAUDE.md point at `/design-lab`. [src/App.jsx:242-244, 329-332] ~-0 (reported)
22. native: replace `@clerk/backend` (`verifyToken` only) with a JWKS fetch and `crypto.subtle.verify`. That is -1 dependency. **Not recommended:** the code is auth-critical, and it has a history of silent failures. [api/_lib/auth.js:22] ~0 (reported)

## Left alone on purpose (staged for open work)

- `src/api/gameday/moments/moments.js` (187, test-only). The header names #2608, and gzilavyss2025/bbsbh#2574 (ready-for-human) is the feature that will read it.
- `src/api/history/{franchiseHof,franchiseLeaders,franchiseSummary,retiredNumbers}.js` and `playedForBoth`. They are on `check-dead-exports` ALLOWLIST as staged for the franchise page (gzilavyss2025/bbsbh#2586; U2–U4 are open as #2784–#2788).
- The three facade barrels `person.js`, `callout-notes.js` and `playbyplay.js` stay. The nested CLAUDE.md files send readers to them. A20 trims only their unused names.
- `account.js`'s `spoiled:{u}` legacy erase. Removing it would leave stale data behind.
- All guards, generators and tests are protected. Splits made for the size caps are protected too. The spoiler-rule structure was never proposed for a cut.

## Found (out of scope; not chased)

- `api/cron/nightly-dispatch.js:15` compares the bearer token with `!==`. That comparison is not timing-safe; `crypto.timingSafeEqual` is (security, reported).
- `api/game-story.js` has its own `getJson` with no timeout. `scripts/gen-savant-percentiles.mjs:80,147` fetch Savant with no retry (reported).
- `scripts/lib/savant.mjs` `withRetry` and `lib/net/retry.mjs` `withRetry` share a name but take different signatures, so the wrong one is easy to import.
- `scripts/check-dead-exports.mjs` counts a test import as a use. That is how about 1,000 lines of test-only src/api code (B2, B16) built up without failing lint. Consider counting only non-test importers.
- Stale e2e: `e2e/intro-two-step.spec.js` tests a modal that no longer renders, and `e2e/club-transactions.spec.js` and `e2e/transaction-rail.spec.js` query `.txstory`.
- Stale docs:
  - `src/components/transactions/CLAUDE.md:43` ("A club's card is TxStory")
  - `src/api/expresslane/CLAUDE.md` and the `clipIndex.js` header (the deleted staging queue)
  - `docs/development.md:123` (the intro modal)
  - `lineup/parts.jsx` and `player/parts.jsx` (they name pages that no longer exist)
  - `designlab` lede text (hardcoded counts)
- `war.json`'s `wrc`/`fld` maps: `war.js` says nothing reads them, but the nightly generator still writes them.
- `src/components/inning/focus/FocusControls.jsx` exports only a hook, `useFocusMode`.

## Totals

- **Section A (safe):** about -1,780 lines.
- **Section B (needs Gary):** about -5,980 lines, of which about 200 are comments.
- **Dependencies:** knip finds 0 unused. `pdfjs-dist` could move to devDependencies if B1 lands, because a script still uses it. `@clerk/backend` could go only through B22, which is not recommended.

net: -7,760 lines, -0 deps possible.

## Issues opened (top 10 checked findings, label `needs-triage`)

No open issue duplicated any of them; gzilavyss2025/bbsbh#1817 (the 2026-10-08 audit) covers different items.

| Report item | Issue |
| --- | --- |
| A1 BallFlight options + ElevationArc | https://github.com/gzilavyss2025/bbsbh/issues/2833 |
| A2 HitChart `variant="half"` | https://github.com/gzilavyss2025/bbsbh/issues/2834 |
| A3 `import.meta.dirname` / `import.meta.main` | https://github.com/gzilavyss2025/bbsbh/issues/2835 |
| A4 props no caller passes | https://github.com/gzilavyss2025/bbsbh/issues/2836 |
| B1 What's Brewing | https://github.com/gzilavyss2025/bbsbh/issues/2837 |
| B2 src/api test-only exports | https://github.com/gzilavyss2025/bbsbh/issues/2838 |
| B3 + A18 intro chain | https://github.com/gzilavyss2025/bbsbh/issues/2839 |
| B4 Design Lab scout prototype | https://github.com/gzilavyss2025/bbsbh/issues/2840 |
| B5 migrate-contract-row-keys | https://github.com/gzilavyss2025/bbsbh/issues/2841 |
| B6 expresslane/rail.js | https://github.com/gzilavyss2025/bbsbh/issues/2842 |
