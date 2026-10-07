# At-bat console for a #22 scorebook: shape handoff (#1389)

Shape session, 2026-10-07, draft PR #1669. Nothing in the app changed. Every file
here is `.scratch`. Read this first, then `spec.md`, then the older handoff it
builds on: `.scratch/innings-console-redesign/README.md` (the agreed round-0 design,
Gary's rules, the feed gotchas and the spoiler checklist).

## Where the design stands

The **current design is round 3: one screen** (`spec.md` §4c). Rounds 1 and 2 are
history that explains it.

| Round | What Gary asked | Result | Mockups |
|---|---|---|---|
| 1 | (shape task) the three notation rulings the issue left open | Options A / B / C. Recommended B: `PK 1-3`, `PKCS 1-3` with the out on the path to 2nd, `E2` with no slot after a steal | `option-A/B/C.jpg`, `marks-close-up.jpg`, `today-823166-bot1.jpg` (the live app today) |
| 2 | animate the pitch into the zone, the bat swing, where the ball lands; the bottom half is repetitive; bases can pop out | One stage replaces the pitch track and play sentence; the bases fold into a chip that opens a sheet; layouts V1 / V2 / V3 | `stage-*.gif`, `stage-*-phone.jpg`, `stage-runners-sheet.jpg`, `stage-sealed.jpg` |
| 3 | use the Now Pitching scene's pitch flight, with the mound, grass, batter's boxes and plate, and fit everything on one screen with no scrolling | The stage is the Now Pitching scene drawn from the app's own model; everything fits 390 × 763; orders O1 (stage first) and O2 (box first, recommended) | `onescreen-*.gif`, `onescreen-*.jpg` |

## Gary's decisions in this session (do not regress)

1. **No bat drawing yet.** Round 2's bat "looks way wrong, no one holds the bat in
   that position." A bat must start from a real grip and stance and follow a real
   swing path, and Gary sees a still frame before anything animates. (`spec.md`
   §4b, "Gary's feedback on round 2".)
2. **The pitch flight is the Now Pitching card's scene** (`PitchScene.jsx`,
   `lib/pitcherCard/scene.js`). The at-bat version of it already exists:
   `AtBatReplay.jsx` + `lib/pitcherCard/atBat.js` (PR 1521) plays a revealed
   at-bat's measured flights. Reuse it. Pitch labels stay numbers and X.
3. **Show the scene's ground:** sky, grass, mound, plate dirt, both batter's boxes,
   the plate, the zone box standing on the plate (`stage(zone)` in `scene.js`).
4. **One screen, no scrolling** at 390 × 763 (iPhone standalone, less the status bar
   and the home indicator).
5. **Play speed:** "last pitch to start, but then it repeats and plays them all. i
   want it to be faster." On reveal the deciding pitch flies first over the earlier
   rings, then the whole at-bat plays in order and loops. ×1.5 slow motion, 0.35 s
   hold, 1.2 s rest between loops (the card uses ×3 and 0.9 s). 9 pitches ≈ 10 s.
6. **The bases are a chip + sheet,** not a strip ("collapse the bases to have them
   pop out or be a modal").
7. **The track and the play sentence are gone** from the bottom half; one line
   under the stage holds P · WH · FO, EV and distance, the top bat speed, runner
   events and ABS results.

Still open (the parent session `session_01TvbCydq8MDvKnsuHLoJt4w` was asked):
the notation option (A / B / C) and the one-screen order (O1 / O2).

## Data facts checked here (details in `spec.md` §4b)

- The swing and bat data note is PR #1621, merged into `docs/peer-sites.md`
  ("Data notes from the 2026-10-06 pass").
- Savant `/gf` (per game) has `batSpeed` on ~99% of swings and `plateTime`; live it
  lags (bat speed median 162 s). It also carries the whole scoreboard, so it is a
  reveal-only read.
- The Statcast CSV has `swing_path_tilt`, `attack_angle`, `swing_length`, the
  intercept point; it fills the morning after a game, so never live.
- Savant `ab_number` and the CSV's `at_bat_number` = the feed's `atBatIndex` + 1
  (every row of 823169 and 823035 matched by batter name).
- No source gives a 3D bat track or a 3D ball track. The ball's plan-view flight
  is `lib/ballpark/ballFlight.js` (bow = apex height).

## Rebuild the mockups

From the repo root (needs network; writes only to `node_modules/.cache/innings-console/`):

```bash
bash .scratch/at-bat-console/rebuild.sh
```

Then open `node_modules/.cache/innings-console/onescreen.html#o2` (or `#o1`) in the
preinstalled Chromium. The canvas controls still work: Space = next at-bat,
`[` `]` = half, the game and half pickers. `window.osPlay(seconds)` draws the stage
at a fixed time (the shot scripts use it). Pages from earlier rounds:
`opt-A/B/C.html`, `stage.html#v1|v2|v3`.

Screenshots and GIFs (paths are absolute to `/home/user/bbsbh`):

```bash
node .scratch/at-bat-console/stage/onescreenshots.mjs OUTDIR o2:0:11:4:99:o2-hr   # layout:game index:half:revealed n:seconds:name
node .scratch/at-bat-console/stage/onescreengif.mjs OUTDIR o2 0 11 4 6.6 0.12 .phone o2hr   # frames, then ImageMagick convert -delay 12 -loop 0
```

Game indexes in the data: 0 = 823035 (MIL @ STL, Jul 7 Gm 2), 1 = 823166, 2 = 824546,
3 = 824624, 4 = 824951, 5 = 823169 (MIN @ SF, Sep 21). Showcase moments: Velázquez's
home run = `0:11:4`; Davidson's 9-pitch single with four swings = `5:1:3`.

## Files

| Path | What |
|---|---|
| `spec.md` | The draft spec: goal, what exists, the #22 needs, options per round, slices S1–S11 (≤ 5 files, pattern, done test, model), out of scope, ADRs, spoiler impact |
| `mockups/` | Every screenshot and GIF named above |
| `rebuild.sh` | One command that rebuilds every mockup page |
| `tools/variants.mjs` | Round 1: patches the canvas data into notation options A / B / C |
| `tools/shoot.mjs`, `tools/today.mjs` | Round 1 shots; `today.mjs` shoots the live app (needs `npm run dev`) |
| `stage/enrich.mjs` | Adds to the canvas data: field geometry, batted-ball flights, Savant bat speed and swing path, and the Now Pitching scene (`atBatScenePitches`, `stage`, `releasePoint`) per at-bat |
| `stage/stage.js`, `stage.css` | Round 2 layer over the canvas: the stage, runners chip and sheet, `fieldSvg` |
| `stage/onescreen.js`, `onescreen.css` | Round 3 layer: the one-screen layout and the scene animation (port of `PitchScene`'s frame loop with the new timing) |
| `stage/build.mjs` | Joins the canvas template + data + layers into one HTML page |
| `stage/*shots.mjs`, `stage/onescreengif.mjs` | Playwright shot and frame scripts |

## Caveats for whoever builds it

- The mockups embed a whole game's data in a script variable and draw only the
  revealed steps. That is the fetched-then-hidden shape the app forbids. The build
  must use the `SealBox` reveal render function (ADR-0001, ADR-0002).
- `onescreen.js` ports `PitchScene`'s frame loop and changes its timing. In the
  app, add the timing as a prop (PitchScene already takes `slow` and `atBat`) and do
  not change the Now Pitching card's own pace.
- Measured layout heights at 390 × 763 are in `spec.md` §4c. The running line is
  80 px and is the easiest place to win room; it may not be removed (ADR-0043).
- `notices()` from the canvas sits over the sealed stage; a long notice list could
  overflow it. Not tested on a half with three or more notices.

## When the build is done

Delete this folder in the PR that ships the last slice, together with
`.scratch/innings-console-redesign/` (its own §12 says where each kind of knowledge
goes). Gary's decisions above belong in the ADR-0043 amendment and `src/CLAUDE.md`.
