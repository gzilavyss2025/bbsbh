# Run plan: player-redesign MODULE issues (checked against origin/main 5f65b939a, 2026-10-13)

Source facts: the module contract (`src/screens/player/next/CLAUDE.md`), `sections.js`, the issues
and their latest comments, and the data plan (`next-run-plan-v2.md`, rows "D1" to "D22").
Open PRs on 2026-10-13: only #1934 (font weights: `src/tokens/fonts.css`, `src/tokens/typography.css`,
`src/styles/09-team-info.css`, `src/screens/designlab/tokens.jsx`). No module row edits those files.

Gary's decisions (2026-10-13), written into the prompts as facts:
- #1896 scope: Similar players (#1926), Prospect rankings (#1927), Innings by position (#1928) and
  Contract (#1929) are built from their boards. Percentile rank, Advanced and Run value go in **Season**,
  under the Season statistics card, as plain stamped cards with today's content. Hits like (the
  `similar` slot) and Milestone watch sit at the end of **Game log**. No new jump-bar button.
- #1929: `CareerEarnings` is the Contract card's "Salary history" part, not its own card.
- #1930: rolling ERA; starter window 3/5/10 starts (default 5); reliever window 10/15/20 IP (default
  15), role from `pitcherRole`; a K% toggle; K% and BB% in the stretches table; postseason in; no
  bottom marks; velocity later (#1933).
- #1851: the start detail is open (ADR-0034); a start still in progress today shows no score and no
  decision. Keep the name "Game Log". Its ADR takes the next free number: **ADR-0110** (0109 is the
  last on origin/main).

## Run plan

"D<n>" is a row of the data plan. "merged" means that PR is on `main`.

| # | What | Model | Effort | Depends on | Parallel with |
|---|---|---|---|---|---|
| M0 | #1930 data slice: `pitcherRollingSeries` (prompt is data plan row D20, not repeated here) | Sonnet 5.5 | medium | D2 merged | all |
| M1 | Page: add the `tbd` slots Overview, On the mound and Game log need (part of #1896) | Sonnet 5.5 | medium | none | M2-M6, all later rows |
| M2 | #1926 Similar players (Hits like / Pitches like) | Sonnet 5.5 | high | none | M1, M3-M6 |
| M3 | #1927 Prospect rankings | Sonnet 5.5 | medium | none | M1, M2, M4-M6 |
| M4 | #1928 Innings by position | Sonnet 5.5 | high | none | M1-M3, M5, M6 |
| M5 | #1929 Contract (+ Salary history) | Sonnet 5.5 | high | none | M1-M4, M6 |
| M6 | #1896 part a: today's cards in Season, Career and History | Sonnet 5.5 | medium | none | M1-M5 (not M7) |
| M7 | #1896 part b: today's cards in Overview, On the mound and Game log | Sonnet 5.5 | medium | M1 and M6 merged | M8-M11 |
| M8 | #1895 Firsts | Sonnet 5.5 | medium | D1 (#1918) merged | M7, M9-M11 |
| M9 | #1893 On the mound | Sonnet 5.5 | high | D3 (#1916) merged | M7, M8, M10, M11 |
| M10 | #1885 Season statistics | Sonnet 5.5 | high | D4 (#1909) merged | M7-M9, M11 |
| M11 | #1889 Form trend (batter); builds the shared form chart | Sonnet 5.5 | high | D2 (#1913) merged | M7-M10 |
| M12 | #1930 module: pitcher Form trend | Sonnet 5.5 | high | M0 (D20) and M11 merged | M13-M21 |
| M13 | #1894 Path to the Majors | Sonnet 5.5 | medium | D9 (#1917) merged | M12, M14-M21 |
| M14 | #1886 Splits | Sonnet 5.5 | high | D13 (#1910) merged | M12, M13, M15-M21 |
| M15 | #1851 part a: ADR-0110, CONTEXT.md, start selectors, pitcher Game log; builds the shared log table | Opus 5.5 | high | D8 and D17 (#1915) merged | M12-M14, M18-M21 |
| M16 | #1851 part b: start detail view + "Load earlier season" | Sonnet 5.5 | high | M15 merged | M17-M22 |
| M17 | #1890 Batter game log (uses M15's log table) | Sonnet 5.5 | medium | M15 and D16 (#1914) merged | M16, M18-M22 |
| M18 | #1891 Foul balls | Sonnet 5.5 | high | D16 (#1881) merged | M12-M17, M19-M22 |
| M19 | #1892 Pitch arsenal + Pitch flight | Sonnet 5.5 | xhigh | D5 and D17 (#1908) merged | M12-M18, M20-M22 |
| M20 | #1888 Contact | Sonnet 5.5 | high | D19 (#1912) merged | M12-M19, M21, M22 |
| M21 | #1887 Plate approach | Sonnet 5.5 | high | D18 (#1911) merged | M12-M20, M22 |
| M22 | #1933 card part: the velocity view in the pitcher Form trend | Sonnet 5.5 | medium | M12 and D22 merged | M16-M21 |

Waves (a row starts when its "depends on" is on main):
- **Wave 1, now:** M1-M6 (no data issue). M0 joins as soon as D2 merges.
- **Wave 2:** M7, M8, M9, M10, M11 (after data wave 1: D1-D4, D2).
- **Wave 3:** M12-M15, M18-M21, as each data row and its backfill merge.
- **Wave 4:** M16, M17, M22.

Model picks, one line each:
- M1, M6, M7: a known pattern (one slot entry, or today's card in a plain stamped card): rung 3.
- M3, M8, M13: small boards on data that exists, one view helper each: rung 3.
- M17: copies M15's table with batter columns: rung 3.
- M22: one more chart choice on a built card: rung 3.
- M2, M4, M5, M9, M10, M11, M12, M14, M18, M20, M21: "build a card from a settled direction" (the design table): rung 4.
- M16: a modal with a focus trap, clip matching to plays, and a season loader: rung 4.
- M19: the flight curve is the hardest card on the canvas (canvas notes): rung 5. Drop to high if M19's arsenal half lands alone.
- M15: an ADR that records a spoiler guard (no score or decision for a start in progress) plus selectors: a spoiler-rule change never goes below rung 7.

## Overlap note

Module folders are independent by design. These are the shared parts to watch:

1. **The log table (M15 -> M17).** #1890 says "match the pitcher module". M15 builds a column-driven
   `modules/pitchlog/LogTable.jsx` (rows + a column list; table at 960 px container width or more, one
   card per game below). M17 imports it from `../pitchlog/` with batter columns and never edits a
   `pitchlog/` file. M16 also edits `pitchlog/`; it must keep `LogTable`'s props. If it must change
   them, M17 rebases on M16.
2. **The form chart (M11 -> M12 -> M22).** M11 builds `modules/form/FormChart.jsx` and
   `StretchTable.jsx` with a `better: 'up' | 'down'` prop and a value formatter, because #1930 is a
   known second user (lower ERA is better). M12 imports them and never edits `form/`. M22 edits only
   `pform/`.
3. **The `tbd` folder (M6 -> M7).** One folder, one `index.jsx` that switches on `section`. Serial.
4. **`sections.js` (M1 only).** M1 is the one page row. It adds slots; no module edits the file.
5. **CSS.** `src/styles/player-next/` holds `page.css`; 18 module sheets would pass the 12-file cap
   (`check-dir-size.mjs`, `MAX_FILES`). And the guards (raw values, contrast, typography, caps) scan
   only `src/styles/`, so a sheet in a module folder escapes them. So each module puts its sheet in
   one sub-folder: `batter/` (plate, contact, form, fouls, batlog), `pitcher/` (arsenal, mound,
   pitchlog, pform), `both/` (season, splits, similar, path, prospects, firsts, innings, contract, tbd,
   plus the shared `logtable.css` and `formchart.css`: 11 files). New files only, so no conflict.
6. **Tokens.** No module adds a token (`src/tokens/` is shared). A missing token is a stop-and-report.
7. **`src/api/` is at its budget (115/115, `check-dir-size.mjs:598`).** No module adds a file there.
   Data hooks live in the module folder. The #1930 comment says `src/api/pitcherForm.js`; that path
   fails the guard, so D20 uses `src/api/player/pitcherForm.js` (11/12).
8. **Request count.** No fetch cache exists (`getJson` has none). Four History modules (M4, M5, M6,
   M8) and two Season modules (M6, M10) would each run a whole tab loader if they call
   `loadPlayerHistory` or `loadPlayerStats`. Each prompt says: call the narrowest fetcher, and put
   the slot's request count in the PR.
9. **#1930's "no extra request" claim.** A module gets `{ bio, role, asOf, season, ... }`, not the
   overview's game-log splits, so M12 makes one game-log call when its slot comes near.
10. **ADR and CONTEXT.md (M15 only).** If ADR-0110 is taken on `main` when M15 starts, it uses the
    next free number and says so.

---

## Prompt M1 — Sonnet 5.5, effort medium

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, src/CLAUDE.md, src/screens/player/next/CLAUDE.md and docs/player-redesign.md. Use the branch the session gives you, cut from current origin/main. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: a page change for issue #1896 (not a module). Gary decided (2026-10-13, #1896 comment) where today's cards go. Three places have no `tbd` slot yet. This PR adds them, so the tbd module can fill them later. It does not build any card.

Facts (origin/main):
- SLOTS in src/screens/player/next/sections.js puts `tbd` in Season, Career and History only.
- PlayerNextPage.jsx renders the Overview (hero + tiles) itself and maps slots only for the other sections (`s.key !== 'overview'`).
- The boards (TbdWire groups): "top" and overview extras sit in Overview, under the tiles (status banners, header extras/OVR, league-rank chips, postseason row, other-level rows). The pitcher "role" group (Command, Target command) sits after On the mound. The "more" group (Milestone watch; a pitcher's Foul balls) sits at the end of Game log, after Similar players.

Steps (test first: add the cases to test/player-next-sections.test.js, see them fail, then write the code):
1. Add three SLOTS entries for the tbd module: `tbd-overview` (section overview, HP, label "More overview"), `tbd-mound` (section on-the-mound, P, "More on the mound") after `mound`, and `tbd-gamelog` (section game-log, HP, "More game log") after `similar`.
2. In PlayerNextPage.jsx, render the Overview section's slots under the tiles, inside the `#overview` Stack, with the same Slot and the same hide rule.
3. Update the slot list in src/screens/player/next/CLAUDE.md.

Done means: the new slots show the tbd stub line on /player/668930?look=new&nointro (Turang) and /player/688107?look=new&nointro (Gasser); the Overview button never hides; npm run lint, npm test and npm run build pass. Render both at 390 px in Chromium and send Gary the screenshots with the routes.
Stop if: a guard fails on a budget (do not raise it).

Handoff: open a draft PR. Body in ASD-STE100 style, with "Part of #1896". Remove `wip` when CI is green. Never merge.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt M2 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, src/CLAUDE.md, src/screens/player/next/CLAUDE.md (the module contract) and docs/player-redesign.md. Use the branch the session gives you, cut from current origin/main. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1926, the Similar players module ("Hits like" for a batter, "Pitches like" for a pitcher). Read the issue. Gary decided (2026-10-13): build the board, not today's card; the slot sits at the end of Game log, with no button of its own.

Board: read it with the Artifact tool (action "read", url https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK, path "project/SimilarPlayers.dc.html"). Copy its layout. Its numbers are samples; show the store's numbers.

Reuse (origin/main): similarHittersFor (src/api/savantPercentiles.js:64), similarPitchersFor (src/api/pitchArsenal.js:357), SimilarHitters (src/components/playercard/SimilarHitters.jsx:46), SimilarPitchers (SimilarPitchers.jsx:34), SimilarPlayerGrid (SimilarPlayerGrid.jsx:66). Today's card: PlayerAnalyticsTab.jsx:337 and :399.

Contract: build only in src/screens/player/next/modules/similar/ and src/styles/player-next/both/similar.css (imported from index.jsx). Never edit sections.js, Slot.jsx or the page. Props { bio, role, asOf, season, section, onEmpty, onCount }. Reserve the card's height while it loads. No data: onEmpty(). Tokens and the shared parts only (src/components/ui/frame/), no raw hex, no new token, no new file in src/api/ (115/115). Keep ?d= and ?s= on links (path builders).

Steps:
1. Check every board number against its source first (docs/player-redesign-data.md has no section for this board). Turang 668930's five dots must read exit velo 71, hard-hit 54, barrel 48, chase 80, sprint 81 (savant-percentiles.json). If a board number has no source, stop and say which.
2. Test first: put the pure view (rows, dot positions, the pitcher Usage/Velocity switch) in modules/similar/similarView.js; test it in test/player-next-similar.test.js; see it fail, then write the code.
3. Build the card. A batter gets Hits like, a pitcher Pitches like, a two-way player both.

Done means: npm run lint, npm test and npm run build pass. Render /player/{id}?look=new&nointro at 390 and 1180 px in Chromium for Turang 668930, Gasser 688107 and Ohtani 660271; send Gary the screenshots with the route and player id. Put the slot's request count (cold load, npm run build + npm run preview) in the PR.
Stop if: a number has no source, or the module needs a file outside its folder and its CSS file.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Closes #1926". Remove `wip` when CI is green. Never merge.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt M3 — Sonnet 5.5, effort medium

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, src/CLAUDE.md, src/screens/player/next/CLAUDE.md (the module contract) and docs/player-redesign.md. Use the branch the session gives you, cut from current origin/main. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1927, the Prospect rankings module, in the Career section beside Path to the Majors. Read the issue. Gary decided (2026-10-13): build the board, not today's card. A player with no ranking on file gets no card.

Board: read it with the Artifact tool (action "read", url https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK, path "project/ProspectRankings.dc.html"). Copy its layout: a bar per year, the change from the last list (+/−), and a dark "Debuted" row. Its numbers are samples.

Reuse (origin/main): ProspectRankHistoryCard (src/components/player/ProspectRankHistoryCard.jsx:28), src/api/prospects.js and public/data/top-prospects.json, fetchProspectTrend (src/api/prospectTrend.js:70).

Contract: build only in src/screens/player/next/modules/prospects/ and src/styles/player-next/both/prospects.css (imported from index.jsx). Never edit sections.js, Slot.jsx or the page. Props { bio, role, asOf, season, section, onEmpty, onCount }. Reserve the card's height while it loads. No ranking: onEmpty(). Tokens and the shared parts only, no raw hex, no new token, no new file in src/api/ (115/115). Keep ?d= and ?s= on links.

Steps:
1. Check each board number against the store first. Turang 668930: one list, #95 in 2021, debuted 2023.
2. Test first: the pure view (years, ranks, deltas, the Debuted row) in modules/prospects/prospectsView.js; test it in test/player-next-prospects.test.js; see it fail, then write the code.
3. Build the card. A two-way player gets one card, not two (the list is per player): render it for the hitting instance only, and call onEmpty() on the pitching one.

Done means: npm run lint, npm test and npm run build pass. Render /player/{id}?look=new&nointro at 390 and 1180 px in Chromium for Jesús Made 815908 and Turang 668930, and show that Gasser 688107 has no card; send Gary the screenshots with the route and player id.
Stop if: a board number has no source in the store.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Closes #1927". Remove `wip` when CI is green. Never merge.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt M4 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, src/CLAUDE.md, src/screens/player/next/CLAUDE.md (the module contract) and docs/player-redesign.md. Use the branch the session gives you, cut from current origin/main. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1928, the Innings by position module, in the History section. Read the issue. Gary decided (2026-10-13): build the board, not today's card.

Board: read it with the Artifact tool (action "read", url https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK, path "project/InningsByPosition.dc.html"). Copy its layout: rings on a park drawing (ring = share of innings) and a Season / Career switch. Its numbers are samples.

Reuse (origin/main): PositionInnings (src/components/player/PositionInnings.jsx:44) and its scope loader (PositionInningsCard and loadPositionScope, used at src/screens/player/PlayerHistoryTab.jsx:163-190). Call the narrowest fetcher, not the whole loadPlayerHistory (src/api/player/history.js:71); there is no fetch cache, and three other History modules load beside this one.

Contract: build only in src/screens/player/next/modules/innings/ and src/styles/player-next/both/innings.css (imported from index.jsx). Never edit sections.js, Slot.jsx or the page. Props { bio, role, asOf, season, section, onEmpty, onCount }. Reserve the card's height while it loads. No data: onEmpty(). Tokens and the shared parts only, no raw hex, no new token, no new file in src/api/ (115/115). Pass asOf to every loader.

Steps:
1. Check the board's numbers against today's source first. Turang 668930 2026: 2B 1311.2 innings in 151 G, SS 12.0 in 4.
2. Test first: the pure view (share per position, ring sizes, scope switch) in modules/innings/inningsView.js; test it in test/player-next-innings.test.js; see it fail, then write the code.
3. Build the card. A two-way player gets one card (render it for the hitting instance; onEmpty() on the pitching one), unless the board draws a pitcher version.

Done means: npm run lint, npm test and npm run build pass. Render /player/{id}?look=new&nointro at 390 and 1180 px in Chromium for Turang 668930, Ohtani 660271 and Gasser 688107; send Gary the screenshots with the route and player id. Put the slot's request count (production build, cold load) in the PR.
Stop if: a board number has no source.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Closes #1928". Remove `wip` when CI is green. Never merge.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt M5 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, src/CLAUDE.md, src/screens/player/next/CLAUDE.md (the module contract), docs/player-redesign.md and ADR-0052 (money pages are open). Use the branch the session gives you, cut from current origin/main. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1929, the Contract module, in the History section. Read the issue and its comment. Gary decided (2026-10-13): build the board, not today's card; the CareerEarnings board becomes the card's "Salary history" part, not its own card. The Money band decision from #928 holds.

Boards: read with the Artifact tool (action "read", url https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK), paths "project/Contract.dc.html" and "project/CareerEarnings.dc.html". Copy the colour strip (club sets pay, arbitration, signed, option, free agency) and the salary bars by year with a career total and 2020 flagged. Board numbers are samples.

Reuse (origin/main): PlayerContractCard (src/components/playerstats/PlayerContractCard.jsx:158), fetchPlayerContract (src/api/person/contracts.js:13), ContractHistoryLedger (src/components/player/ContractHistoryLedger.jsx:35), fetchPlayerContractHistory (src/api/contractsHistory.js:130).

Contract: build only in src/screens/player/next/modules/contract/ and src/styles/player-next/both/contract.css (imported from index.jsx). Never edit sections.js, Slot.jsx or the page. Props { bio, role, asOf, season, section, onEmpty, onCount }. Reserve the card's height while it loads. No data: onEmpty(). Tokens only, no raw hex, no new token, no new file in src/api/ (115/115). Today's page skips the contract fetch when asOf is set (overview.js:62); keep that rule.

Steps:
1. Check each number first. Turang 668930: 2027 Arb 2, $11.75M, 6th of 19 second basemen.
2. Test first: the pure view (strip segments by year, salary bars, career total, the 2020 flag) in modules/contract/contractView.js; test it in test/player-next-contract.test.js; see it fail, then write the code.
3. Build the card. A two-way player gets one card (hitting instance; onEmpty() on the pitching one).

Done means: npm run lint, npm test and npm run build pass. Render /player/{id}?look=new&nointro at 390 and 1180 px in Chromium for Turang 668930, Gasser 688107 and Ohtani 660271; send Gary the screenshots with the route and player id.
Stop if: a board number has no source.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Closes #1929". Remove `wip` when CI is green. Never merge.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt M6 — Sonnet 5.5, effort medium

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, src/CLAUDE.md, src/screens/player/next/CLAUDE.md (the module contract) and docs/player-redesign.md. Use the branch the session gives you, cut from current origin/main. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1896, part a: today's cards, unchanged, in a plain stamped card, in the tbd slots of Season, Career and History. No new design. Part b (Overview, On the mound, Game log) is a later prompt. Read the issue and its 2026-10-13 comment. Gary decided: Percentile rank, Advanced and Run value go in Season, under Season statistics. Similar players, Prospect rankings, Innings by position and Contract are NOT here (#1926-#1929).

Board: TbdWire (Artifact tool, action "read", url https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK, path "project/TbdWire.dc.html"), groups "season", "career", "history1", "history2", "history3". It shows only what goes where.

What goes where, and today's card (origin/main):
- Season: StatcastPercentiles (src/components/charts/StatcastPercentiles.jsx:29), AdvancedStatsCard (src/components/player/AdvancedStatsCard.jsx:25), RunValueCard (src/components/playerstats/RunValueCard.jsx:36). Live use: PlayerAnalyticsTab.jsx:215-231.
- Career: whatever TbdWire "career" still holds after #1927 left; if nothing, this slot calls onEmpty().
- History: AwardsLedger (src/components/player/AwardsLedger.jsx:42), CareerTimeline "Team history" (CareerTimeline.jsx:47), TransactionTimeline (src/components/transactions/TransactionTimeline.jsx:65), PlayerPhotosRail and PlayerHighlightsRail (src/components/player/). Live use: PlayerHistoryTab.jsx:89-156, PlayerPage.jsx:364-418.

Contract: build only in src/screens/player/next/modules/tbd/ and src/styles/player-next/both/tbd.css. index.jsx switches on the `section` prop. Never edit sections.js, Slot.jsx or the page. Each card inside hides alone when it has no data; the slot calls onEmpty() when all of them do. Reserve height. No new token, no new file in src/api/ (115/115). Call the narrowest fetchers, not a whole tab loader.

Steps (test first: the pure "which cards for this section and role" helper in modules/tbd/tbdView.js, tested in test/player-next-tbd.test.js; see it fail, then write the code):
1. The helper, then the three sections.
2. Check Turang 668930 Run value: +38.5 runs (bat 23.9, field 14.1, run 0.5).

Done means: npm run lint, npm test and npm run build pass. Render /player/{id}?look=new&nointro at 390 and 1180 px in Chromium for Turang 668930, Gasser 688107 and Ohtani 660271; send Gary the screenshots. Put the request count of the three slots (production build, cold load) in the PR.
Stop if: a card cannot render outside its tab without a change to the card itself.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Part of #1896". Remove `wip` when CI is green. Never merge.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt M7 — Sonnet 5.5, effort medium

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, src/CLAUDE.md, src/screens/player/next/CLAUDE.md (the module contract) and docs/player-redesign.md. Use the branch the session gives you, cut from current origin/main. Needs on main: the PR that added the tbd-overview, tbd-mound and tbd-gamelog slots ("Part of #1896", page) and the tbd part a PR. If either is not merged, stop and report. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1896, part b: today's cards, unchanged, in a plain stamped card, in the tbd slots of Overview, On the mound and Game log. No new design. Gary decided (2026-10-13): Milestone watch sits at the end of Game log, with no new button.

Board: TbdWire (Artifact tool, action "read", url https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK, path "project/TbdWire.dc.html"), groups "top", "role" and "more".

What goes where (origin/main):
- Overview, under the tiles: status banners (All-Star, rehab, injured list, last played; only when they apply), header extras (OvrTile, used at src/screens/player/PlayerHubShell.jsx:128), league-rank chips, the postseason row, other-level rows. Find each one's live source in PlayerHubShell.jsx and PlayerPage.jsx.
- On the mound (pitcher): CommandReceivedCard (src/components/playerstats/CommandReceivedCard.jsx:36) and TargetCommand (src/components/charts/TargetCommand.jsx:32). Live use: PlayerAnalyticsTab.jsx:289, :356.
- Game log: MilestoneWatchCard (src/components/playerstats/MilestoneWatchCard.jsx:23; PlayerPage.jsx:352); for a pitcher, also FoulCard (src/components/playerstats/FoulCard.jsx:26) with group pitching.

Contract: edit only src/screens/player/next/modules/tbd/ and src/styles/player-next/both/tbd.css. Extend the section switch from part a; do not change part a's sections. Never edit sections.js, Slot.jsx or the page. Each card hides alone; the slot calls onEmpty() when all do. Reserve height. No new token, no new file in src/api/ (115/115). Narrowest fetchers only.

Steps (test first: extend test/player-next-tbd.test.js for the three new sections; see it fail, then write the code).

Done means: npm run lint, npm test and npm run build pass. Render /player/{id}?look=new&nointro at 390 and 1180 px in Chromium for Turang 668930, Gasser 688107, Cade Smith 671922 (closer) and Ohtani 660271; send Gary the screenshots with the route and player id.
Stop if: a card cannot render outside its tab without a change to the card itself.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Closes #1896". Remove `wip` when CI is green. Never merge.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt M8 — Sonnet 5.5, effort medium

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, src/CLAUDE.md, src/screens/player/next/CLAUDE.md (the module contract) and docs/player-redesign.md. Use the branch the session gives you, cut from current origin/main. Needs on main: the #1918 PR (every first carries oppId). If it is not merged, stop and report. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1895, the Firsts module, in the History section. A first he has not reached yet is left off.

Board: read it with the Artifact tool (action "read", url https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK, path "project/Firsts.dc.html"). Copy its layout. Its numbers are samples.

Reuse (origin/main): the firsts in src/api/player/history.js (~:325-337, now with oppId); the orders FIRSTS_ORDER and PITCHER_FIRSTS_ORDER in src/screens/player/PlayerHistoryTab.jsx:28, :31, :81; teamLogoUrl(oppId) (src/lib/teams.js:477). Do not edit PlayerHistoryTab.jsx; copy the two orders into the module (the swap, #1898, deletes the tab).

Contract: build only in src/screens/player/next/modules/firsts/ and src/styles/player-next/both/firsts.css (imported from index.jsx). Never edit sections.js, Slot.jsx or the page. Props { bio, role, asOf, season, section, onEmpty, onCount }. Reserve height. No firsts: onEmpty(). Tokens only, no raw hex, no new token, no new file in src/api/ (115/115). Keep ?d= and ?s= on game links (path builders). If only loadPlayerHistory gives the firsts, say so in the PR with the request count.

Steps (test first: the pure view, the order by role and the left-off rule, in modules/firsts/firstsView.js; tested in test/player-next-firsts.test.js; see it fail, then write the code):
1. The view, then the card. role 'hitting' uses the batter order, 'pitching' the pitcher order; a two-way player gets both.

Done means: npm run lint, npm test and npm run build pass. Render /player/{id}?look=new&nointro at 390 and 1180 px in Chromium for Turang 668930, Gasser 688107 and Ohtani 660271; send Gary the screenshots with the route and player id.
Stop if: a first has no oppId on main.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Closes #1895". Remove `wip` when CI is green. Never merge.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt M9 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, src/CLAUDE.md, src/screens/player/next/CLAUDE.md (the module contract) and docs/player-redesign.md. Use the branch the session gives you, cut from current origin/main. Needs on main: the #1916 PR (opponent per app; starts-only pitches per start). If it is not merged, stop and report. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1893, the On the mound module (pitcher only): the days-since track, the last outings on a calendar, Starter and Bullpen tabs. The opponent circles on the board are placeholders: use the real club marks (teamLogoUrl, src/lib/teams.js:477).

Board: read it with the Artifact tool (action "read", url https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK, path "project/MoundCard.dc.html"). Copy its layout. Its numbers are samples.

Reuse (origin/main): PitcherWorkloadCard (src/components/playerstats/PitcherWorkloadCard.jsx:58), foldGameLog and moundRateFor (src/api/workload.js:35, :370), public/data/workload.json.

Contract: build only in src/screens/player/next/modules/mound/ and src/styles/player-next/pitcher/mound.css (imported from index.jsx). Never edit sections.js, Slot.jsx or the page. Props { bio, role, asOf, season, section, onEmpty, onCount }. Reserve height. No data: onEmpty(). Tokens only, no raw hex, no new token, no new file in src/api/ (115/115). Pass asOf; an app on or after the cutoff day is not shown.

Steps (test first: the pure view, calendar cells, days since, the default tab from the role, in modules/mound/moundView.js; tested in test/player-next-mound.test.js; see it fail, then write the code):
1. Check Gasser 688107: 87 pitches per start (86.8, starts only).
2. Build the card. A closer opens on the Bullpen tab.

Done means: npm run lint, npm test and npm run build pass. Render /player/{id}?look=new&nointro at 390 and 1180 px in Chromium for Gasser 688107, Cade Smith 671922 and Ohtani 660271; send Gary the screenshots with the route and player id.
Stop if: workload.json has no opponent id per app on main.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Closes #1893". Remove `wip` when CI is green. Never merge.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt M10 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, src/CLAUDE.md, src/screens/player/next/CLAUDE.md (the module contract), docs/player-redesign.md and the #1909 section of docs/player-redesign-data.md. Use the branch the session gives you, cut from current origin/main. Needs on main: the #1909 PR (season-correct abbreviations, the "2 TM" subtotal row, the MiLB career line, gap rows). If it is not merged, stop and report. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1885, the Season statistics module. One scope switch (MLB, Minors, All, Postseason) drives the five tiles and the year-by-year table. Tap a season's WAR to compare it with the league.

Boards: read with the Artifact tool (action "read", url https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK), paths "project/SeasonStats.dc.html" and "project/SeasonStatsPitcher.dc.html". Copy the layout. Board numbers are samples.

Reuse (origin/main): careerRegisterView (src/api/person/careerRegister.js:147), CareerRegister and PostseasonRegister (src/components/player/CareerRegister.jsx:21, :123; live use PlayerStatsTab.jsx:105, :109), StatTile (src/components/ui/frame/StatTile.jsx). Call the narrow fetchers that loadPlayerStats (src/api/player/stats.js:37) uses, not the whole loader; there is no fetch cache.

Contract: build only in src/screens/player/next/modules/season/ and src/styles/player-next/both/season.css (imported from index.jsx). Never edit sections.js, Slot.jsx or the page. Props { bio, role, asOf, season, section, onEmpty, onCount }. Reserve height. No data: onEmpty(). Tokens only, no raw hex, no new token, no new file in src/api/ (115/115). Pass asOf to every fetch. Keep ?d= and ?s= on links.

Steps (test first: the pure view, rows and tiles per scope, the subtotal and gap rows, in modules/season/seasonView.js; tested in test/player-next-season.test.js; see it fail, then write the code):
1. The view, then the card. A closer's first tile shows SV in place of W-L.
2. Check Turang 668930 (2018 AZL Brewers row, season-correct abbreviation) and Gasser 688107.

Done means: npm run lint, npm test and npm run build pass. Render /player/{id}?look=new&nointro at 390 and 1180 px in Chromium for Turang 668930, Gasser 688107, Cade Smith 671922, Ohtani 660271 and Jesús Made 815908 (Minors scope); send Gary the screenshots with the route and player id. Put the slot's request count in the PR.
Stop if: a tile or column has no source in the data audit.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Closes #1885". Remove `wip` when CI is green. Never merge.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt M11 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, src/CLAUDE.md, src/screens/player/next/CLAUDE.md (the module contract) and docs/player-redesign.md. Use the branch the session gives you, cut from current origin/main. Needs on main: the #1913 PR (rollingSeries in src/api/hitterForm.js). If it is not merged, stop and report. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1889, the batter Form trend module. It also builds the chart and the table that the pitcher Form trend (#1930) will reuse.

Board: read it with the Artifact tool (action "read", url https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK, path "project/FormTrend.dc.html"). Copy it: rolling OPS at the cursor, window chips 10/15/20 (default 15), "Play the season", fill above/below the season OPS, best and worst marks, an HR rug, a scrubber, and the second card "How the stretches ended". Board numbers are samples.

Reuse (origin/main): fetchHitterForm (src/api/hitterForm.js:20; its game-log call uses MLB_LOG_GAME_TYPES), rollingSeries (same file), RecentFormCard (src/components/playerstats/RecentFormCard.jsx:24).

Contract: build only in src/screens/player/next/modules/form/, src/styles/player-next/batter/form.css and src/styles/player-next/both/formchart.css. Never edit sections.js, Slot.jsx or the page. Props { bio, role, asOf, season, section, onEmpty, onCount }. Reserve height. No data: onEmpty(). Tokens only, no raw hex, no new token, no new file in src/api/ (115/115). Animation off under prefers-reduced-motion. Open surface (ADR-0034); pass asOf.

Shared part (a known second user, not a guess): put the chart in modules/form/FormChart.jsx and the stretches table in modules/form/StretchTable.jsx. FormChart takes the series, a value formatter, and `better: 'up' | 'down'` (green fill on the better side of the season line). StretchTable takes its columns. Their CSS is both/formchart.css, imported by the two files.

Steps (test first: the pure view, cursor text, best/worst, stretch rows, in modules/form/formView.js; tested in test/player-next-form.test.js; see it fail, then write the code):
1. Check Turang 668930: best 15-game OPS 1.227.
2. Build the module.

Done means: npm run lint, npm test and npm run build pass. Render /player/{id}?look=new&nointro at 390 and 1180 px in Chromium for Turang 668930 and Ohtani 660271; send Gary the screenshots with the route and player id.
Stop if: rollingSeries is not on main.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Closes #1889". Remove `wip` when CI is green. Never merge.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt M12 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, src/CLAUDE.md, src/screens/player/next/CLAUDE.md (the module contract) and docs/player-redesign.md. Use the branch the session gives you, cut from current origin/main. Needs on main: the #1930 data PR (pitcherRollingSeries in src/api/player/pitcherForm.js) and the #1889 PR (modules/form/FormChart.jsx, StretchTable.jsx). If either is not merged, stop and report. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1930, the module slice: the pitcher Form trend card. Gary's decisions (2026-10-13, #1930 comment):
- Headline: rolling ERA. Fill green where the rolling ERA is below the season ERA.
- Starter: chips 3/5/10 starts, default 5. Reliever: chips 10/15/20 IP, default 15. Role from pitcherRole (src/api/person/identity.js:40).
- A K% toggle flips the chart between ERA and K%. "How the stretches ended": IP, ERA, K%, BB%.
- Postseason included. No bottom marks. No velocity (#1933 adds it later).
- The game line uses the split's `summary` ("6.0 IP, 1 ER, 9 K, 1 BB").

Boards: "project/FormTrend.dc.html" (the batter card; the two must look like one family) and the "form_p" group of "project/TbdWire.dc.html" (Artifact tool, action "read", url https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK).

Contract: build only in src/screens/player/next/modules/pform/ and src/styles/player-next/pitcher/pform.css. Import FormChart and StretchTable from ../form/ (better: 'down' for ERA, 'up' for K%). Do not edit any form/ file; if you must, stop and report. Never edit sections.js, Slot.jsx or the page. Props { bio, role, asOf, season, section, onEmpty, onCount }. Reserve height. No data: onEmpty(). Tokens only. The module gets no overview splits, so it makes ONE gameLog call (group pitching, gameType MLB_LOG_GAME_TYPES, src/api/boxlines/rows.js:152) when its slot comes near; say so in the PR.

Steps (test first: the pure view, chips by role and the cursor text, in modules/pform/pformView.js; tested in test/player-next-pform.test.js; see it fail, then write the code):
1. Check Gasser 688107: 5-start ERA best 1.35 (Sep 7-Oct 7), worst 5.32 (Jul 12-Aug 8), season 3.87.

Done means: npm run lint, npm test and npm run build pass. Render /player/{id}?look=new&nointro at 390 and 1180 px in Chromium for Gasser 688107, Cade Smith 671922 (innings window) and Ohtani 660271; send Gary the screenshots with the route and player id.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Closes #1930". Remove `wip` when CI is green. Never merge.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt M13 — Sonnet 5.5, effort medium

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, src/CLAUDE.md, src/screens/player/next/CLAUDE.md (the module contract) and docs/player-redesign.md. Use the branch the session gives you, cut from current origin/main. Needs on main: the #1917 PR (games and clubs per level in src/api/person/career/progression.js). If it is not merged, stop and report. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1894, the Path to the Majors module, in the Career section: games at each level with the club logo and years, a "Here now" marker, and a prospect version for a player not yet in the majors.

Boards: read with the Artifact tool (action "read", url https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK), paths "project/PathToMajors.dc.html" and "project/PathProspect.dc.html". Copy the layout. Board numbers are samples.

Reuse (origin/main): levelProgressionView, dropRehabStints, careerTimelineView (moved to src/api/person/career/progression.js by #1909), LevelProgressionCard (src/components/player/LevelProgressionCard.jsx:9), teamLogoUrl (src/lib/teams.js:477).

Contract: build only in src/screens/player/next/modules/path/ and src/styles/player-next/both/path.css (imported from index.jsx). Never edit sections.js, Slot.jsx or the page. Props { bio, role, asOf, season, section, onEmpty, onCount }. Reserve height. No minor-league record: onEmpty(). Tokens only, no raw hex, no new token, no new file in src/api/ (115/115). Narrowest fetchers; pass asOf.

Steps (test first: the pure view, levels, games, clubs, the "Here now" row, the prospect variant, in modules/path/pathView.js; tested in test/player-next-path.test.js; see it fail, then write the code):
1. Check Turang 668930: Rookie level 42 G, AZL Brewers 13 and Helena 29.
2. Build the card. A two-way player gets one card (hitting instance; onEmpty() on the pitching one).

Done means: npm run lint, npm test and npm run build pass. Render /player/{id}?look=new&nointro at 390 and 1180 px in Chromium for Turang 668930, Jesús Made 815908 (prospect) and Gasser 688107; send Gary the screenshots with the route and player id.
Stop if: the per-level games are not on main.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Closes #1894". Remove `wip` when CI is green. Never merge.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt M14 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, src/CLAUDE.md, src/screens/player/next/CLAUDE.md (the module contract), docs/player-redesign.md and the #1910 section of docs/player-redesign-data.md. Use the branch the session gives you, cut from current origin/main. Needs on main: the #1910 PR "Closes #1910" (season picker, Career, All, reads, door columns). If it is not merged, stop and report. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1886, the Splits module (batter and pitcher). Gary decided (2026-10-13): a pitcher's "All batters" row is vs L + vs R.

Boards: read with the Artifact tool (action "read", url https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK), paths "project/Splits.dc.html" and "project/PitcherSplits.dc.html". Copy the layout. Board numbers are samples.

Reuse (origin/main, plus the #1910 helpers): splitsView (src/api/person/stats.js:257), SplitsSection (src/components/playerstats/SplitsSection.jsx:130), SplitsVsTeam (SplitsVsTeam.jsx:49), vsTeamSplitsFor (src/api/vsTeamSplits.js:108), GameLinesCard (src/components/playerstats/GameLinesCard.jsx:71) and the door columns in src/api/boxlines/careerSplits.js.

Contract: build only in src/screens/player/next/modules/splits/ and src/styles/player-next/both/splits.css (imported from index.jsx). Never edit sections.js, Slot.jsx or the page. Props { bio, role, asOf, season, section, onEmpty, onCount }. Reserve height. No data: onEmpty(). Tokens only, no raw hex, no new token, no new file in src/api/ (115/115). Narrowest fetchers; pass asOf. Keep ?d= and ?s= on door links.

Steps (test first: the pure view, rows per scope, deltas, best/weak/thin flags, in modules/splits/splitsView.js; tested in test/player-next-splits.test.js; see it fail, then write the code):
1. Check Gasser 688107: 463 BF in the baseline row; his two .5 K%/BB% rows read 13%.
2. Build the card for both roles.

Done means: npm run lint, npm test and npm run build pass. Render /player/{id}?look=new&nointro at 390 and 1180 px in Chromium for Turang 668930, Gasser 688107 and Ohtani 660271; send Gary the screenshots with the route and player id. Put the slot's request count in the PR.
Stop if: a column has no source.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Closes #1886". Remove `wip` when CI is green. Never merge.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt M15 — Opus 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, src/CLAUDE.md, src/api/CLAUDE.md, src/screens/player/next/CLAUDE.md (the module contract), ADR-0034, ADR-0026 and .scratch/player-pitcher-redesign/notes.md. Use the branch the session gives you, cut from current origin/main. Needs on main: the game-log PR ("Part of #1914", "Part of #1915": sort, league prefix, score) and the pitch-arsenal backfill ("Closes #1915": per-start mix on file). If either is not merged, stop and report. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1851, slices 1, 2 and 5: the ADR, the CONTEXT.md entry, the start selectors, and the pitcher Game log rows (newest season only). The start detail view and "Load earlier season" are a later prompt. Read the issue and its first comment (layout rules: table at 960 px container width or more, a card per start below; totals row; All / Regular season / Postseason filter; logo replaces the team code; dates as 10/7; FF, SI, FC, ST, CH mix bar; K >= 7 bold green, ER >= 4 bold clay, never colour alone).

Gary decided (2026-10-12): the start detail is open (ADR-0034). The one guard: a start still in progress today shows no final score and no decision. Keep the name "Game Log".

Steps:
1. ADR: write docs/adr/0110-<slug>.md in the shape of ADR-0109 (status, date, issue, context, decision). If 0110 is taken on main, use the next free number and say so. Add the CONTEXT.md entry: the stamp Game Log vs the pitcher Game Log.
2. Test first (test/player-next-pitchlog.test.js; see each fail first): start rows from the gameLog split (gamesStarted), the decision, the score, the mix bar from the per-start store, and the guard: a game in progress today gives no score and no decision.
3. Build modules/pitchlog/ (selectors in pitchlogView.js). The table is a shared part: modules/pitchlog/LogTable.jsx takes rows and a column list, so the batter log (#1890) imports it with its own columns. LogTable's CSS is src/styles/player-next/both/logtable.css; the rest is pitcher/pitchlog.css.
4. Board: "project/GameLog.dc.html" (Artifact tool, action "read", url https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK); the issue's two older canvases are reference only.

Contract: build only in modules/pitchlog/ and the two CSS files. Never edit sections.js, Slot.jsx or the page. Props { bio, role, asOf, season, section, onEmpty, onCount }; onCount(starts). Reserve height. No starts: onEmpty(). Tokens only, no new token, no new file in src/api/ (115/115). Pass asOf.

Check: Gasser 688107, 2026-05-23 vs LAD: L 3-11, 4.1 IP, 4 ER, 4 K, 89 pitches (53 strikes), cutter 29. The issue says 22 starts; research found 21 GS plus one bulk relief (08-26): show what gamesStarted gives and say so in the PR.

Done means: npm run lint, npm test and npm run build pass. Render /player/{id}?look=new&nointro at 390 and 1180 px in Chromium for Gasser 688107, Cade Smith 671922 and Ohtani 660271; send Gary the screenshots with the route and player id.
Stop if: the in-progress guard needs a change outside this folder.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Part of #1851". Remove `wip` when CI is green. Never merge.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt M16 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, src/CLAUDE.md, src/screens/player/next/CLAUDE.md (the module contract), the #1851 ADR on main (docs/adr/0110-*.md, or the number its PR used) and .scratch/player-pitcher-redesign/notes.md ("Start modal: data sources", "Game Log: scroll back through earlier seasons"). Use the branch the session gives you, cut from current origin/main. Needs on main: the #1851 part a PR (modules/pitchlog/ with LogTable.jsx). If it is not merged, stop and report. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1851, slices 3 and 4: the start detail view and "Load earlier season". Read the issue body: the nine parts of the detail view (header, result strip, pitching line, pitches table, game clips, strikeouts, big plays, clip footnote, Earlier / Later / Open this game) and the clip rule ("Watch m:ss" for an MLB highlight, "Pitch clip" for the Savant single-pitch clip).

Rules:
- The detail view is a modal: Escape closes it, focus is trapped, focus returns to the row.
- It fetches the game's feed and content only when opened. The ADR's guard holds: a start in progress today shows no score and no decision.
- "Load earlier season" sits at the left end of the row and fetches one season back only when pressed. Each season adds a labelled block with a divider; the filter slider spans every loaded season. A season with no pitch tracking shows date, opponent and result only.
- Verify every feed path on a live response; do not guess.

Contract: edit only src/screens/player/next/modules/pitchlog/ and src/styles/player-next/pitcher/pitchlog.css. Keep LogTable's props as they are (the batter log imports it); if you must change them, stop and report. Never edit sections.js, Slot.jsx or the page. No new token, no new file in src/api/ (115/115). Keep ?d= and ?s= on "Open this game".

Steps (test first: the detail selectors, strikeouts, big plays, the clip match and fallback, the season loader's state, in test/player-next-pitchlog.test.js; see them fail, then write the code).
Check: Gasser 688107, 2026-05-23 vs LAD, the issue's reference start (cutter 29 / 87.8 mph / 5 whiffs; Hernández 3-run HR, "Watch 1:16").

Done means: npm run lint, npm test and npm run build pass. Render the modal and an earlier season at 390 and 1180 px in Chromium on /player/688107?look=new&nointro; send Gary the screenshots with the route, player id and gamePk.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Closes #1851". Remove `wip` when CI is green. Never merge.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt M17 — Sonnet 5.5, effort medium

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, src/CLAUDE.md, src/screens/player/next/CLAUDE.md (the module contract) and docs/player-redesign.md. Use the branch the session gives you, cut from current origin/main. Needs on main: the #1851 part a PR (modules/pitchlog/LogTable.jsx) and the fouls backfill ("Closes #1914": per-game fouls on file, the join helper in src/api/person/gameLog.js). If either is not merged, stop and report. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1890, the batter Game log module. "Match the pitcher Game log module (#1851) so the two read as one part."

Board: read it with the Artifact tool (action "read", url https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK, path "project/BatterGameLog.dc.html"). Copy its columns and layout. Board numbers are samples.

Reuse (origin/main): LogTable (src/screens/player/next/modules/pitchlog/LogTable.jsx) with batter columns; gameLogView (src/api/person/gameLog.js:76: doubleheader order, league prefix, score) and the per-game fouls join helper beside it; teamLogoUrl (src/lib/teams.js:477). Today's card: GameLog (src/components/player/GameLog.jsx:21).

Contract: build only in src/screens/player/next/modules/batlog/ and src/styles/player-next/batter/batlog.css. Import LogTable from ../pitchlog/; never edit a pitchlog/ file (if you must, stop and report). Never edit sections.js, Slot.jsx or the page. Props { bio, role, asOf, season, section, onEmpty, onCount }; onCount(games). Reserve height. No games: onEmpty(). Tokens only, no raw hex, no new token, no new file in src/api/ (115/115). Pass asOf: the cutoff filter in gameLogView must hold.

Steps (test first: the batter column list and row values, in modules/batlog/batlogView.js; tested in test/player-next-batlog.test.js; see it fail, then write the code):
1. Check Turang 668930 2026: 157 rows with the postseason (6 G); doubleheaders 04-04, 07-07, 07-11 in game order.

Done means: npm run lint, npm test and npm run build pass. Render /player/{id}?look=new&nointro at 390 and 1180 px in Chromium for Turang 668930 and Ohtani 660271; send Gary the screenshots with the route and player id.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Closes #1890". Remove `wip` when CI is green. Never merge.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt M18 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, src/CLAUDE.md, src/screens/player/next/CLAUDE.md (the module contract), docs/player-redesign.md and the #1881 section of docs/player-redesign-data.md. Use the branch the session gives you, cut from current origin/main. Needs on main: the fouls backfill ("Closes #1881": fouls by count and the league median on file). If it is not merged, stop and report. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1891, the Foul balls module (batter only; the "Count explorer" direction, approved). It sits in the Game log section; it has no button of its own. Gary decided (2026-10-13): the league "most in one at-bat" figure is the median of regular hitters (300+ PA), 2026 = 6; the record is not shown.

Board: read it with the Artifact tool (action "read", url https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK, path "project/FoulBalls.dc.html"). Copy its layout. ALL board numbers are samples; use the store.

Reuse (origin/main): src/api/fouls.js (spoiler-free reader, now with the by-count cells), FoulCard (src/components/playerstats/FoulCard.jsx:26).

Contract: build only in src/screens/player/next/modules/fouls/ and src/styles/player-next/batter/fouls.css (imported from index.jsx). Never edit sections.js, Slot.jsx or the page. Props { bio, role, asOf, season, section, onEmpty, onCount }. Reserve height. No data: onEmpty(). Tokens only, no raw hex, no new token, no new file in src/api/ (115/115).

Steps (test first: the pure view, the 12-count grid, the rates per count, the best at-bat vs the league median, in modules/fouls/foulsView.js; tested in test/player-next-fouls.test.js; see it fail, then write the code):
1. Check Turang 668930: 573 regular-season fouls, best at-bat 6, league 6.
2. Build the card.

Done means: npm run lint, npm test and npm run build pass. Render /player/{id}?look=new&nointro at 390 and 1180 px in Chromium for Turang 668930 and Ohtani 660271; send Gary the screenshots with the route and player id.
Stop if: a count cell has no source in the store.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Closes #1891". Remove `wip` when CI is green. Never merge.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt M19 — Sonnet 5.5, effort xhigh

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, src/CLAUDE.md, src/screens/player/next/CLAUDE.md (the module contract), docs/player-redesign.md, docs/pitch-types.md and the #1908 section of docs/player-redesign-data.md. Use the branch the session gives you, cut from current origin/main. Needs on main: the #1908 part a PR (whiff %, zone mark, xwOBA) and the pitch-arsenal backfill ("Closes #1908": movement, spin, release, flight on file). If either is not merged, stop and report. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1892, the Pitch arsenal module (pitcher only), with the Pitch flight card (#1908 puts flight here). Pitch shapes and colours come only from pitchMark(code) (src/lib/pitch/pitchTypes.js:48); never pick a pitch colour in the module.

Boards: read with the Artifact tool (action "read", url https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK), paths "project/ArsenalReveal.dc.html" and "project/PitchFlight.dc.html". Copy the layout; on wide they sit side by side. The leftover old flight CSS colours on D2 can be ignored (canvas note). Board numbers are samples.

Reuse (origin/main): src/api/pitchArsenal.js (433 lines), commandView (src/api/commandMap.js:63), PitchMix (src/components/charts/PitchMix.jsx:39), PitchArsenalMix (src/components/charts/PitchArsenalMix.jsx:63), PitchesCard (private, src/screens/player/PlayerAnalyticsTab.jsx:370; copy what you need, do not export it).

Contract: build only in src/screens/player/next/modules/arsenal/ and src/styles/player-next/pitcher/arsenal.css (imported from index.jsx). Never edit sections.js, Slot.jsx or the page. Props { bio, role, asOf, season, section, onEmpty, onCount }; onCount(pitch types). Reserve height. No data: onEmpty(). Tokens only, no raw hex, no new token, no new file in src/api/ (115/115). Flight animation off under prefers-reduced-motion.

Steps (test first: the pure views, arsenal rows and the flight path from release, movement and flight time, in modules/arsenal/arsenalView.js and flightView.js; tested in test/player-next-arsenal.test.js; see them fail, then write the code):
1. Check Gasser 688107: FF usage 23.4 (store, not Savant).
2. Build the two cards.

Done means: npm run lint, npm test and npm run build pass. Render /player/{id}?look=new&nointro at 390 and 1180 px in Chromium for Gasser 688107, Cade Smith 671922 and Ohtani 660271; send Gary the screenshots with the route and player id.
Stop if: a flight input is null for an MLB pitcher after the backfill.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Closes #1892". Remove `wip` when CI is green. Never merge.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt M20 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, src/CLAUDE.md, src/screens/player/next/CLAUDE.md (the module contract), docs/player-redesign.md and the #1912 section of docs/player-redesign-data.md. Use the branch the session gives you, cut from current origin/main. Needs on main: the spray rebuild ("Closes #1912": per-ball launch angle, distance, xBA, barrel on file). If it is not merged, stop and report. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1888, the Contact module (batter only): the spray chart and the batted-ball mix. Gary decided (2026-10-13): each ball shows real xBA from the xBA lattice.

Board: read it with the Artifact tool (action "read", url https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK, path "project/Contact.dc.html"). Copy its layout. Board numbers are samples.

Reuse (origin/main): decodeSprayBalls (src/api/spray.js:134; spoiler-free, decided games only), SprayMapSection (src/components/playerstats/SprayMapSection.jsx:27), BattedBallMix (src/components/charts/BattedBallMix.jsx:18).

Contract: build only in src/screens/player/next/modules/contact/ and src/styles/player-next/batter/contact.css (imported from index.jsx). Never edit sections.js, Slot.jsx or the page. Props { bio, role, asOf, season, section, onEmpty, onCount }; onCount(balls in play). Reserve height. No data: onEmpty(). Tokens only, no raw hex, no new token, no new file in src/api/ (115/115). Pass asOf: no ball from a game on or after the cutoff.

Steps (test first: the pure view, ball marks, the mix, the tapped-ball detail, in modules/contact/contactView.js; tested in test/player-next-contact.test.js; see it fail, then write the code):
1. Check Turang 668930: the 2026-09-23 home run (108.4 mph, 22 degrees) shows xBA about .911.
2. Build the card.

Done means: npm run lint, npm test and npm run build pass. Render /player/{id}?look=new&nointro at 390 and 1180 px in Chromium for Turang 668930 and Ohtani 660271; send Gary the screenshots with the route and player id.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Closes #1888". Remove `wip` when CI is green. Never merge.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt M21 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, src/CLAUDE.md, src/screens/player/next/CLAUDE.md (the module contract), docs/player-redesign.md, the #1911 section of docs/player-redesign-data.md and ADR-0096. Use the branch the session gives you, cut from current origin/main. Needs on main: the hitter-grid backfill ("Closes #1911": calledStrikes, inPlay, speedSum and the foul-tip rule on file). If it is not merged, stop and report. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1887, the Plate approach module (batter only). The zone map is mostly a reuse of the Matchup Scout map. Gary decided (2026-10-13): a foul tip is a whiff.

Board: read it with the Artifact tool (action "read", url https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK, path "project/PlateApproach.dc.html"). Copy its layout. Board numbers are samples.

Reuse (origin/main): hitterMap (src/screens/scout/hitterBoard.js:49), the grid reader src/api/scout/hitterGrid.js, viewCol and inZone (src/lib/zone/zoneGeometry.js:111, :114; draw columns through viewCol, never by stored index), pitchMark (src/lib/pitch/pitchTypes.js:48) for any pitch colour.

Contract: build only in src/screens/player/next/modules/plate/ and src/styles/player-next/batter/plate.css (imported from index.jsx). Never edit sections.js, Slot.jsx or the page, and do not edit src/screens/scout/ (import from it). Props { bio, role, asOf, season, section, onEmpty, onCount }; onCount(pitches seen). Reserve height. No data: onEmpty(). Tokens only, no raw hex, no new token, no new file in src/api/ (115/115).

Steps (test first: the pure view, swing / chase / in-zone rates from the counters, in modules/plate/plateView.js; tested in test/player-next-plate.test.js; see it fail, then write the code):
1. Check Turang 668930: 1,247 swings, 288 whiffs (23.1%).
2. Build the card.

Done means: npm run lint, npm test and npm run build pass. Render /player/{id}?look=new&nointro at 390 and 1180 px in Chromium for Turang 668930 and Ohtani 660271; send Gary the screenshots with the route and player id.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Closes #1887". Remove `wip` when CI is green. Never merge.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt M22 — Sonnet 5.5, effort medium

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, src/CLAUDE.md and src/screens/player/next/CLAUDE.md (the module contract). Use the branch the session gives you, cut from current origin/main. Needs on main: the pitcher Form trend module ("Closes #1930", modules/pform/) and the velocity backfill (per-game fastball velocity on file, "Part of #1933" code PR plus its data PR). If either is not merged, stop and report. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1933, the card part: a velocity view in the pitcher Form trend, a third chart choice beside ERA and K% (Gary, 2026-10-13). The page reads the per-pitcher velocity shard once; no feed call per game.

Facts: the reader of the per-game velocity is the one the #1933 code PR added (its PR body names it). The chart is FormChart from ../form/ (do not edit form/ files).

Contract: edit only src/screens/player/next/modules/pform/ and src/styles/player-next/pitcher/pform.css. Never edit sections.js, Slot.jsx or the page. No new token, no new file in src/api/ (115/115). A pitcher with no velocity on file gets no velocity choice; ERA and K% stay.

Steps (test first: extend test/player-next-pform.test.js for the velocity series, a rolling mean of the primary fastball over the same window, and the missing-data case; see it fail, then write the code).

Done means: npm run lint, npm test and npm run build pass. Render /player/{id}?look=new&nointro at 390 and 1180 px in Chromium for Gasser 688107 and Cade Smith 671922; send Gary the screenshots with the route and player id.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Closes #1933". Remove `wip` when CI is green. Never merge.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```
