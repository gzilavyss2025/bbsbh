# Matchup Scout redesign: run plan and slice specs (#2319)

The build plan for #2319, cut so that Sonnet 5.5 and Haiku 5.5 agents can run each slice.
The decisions are in **ADR-0118**. The look is the design canvas,
https://claude.ai/artifact/XFBPUYkP8Xf8VSs4dvV7rm: phone board `Main.dc.html` and
desktop board `Desktop.dc.html`. Every slice agent reads this file first.

Files in this folder:

| File | What it is |
| --- | --- |
| `README.md` | This plan: shared rules, the slices, and one ready prompt per slice |
| `verdict-draft.js` | Slice 1's function, checked against real store data |
| `verdict-draft.test.js` | Slice 1's six tests, all passing against the draft |
| `vsplayer-bonds-maddux.json` | A trimmed real Stats API `vsPlayer` answer for slice 7b's test |
| `shot.mjs` | A screenshot helper that works in the cloud container (see "Verify") |

## Run plan

Slice 0 is this folder plus ADR-0118. It must be on `main` before any slice starts.

| # | Slice | Model | Effort | Depends on | Parallel with |
| --- | --- | --- | --- | --- | --- |
| 1 | Verdict function + tests | Haiku 5.5 | medium | 0 | 2 |
| 2 | One view (retire the View toggle) | Sonnet 5.5 | medium | 0 | 1 |
| 3 | One scroll: sections, jump bar, CSS partials, page wiring | Sonnet 5.5 | medium | 2 | — |
| 4 | The edge: verdict card, pushes, things to watch, side colours | Sonnet 5.5 | high | 1, 3 | 5, 6, 7 |
| 5 | Pitch by pitch: tug-of-war rows | Sonnet 5.5 | medium | 3 | 4, 6, 7 |
| 6 | Where: one overlay map, Show, Metric, phone chip strip | Sonnet 5.5 | high | 3 | 4, 5, 7 |
| 6b | Where: the batter figure in the home uniform | Sonnet 5.5 | medium | 6 | 4, 5, 7 |
| 7 | Meetings restyle (numbered pitch rows, written-out calls) | Sonnet 5.5 | medium | 3 | 4, 5, 6 |
| 7b | Retired players: meetings first, last club, pre-2008 line | Sonnet 5.5 | high | 7 | 4, 5, 6, 6b |
| 8 | Desktop layout (740 px and wider) | Sonnet 5.5 | medium | 4, 5, 6, 6b, 7, 7b | 9 |
| 9 | Motion | Sonnet 5.5 | medium | 4, 5, 6, 6b, 7, 7b | 8 |

The model picks follow `.claude/skills/write-prompt/SKILL.md`:

- **Slice 1** is a paste of verified code and tests, so it runs on Haiku 5.5 at medium effort.
- **Slices 2, 3, 5, 6b, 7, 8 and 9** follow a spec and existing patterns, so they run on Sonnet 5.5 at medium effort.
- **Slices 4, 6 and 7b** carry judgment in layout or data, so they run on Sonnet 5.5 at high effort.
- **If a result comes back weak,** raise the effort on the same model first. Change the model only after that.

**Why slice 3 comes before the rest:** slices 4 to 7 each own one section, one folder and one CSS partial. Slice 3 creates those homes and does all the wiring in `ScoutPage.jsx`, so slices 4 to 7 can run at the same time without editing the same file. Slices 6b and 7b follow 6 and 7 because they edit the same files.

**Who may edit `ScoutPage.jsx` after slice 3:** slice 6 (the Where wrapper lines: the Metric control and the chip strip) and slice 7b (the one flag that hides the Edge, Pitches and Where sections). No other slice edits it. A slice that needs another change there stops and reports.

Each slice is one PR. Its body says `Part of #2319`, never `Closes`. Gary closes #2319 by hand after the last slice lands (an unattended session never closes an issue). The PRs land through `/stack-prs`.

## Shared rules (every slice)

- **Start.** Read `CLAUDE.md`, `src/CLAUDE.md`, `src/styles/CLAUDE.md`, ADR-0118 and this file's section for your slice. Then list the open PRs and their files. Stop and report if one of them touches a file you will change.
- **The canvas.** Read it with the Artifact tool (`action: "read"`, the URL at the top of this file). If it does not open, stop and report; do not guess the look.
- **Test discipline.** New pure logic lands with a test. Write the test first and watch it fail. Never loosen an assertion to pass. A test whose behaviour this redesign changes on purpose is changed in the same commit, and the PR says which test and why.
- **CSS guards** (`npm run lint`):
  - `font-size` is `var(--fs-*)`. The smallest sizes are `--fs-cell` and `--fs-caption`, both 11 px. Never use 10 px.
  - `font-weight`, `line-height` and `letter-spacing` use their `--w-*`, `--lh-*` and `--ls-*` tokens.
  - Padding and gap use `--space-*`.
  - No raw hex, ms or shadow value: use tokens. The `check-raw-values` ratchet only goes down.
  - Layout uses the `Stack`, `Cluster` and `Grid` components. A layout rule in CSS needs `layout-exempt: <reason>`, because the layout ratchet only goes down.
  - A z-index above 3 uses a `--z-*` token.
  - An `@media` width must come from the allowed list. The wide step is 740 px.
- **Copy.** Write copy in sentence case; CSS sets the caps, and `.toUpperCase()` is never used. Use ASD-STE100 style. Say "postseason", never "playoffs".
- **Colour.** The pitcher's side is `--allstar-blue`. The hitter's side is `--award-line` for fills and `--award-ink` for text. Text on an `--award-line` fill uses `--text-heading` (ink). Never use clay for a side. Register each new text pair in `src/lib/design/contrastPairings.js` with `TEXT` (4.5), and each new non-text pair with `UI` (3.0).
- **Caps.** At most 12 files directly in a folder (`check-dir-size`), and at most 600 lines in a file (`check-file-size`). `check-dead-exports` fails on an export that nothing imports, so delete each export you stop using.
- **Never add a `SealBox`.** The scout page is an open surface (ADR-0034).
- **Verify.**
  - Run the tests you wrote or changed, the tests that import a file you changed, and `npm run lint`. CI runs the full `npm test` and the build.
  - Start `npm run dev` and take screenshots with the helper (below) at 390 px, plus 1280 px for slice 8. Send them to Gary with `SendUserFile`, with the exact route.
- **Screenshot helper.** The container's Chromium cannot reach the MLB hosts, so `shot.mjs` sends their requests through Node:

  ```
  node .scratch/scout-redesign/shot.mjs "/scout/nick-pivetta-601713/jackson-chourio-694192" /tmp/s.png 390
  ```

- **Test pairs:**
  - Pivetta 601713 vs Chourio 694192: an active pair with a full grid.
  - Pujols 405395 vs Kershaw 477132: both retired, with Statcast meetings from 2008 to 2022.
  - Bonds 111188 vs Maddux 118120: both retired, no Savant rows. The Stats API career line is 154 PA, .262/.370/.485.
- **Handoff.**
  - Open a draft PR and push. When the work is done and CI is green, remove the `wip` label. Never merge. Never push to `main`.
  - Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report. Do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this plan or CLAUDE.md names count as asked for.

## Code map (verified 2026-10-19)

- **The page:** `src/screens/scout/ScoutPage.jsx` (329 lines).
  - Its tabs: `TABS` (line 60), rendered at about lines 238–305.
  - The View controls: `VIEWS` and `VIEW_KEY` (lines 58–59), `storedView` (65–72), `setView` (139–148), and the `ScoutScene` options (202–214).
- **Edge:** `src/screens/scout/edge/`.
  - `EdgePanel.jsx` holds the ledger and the verdict text.
  - `edge.js` exports `FAVORS`, `whoFavors`, `ledgerRows`, `rowTag`, `versus`, `ledgerScale`, `listOf`, `leanMetric`, `headline`, `textOf`, `typeSentences`, `whiffSentence`, `locationLens`, `leftOut`, `locationSentences` and `verdict`. `test/scout-edge.test.js` covers them.
- **Zones:** `src/screens/scout/zones/`.
  - `ZonesPanel.jsx` uses `turns` and `.is-turning`.
  - `MapParts.jsx` exports `Swatch`, `Sides`, `Answer`, `Readout` and `Key`.
  - `callout.js`.
  - The map itself is `src/components/scout/ScoutMap.jsx`, an SVG with cells `{tone, value, count}`.
- **Meetings:** `src/screens/scout/meetings/`.
  - `MeetingsPanel.jsx` has three states: loading, `null` meaning "No head-to-head on file", and empty `pas`. It fetches its own data (`useAsync(() => fetchHeadToHead(...))`, line 48; `fetchHeadToHead` is in `src/api/scout/headToHead.js`). The plate-appearance count for the jump bar therefore lives inside it today.
  - `headToHead.js` lines 68–69 say why `vsPlayer` is not its source: it lists each plate appearance twice. `test/fixtures/scout/vs-player-total.json` and `test/scout-head-to-head.test.js` already cross-check against the `vsPlayerTotal` entry. Nothing in `src/` calls `vsPlayer` yet.
  - `PitchModal.jsx`, `PitchZone.jsx`, `Facts.jsx`, and `meetings.js` (pure).
- **Data:**
  - `board.js` `pitcherBoard` returns `{tiles, types, codes, all, byType}`. Each map is `{n, thin, regionN, share, cells}`.
  - `hitterBoard.js` `hitterSide` returns `{all, byType, overall}`. Each `byType[code]` is `{hit, cells, typeVal, leagueFlat, seen, exp, league}`, with `exp` null when the pitcher's map is thin.
  - `src/lib/scout/metrics.js` holds `METRICS`, `band(metric, value, league)` (−2..2, null on a null input) and `expected`.
- **Styles:** `src/styles/scout/`.
  - `scout.css` is 526 lines (74 of headroom). Its motion block is at lines 482–520 and holds the keyframes `scout-ink` and `scout-turn`.
  - `panels.css` is 357 lines and `meetings.css` 332.
  - All three are imported by `ScoutPage.jsx`, lines 1–3.
  - The map tones today:
    - `.scout__region--hi1/hi2` use `--award-line` at .2 and .4.
    - `.scout__region--lo1/lo2` use `--allstar-blue` at .16 and .36.
- **Reusable parts:**
  - `HubTabBar` (`src/components/chrome/HubTabBar.jsx`) with `variant="anchor"`, `tabs=[{key, label, count}]`, `ariaLabel`, `offset` and `hold`. The team page uses it in `TeamNextPage.jsx`, lines 70–78. Each key is a section element id.
  - `Headshot` takes `{personId, name, teamId}`.
  - `teamLogoUrl(teamId)`.
  - `batterFigureUrls(assets, hand)` with `UniformFigure`.
  - `fetchTeamUniformCatalog(teamIds, season)` returns `{[teamId]: [{text, piece, code}]}`.
  - `rosterStatusView(person, onDate, {isMlbTeamId})` returns `{state, lastTeam, ...}` and needs `person.rosterEntries`, which `fetchPerson` already hydrates.
  - `yearsPlayed(p)` lives in `src/api/search.js`. It gives "2001-2022" with an ASCII hyphen for a retired player, "2001-" for an active one, and '' when `lastPlayedDate` is missing. The last year of play is `p.lastPlayedDate.slice(0, 4)`.
  - `isMlbTeamId(teamId)` lives in `src/lib/teams.js`.
  - `hitterBoard.js` already imports `band` (line 2) and has `expectedAll` (lines 81–93) above `hitterSide` (line 95).
  - `useInViewOnce(key)` returns `[ref, 'rest'|'wait'|'play']`.
  - `useCountUp` lives at `src/screens/team/next/ranks/runvalue/useCountUp.js` and is DOM-driven through `data-count-*`.
- **Tokens:**
  - `--allstar-blue` #1D4E8F, `--award-line` #C79A3E, `--award-ink` #8A5A1E (5.46:1 on `--surface-card`) and `--award-soft` #F6EBCF.
  - Motion: `--dur-fast` 120, `--dur-med` 220, `--dur-stamp-in` 380, `--dur-rise` 420, `--dur-rv-grow` 640, `--ease-stamp`, `--ease-out` and `--ease-unfold`, all in `src/tokens/effects.css`.

---

## Slice 1: the verdict function (Haiku 5.5, high)

Done means:

- `test/scout-verdict.test.js` is a copy of `verdict-draft.test.js`. It runs and fails first, because the function does not exist yet. Change the `DRAFT for slice 1` header comment to a plain description; keep the fixture note.
- `matchupVerdict` from `verdict-draft.js` is pasted into `src/screens/scout/hitterBoard.js`, between `expectedAll` and `hitterSide`, with its comment block. `band` is already imported there; add no import.
- All six tests pass, and `npm run lint` passes.
- `check-dead-exports` counts a test import as a use, so the new test keeps `matchupVerdict` from being flagged before slice 4 imports it.

## Slice 2: one view (Sonnet 5.5, medium)

Remove the View toggle and the pitcher's view **from the page**. Keep the geometry library, `src/lib/zone/regions.js`, and its tests: they test pure functions that stay.

- **`ScoutPage.jsx`:**
  - Delete `VIEWS`, `VIEW_KEY`, `storedView`, `savedView`, `setView` and `turns`.
  - Set `const view = 'hitter'`.
  - Pass no `options`, `value` or `onChange` to `ScoutScene`, and delete the fallback `<Choice label="View">`.
- **`ScoutScene.jsx`:** render the segmented control only when `options` is given, or delete it if nothing else passes `options`.
- **`ZonesPanel.jsx`:** remove `turns`, `key={turns}` and `.is-turning`.
- **`scout.css`:** remove `.scout__board` perspective, `.scout__maps.is-turning` and `@keyframes scout-turn`.
- **`src/lib/scout/path.js` and `route.js`:** stop writing and stop parsing `view` (ADR-0118: "`?view=` stops being read"). An old link with `?view=pitcher` still opens the page, because the parser ignores unknown parameters. Update the two tests in `test/scout-page.test.js` (lines 18–36) on purpose, and say in the PR which assertions changed and why.
- **Meetings:** `PitchModal` and `PitchZone` take their `view` from the page. Today the page default is `'pitcher'`, so after this slice the modal draws the hitter's view. That is the intended change (ADR-0118, 4). Check `test/scout-scene.test.js` and `test/scout-meetings.test.js` for a test that expects the pitcher's view.
- **The motion block** in `scout.css` loses the `scout-turn` keyframes and `.is-turning`; keep `scout-ink`.

Verify with `test/scout-page.test.js`, `test/scout-scene.test.js`, `test/scout-regions.test.js` and lint.

## Slice 3: one scroll (Sonnet 5.5, medium)

Turn the three tabs into four stacked sections under a `HubTabBar` with `variant="anchor"`. **Keep each section's content as it is today.** Slices 4–7 restyle the sections.

- **Section ids and labels:** `scout-edge` "Edge", `scout-pitches` "Pitches", `scout-where` "Where", `scout-meet` "Meetings".
- **Badge counts:** Pitches gets `board.types.length`. Meetings gets the plate-appearance count: lift the `fetchHeadToHead` read out of `MeetingsPanel.jsx` into `ScoutPage.jsx` and pass the result down as a prop (leave the badge empty while loading). Edge and Where get none.
- **Move the ledger and the pills:**
  - Move the ledger, meaning the `.scout__ledgerhead` and `.scout__ledger` block, out of `EdgePanel.jsx` into a new `src/screens/scout/pitches/PitchRows.jsx`. Move it unchanged.
  - Move the Metric `Choice` that sits under the ledger into `ScoutPage.jsx`, at the top of the Where section. The page owns the `metric` state; the ledger still reads it. Slice 6 moves the control into the Where panel's own control row.
  - Move the pitch-pill row from `ScoutPage.jsx` into the Pitches section.
  - The scene stays where it is, above the sections, for now.
- **Page wiring.** Do all of it here: pass `selectedPitch`, `metric` and the lifted head-to-head result to the panels as props, and build the section list in one array so that slice 7b can hide sections by changing one flag. Slices 4 to 7 then need no other edit in `ScoutPage.jsx`.
- **Delete** `TABS`, the tab buttons, `role="tablist"`, `?tab` writing in `path.js` and `TABS` in `route.js`. Stop parsing `?tab` too (ADR-0118, 1). Update the `tab` assertions in `test/scout-page.test.js` on purpose and say so in the PR.
- **Create four CSS partials** in `src/styles/scout/`: `edge.css`, `pitches.css`, `where.css` and `meet.css`. Each holds one header comment and the rules moved for its section. `ScoutPage.jsx` imports all of them after the three that exist. Slices 4–7 each own one partial.
- **The jump bar's offset** matches the sticky site header. Read how `TeamNextPage` sets `BAR_H`.
- **Verify:** `test/scout-page.test.js`, the scout tests that import a file you changed, lint, and the 390 px screenshot.

## Slice 4: the edge (Sonnet 5.5, high)

Build the edge section from the canvas (phone board, section "The edge"). Files: `src/screens/scout/edge/` and `src/styles/scout/edge.css`.

1. **Verdict card** (a new `edge/VerdictCard.jsx`). It is an ink stamped card (`Card frame="stamped"` in the ink tone) with the name tab "The verdict".
   - **Headline from `v = matchupVerdict(board, sides.xwoba)`:** `band === 0` reads "Even". Otherwise it reads `Edge {name}` (the hitter's last name when `band > 0`, the pitcher's when `band < 0`), and under it "Slight" or "Clear" for |band| 1 or 2.
   - **Sub-line:** inside the band it reads "Inside the ±.030 band · no side has the edge". Outside it reads "Past ±.030" for Slight or "Past ±.070" for Clear.
   - **The scale:** five segments, at 15%, 20%, 30%, 20% and 15% of the width:
     - Clear for the pitcher: `--allstar-blue`.
     - Slight for the pitcher: `--allstar-blue` mixed toward ink.
     - Even: the graphite tone.
     - Slight for the hitter: `--award-line` mixed toward ink.
     - Clear for the hitter: `--award-line`.
     - A centre line marks the league.
     - The marker sits at `50 + clamp(gap / 0.1, −1, 1) * 50` percent, with its label `fmtValue('xwoba', |gap|)` and the sign of the gap.
     - Labels "◀ {pitcher}" and "{hitter} ▶".
     - The line under the scale: "Expected xwOBA (est.) {value} · league {league} on the same pitches."
   - **No grid:** when `sides.xwoba` is null (no grid), show the existing `HitterLine` fallback, as `EdgePanel` does today.
2. **What pushes it:** one row per `v.rows` entry.
   - Each row shows the name, "{round(share*100)}% of pitches", a bar from the centre line toward the hitter (positive push, amber) or the pitcher (negative push, blue) with width `|push| / 0.015 * 50`%, and the signed value with three decimals and no leading zero (+.009).
   - The note under the rows: "xwOBA (est.) counts every plate appearance, and a strikeout counts 0 …". Name the types where `mapped` is false, with their `n`.
3. **Things to watch:** a list built from the existing `edge.js` sentences, with no new copy.
   - Each item shows the player's 56 px `Headshot`, a name tag in that player's side colour, and the sentence through `<Rich>`.
   - Map each sentence to a player:
     - `typeSentences`: the "beats the league" sentence goes to the hitter, and "has the edge" goes to the pitcher.
     - `whiffSentence` goes to the pitcher.
     - The hot/cold sentence from `locationSentences` goes to the hitter when `lens.hot > lens.cold`, else to the pitcher.
     - Drop the "Leaves out" sentence (the pushes note covers it), and the "Too few" sentence.
   - Add a pure `watchList({board, sides, names, stance})` to `edge.js` that returns `[{who: 'hitter'|'pitcher', parts}]`, with a test.
4. **Remove from `EdgePanel`** the old "Lean …" headline and the paragraphs it replaces. Delete each `edge.js` export that goes dead (likely `verdict`, `headline` and `leanMetric`) and change `test/scout-edge.test.js` on purpose; the PR says which tests. Keep `FAVORS`, `whoFavors`, `ledgerRows`, `ledgerScale`, `rowTag` and `versus`: `PitchRows` uses them and slice 5 builds on them.
5. **Contrast pairs:** register `award-ink`/`surface-card`, `text-heading`/`award-line` and `text-on-ink`/`surface-stamped-ink` if they are missing.

## Slice 5: pitch by pitch (Sonnet 5.5, medium)

Files: `src/screens/scout/pitches/` and `src/styles/scout/pitches.css`. Restyle `PitchRows` into the canvas's tug-of-war rows. **Keep `ledgerRows` and `versus` as the data.**

- **Each row is a `<button>`** (it selects the pitch; a second tap clears it). It shows:
  - The pitch mark from `pitchMark(code)` (`src/lib/pitch/pitchTypes.js`), the name, "{pct}% · {mph} mph", and a usage bar.
  - A **Contact** line: a bar from the centre toward the side the xwOBA (est.) row favors, with width `min(|value − league| / 0.100, 1) * 50`%, and the word from `rowTag` plus `versus('xwoba', row)`.
  - A **Whiff** line in the same form, from `ledgerRows(board.types, sides.whiff, 'whiff')`, with a scale of 12 points. Higher whiff favors the pitcher, so its bar points left.
  - A swing line: "Swings at {x}% · league {y}% · favors neither".
  - Even uses the graphite tone.
- **Above the rows:** the "◀ {pitcher}'s side · League · {hitter}'s side ▶" header and an "All pitches" button.
- **Remove** the pitch-pill row from this section. The rows select the pitch now. Do not touch the Metric control: it sits in the Where section since slice 3, and slice 6 owns it. The contact and whiff lines use fixed metrics, so the rows no longer depend on `metric`.
- **Not in this slice:** the phone chip strip (slice 6 builds it in the Where section).

## Slice 6: Where (Sonnet 5.5, high)

Files: `src/screens/scout/zones/`, `src/components/scout/ScoutMap.jsx`, `src/styles/scout/where.css`, `FilterSheet.jsx` and the Where lines in `ScoutPage.jsx`. Draw **one** map in place of the two. The batter figure is slice 6b.

- **`ScoutMap` gets `mode`:**
  - `'both'`: the fill is the hitter's tone, plus a centred square in the ink token (no raw colour) with side `round(maxSide * sqrt(share / maxShare))` and the share % under the figure.
  - `'locations'`: the pitcher's map as today.
  - `'results'`: the hitter's map as today.
  - Hatching rules stay. In `'both'` mode, when the pitcher's map is thin, draw no squares and show the note "{Pitch}: {n} pitches to {crowd}, under the 50-pitch floor."
- **Tones flip by side for Whiff %.** A higher whiff rate is the pitcher's side, so in Whiff % `hi*` uses `--allstar-blue` and `lo*` uses `--award-line`. xwOBA (est.) keeps hi as amber and lo as blue. Swing % uses neutral ink tints. Do this with a class on the map, for example `.scout__map--whiff`, not in JS colours.
- **Controls above the map:**
  - Show (Both / Locations / Results), with the default Both.
  - Metric (xwOBA / Whiff % / Swing %). Slice 3 left the control at the top of the Where section in `ScoutPage.jsx`; move it into this control row. It was also in the Filters sheet: remove it from `FilterSheet.jsx` and from `filterSummary`, and update the tests that import them on purpose.
  - Both use `Choice`.
- **Phone chip strip:** a sticky strip (All plus one chip per pitch, each with its mark) at the top of the Where section (`#scout-where`). It sets the same selected pitch as the rows in the Pitches section. Pin it under the jump bar. Below 740 px only.
- **Keep:** the readout, the key, the hot and cold tiles (the `zoneCallout` numbers) and the answer strip.
- **Delete** `Sides` view logic that only served the pitcher's view, if slice 2 left any.

## Slice 6b: the batter figure (Sonnet 5.5, medium)

Needs slice 6 merged (it edits `ScoutMap.jsx` and `where.css`). Files: `ScoutMap.jsx`, `where.css`, `loadScout.js` or the Where panel for the catalog fetch, and a new pure `homeSetOf`.

- **Batter figure:**
  - Replace the stance box with `UniformFigure`, built from `batterFigureUrls(homeSet, hand)`.
  - `homeSet` is the hitter's club home set from `fetchTeamUniformCatalog([teamId], season)`. Choose the jersey whose text says "Home", then the pants from the same set. Add a pure `homeSetOf(catalog, teamId)` with a test. If nothing is found, keep today's stance box.
  - `hand` is 'right' for a right-handed stance and 'left' for a left-handed one. Never use a CSS mirror.
  - Scale it so the art's y 385 to 820 (of 1050) spans the zone rows, and let the bat clip. See the canvas for the exact numbers at 390 px.
- **Verify:** the new `homeSetOf` test, lint, and a 390 px screenshot of a right-handed and a left-handed hitter.

## Slice 7: meetings restyle (Sonnet 5.5, medium)

Files: `src/screens/scout/meetings/` and `src/styles/scout/meet.css`.

- **Restyle the cards to the canvas.**
  - A pitch is a numbered row: mark, name · mph, "Count b-s", and the call **written out** in a tag:
    - Called strike, Swinging strike, Foul, Ball and In play come from `callOf`.
    - Strikes take a blue tag, a ball a paper tag, and in play an ink tag.
  - Remove `AsOfBanner` and the intro line from this section; the cutoff logic stays.
- **Verify:** `test/scout-meetings.test.js`, lint, and a 390 px screenshot of the Pivetta vs Chourio meetings.

## Slice 7b: retired players (Sonnet 5.5, high)

Needs slice 7 merged (it edits `MeetingsPanel.jsx`). Files: `loadScout.js`, the `Matchup.jsx` card, `MeetingsPanel.jsx`, the one hide-sections flag in `ScoutPage.jsx` (slice 3 built it), and a new `src/api/scout/vsPlayer.js`.

1. **Retired detection** (`loadScout.js`).
   - Add `retired: boolean` to each person: `p.active === false`.
   - Add `inStores: boolean`: the pitcher has `arsenal.pit[id]`, and the hitter has `grid` or a Savant `bat` row.
   - When either `inStores` is false, `ScoutPage` hides the Edge, Pitches and Where sections and their jump-bar tabs, and shows one line above Meetings: "{Last name} last played in {yyyy} · scouting data covers {season}".
3. **Card identity for a retired player.**
   - The logo comes from `rosterStatusView(person, today, { isMlbTeamId }).lastTeam.id`. Pass `isMlbTeamId` from `src/lib/teams.js`.
   - The hand line reads "Bats R · {yearsPlayed(p)} · Retired". The span uses an ASCII hyphen.
4. **Before pitch tracking.** Read `src/api/scout/headToHead.js` lines 60–75 first: `vsPlayer` lists each plate appearance twice. When `fetchHeadToHead` returns `{pas: []}` and either player's last year of play (`lastPlayedDate.slice(0, 4)`) is before 2008:
   - Fetch `/api/v1/people/{hitterId}/stats?stats=vsPlayer&group=hitting&opposingPlayerId={pitcherId}&sportId=1` through `getJson`.
   - Read **only** the split under `stats[].type.displayName === 'vsPlayerTotal'`.
   - Show PA, AVG/OBP/SLG, HR, K and BB with the label "Regular season · no pitch tracking before 2008".
   - Add `parseVsPlayerTotal(json)` as a pure function, with a test on `vsplayer-bonds-maddux.json`. Copy that file to `test/fixtures/scout/vs-player-bonds-maddux.json` (beside the existing `vs-player-total.json`). Expected: PA 154, .262/.370/.485, HR 8, K 16, BB 23. The test must show that the per-season `vsPlayer` splits are ignored.
5. **Verify on the three test pairs.**

## Slice 8: desktop (Sonnet 5.5, medium)

At 740 px and wider, follow the canvas desktop board. Each rule goes in its section's partial under `@media (min-width: 740px)`.

- A 1240 px max-width page.
- The matchup card in one row, with 96 px headshots.
- The edge: the verdict card and "What pushes it" side by side, and the watch list in two columns.
- Pitch by pitch beside Where. The pitch column pins (`position: sticky`) only under `@media (min-height: 900px)`.
- Meeting cards in a three-column grid.
- No chip strip at this width.

## Slice 9: motion (Sonnet 5.5, medium)

Put the rules in a new `src/styles/scout/motion.css`, imported by `ScoutPage.jsx` after the other scout sheets. Do not use `src/styles/motion/`: it holds 12 source files, the `check-dir-size` cap, so a 13th file fails lint. The scout sheets are already page-imported and hold their own motion block (`scout.css` lines 488–520). Add a one-line pointer to the new file in `docs/motion.md`. Read `docs/motion.md` and `.agents/skills/review-animations/STANDARDS.md` first. Everything goes inside `@media (prefers-reduced-motion: no-preference)`.

| Motion | Spec | Gate |
| --- | --- | --- |
| Verdict card | Stamp-in, `--dur-stamp-in` `--ease-stamp` | `useInViewOnce('scout:{pitcherId}:{hitterId}:verdict')` |
| Marker + label | Slide from the centre line, `--dur-rv-grow` ease-out after 260 ms; count-up with `useCountUp` | same |
| Push bars, tug bars | `scaleX(0)` to 1 from the centre line, `--dur-rise`, 55 ms stagger | the section's `useInViewOnce` |
| Map on a pitch, Show or Metric tap | Fill tween `--dur-med`; squares resize `--dur-med` `--ease-out`; changed figures `scout-ink` (they already key on value) | every tap |
| Presses | 2 px down and right, `--dur-fast` `--ease-stamp` | every tap |
| Meeting cards | Stamp-in, 55 ms stagger | `useInViewOnce` |
| Scene in flight | Pulse only the pitch mark in the rows and chips | the scene's `onActive` |

Under reduced motion every part shows its end state, and the count-up shows the final value. Add each new duration and delay as a token if `check-raw-values` asks.

---

## Prompts

Paste one prompt per cloud session. The spec for each slice is its section above, so the prompts are short. Each one names the slice it needs on `main`; the agent checks that first and stops if it is missing.

**Landing order.** Start a wave only when the earlier waves are merged:

| Wave | Slices | Starts when |
| --- | --- | --- |
| 0 | PR 2320 (this folder and ADR-0118) | now |
| 1 | 1 and 2 | wave 0 is on `main` |
| 2 | 3 | slice 2 is on `main` |
| 3 | 4, 5, 6, 7 | slices 1 and 3 are on `main` |
| 4 | 6b and 7b | slice 6 (for 6b) or slice 7 (for 7b) is on `main`; they can start while 4 and 5 run |
| 5 | 8 and 9 | all of 4, 5, 6, 6b, 7, 7b are on `main` |

**If a slice stalls.** Raise the effort on the same model, then the model (one rung at a time), as in "Run plan". A slice that stops with "a file I need to change is in another open PR" waits for that PR. A slice that reports "the canvas did not open" needs Gary.

**Unverified when this plan was written:** that a child cloud session can open the canvas artifact; the `/scout/` slugs for Kershaw, Pujols, Maddux and Bonds (they follow the name-id pattern of the Pivetta route); and the band-edge behaviour of the verdict at exactly .030 and .070 (the code uses a strict less-than, so a gap of exactly .030 reads Slight).

### Slice 1 — Haiku 5.5, effort medium

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Build slice 1 of the Matchup Scout redesign (issue #2319, gzilavyss2025/bbsbh). Read
.scratch/scout-redesign/README.md: "Shared rules", "Code map" and "Slice 1". That section is the whole
spec; ADR-0118 holds the decisions, so do not reopen them. This is a paste of verified code: copy the test, run it and see it fail, paste the function, run it and see it pass.

Do only slice 1, on your session's branch from current origin/main. PR 2320 (ADR-0118 and this folder) must be on main; if not, stop and report.
The PR body says "Part of #2319", never "Closes". Open it as a draft; when the work is done and CI is
green, remove the wip label. Never merge.
Verify as "Shared rules → Verify" says. No screenshot: this slice changes no screen.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the
user, or before a risky step. When the work is done and checked, stop and report; do not add features,
tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md
names count as asked for.
```

### Slice 2 — Sonnet 5.5, effort medium

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Build slice 2 of the Matchup Scout redesign (issue #2319, gzilavyss2025/bbsbh). Read
.scratch/scout-redesign/README.md: "Shared rules", "Code map" and "Slice 2". That section is the whole
spec; ADR-0118 holds the decisions, so do not reopen them. Match the design canvas with the repo's
tokens and components.

Do only slice 2, on your session's branch from current origin/main. PR 2320 must be on main; if not, stop and report.
The PR body says "Part of #2319", never "Closes". Open it as a draft; when the work is done and CI is
green, remove the wip label. Never merge.
Verify as "Shared rules → Verify" says. Send Gary the 390 px screenshot of
/scout/nick-pivetta-601713/jackson-chourio-694192?nointro.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the
user, or before a risky step. When the work is done and checked, stop and report; do not add features,
tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md
names count as asked for.
```

### Slice 3 — Sonnet 5.5, effort medium

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Build slice 3 of the Matchup Scout redesign (issue #2319, gzilavyss2025/bbsbh). Read
.scratch/scout-redesign/README.md: "Shared rules", "Code map" and "Slice 3". That section is the whole
spec; ADR-0118 holds the decisions, so do not reopen them. Match the design canvas with the repo's
tokens and components.

Do only slice 3, on your session's branch from current origin/main. Slice 2 must be merged to main; if not, stop and report.
The PR body says "Part of #2319", never "Closes". Open it as a draft; when the work is done and CI is
green, remove the wip label. Never merge.
Verify as "Shared rules → Verify" says. Send Gary the 390 px screenshot of
/scout/nick-pivetta-601713/jackson-chourio-694192?nointro.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the
user, or before a risky step. When the work is done and checked, stop and report; do not add features,
tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md
names count as asked for.
```

### Slice 4 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Build slice 4 of the Matchup Scout redesign (issue #2319, gzilavyss2025/bbsbh). Read
.scratch/scout-redesign/README.md: "Shared rules", "Code map" and "Slice 4". That section is the whole
spec; ADR-0118 holds the decisions, so do not reopen them. Match the design canvas with the repo's
tokens and components.

Do only slice 4, on your session's branch from current origin/main. Slices 1 and 3 must be merged to main; if not, stop and report. Do not edit ScoutPage.jsx.
The PR body says "Part of #2319", never "Closes". Open it as a draft; when the work is done and CI is
green, remove the wip label. Never merge.
Verify as "Shared rules → Verify" says. Send Gary the 390 px screenshot of
/scout/nick-pivetta-601713/jackson-chourio-694192?nointro.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the
user, or before a risky step. When the work is done and checked, stop and report; do not add features,
tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md
names count as asked for.
```

### Slice 5 — Sonnet 5.5, effort medium

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Build slice 5 of the Matchup Scout redesign (issue #2319, gzilavyss2025/bbsbh). Read
.scratch/scout-redesign/README.md: "Shared rules", "Code map" and "Slice 5". That section is the whole
spec; ADR-0118 holds the decisions, so do not reopen them. Match the design canvas with the repo's
tokens and components.

Do only slice 5, on your session's branch from current origin/main. Slice 3 must be merged to main; if not, stop and report. Do not edit ScoutPage.jsx, and do not touch the Metric control.
The PR body says "Part of #2319", never "Closes". Open it as a draft; when the work is done and CI is
green, remove the wip label. Never merge.
Verify as "Shared rules → Verify" says. Send Gary the 390 px screenshot of
/scout/nick-pivetta-601713/jackson-chourio-694192?nointro.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the
user, or before a risky step. When the work is done and checked, stop and report; do not add features,
tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md
names count as asked for.
```

### Slice 6 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Build slice 6 of the Matchup Scout redesign (issue #2319, gzilavyss2025/bbsbh). Read
.scratch/scout-redesign/README.md: "Shared rules", "Code map" and "Slice 6". That section is the whole
spec; ADR-0118 holds the decisions, so do not reopen them. Match the design canvas with the repo's
tokens and components.

Do only slice 6, on your session's branch from current origin/main. Slice 3 must be merged to main; if not, stop and report. In ScoutPage.jsx edit only the Where lines (the Metric control).
The PR body says "Part of #2319", never "Closes". Open it as a draft; when the work is done and CI is
green, remove the wip label. Never merge.
Verify as "Shared rules → Verify" says. Send Gary the 390 px screenshot of
/scout/nick-pivetta-601713/jackson-chourio-694192?nointro.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the
user, or before a risky step. When the work is done and checked, stop and report; do not add features,
tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md
names count as asked for.
```

### Slice 6b — Sonnet 5.5, effort medium

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Build slice 6b of the Matchup Scout redesign (issue #2319, gzilavyss2025/bbsbh). Read
.scratch/scout-redesign/README.md: "Shared rules", "Code map" and "Slice 6b". That section is the whole
spec; ADR-0118 holds the decisions, so do not reopen them. Match the design canvas with the repo's
tokens and components.

Do only slice 6b, on your session's branch from current origin/main. Slice 6 must be merged to main; if not, stop and report. Do not edit ScoutPage.jsx.
The PR body says "Part of #2319", never "Closes". Open it as a draft; when the work is done and CI is
green, remove the wip label. Never merge.
Verify as "Shared rules → Verify" says. Send Gary the 390 px screenshot of
/scout/nick-pivetta-601713/jackson-chourio-694192?nointro, and one of a left-handed hitter.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the
user, or before a risky step. When the work is done and checked, stop and report; do not add features,
tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md
names count as asked for.
```

### Slice 7 — Sonnet 5.5, effort medium

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Build slice 7 of the Matchup Scout redesign (issue #2319, gzilavyss2025/bbsbh). Read
.scratch/scout-redesign/README.md: "Shared rules", "Code map" and "Slice 7". That section is the whole
spec; ADR-0118 holds the decisions, so do not reopen them. Match the design canvas with the repo's
tokens and components.

Do only slice 7, on your session's branch from current origin/main. Slice 3 must be merged to main; if not, stop and report. Do not edit ScoutPage.jsx.
The PR body says "Part of #2319", never "Closes". Open it as a draft; when the work is done and CI is
green, remove the wip label. Never merge.
Verify as "Shared rules → Verify" says. Send Gary the 390 px screenshot of
/scout/nick-pivetta-601713/jackson-chourio-694192?nointro.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the
user, or before a risky step. When the work is done and checked, stop and report; do not add features,
tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md
names count as asked for.
```

### Slice 7b — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Build slice 7b of the Matchup Scout redesign (issue #2319, gzilavyss2025/bbsbh). Read
.scratch/scout-redesign/README.md: "Shared rules", "Code map" and "Slice 7b". That section is the whole
spec; ADR-0118 holds the decisions, so do not reopen them. Match the design canvas with the repo's
tokens and components.

Do only slice 7b, on your session's branch from current origin/main. Slice 7 must be merged to main; if not, stop and report. In ScoutPage.jsx edit only the hide-sections flag.
The PR body says "Part of #2319", never "Closes". Open it as a draft; when the work is done and CI is
green, remove the wip label. Never merge.
Verify as "Shared rules → Verify" says. Send Gary the 390 px screenshots of
/scout/nick-pivetta-601713/jackson-chourio-694192?nointro,
/scout/clayton-kershaw-477132/albert-pujols-405395?nointro and
/scout/greg-maddux-118120/barry-bonds-111188?nointro (the last two slugs follow
the name-id pattern of the first; if one does not open, fix the slug).

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the
user, or before a risky step. When the work is done and checked, stop and report; do not add features,
tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md
names count as asked for.
```

### Slice 8 — Sonnet 5.5, effort medium

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Build slice 8 of the Matchup Scout redesign (issue #2319, gzilavyss2025/bbsbh). Read
.scratch/scout-redesign/README.md: "Shared rules", "Code map" and "Slice 8". That section is the whole
spec; ADR-0118 holds the decisions, so do not reopen them. Match the design canvas with the repo's
tokens and components.

Do only slice 8, on your session's branch from current origin/main. Slices 4, 5, 6, 6b, 7 and 7b must all be merged to main; if not, stop and report. Do not edit ScoutPage.jsx.
The PR body says "Part of #2319", never "Closes". Open it as a draft; when the work is done and CI is
green, remove the wip label. Never merge.
Verify as "Shared rules → Verify" says. Send Gary the 390 px and 1280 px screenshots of
/scout/nick-pivetta-601713/jackson-chourio-694192?nointro.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the
user, or before a risky step. When the work is done and checked, stop and report; do not add features,
tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md
names count as asked for.
```

### Slice 9 — Sonnet 5.5, effort medium

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Build slice 9 of the Matchup Scout redesign (issue #2319, gzilavyss2025/bbsbh). Read
.scratch/scout-redesign/README.md: "Shared rules", "Code map" and "Slice 9". That section is the whole
spec; ADR-0118 holds the decisions, so do not reopen them. Match the design canvas with the repo's
tokens and components.

Do only slice 9, on your session's branch from current origin/main. Slices 4, 5, 6, 6b, 7 and 7b must all be merged to main; if not, stop and report. Put the rules in src/styles/scout/motion.css, not in src/styles/motion/ (that folder is at the file cap). In ScoutPage.jsx add only the one import.
The PR body says "Part of #2319", never "Closes". Open it as a draft; when the work is done and CI is
green, remove the wip label. Never merge.
Verify as "Shared rules → Verify" says. Motion cannot show in a still, so tell Gary how to see each motion in the dev server, and send
the 390 px reduced-motion end state of /scout/nick-pivetta-601713/jackson-chourio-694192?nointro.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the
user, or before a risky step. When the work is done and checked, stop and report; do not add features,
tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md
names count as asked for.
```
