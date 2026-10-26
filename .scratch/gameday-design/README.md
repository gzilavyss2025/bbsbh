# Gameday design round (#2568): round 1 handoff

Working notes for the design round in #2568 (umbrella #2566). Round 1 ran on 2026-10-26 in a
session Gary watched. Round 2 starts from this file.

- **Artifact (private to Gary):** https://claude.ai/artifact/BCZgTVQDbXUheJiypLsXtu (version 4 is
  round 1 as locked). Read it with the Artifact tool, `action: "read"`. Do not WebFetch it.
- **Decisions on record:** the #2568 comment "Design round 1: Gary's locked choices (2026-10-26)",
  and the #2580 comment that drops the 3D spike.
- **Round 2 prompt:** `round2-prompt.md`.
- Delete this folder in the PR that ships the last Gameday slice, with `.scratch/at-bat-console/`
  and `.scratch/innings-console-redesign/` (#2566, "Done means").

## Round 1: what Gary locked (2026-10-26)

1. **Layout: direction B, panels around the stage** (like Out of the Park). Direction A (a HUD over a
   full-screen stage, like MVP Baseball 2004 and The Show) is not chosen. Gary's note on the pick:
   "i like the 16-bit sprites as the baseline to work off of, this is good".
2. **Stage look: 16-bit sprites is the baseline.** Paper diorama, broadcast flat and low-poly 3D are
   dropped. Dropping 3D settles 2D for now (#2568 "Not decided" item 6; #2580).
3. **The ranking is settled** (`prototype/ranking.js`, plain words in `prototype/see.js`). Gary's
   notes:
   - Row 20, the at-bat card: "this is the heart of what I write in my scorebook. all the other
     sizzle is useless without the Balls and Strikes chart and the diamond layout." See
     "The scorebook box" below.
   - Row 35, the ABS challenge mark: square corners, no rounded pill.
   - Row 12: today's "Final line for" card can show before a departed pitcher's runners are
     settled. That is a bug in today's app, outside the design round. It was queued as its own
     task. It did not reproduce on 824716 top 4th (that line was final).
4. **A ground out shows the throw** (Gary's note on the 16-bit concept). The fielding credits give
   who threw to whom (a 4-3); the prototype draws the timing.
5. **Swing stills: no verdict.** The 2026-10-07 rule holds: no bat drawing in the app until Gary
   approves a still frame of a real swing pose. The stills are on the artifact's Swing tab
   (`SWING` keyframes in `prototype/engine.js`).

Gary's saved feedback is in the artifact's `db`, collection `feedback`: `direction`,
`concept-<id>`, `rank-<n>`, `pose-<name>`. Read it with the `ArtifactData` tool, `action: "list"`.

## Round 2: what is open

- **Tokens** for the 16-bit look inside layout B: the app's paper tokens, a new set for the stage
  only, or both. `npm run lint` fails on raw values (`check-raw-values`), so a new palette needs
  tokens. Gary decides after seeing them.
- **What replaces "See the whole half"** (it scrolls). Candidates: the checkpoint's at-bats page; a
  paged view; one line per play with a star on scoring plays (The Show 13 post-game list); nothing.
- **The checkpoint wireframes** (#2572): four pages, how they cycle, and whether the score-free
  facts (`src/api/between-innings.js`) become a fifth page, go in the menu, or go away. Pages 1
  and 2 are built as data in `src/api/gameday/checkpoint.js` (`PAGE_ORDER`).
- **ADR-0123's wireframe questions:** the advance control's words, the pitch button's place and
  look, how a sub-step looks on the stage, and how a mid-at-bat event card looks. Each keeps
  ADR-0123 decisions 3 and 4.
- **The ESPN candidates** (#2568 step 0, item 8): the batter zone map as the stage's resting state,
  and the batter silhouette.
- **The breakpoints** between the four sizes, and the final order of folding.
- **The swing stills**, for Gary's approval.

## Layout B, size by size (round 1 wireframes)

Boxes are `[part, x, y, w, h]` in CSS px, in `prototype/ladder.js` (`DIRS.panels`). Every size is
drawn in three states: waiting (the next at-bat sealed; the last result stays with the due-up
strip), revealed, and menu open. The sealed and revealed frames use the same boxes, so nothing
moves before the tap (ADR-0046).

| Size | Shows | In the menu |
| --- | --- | --- |
| Phone 390 × 763 | Band, stage, hero, bar. The hero holds the scorebook box, the play line, the due-up strip and the contact numbers. The menu button is in the bar. | Trail, navigator, pitches, lineups, field, arms, extras, scorecard, box score, refresh |
| Tablet 760 × 1024 | Adds the navigator (line score), the pitch panel and the trail as rows. | Lineups, field, arms, extras, scorecard, box score, refresh |
| iPad landscape 1180 × 820 | Adds the batting order on the left and the reference tabs on the right. | Scorecard, box score, refresh, the other club's order |
| Desktop 1440 × 900 | Adds the event log under the reference tabs and a wider stage. | Same as 1180 |

Part names keep ADR-0043's words (band, hero, trail, reference, bar) and add the umbrella's
(stage, checkpoint). The bar holds the menu button, the pitch-by-pitch toggle and the advance
control. The never-fold set (game state, the result and who is up, the advance control) is
always shown at every size.

## The scorebook box

The box the reader copies to paper is the heart of the screen (Gary, row 20). At every size it
shows two columns, B and S, with the pitch numbers and an X for the pitch put in play (Gary's rule:
pitch pips are numbers and X only), the diamond with the legs the batter ran, the code, the RBI
and the out number. Never squeeze the columns into one row. On a phone it is the largest thing in
the hero. The round 1 wireframes draw it this way (`box22` in `prototype/ladder.js`).

## The prototype (`prototype/`)

The artifact's source, as published in version 4. It is design code, not app code: it may not be
copied into `src/`.

| File | What |
| --- | --- |
| `index.html` | The page. Tabs: overview, ranking, ladder, stage, swing, references. Tally Baseball design system for the frame. |
| `app.js` | Tabs, the feedback store, the ladder scaling, the stage players (scrub bar, frame strip, frame-rate meter), the swing stills. |
| `engine.js` | Shared by every concept: the field, the pitch path (realFlight samples), the batted-ball path, the wall and seats, the throw, the batter and pitcher keyframes, the timeline after the tap, the cameras. |
| `data.js` | Real data: gamePk 824716, top 2nd (atBatIndex 7 to 15) and the popup (45). Made by `tools/extract.mjs`, then a hand-added `code` and `line` per play. |
| `concept-sprites.js` | **The baseline.** 16-bit: low-resolution render, about 30 colours, a cut from the pitch view to a scrolling overhead field view. |
| `concept-diorama.js`, `concept-broadcast.js`, `concept-3d.js` | Dropped by Gary. Kept so the page rebuilds as published. |
| `ladder.js` | The size ladder: both directions, four sizes, three states. |
| `ranking.js`, `see.js`, `imgs.js`, `img/` | The ranking, its plain words, and 57 pictures of today's blocks (captured with `tools/capture.mjs`). |
| `refs.js` | The console-game references and their sources. |
| `harness.html`, `concept-wire.js` | A one-concept test page and a line-only debug concept. |

**Run it:** `sh .scratch/gameday-design/tools/preview.sh` writes `prototype/preview.html` (ignored
by git). Open it with Playwright, for example
`node .scratch/gameday-design/tools/pageshot.mjs "file://$PWD/.scratch/gameday-design/prototype/preview.html#ladder" out.png 1440 900`.
One concept alone: `harness.html?c=concept-sprites.js` with `tools/shoot.mjs`.

**Publish:** update the same artifact with the Artifact tool: `file_path` = `prototype/index.html`,
`root` = `prototype/`, and `files` = every `.js` file and `img/*.jpg`. Pass the artifact's URL as
`url` from a new session, and read it first. Keep the `db` and `user` capabilities (the publish
carries them forward when you omit `capabilities`). Or start a new artifact for round 2 and link
it from #2568.

**The engine and the app's engine.** `engine.js` came before the app's Gameday engine landed
(#2645, 2026-10-26). A build uses the app's modules, not this file:

- the batted-ball path: `src/lib/gameday/flightPath.js` (`ballTier`, `flightPath`, tiers A, B, C).
  Both end a ground ball on the hit coordinate (where it was fielded).
- the step cut, day lines, reviews and ABS, the checkpoint pages, moments: `src/api/gameday/`
  (all reveal-only; read `src/api/gameday/CLAUDE.md`);
- sub-step stepping: ADR-0123.

Three things exist only in this prototype: the wall and seats stop (a ball below the wall's top
drops at its foot; a home run ends in stands that rise 0.55 ft per ft), the throw from the
fielding credits (0.25 s transfer, 85 ft/s), and the swing keyframes.

## Findings from round 1

- **Release rule** (#2568 "Not decided" item 5): with release at `60.5 − extension`, `realFlight`'s
  flight time matched the feed's `plateTime` on all 334 pitches of 824716. Median error −0.001 s,
  worst 0.006 s (`tools/release-check.mjs`). One MLB game; MiLB parks with no extension are open.
- **A phone stage is tall**, so a fixed lens cuts off the batter. The cameras widen the vertical
  field of view to keep at least 6 ft either side of the plate (`vfovFor` in `engine.js`).
- **A ground ball's `totalDistance` is not where it went.** Canzone (atBatIndex 14): 46 ft; the
  coordinate puts the fielding play 106 ft out. `flightPath.js` found the same over 134 games.
- **The batter reaches the contact pose as the ball reaches the plate.** An early engine had it
  0.2 s late. Keep contact on the pitch's last sample.
- **three.js r128** is 603,445 bytes minified and 148,737 bytes gzip. Moot now that 3D is dropped.

## Tools (`tools/`)

| Tool | Use |
| --- | --- |
| `extract.mjs` | `node extract.mjs <feed.json> <out.json>`: pitches and batted balls through the repo's own `realFlight`, `fitLift`, `simFlight` and park layout. |
| `release-check.mjs` | `node release-check.mjs <feed.json>`: the release-rule check above. |
| `preview.sh` | Wraps `prototype/index.html` the way the publish skeleton does. |
| `shoot.mjs`, `pageshot.mjs`, `frames.mjs` | Screenshots: one concept at chosen times, one page tab, every wireframe at true size. |
| `capture.mjs` + `plans/*.json` | Photographs blocks of TODAY's app at a set reading position, with an optional yellow outline around a part inside its card. Needs `npm run dev` on port 5173. |
| `today.mjs`, `events.mjs` | Dump the classes on today's page; list the event cards in a stacked half. |

Traps:

- **A half index counts both halves.** Top 1st is 0, bottom 1st is 1, top 2nd is 2. The reveal mark
  is `bbsbh:reveal:{gamePk}` = the last revealed half index. The at-bat cursor is
  `bbsbh:reveal-atbat:{gamePk}` = `"{halfIdx}:{count}"`, and a mound visit or a substitution card
  counts as an entry.
- **Chromium in the cloud does not trust the agent proxy.** The capture tools relay every https
  request through Node's `fetch`, as `.claude/skills/run/shot.mjs` does.
- **The fixed bottom bar covers a crop** under it. `capture.mjs` hides it unless the bar is the
  subject.
- **The Read tool refuses an image over 250 KB.** Save screenshots as JPEG and shrink contact sheets.
- `check-statsapi-client` scans `.scratch/**/*.js` and `.mjs`: never name the statsapi host on a
  code line here.

## Research (`research/`)

- `hud-notes.md`: what MVP Baseball 2003 to 2005 and The Show 07 to 16 put on screen, and what
  Gameday can borrow (inference marked).
- `hud-sources.md`, `menu-sources.md`: every still with its video link and what is on screen.
  The images themselves are not in the repo (the art belongs to EA and Sony); the links are.

The ideas round 1 kept for round 2:

- MVP 05's pause menu covers only the top half and keeps the game state in view.
- The Show 15's quick menu opens without pausing.
- The Show 13's pause screen puts player cards on a diamond.
- The MVP 2004 manual's "Manager Challenge" screen is a turn-based panels layout with a three-line
  play log, which is close to direction B.
- The Show 13's post-game list is one line per play, with a star on scoring plays.

## Rules that bind every round

- **The spoiler rule** (CLAUDE.md; #2568 "Spoiler-rule check"): stage reads only inside a
  `SealBox` reveal render function; one sealed height per size; the stage plays only on the reveal
  tap, never on a cold load, a return visit, a poll or a force-reveal; a home run's landing exists
  only in the revealed stage.
- **Fresh start** (#2566): import none of the reference-only pieces. The prototype is design
  code; the build starts from the engine modules.
- **No scroll** at the four sizes, Gameday only.
- **The design system:** square corners (Gary, row 35), tokens not raw values, the paper
  scorebook (`src/styles/CLAUDE.md`).
- **No sound, no haptics.**
- **Real data only.** Every number in a wireframe comes from a feed; check it before you show it.
