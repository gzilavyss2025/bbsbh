# Contact replay: run plan

A run plan for `/orchestrate` (Lane 3). It builds the contact replay (issue #1771,
phases A to C) and the tuning work (#2345, #2305). Written 2026-10-19 by a
planning session that used `write-prompt`, and checked against `origin/main` on
that date.

**To start it:** open a cloud session in **Auto** mode (children inherit the
mode; in Accept edits every git and npm call waits for a tap), run
`/orchestrate`, and give it this file. It runs unattended (see Standing answers).

**Before it starts, read these** (the prompts depend on them):

- `docs/contact-replay.md`: the spec. It wins on any conflict.
- `.scratch/contact-replay/facts.md`: facts measured on completed games
  (the fixture game, the Savant field shapes, the screenshot setup, the
  directory limits). Each prompt treats them as settled.
- `.scratch/contact-replay/prototype.html`: Gary's design prototype. Builders
  port its math.

**No live game is needed.** Every row works from completed games. The one
measurement that needs a live game (the CSV fill time) is issue #2349, outside
this plan, and it gates nothing (spec §3.3).

**No Opus row.** The one hard design question (one clock across `PitchScene`,
`SideView` and `QualityLine`, with a slot per pitch) is settled in prompts 4 and
6, and their tests fail on a wrong design.

## The table

Slug: `contact-replay`.

| # | What it does | Model | Effort | Depends on | Parallel with |
| --- | --- | --- | --- | --- | --- |
| 0 | Prep: PR #2346 (this file, `facts.md`, the prototype copy). No session. If it is merged, row 0 is done. | — | — | — | 1, 2, 3 |
| 1 | #2345: measure the contact point and the verdict rates (docs only) | Sonnet 5.5 | medium | — | 2, 3 |
| 2 | Phase A data: `hit`, `playId`, swing class, bat side, fixture | Sonnet 5.5 | medium | — | 1, 3 |
| 3 | Move `flightModel` to `lib/ballpark/`, add `easeOut` | Sonnet 5.5 | medium | — | 1, 2 |
| 4 | Phase A pure models and the replay clock | Sonnet 5.5 | high | rows 0, 2, 3 merged | 5 |
| 5 | Phase B: the `/gf` module, stripped on parse | Sonnet 5.5 | high | row 2 merged | 4 |
| 6 | Phase A: the scene | Sonnet 5.5 | high | row 4 merged | — |
| 7 | Phase A: the side view and the quality line | Sonnet 5.5 | high | row 6 merged | — |
| 8 | Phase B wiring | Sonnet 5.5 | medium | rows 5, 7 merged | — |
| 9 | #2305: tune the drawn values | Sonnet 5.5 | high | rows 1, 8 merged | — |
| 10 | Phase C: the ink bat and the attack label | Sonnet 5.5 | high | row 9 merged | — |

Waves: 1 = rows 1, 2, 3 (stack row 0 with them if it is still open);
2 = rows 4, 5; 3 = row 6; 4 = row 7; 5 = row 8; 6 = row 9; 7 = row 10.

## Standing answers

- **Ledger:** comments on issue #1771.
- **Merges:** every wave lands through `/stack-prs` before the next wave starts,
  and the next wave starts from the new `origin/main`.
- **Retries:** rows 4, 6, 7 and 10 may retry once on Sonnet 5.5 at xhigh after
  two red tries. Start no Opus session. A row that still fails is blocked, and
  so is every row that depends on it.
- **Verdict cutoffs:** row 8 uses .500 and .250 (spec §7.2) as named constants.
  Gary changes them later from the #2345 numbers. No row changes them.
- **Visual changes (row 9):** a value changes only with a before and an after
  screenshot. Otherwise it stays.
- **A fact in `facts.md` turns out wrong:** the child stops and reports with
  NEEDS PARENT. Do not let a child work around it.
- **Time limit:** 24 hours. If the run stops early, the morning report names the
  next wave.

## The prompts

Each prompt stands alone. The orchestrator puts "Run at <effort>." first and
adds its footer (Lane 3, step 3). Screenshot steps use the setup in
`facts.md`: route `/10152026/millad/{half}?nointro`, with localStorage
`bbsbh:reveal:849810` = `"17"` seeded before the page loads, at two viewports:
390x844 (the phone sheet) and 1280x800 (the wide rail).

### Prompt 1 of 10 — Sonnet 5.5, effort medium

```
Work issue #2345 in gzilavyss2025/bbsbh. Its body is the task; its "Done means" is the finish line. Read .scratch/contact-replay/facts.md first; its facts are settled.

- Docs only. Add the two "Measured on real games" subsections to docs/contact-replay.md (end of §6.1, end of §7.2). Change no value. Do not edit the spec's opening paragraph.
- The CSV: build the URL from the pattern in src/api/scout/headToHead.js (about line 112), with `game_pk=<pk>` to get one game (facts.md shows a working URL). Field docs: https://baseballsavant.mlb.com/csv-docs. Use at least 5 completed 2026 MLB games, 849810 among them, and record every gamePk.
- A one-off script, if you need one, goes in .scratch/contact-replay-tuning/.
- Style: ASD-STE100 (docs/agents/writing-style.md). Label each inference. Say "postseason", never "playoffs".

Verify: npm run lint. PR body: "Part of #2305".

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.
```

### Prompt 2 of 10 — Sonnet 5.5, effort medium

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Contact replay, phase A, data slice (#1771). Spec: docs/contact-replay.md; it wins on conflict. Read §3.1, §10, §11, src/api/CLAUDE.md and .scratch/contact-replay/facts.md first. The facts in facts.md are settled.

1. Fixture: gamePk 849810 (facts.md lists its at-bats). Record a trimmed live feed (statsapi.mlb.com/api/v1.1/game/849810/feed/live, reachable) in test/fixtures/contact-replay/game-849810.trimmed.json, a new folder. Keep only the plays in facts.md's table. Follow the pattern of test/fixtures/game-*.trimmed.json.
2. src/api/playbyplay/pitchInfo.js, the pitchDetails map (about line 136): add `hit` (the exact shape in §3.1, read from that pitch's own playEvents entry) and `playId: e.playId ?? null`. Check each hitData path in the fixture and name gamePk 849810 in the comment, like the vX0 comment. The module stays reveal-only in spoiler-manifest.json.
3. src/lib/pitcherCard/atBat.js: `atBatScenePitches(pitchDetails, view, batSide)`. On each scene pitch put `hit`, `playId`, `batSide`, and `swing` = the detail's `cat` when it is 'whiff', 'foul' or 'inplay', else null.
4. Its only caller, useReplayPitches in src/components/playbyplay/pitcherCard/AtBatReplay.jsx: pass `entry.batSide`, and add batSide to the memo's content key (`hit` is already in it through pitchDetails).

Tests first, in test/at-bat-scene.test.js (it already covers pitchCardInfo); watch them fail:
- the four pitchInfo cases in §11, against the fixture;
- `swing` is null on a ball and on a called strike;
- `batSide` passes through.

Nothing user-visible changes. Verify: your tests, the existing tests that import a changed file, npm run lint. CI runs the full npm test and build. PR body: "Part of #1771".

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.
```

### Prompt 3 of 10 — Sonnet 5.5, effort medium

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Contact replay prep (#1771; docs/contact-replay.md §4, §8.1). Read src/lib/CLAUDE.md, src/screens/player/next/CLAUDE.md and .scratch/contact-replay/facts.md first. Nothing user-visible changes.

1. Move `simFlight` and `flightModel` (and only what they need) from src/screens/player/next/modules/contact/contactFlight.js to a new src/lib/ballpark/flightModel.js. Re-export them from contactFlight.js, so the Contact card and its tests do not change. Add a start-height argument in ft to both (default 3, today's fixed value). src/lib/ballpark/ then holds 12 source files, the check-dir-size cap: add nothing else there.
2. src/lib/motion/curves.js: add `easeOut` for the `--ease-out` token (src/tokens/effects.css line 64: cubic-bezier(0.16, 1, 0.3, 1)). Pin it in test/motion-curves.test.js the way EASE_STAMP is pinned.

Tests:
- test/player-next-contact-flight.test.js passes unchanged;
- a new test: start height 3 gives the old numbers exactly; a lower start height lands sooner.

Verify: your tests, the existing tests that import a changed file, npm run lint. CI runs the full npm test and build. PR body: "Part of #1771".

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.
```

### Prompt 4 of 10 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Contact replay, phase A, the pure models (#1771). Read docs/contact-replay.md §6 and §8 (the spec wins on conflict), .scratch/contact-replay/README.md, .scratch/contact-replay/facts.md, and in .scratch/contact-replay/prototype.html the functions swingModel, battedFlight, groundRoll, sampleAt and build. PORT that math; do not invent new math. Pure modules: no React, no DOM. New files go in src/lib/pitcherCard/ (6 today, 9 after; cap 12).

THE DESIGN BELOW IS SETTLED. Do not redesign it.

1. swing.js
   - export YC = 2.2.
   - swingModel({ batSide, swing, K, attackDeg = 10, swingSec = 0.16 }) returns { at(dt), sweet(theta), Kb, TH0, THE, COIL, SWING, FOLLOW }, as in the prototype.
   - side: -1 for batSide 'R', +1 for 'L'.
   - Export as named constants: the whiff offset (0.42), the foul offset (0.11) and the centre offset (2.25). Issue #2305 tunes them later.
2. batted.js
   - battedPath(hit, K) returns { pos(t), T, exitSec }. pos(t) is in scene ft, t seconds after contact. Fit with simFlight/flightModel from src/lib/ballpark/flightModel.js (start height K[2]). Turn by the spray angle (§3.1; import HIT_COORD_ORIGIN from src/lib/ballpark/hitProjection.js). Below 8° launch, use the bounce model (§6.4).
   - foulPath(K, batSide): the drawn foul (§6.4).
   - sideViewPath(hit): the 2-D path at the §7.1 scale.
   - Edge cases: §10 (no distance, no coordinates, no launch angle, bunt).
3. contactTimeline.js, THE REPLAY CLOCK
   - Background: sceneFrame (scene.js:143) gives every pitch ONE fixed slot (longest T × slow + HOLD). The Now Pitching card and the Scout use it. DO NOT CHANGE sceneFrame.
   - contactPoint(flight): `flight` is realFlight's { T, at(u) } (camera.js:52). at(u) takes u in [0, 1] from release to plate front, NOT seconds. Solve for the u where y = YC. Return { tc: u × T, K: at(u) }, or null when the path never reaches YC.
   - pitchBeats(pitch, slow, figCount = 1): ms of screen time from release, ported from prototype build(): contactMs, freezeMs (66 in play, 33 foul, 0 whiff; NOT scaled by slow), exitMs, sceneEndMs, sideStartMs, sideMs, landMs, figsStartMs, verdictMs, totalMs. A pitch with swing == null returns only { totalMs: (T × slow + HOLD) × 1000 }. Export HOLD from scene.js (line 134); do not copy 0.9.
   - sceneClock(beats, tau): the scene's time in ms; it holds at contactMs for freezeMs (prototype render()).
   - replayFrame(beatsList, elapsedMs, picked): plays the pitches ONCE, in order, each in its own totalMs slot. Returns { idx, tau, done }, with tau in ms inside that pitch's slot. With `picked` (an index), it plays only that pitch.
4. atBat.js: put `contact` (from contactPoint) on each pitch whose swing is not null.

Tests first, in new files:
- every swing.js and batted.js case in §11;
- for a ONE-pitch list, a take's totalMs equals sceneFrame's slot in ms;
- beats are ordered: contact < exit ≤ sceneEnd < sideStart < land < figsStart ≤ total;
- a whiff has freezeMs 0 and no side beats;
- sceneClock holds during the freeze and runs after it;
- replayFrame steps through pitches of different lengths, then returns done;
- on the fixture (test/fixtures/contact-replay/game-849810.trimmed.json), the at-bat 16 home run's contact.K is in front of the plate and battedPath lands within 1 ft of 428 ft;
- test/scout-scene.test.js and test/pitcher-card-model.test.js pass unchanged.

Nothing draws yet. Verify: your tests, the existing tests that import a changed file, npm run lint. CI runs the full npm test and build. PR body: "Part of #1771".

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.
```

### Prompt 5 of 10 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Contact replay, phase B: the Savant /gf module (#1771). Gary's decision (2026-10-18): STRIP ON PARSE. Read docs/contact-replay.md §3.2, §11 and §13 (the spec wins on conflict), src/api/CLAUDE.md, src/api/spoiler-manifest.json and .scratch/contact-replay/facts.md (its "/gf" section is settled). Fetch patterns: src/api/scout/headToHead.js, src/api/expresslane/clipIndex.js.

1. Fixture: fetch https://baseballsavant.mlb.com/gf?game_pk=849810 (reachable). Commit a trimmed copy in test/fixtures/contact-replay/ that KEEPS some scoreboard, boxscore and row des/events/result text: the test needs them to prove the strip. Keep the rows for at-bats 16, 37 and 45.
2. A new module in a NEW folder, src/api/savant/ (src/api/ itself is at its check-dir-size budget of 115; a file there fails lint). It exports one async function (gamePk, sportId):
   - sportId !== 1: return an empty Map and make NO fetch.
   - Otherwise fetch and parse in the same scope. Read ONLY team_home[] and team_away[], and from each row ONLY play_id, batSpeed, xba, is_barrel and contextMetrics.homeRunBallparks (nested, not a top-level field).
   - Return a Map of playId to { batSpeed, xba: Number(row.xba) (it is a string such as ".820"), barrel: row.is_barrel === 1, hrParks }. A missing field is null.
   - No cache, ref or module state holds the raw body. Never log it.
3. Classify the module reveal-only in spoiler-manifest.json, with a "why" like its neighbours. Nothing imports it in this PR.

Tests first:
- the output holds only the five kept fields; at-bat 16's home run has xba 0.96, barrel true and hrParks 30;
- JSON.stringify(output) contains no scoreboard or boxscore key and none of the body's des, events or result text;
- sportId 11 makes no fetch (stub globalThis.fetch and assert it was not called).

Verify: your tests, npm run lint (check-dir-size and check-spoiler-manifest must pass). CI runs the full npm test and build. PR body: "Part of #1771".

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.
```

### Prompt 6 of 10 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Contact replay, phase A: the scene (#1771). Read docs/contact-replay.md §5, §6, §8, §9, §10, §12, §13 (the spec wins on conflict); .scratch/contact-replay/facts.md; in .scratch/contact-replay/prototype.html, render, batPolygon, drawBat and buildStage; and src/CLAUDE.md, src/components/CLAUDE.md, src/styles/CLAUDE.md. On main: src/lib/pitcherCard/swing.js, batted.js and contactTimeline.js. Use them; do not re-derive their math.

THE DESIGN BELOW IS SETTLED.
1. PitchScene.jsx (src/components/playbyplay/pitcherCard/):
   - When atBat != null, drive the loop with replayFrame + sceneClock, in ms. The sceneFrame path (Now Pitching card, Scout) stays byte-for-byte unchanged.
   - A swing pitch's ball stops at contact.K, not the plate.
   - onLand fires at contactMs for a swing pitch, at the plate for a take.
   - Add one prop, onFrame(idx, tau, rest). Call it on every draw; rest is true for the rest frame. It is a plain callback, never React state.
2. Draw §6.2 to §6.5 in §6.5 order: smear bats, barrel path, exit trail, shadow, drop line, ground track, bat, ring and ticks, mitt ring (whiff), trajectory tag, honesty tag `SWING DRAWN · PATHS MEASURED`. Ring strength: 0.8 (no bat speed yet), 0.35 for a foul. The rest frame is §8.4. Under reduced motion, show only the rest frame.
3. PitchScene.jsx is 254 lines, and check-file-size caps files at 600. Put the attribute-setting helpers for the new marks in a new src/lib/pitcherCard/contactDraw.js (pure functions of refs and numbers). PitchScene keeps the loop and the JSX.
4. Resting looks go in a new src/styles/pitcher-card/contact.css, imported in src/index.css right after pitcher-card/card.css. Use tokens only. SVG stroke widths take the `raw-value-exempt: SVG stroke width in the scene's own units` marker, as card.css does. Ink is measured, pencil (graphite) is drawn (§1).
5. AtBatReplay.jsx: "Play at-bat" (ReplayState) and the phone's Segmented chips use size="tap" (§9).
6. Build the scene's aria-label per pitch (§12). It changes only when the pitch in view changes.

Not in this slice: the side view, the quality line, any /gf fetch.

Tests: one per pure helper in contactDraw.js. The existing PitchScene, scout and pitcher-card tests pass unchanged.

Screenshots (setup in facts.md): npm run dev and the preinstalled Chromium. Seed localStorage bbsbh:reveal:849810 = "17" before the page loads. Open /10152026/millad/top1?nointro (at-bat 1: ground ball; at-bat 2: foul, whiff) and /10152026/millad/bottom2?nointro (at-bat 16: home run), and open each at-bat's replay. Capture each mid-swing and at rest, at 390x844 and 1280x800. Save them in .scratch/contact-replay/shots/, put the routes in the PR body, and send them to Gary with SendUserFile.

Verify: your tests, the existing tests that import a changed file, npm run lint. CI runs the full npm test and build. PR body: "Part of #1771".

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.
```

### Prompt 7 of 10 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Contact replay, phase A: the side view and the quality line (#1771). Read docs/contact-replay.md §5, §7, §8.2, §8.4, §9, §10, §12 (the spec wins on conflict); .scratch/contact-replay/facts.md; in .scratch/contact-replay/prototype.html, buildSide, renderSide, buildReadout, renderReadout and readoutFigs; and the nested CLAUDE.md of each folder you edit. On main: PitchScene's onFrame(idx, tau, rest); contactTimeline.js pitchBeats (sideStartMs, sideMs, landMs, figsStartMs); batted.js sideViewPath.

THE DESIGN BELOW IS SETTLED.
1. ReplayScene (AtBatReplay.jsx) holds `const drawers = useRef(new Set())` and passes PitchScene `onFrame={(i, t, r) => drawers.current.forEach((d) => d(i, t, r))}`.
2. New SideView.jsx and QualityLine.jsx in src/components/playbyplay/pitcherCard/ (8 files today, 10 after) each take `pitches` and `drawers`. Each adds its draw function in a useEffect, removes it on cleanup, and sets attributes through refs. No React state per frame. The card order is §5.
3. SideView is exactly §7.1: the fixed scale, the fence post, the apex label rule, the landing rings (the Contact card's), the distance label rule past 370 ft, and the three empty-state words.
4. QualityLine, phase A: exit velocity only, for a ball in play; nothing for a whiff or a foul. No waiting figures in phase A (§10). Its min-height holds one row and a verdict, so the card never changes height (ADR-0046). Its text is plain DOM in reading order (§12). Styles go in src/styles/pitcher-card/contact.css.

Tests: one pure test per placement rule: the apex label goes under the arc when the apex is in the top 46 units; past 370 ft the distance label goes in the axis row and the 400 ft tick label hides (at-bat 16's 428 ft home run is a real case).

Screenshots (setup in facts.md): seed localStorage bbsbh:reveal:849810 = "17" before the page loads. Open /10152026/millad/bottom2?nointro (at-bat 16: home run) and /10152026/millad/top1?nointro (at-bat 1: ground ball; at-bat 2: whiff), and open each replay. Capture each mid-flight and at rest, at 390x844 and 1280x800. Save them in .scratch/contact-replay/shots/, put the routes in the PR body, and send them to Gary with SendUserFile.

Verify: your tests, the existing tests that import a changed file, npm run lint. CI runs the full npm test and build. PR body: "Part of #1771".

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.
```

### Prompt 8 of 10 — Sonnet 5.5, effort medium

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Contact replay, phase B wiring (#1771). On main: the reveal-only /gf module in src/api/savant/ ((gamePk, sportId) to a Map of playId → { batSpeed, xba, barrel, hrParks }), the phase A scene, SideView and QualityLine. Read docs/contact-replay.md §2 (decision 4), §3.2, §3.4, §6.2, §6.3, §7.2, §10, §11 (the spec wins on conflict) and .scratch/contact-replay/facts.md.

1. Fetch: call the /gf module only from the replay (ReplayScene renders inside the half's reveal), once when a replay opens. Call it again only when the reader re-opens a replay in which a pitch still has no batSpeed. Never poll. Look up only this at-bat's playIds. The ids come from the screen: sportId as in src/screens/InningViewer.jsx line 229 (meta.away.sportId), and gamePk from the feed (PlayByPlay.jsx reads feed.gamePk). Thread them down as props. When data arrives, re-render the rest frame only. Never replay on a data change.
2. Swing timing: 0.16 s × 72 / batSpeed, clamped to 0.14–0.18 s. Contact time stays fixed (§6.2). Ring strength = squared-up, capped at 1; else 0.8 (§6.3).
3. QualityLine: the full §7.2 figures, the waiting figure and its label, squared-up per §3.4 (above 100% shows 100%), the home-run parks (`20 of 30`), and the verdict stamp. Put the cutoffs in ONE place as named constants: HARD_LUCK_XBA = 0.5, LUCKY_XBA = 0.25. A MiLB game shows exit velocity only, with no waiting figures (§10).

Tests first:
- one per §7.2 verdict row, plus the .500 and .250 boundaries;
- squared-up above 1 shows 100%;
- the swing-duration clamp;
- a MiLB game makes no /gf call.

Screenshots (setup in facts.md): seed localStorage bbsbh:reveal:849810 = "17" before the page loads. Open /10152026/millad/top5?nointro (at-bat 37: a barrel lineout, xBA .690, so a "Hard-luck out" stamp) and /10152026/millad/top6?nointro (at-bat 45: a barrel home run, 20 parks), and open each replay at rest, at 390x844 and 1280x800. Save them in .scratch/contact-replay/shots/ and send them to Gary with SendUserFile.

Verify: your tests, the existing tests that import a changed file, npm run lint. CI runs the full npm test and build. PR body: "Part of #1771".

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.
```

### Prompt 9 of 10 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Work issue #2305 in gzilavyss2025/bbsbh: tune the contact replay's drawn values on real games. Read the issue, its comments, the numbers #2345 added to docs/contact-replay.md §6.1 and §7.2, and .scratch/contact-replay/facts.md. Phases A and B are on main.

For each row of the issue's table:
1. Render the replay (npm run dev, preinstalled Chromium) on at least 10 real pitches from at least 2 completed MLB games: 849810 (setup and at-bats in facts.md) and one more. For another game, use the same setup: route /{MMDDYYYY}/{matchup}/{half}?nointro (src/lib/route.js line 97), with localStorage bbsbh:reveal:<gamePk> seeded to its last half-index before the page loads.
2. Judge whether the drawn value looks right. Change a value ONLY when the screenshots show it is wrong. Then save before and after screenshots in .scratch/contact-replay/tuning/ and name both in the PR body. A value that holds up stays.
3. Do NOT change HARD_LUCK_XBA or LUCKY_XBA; Gary picks them from #2345's rates. Record the stamp rates you saw in the spec.

Done (from the issue): each row has a value checked against at least one real game, recorded in the spec with its gamePk, and pinned in a test. Send Gary the screenshots with SendUserFile.

Verify: your tests, the existing tests that import a changed file, npm run lint. CI runs the full npm test and build. PR body: "Part of #2305" (Gary closes it once he picks the cutoffs).

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.
```

### Prompt 10 of 10 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Contact replay, phase C: the final tier (#1771). Read docs/contact-replay.md §2, §3.3, §6.2, §9, §13 (the spec wins on conflict), src/api/CLAUDE.md and .scratch/contact-replay/facts.md (its CSV section is settled). Phases A and B are on main. The CSV fill time is not measured (issue #2349) and is NOT a gate: build for any fill time. Use only completed games; no live game is needed.

1. A new reveal-only module in src/api/savant/ (beside the /gf module; src/api/ itself is at its check-dir-size budget) fetches the Statcast CSV. Build the URL from the pattern in src/api/scout/headToHead.js with `game_pk=<pk>` and the game's date (facts.md shows a working URL). It fetches only for a Final, MLB game, once per gamePk per page load, and never polls. STRIP ON PARSE: keep only game_pk, at_bat_number, pitch_number, attack_angle and attack_direction; drop bat_score, post_bat_score and every other field at once. Classify it reveal-only in spoiler-manifest.json before anything imports it.
2. Join on game_pk + at_bat_number (= atBatIndex + 1) + pitch_number. With a measured attack_angle, swing.js uses it as attackDeg and the bat AT CONTACT draws in ink; the swing before contact stays pencil. Add the `attack +9° · measured` label (§9). With no rows (not filled yet, or no rows ever), the bat stays pencil.

Tests first:
- record a trimmed real CSV for gamePk 849810 in test/fixtures/contact-replay/ (keep the rows for at-bats 1, 2 and 16); the parser keeps only the five fields, and its serialised output holds no bat_score or post_bat_score;
- a non-Final game and a MiLB game make no fetch;
- an empty CSV leaves every bat pencil;
- the join picks the right pitch (at-bat 16, pitch 3: the home run).

Screenshot (setup in facts.md): seed localStorage bbsbh:reveal:849810 = "17" before the page loads, open /10152026/millad/bottom2?nointro, open at-bat 16's replay at rest, and show the ink bat and its attack label, at 390x844. Send it to Gary with SendUserFile.

Verify: your tests, the existing tests that import a changed file, npm run lint (check-dir-size and check-spoiler-manifest must pass). CI runs the full npm test and build. PR body: "Part of #1771" (§14 keeps a later quality-line pass on the issue).

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.
```

## Why each row has its model

- **Sonnet medium** (rows 1, 2, 3, 8): each follows a named pattern, with exact
  field lists and tests.
- **Sonnet high** (rows 4, 5, 6, 7, 9, 10): ported math across files, the
  strip-on-parse code, a screen built to a settled direction, and judging
  visuals.
- **The `/gf` row is Sonnet, not Opus** (Gary, 2026-10-19): the decision is
  made, §3.2 lists the fields, and a test proves no score survives the parse.
