> REJECTED, see REJECTED.md. The inventory is still valid.

# Round 4: three directions for the at-bat console (#1389)

Shape only. No app code changed. Base: `origin/main` at `b24dff28`.

## What changed from round 3, and why

Round 3 fit 390 × 763 by dropping the pitch track and the play sentence, drew new
art, and gave three versions of one idea. Gary: "wrong direction", "generic",
"ignored how the app looks". So this round:

- **The mocks are the app.** `mock/index.html` runs on the app's own dev server
  and imports `src/index.css`. The chrome (site bar, masthead, section tabs, half
  nav, console band, trail, running line, reference rail or chips, bottom bar) is
  the live app's own markup, captured at the same state by `tools/capture.mjs`.
  The at-bat content is the app's own React components (`AtBatHero`,
  `AtBatBox`, `PitchScene`, `PitchList`, `StrikeZone`, `PlayDiamond`,
  `PitchLadder`, `EventCard`, `FielderNotice`, `BallparkDiagram`, `Button`,
  `SealBox`) fed by the app's own selectors (`computeHalfInningFeed`,
  `pitchLadder`, `atBatScenePitches`, `ballFlightPath`). The only new CSS is
  layout (`mock/directions.css`, tokens only, no hex).
- **Nothing is dropped.** The play sentence, the pitch list and the zone plot are
  on every revealed screen. The page scrolls.
- **Three ideas, not three orders.** Each direction picks a different thing to put
  first: the box you copy (D1), the order things happened (D2), where things
  happened (D3).
- **It adapts to the width.** Phone 390, iPad portrait 820, iPad landscape 1180,
  desktop 1440. At 1440 the console widens to 1272 px, the slate's wire-rail
  precedent (`.screen--slate.screen--wirerail`, `styles/25-wide-layout.css`).
- **Touch only.** Every control is a `.btn` tap. No hover, no `title=` added.

Kept from round 3 (README "Gary's decisions"): no bat drawing; the pitch flight is
the Now Pitching scene (`PitchScene`, as `AtBatReplay` uses it); the bases are a chip
(`.btn`) that opens a sheet (`.scrim .sheet`) with each runner's #22 box. The faster
replay timing (×1.5, 0.35 s hold) is a prop for the build; the mock runs PitchScene's
own `atBat` pace.

**Spoiler note for all three.** These mocks are not the app. They fetch the whole
feed, but each at-bat value is computed inside a real `SealBox` reveal render function
(`main.jsx`, `<SealBox coverless forceRevealed>{() => …}</SealBox>`). The build must keep
every score-bearing value inside that function (ADR-0001, ADR-0002), keep the sealed
stage's height independent of the hidden at-bat (ADR-0046), and use no
`gameData.absChallenges` total (whole game, leaks).

## The moments (real data)

| Key | Game | Half | Why |
|---|---|---|---|
| `hr` | 823035 MIL @ STL, Jul 7 2026, game 2 (anchor) | bottom 6th, at-bat 4 | Velázquez 2-run HR, Walker scores; the sealed state has two pre-pitch fielder notices |
| `abs` | 824624 MIA @ CHC, Sep 22 2026 | bottom 3rd, at-bat 1 | Kelly K swinging; pitch 2 has a Cubs ABS challenge, upheld |
| `sb` | 824624, same half | at-bat 4 window | Crow-Armstrong steals 2nd during Suzuki's at-bat; Suzuki K looking ends the half (half tally, due up next) |

824624 is not yet in `docs/test-games.md`; it was found by scanning the six round-3
games for a half with both a steal and an ABS challenge (it is the only one).

## D1: The box

**Idea:** the #22 box you are about to pencil is the hero; everything else explains it.

- **Blocks:** the scorecard's own `scoring/AtBatBox.jsx`, zoomed like the lens carry
  strip (`.sc-carry__box` idiom, `styles/scorecard/lens-carry.css`), inside a
  `.card.card--sheet` with `.sectionhead`-style label "Pencil this · Bats 4th"; the
  play sentence `.pbp__desc` beside it; the runners chip `.btn`; `AtBatHero` above;
  `PitchList` + `StrikeZone` below in a `.card`. The scene is `PitchScene` in
  `.pcard.pbp__replay`.
- **Width:** phone stacks hero → box + sentence → scene → pitches. Wide (≥ 740) puts
  the scene in the reference rail's replay slot, where `AtBatReplay` already puts it
  (`.focusrail__replay`). 1180 and 1440: box column | pitches column.
- **How the #22 is filled:** copy the box one to one. Outcome box, RBI box, the
  diamond with each leg's mark, the fielding chain, the out circle and the pitch strip
  are already drawn the way the sheet draws them (`AtBatBox` header comment). Runners'
  boxes come from the chip's sheet, each as its own `AtBatBox`.
- **Sealed:** an empty `AtBatBox` template (the same size every time) under the due-up
  row and the pre-pitch notices. Kraft dashed edge (`--seal`) because a reveal lands
  there.
- **Risk:** the box is small writing even at ×2.2; Gary must find the box readable at
  arm's length.

Files: `mockups/d1-*.jpg`.

## D2: The log

**Idea:** the at-bat in the order it happened, one row per pitch, with the
mid-at-bat moves in their place, and a pencil column that says what each row writes.

- **Blocks:** rows use the pitch list's own classes (`.pitchlist`,
  `.pitchlist__num--{cat}`, `__type`, `__meta`, `--decisive`); mid-at-bat moves are
  the app's own `EventCard` (SB, CS, PK, WP, PB, BK) placed between the pitches where
  they happened; the result row is the at-bat card's own `.pbp__side` (ladder, code,
  RBI, diamond, out circle) and sentence; at the foot "The box, filled" is
  `AtBatBox` + `StrikeZone`. `AtBatHero` above; scene as in D1.
- **Width:** phone stacks hero → scene → log → box. Wide: scene in the rail slot.
  1440: the trail stands up as a column at the left, the half's own log beside the
  at-bat's (`.trailstrip__cells` in a column).
- **How the #22 is filled:** top to bottom. Each pitch row's pencil cell is the mark
  for the pitch strip ("2 strike col", "X"); a move row says "SB runner box"; the
  last row is the outcome. ABS results print on the pitch row ("ABS upheld").
- **Sealed:** the log's header and six blank ruled rows, always six.
- **Risk:** the longest page of the three on a phone (a 9-pitch at-bat is 9 rows).

Files: `mockups/d2-*.jpg`.

## D3: The field

**Idea:** where it happened. The pitch scene and the park share one stage, and a big
diamond under them is the key to the marks.

- **Blocks:** `PitchScene` (behind the plate) beside `BallparkDiagram` with the
  flight path and landing mark from `BallFlight`'s own drawing (`ballFlightPath`,
  `.bflight__path`, `.bflight__hr`, `.bflight__facts`: exit velo, launch, distance);
  the key card is `.pbp__side` with `PlayDiamond` at 150 px, the sentence, the move
  cards and the runners chip; `PitchList` beside it.
- **Width:** phone stacks scene → park → key → pitches. Wide: scene | park side by
  side, key | pitches under them. D3 gives the stage the whole width, so the
  reference rail folds to the phone's four chips (`.refbar`) at every width. When
  the ball is not put in play (K, BB) the park is not drawn and the scene centres.
- **How the #22 is filled:** read the key: the big diamond carries the same leg marks,
  code and out circle as the box; the park says where to draw the hit line on the
  sheet's diamond; runners from the chip's sheet.
- **Sealed:** the empty park outline at the same height, under due up and the
  notices.
- **Risk:** the reference rail is one tap away on wide too (a sheet, not a column).
  `FlightPlot` is private in `BallFlight.jsx`; the build exports it (the mock ports
  20 lines of it).

Files: `mockups/d3-*.jpg`.

## Where every inventory row goes

Rows are `inventory.md` numbers. "Same" = the app's block, in the app's place.

| Rows | D1 The box | D2 The log | D3 The field |
|---|---|---|---|
| 1–8 chrome, band, bar | Same | Same | Same |
| 9–18 pre-half (Now Pitching card, due up, pre-pitch notices, extras banner, delay) | Same, above the blank box | Same, above the blank log | Same, above the empty park |
| 19–20 window, card frame | One window | One window | One window |
| 21 hero | Top of the window | Top | Top |
| 22 portrait filler (no zone) | Beside the box | Above the log | In the scene's place |
| 23 play sentence | Beside the box | Result row | Key card |
| 24 interrupted sub-line | Under the sentence | Result row | Key card |
| 25 callouts ★ | Under the sentence | Under the result row | Key card |
| 26 zone modal (phone) | Not needed: zone is inline | Not needed: zone in "box, filled" | Not needed: list and zone inline |
| 27 Watch | Beside the runners chip | Result row | Key card |
| 28 replay sheet (phone) | Replaced by the inline scene | Same | Same |
| 29–32 ladder, code + RBI, diamond, out | Inside the #22 box | Result row (`.pbp__side`) | Key card, big diamond |
| 33 ball-flight handle | Tap the box's diamond (as today) | Tap the result diamond | Drawn open on the park |
| 34, 35, 36 pitch list, ABS mark, zone plot | Pitches card | The log rows; zone at the foot | Pitches card with the zone |
| 37, 38 replay picks, rail scene | Rail slot (wide); picks on the list | Rail slot; picks on log rows | Stage (no rail) |
| 39 placed runner AR | `AtBatBox` draws AR already | First log row "AR" | Key card with `placedAt` |
| 40–49 subs, visits, ejection, delay | Notice cards above the hero (as today) | Rows in the log at their time | Under the sentence in the key |
| 50–54 SB CS PK WP PB BK DI RP | Notice cards above the hero | Rows between the pitches | Key card + leg mark on the diamond |
| 55, 56 fallback note, errors | Same | Same, as a row | Same |
| 57–60 trail and its controls | Above the hero (as today) | Above; a column at 1440 | Above |
| 61 running line | Under the stage (never removed) | Same | Same |
| 62 half hit chart | EXTRAS, unchanged | Same | The park on the stage is its per-play view; chart unchanged |
| 63–66 due-up console, half tally, between innings, due up next | Same | Same | Same |
| 67–80 reference tabs and panels | Rail (wide), chips (phone) | Rail, chips | Chips at every width |
| 81–87 bar states | Same | Same | Same |
| 88 sealed | Blank box | Six blank rows | Empty park |
| 89 stacked | One box per at-bat, each with its sentence | One log per at-bat | One key per at-bat; park on tap |
| 90 reduced motion | Scene still (end state) | Same | Same |
| 91 live half | "At the plate."; box fills as pitches arrive | Rows arrive as pitches arrive | Scene only until contact |
| 92 MiLB | Box without zone; no scene | Log without zone dots | No park, no scene: key + list |
| 93 extras | AR box | AR row | AR key |
| 94 runners chip + sheet | Beside the sentence | Result row | Key card |
| 95 day lines (S2) | Under the hero names | Same | Same |
| 96 bat speed (S9/S10) | Scene bar | Pitch row's meta | Scene bar |
| 97 review card, ABS bank (S7) | Notice card above hero; bank in band | Row at its pitch | Key card |
| 98 notice "write" line (S5) | Notice card | Its log row | Key card |
| 99 #22 box | The hero | "The box, filled" | Not shown; the key carries the same marks |

No row is without a place, so nothing stops this round.

## What was mocked

- The **chrome** is a static capture of the live app (`tools/capture.mjs`), so its
  buttons do nothing in the mock. The reveal mark was seeded in localStorage to the
  half before (`bbsbh:reveal:823035 = 10`, `bbsbh:reveal:824624 = 4`).
- The **runners chip state** for each moment is typed by hand from the feed
  (`SCENES.*.bases` in `main.jsx`); S4 derives it.
- **D2's pitch position of a mid-at-bat move** is read from the play's `playEvents` in
  the mock (`pitchesBefore`); in the app it is the note's `pitchLabel`, which
  `runnerNotes.js` leaves null for WP/BK/PB today (S3).
- **D3's park drawing** ports `BallFlight.jsx`'s private `FlightPlot` (about 20 lines).
- The **ABS text** on D2's row ("ABS upheld") is new copy; D1 and D3 use the app's own
  `ChallengeMark` inside `PitchList`.
- The scene is caught mid-loop, so each shot shows a different pitch in flight.
- 824624 is not in `docs/test-games.md` yet (the close-out PR adds it).

## Rebuild

```bash
npm run dev   # port 5173
node .scratch/at-bat-console/round4/tools/capture.mjs /07072026/milstl-2/bottom6 4 hr-rev 823035 10   # recapture one state
node .scratch/at-bat-console/round4/tools/shoot.mjs OUTDIR 1 hr rev       # direction, moment, sealed|rev → 4 widths
```

Open `http://localhost:5173/.scratch/at-bat-console/round4/mock/index.html?nointro&d=2&s=sb&v=rev`
(`&sheet=1` opens the runners sheet).

## Mockup files

- `mockups/d{1,2,3}-{hr-sealed,hr-rev,abs-rev,sb-rev}.jpg`: contact sheets, the four
  widths side by side (390 / 820 / 1180 / 1440).
- `mockups/shots/*.jpg`: every shot at full size (`-sheet` = runners sheet open).
- `mockups/runners-sheet.jpg`: the runners chip opened (same in all three directions).
