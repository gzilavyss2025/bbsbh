# Contact replay: handoff spec (#1771)

This spec tells a builder how to add the swing, the contact and the batted ball
to the at-bat replay (PR #1521), and how to add the quality line under it. The
research and the data facts are in issue #1771. Do not repeat that research.

The design exists as a working prototype. Gary owns the link (a private
claude.ai page): https://claude.ai/artifact/XQbzftrqC9xN6qgEuacNmg. It uses the
app's real camera and tokens, with invented sample data. When this spec and the
prototype do not agree, this spec wins.

## 1. Overview

The at-bat replay plays every pitch of one revealed plate appearance from
behind the plate. Today it stops when the last pitch reaches the plate. This
work adds four things to the LAST pitch of the at-bat, and to any pitch the
batter swung at:

1. **A drawn swing.** The bat winds back, swings, and follows through.
2. **The contact or the miss.** A short freeze and a ring mark contact. A whiff
   has no freeze.
3. **The batted ball.** It leaves the bat in the scene, then a side-view strip
   shows its whole flight.
4. **The quality line.** One row of figures under the card, and a verdict stamp.

**The reader.** Gary watches a half-inning on TV, then looks at the phone in the
break. The data must be ready about 2 to 3 minutes after the last pitch.

**One rule governs every mark: ink is measured, pencil is drawn.** A mark from
tracking data is ink. A mark that this app invents is pencil. The scene always
shows a small tag that says so. Do not draw an invented mark in ink.

## 2. Build order and decision gates

Each phase ships alone. Do the phases in this order.

| Phase | What ships | Data | Blocked on |
| --- | --- | --- | --- |
| A | Drawn swing (default timing), contact, whiff, foul, exit trail, trajectory tag, side view, quality line with exit velocity only | MLB feed `hitData` only | Nothing |
| B | Swing timed from bat speed; squared-up %, xBA, barrel, home-run parks on the quality line | Savant `/gf` | Gary's `/gf` spoiler call (issue #1771, "Spoiler rule") |
| C | The bat at contact in ink, with the measured attack angle | Savant Statcast CSV | Gary's "both tiers?" answer, and one measurement of when the CSV fills |

Phase A needs no new fetch. Start there. Do not start phase B or C without
Gary's answer in the issue.

## 3. Data contract

### 3.1 Phase A: add `hit` to the pitch that was put in play

`src/api/playbyplay/pitchInfo.js` builds `pitchDetails`. It is reveal-only in
`src/api/spoiler-manifest.json`, so the new fields stay on the reveal path. Add
one field to each pitch detail. Read it from that pitch's own `playEvents[]`
entry, never from the play's last event by index.

```js
hit: hitData ? {
  exitVelo: num(hitData.launchSpeed),     // mph
  launchAngle: num(hitData.launchAngle),  // degrees, negative = into the ground
  distance: num(hitData.totalDistance),   // ft
  trajectory: hitData.trajectory ?? null, // 'line_drive' | 'fly_ball' | 'ground_ball' | 'popup' | null
  coordX: num(hitData.coordinates?.coordX),
  coordY: num(hitData.coordinates?.coordY),
} : null,
```

These are the same paths `src/api/hitchart.js` reads. Verify each path against
a live game first (root `CLAUDE.md`, "Verify feed field paths"). Write the
gamePk you checked in the comment, as `pitchInfo.js` does for `vX0`.

**Spray angle**, in degrees, positive toward right field:

```js
const dx = coordX - HIT_COORD_ORIGIN.x
const dy = HIT_COORD_ORIGIN.y - coordY
const spray = Math.atan2(dx, dy) * 180 / Math.PI
```

`HIT_COORD_ORIGIN` is in `src/lib/ballpark/hitProjection.js`. Read it from
there. Do not copy the numbers.

**Which pitches get a swing.** Use the call code tables in `pitchInfo.js`
(`WHIFF_CODES`, `FOUL_CODES`, and the in-play codes). A called pitch (ball,
called strike) gets no bat. Do not draw a bat for a pitch the batter took.

### 3.2 Phase B: `/gf` fields (only after Gary's call)

Join a `/gf` row to an MLB pitch on `play_id` = `playId`. Read `batSpeed`,
`xba`, `is_barrel` and `homeRunBallparks`. Follow the spoiler decision Gary
records in #1771. Classify the new module in `spoiler-manifest.json` before
anything imports it.

### 3.3 Phase C: CSV fields (only after Gary's call)

Join on `game_pk` + `at_bat_number` (= `atBatIndex + 1`) + `pitch_number`. Read
`attack_angle` and `attack_direction`.

### 3.4 Squared-up %

`squaredUp = exitVelo / (1.23 * batSpeed + 0.2116 * pitchMph)`. Savant
publishes no per-swing value, so the app computes it. The formula is an
approximation (issue #1771). Show it as a whole percent. A value above 100%
shows as `100%`. With no bat speed, show the waiting state (section 7).

## 4. Files

New paths below are to be created. Keep `scene.js` and `PitchScene.jsx` free of
Savant code.

| File | Change |
| --- | --- |
| `src/api/playbyplay/pitchInfo.js` | Add `hit` (section 3.1) |
| `src/lib/pitcherCard/atBat.js` | Pass `hit`, the call class (swing, whiff, foul, in play) and the bat side to each scene pitch |
| new `lib/pitcherCard/swing.js`, to be created | The swing model: pure math, no React. Section 6.2 |
| new `lib/pitcherCard/batted.js`, to be created | The batted ball in the scene camera, and the side-view path. Section 6.4 |
| `src/screens/player/next/modules/contact/contactFlight.js` | Move `simFlight` and `flightModel` to a new `lib/ballpark/flightModel.js` (to be created). Re-export them here so the Contact card and its tests do not change. Add one argument: the start height (today it is fixed at 3 ft) |
| `src/components/playbyplay/pitcherCard/PitchScene.jsx` | Draw the bat, the contact ring and ticks, the exit trail, the shadow, and the trajectory tag. Same rAF loop, same refs, no React state per frame |
| new `components/playbyplay/pitcherCard/SideView.jsx`, to be created | The side-view strip |
| new `components/playbyplay/pitcherCard/QualityLine.jsx`, to be created | The quality line |
| `src/components/playbyplay/pitcherCard/AtBatReplay.jsx` | Put `SideView` and `QualityLine` in `ReplayScene`, in the order in section 5 |
| new `styles/pitcher-card/contact.css`, to be created | Resting looks. Import it in `src/index.css` after `pitcher-card/card.css` |
| `src/styles/motion/` | No change. All replay motion runs in JS from one clock (section 8.1) |
| `test/at-bat-scene.test.js`, plus new tests | Section 11 |

`src/lib/pitcherCard/` holds 6 files today. The two new files keep it under
the `check-dir-size` cap of 12.

## 5. Layout

The card is the existing `.pcard .pbp__replay`. From top to bottom:

1. **The scene.** No change to its size: `SCENE_W` x `REPLAY_H` (336 x 312)
   from `scene.js`.
2. **The side-view strip.** New. viewBox 336 x 100. It sits DIRECTLY under the
   scene, so one ball is never split by the navy bar.
3. **The navy bar** (`.pscene__bar`). No change.
4. **The count strip and diamond** (`ReplayState`). No change.
5. **The quality line.** New. Last.

**Fixed height.** The side-view strip and the quality line keep their space on
every pitch, also when the pitch has no contact. Nothing on the card changes
height while the replay plays (ADR-0046). The quality line has a `min-height`
that holds one row of figures and the verdict.

**Width.** The card fills its column. On a phone the scene opens in
`ReplaySheet`; on a wide screen it opens in the rail (`ReplayRail`). The layout
is the same in both. Section 9 has the one difference.

## 6. The scene: what to draw

All geometry uses the scene camera `proj` from `scene.js`. Feet: x is right of
the plate's centre, y is toward the mound from the plate's back point, z is up.

### 6.1 Contact point

`YC = 2.2` ft, a design choice: the ball meets the bat 2.2 ft in front of the
plate's back point. The contact point `K` is the measured pitch path at
`y = YC` (the `realFlight` of the pitch, `camera.js`). Contact time `tc` is the
time the pitch reaches `y = YC`.

### 6.2 The swing (pencil, always, until phase C)

The bat is a straight tapered shape, 2.65 ft long. The barrel's sweet spot
moves on a circle in a tilted plane:

- **Centre** `C = (side * 2.25, YC - 0.15, Kb.z + 0.75)`. `side` is `-1` for a
  right-handed batter (he stands left of the plate, seen from behind) and `+1`
  for a left-handed batter. Take the side from the batter's `batSide` for this
  plate appearance, not from his bio, because switch hitters change sides.
- **Target** `Kb`: `K` for contact; `K + (0, 0, 0.11)` for a foul (the bat
  meets the bottom of the ball); `K + (0, 0, 0.42)` for a whiff (the bat passes
  over it). These offsets are drawings. They are not data.
- **Plane**: `u` = unit vector from `C` to `Kb`; `v` = the attack direction
  `(0, cos a, sin a)`, made orthogonal to `u`. `a` is 10° by default; phase C
  uses the measured `attack_angle`.
- **Sweet spot at angle θ**: `C + R (u cos θ + v sin θ)`, with `R = |Kb - C|`.
  The knob is at radius `R - 2.15`.

Timing, in REAL seconds from contact (`dt = t - tc`). The scene's slow factor
`SLOW = 3` (`scene.js`) multiplies all of them, as it does for the pitch.

| Beat | Real time | What the bat does |
| --- | --- | --- |
| Stance | before `-0.25` | Load pose: up and back over the rear shoulder |
| Coil | `-0.25` to `-0.16` | Winds back a little further (smoothstep). Anticipation |
| Swing | `-0.16` to `0` | θ from -125° to 0°, as `q²` (the barrel gathers speed). It blends from the coil pose into the plane over the first 40% |
| Follow-through | `0` to `+0.22` | θ from 0° to 150°, as `1 - (1 - q)³` |
| Fade | after `+0.22` | Opacity falls to 25% over 400 ms of screen time |

In phase B, scale the swing duration (0.16 s) by `72 / batSpeed`, clamped to
0.14 to 0.18 s. Keep the contact time fixed: the swing must reach the ball
exactly when the pitch does.

**Smear frames.** While `dt` is between `-0.12` and `+0.09`, draw 4 copies of
the bat at `dt - 0.012 k` (k = 1 to 4), at opacity 0.30, 0.20, 0.12 and 0.06. Do
not draw them during the freeze.

**Barrel path.** Draw the sweet spot's path from θ = -92° to the current θ as a
dashed pencil line (`stroke-dasharray: 3 3`, width 1.5). Opacity 0.9 while it
draws, 0.75 after. It stays on. On a whiff it shows the swing passed over the
ball.

**Bat shape.** A polygon: knob width = 0.33 x the projected ball diameter at the
knob (minimum 0.8 px); barrel width = 0.95 x the projected ball diameter at the
end (minimum 1.6 px). It flares from 42% to 72% of the length. A round cap at
the barrel end.

### 6.3 Contact

| Outcome | Freeze | Ring | Ticks |
| --- | --- | --- | --- |
| In play | 66 ms (4 frames at 60 Hz) | Ink | 8 |
| Foul | 33 ms | Pencil | None |
| Whiff | None | None | None |

**The freeze** stops the scene's clock: the pitch, the bat and the ball all
hold. The freeze is screen time. `SLOW` does not scale it.

**The ring** starts at 0.8 x the ball's radius (never from zero) and grows over
260 ms on `--ease-out`. Its largest radius is
`ballDiameter * (0.6 + 0.5 * strength)`, so it never grows wider than one zone
cell. Stroke width is `1 + strength`. Opacity starts at `0.4 + 0.6 * strength`
and falls to 0. `strength` is the squared-up fraction, capped at 1. With no bat
speed (phase A), use 0.8. A foul uses 0.35.

**The ticks** are 8 short ink lines around the ring, the same idea as
`.bigplay__tick`. They ride the ring out and fade with it.

One flash per contact. Never repeat it.

**The whiff** runs the ball on along its path to `y = -0.8` ft (the catcher's
mitt). A pencil ring there grows from 0.7 to 1.6 ball diameters over 300 ms.

### 6.4 The batted ball in the scene

- **Path.** Fit a 2-D flight (distance along the ground, height) to the
  measured exit velocity, launch angle and distance with `flightModel`, started
  at `K.z`. Turn it by the spray angle. A grounder (launch angle under 8°) uses
  a bounce model: restitution 0.3 to 0.42, ground friction 0.86 a bounce.
- **Foul.** No flight model. Move the ball back over the camera and up, at
  72 mph, as a drawing, in pencil, dashed.
- **When it leaves.** Follow the ball until it leaves the frame, or until its
  diameter is under 1.3 px, or for 0.9 s of real time at most. A fly ball
  leaves in about 0.15 s.
- **Trail.** 24 pieces, each as wide as the ball at that point (0.55 x the
  projected diameter, minimum 1.2 px). Opacity rises from 0.30 (oldest) to 0.95
  (newest), the same rule as the pitch trail. Colour: `--accent-primary`.
  Give the group a 0.7 px paper edge, the way `.pscene__trail` has an ink edge.
- **Shadow and ground track.** While the ball flies: an ellipse on the ground
  under it (rx 0.5, ry 0.18 of the projected ball diameter, 25% ink), a
  dotted drop line from the ball to the shadow when the ball is over 1 ft high,
  and a dotted ground track from the contact point. Remove all three at rest.
  Reason: from behind the plate a grounder runs UP the screen toward the
  horizon, like a line drive. The shadow tells them apart.
- **Trajectory tag.** At the end of the freeze, an ink tag fades in at the top
  right over 220 ms: `LINE DRIVE`, `FLY BALL`, `GROUND BALL` or `POPUP`, from
  `hit.trajectory`. Navy fill, paper text. It is measured, so it is ink. No tag
  when `trajectory` is null.
- **The honesty tag.** Bottom left, always on: `SWING DRAWN · PATHS MEASURED`.

### 6.5 Draw order (back to front)

Ground and zone (no change); smear bats; barrel path; pitch trail; ground track;
shadow; drop line; exit trail; bat; ball and seams; contact ring; ticks; mitt
ring; attack label (phase C); trajectory tag; honesty tag.

## 7. The side-view strip and the quality line

### 7.1 Side view

- **Scale.** 0 to 450 ft along the ground, `x = 16 + ft * 304 / 450`. Height
  uses the same scale, from a baseline at y = 80. One scale for every at-bat.
  Never rescale it (Heer and Robertson, `docs/design-inspiration.md` §9).
- **Fixed marks.** A baseline in ink. Ticks at 100, 200, 300 and 400 ft; labels
  only at 200 and 400 (`200 ft`). A green fence post at 400 ft, 10 ft tall,
  `--field`. The title reads `SIDE VIEW · GREEN POST IS THE FENCE`. The post is
  a generic fence, not this park's wall. Say so in the card's (i) note.
- **Flight.** It starts 140 ms after the ball leaves the scene. It lasts
  `clamp(T * 500, 700, 2800)` ms, where `T` is the hang time in seconds: the
  same pace as the Contact card (`contactFlight.js`). The trace draws on behind
  a ball dot. After landing, the trace fades to 60% over 1400 ms.
- **Apex.** For a launch angle of 8° or more: a dashed pencil drop from the
  apex and the label `apex ≈ 29 ft · drawn`. The apex comes from the fitted
  model, so it is pencil. When the apex is in the top 46 units of the strip,
  put the label under the arc, to the right of the drop, so it never meets the
  title.
- **Landing.** The Contact card's rings: one ring from 3 to 15 units over
  900 ms; a home run adds a second ring from 3 to 25 units, 140 ms later, over
  1100 ms. A resting circle stays (radius 4.5).
- **Distance label.** `312 ft`, bold, above the landing point. When the ball
  lands past 370 ft, put the label in the axis row, right-aligned, and hide the
  `400 ft` tick label. It must never sit on the fence post.
- **No contact.** The strip shows only its fixed marks and one centred word:
  `NO CONTACT` (whiff) or `FOUL · NO FLIGHT DRAWN` (foul) in `--text-caption`.
- **No hit data.** Same as no contact, with `NO TRACKING FOR THIS BALL`.

### 7.2 Quality line

One row of figures, then the verdict at the right end. On a narrow card the
verdict wraps to its own line, right-aligned.

| Outcome | Figures, in order |
| --- | --- |
| In play | exit velocity (`mph off the bat`), squared-up %, xBA, and for a home run `27 of 30` (`parks a home run`) |
| Whiff | bat speed (`mph bat speed`), horizontal break (`horizontal break`) |
| Foul | bat speed |

Do not repeat the call. The navy bar already says `Swinging strike` or `Foul`.

- **Figure**: `--font-mono`, `--w-bold`, `--fs-body`, `tabular-nums`,
  `--text-heading`.
- **Figure label**: `--font-display`, `--fs-label`, `--ls-label`, uppercase
  (by the CSS caps rule, never `.toUpperCase()`), `--text-caption`.
- **Waiting figure**: `—` in `--text-caption` at normal weight. Its label says
  what it waits for: `squared up · waits for bat speed`.
- **Spacing**: `--space-1h` between rows, `--space-3h` between figures; card
  padding `--space-2h`.

**Verdict.** Only when the result disagrees with the expected result. These
rules are a first cut. Tune them on real games:

| Verdict | Rule | Ink |
| --- | --- | --- |
| `Hard-luck out` | out, and xBA ≥ .500 | `--clay` border, `--clay-deep` text (clay means outs) |
| `Lucky hit` | hit, and xBA < .250 | `--field` border, `--field-deep` text |
| `Barrel` | `is_barrel` | `--field` border, `--field-deep` text |
| none | anything else | Show no stamp. Do not keep empty space for it on the row |

A verdict needs xBA or the barrel flag, so it ships in phase B. The stamp is
`--font-display`, `--w-bold`, `--fs-ui`, `--ls-label`, a 2 px border,
`--radius-xs`, and a resting turn of -3°.

## 8. Motion

### 8.1 One clock

The replay has one clock, `tau`, in ms of screen time since the tap. Every mark
in the scene, the side view and the quality line is a pure function of `tau`.
This keeps the existing `PitchScene` design: one rAF loop, attributes set
through refs, no React state per frame, the loop stops off screen
(IntersectionObserver). Do not use CSS transitions or keyframes for the replay
marks. They cannot rewind, and the rest frame and a re-pick need to.

JS reads the curves from `src/lib/motion/curves.js` (`easeStamp`, and add
`easeOut` for `--ease-out` with its pin in `test/motion-curves.test.js`). Never
type a cubic-bezier into a component.

### 8.2 Beat table

Times for the in-play case at `SLOW = 3`, from the tap. The pitch time varies
with the pitch speed; every later beat follows from it.

| Element | Starts | Animation | Duration | Easing |
| --- | --- | --- | --- | --- |
| Pitch | 0 | No change (PR #1521) | about 1200 ms | linear in time |
| Coil | contact − 750 ms | Bat winds back | 270 ms | smoothstep |
| Swing | contact − 480 ms | Bat sweeps to the ball; 4 smear frames | 480 ms | `q²` (the one ease-in; see 8.3) |
| Freeze | contact | Scene clock stops | 66 ms | none |
| Ring and ticks | contact | Grow from 0.8x, fade | 260 ms | `--ease-out` |
| Trajectory tag | contact + 66 ms | Fade in | 220 ms (`--dur-med`) | linear |
| Follow-through | after the freeze | Bat sweeps on | 660 ms | `1 - (1 - q)³` |
| Exit | after the freeze | Ball and trail leave the frame | to 0.9 s real, x3 | physics |
| Side view | exit + 140 ms | Trace draws, ball dot flies | 700 to 2800 ms | physics, linear in time |
| Landing rings | landing | Grow and fade | 900 ms (+1100 ms HR) | linear |
| Figures | landing + 200 ms | Rise 4 px, fade in; 55 ms apart (`--stagger-step`) | 220 ms (`--dur-med`) | `--ease-stamp` |
| Verdict | after the last figure + 110 ms | Scale 1.18 → 1, turn -7° → -3°, fade in | 380 ms (`--dur-stamp-in`) | `--ease-stamp` |

For a whiff and a foul, the figures start 120 ms after the scene ends.

### 8.3 Why each choice

- **Ease-in on the swing only.** The app keeps one ease-in, `--ease-press`, for
  things pushed or thrown (`src/tokens/effects.css`). A bat gathers speed into
  the ball, so the swing is that kind of thing. Every UI element on the card
  still decelerates.
- **Freeze on contact, none on a whiff.** A hit-stop of 2 to 5 frames shows
  impact (dylantarre/animation-principles, "game-development"). The missing
  freeze on a whiff says "miss" with no extra mark.
- **Cut to a side view, never pan.** The scene camera loses a fly ball in about
  0.15 s. A camera pan would rescale the picture during the move.
- **The ring scales with squared-up %.** A flush hit looks flush. One flash only
  (no more than 3 flashes a second, accessible-motion).
- **A replay may run longer than 300 ms.** The 300 ms limit in
  `.claude/skills/review-animations/STANDARDS.md` is for UI. The replay is
  content that the reader starts, and it is rare. The quality line IS UI, so it
  keeps to 220 ms and 380 ms.

### 8.4 Rest frame and reduced motion

The replay rests on its end state until a tap (no change). For a swing pitch,
the rest frame is a multiple exposure:

- the pitch path to the contact point (or to the mitt on a whiff);
- three bats: mid-swing (`dt = -0.05`) and follow-through (`dt = +0.12`) at 22%
  opacity, and the bat at contact at 95%;
- the barrel path at 75%;
- the ring at 0.9x its largest size, 25% opacity, no ticks;
- the exit trail to where the ball left the frame;
- the trajectory tag;
- the side view complete, with the resting landing circle and the distance;
- the quality line complete.

Under `prefers-reduced-motion: reduce` (`motionIsReduced()`), the card shows
only the rest frame. The "Play at-bat" button stays hidden, as today. Picking a
pitch shows that pitch's rest frame with no motion.

## 9. States and interactions

| Element | State | Behaviour |
| --- | --- | --- |
| Card | Before a tap | Rest frame of the last pitch |
| "Play at-bat" (`Button skin="ink" size="tap"`) | Tap | Plays every pitch in order; the swing beats play on each swing pitch |
| "Play at-bat" | During play | A new tap restarts from the first pitch |
| Pitch chip (`Segmented`, phone) or list row (wide) | Tap | Plays that one pitch with its swing beats, then holds its rest frame |
| List row (wide, mouse only) | Hover 250 ms (`DWELL_MS`) | Same as a tap, as today |
| Card | Scrolled off screen | Clock stops; it resumes from the same `tau` |
| Card | Leaves the rail (wide) | Pick drops; it shows the rest frame when it comes back |
| Quality line | Pitch with no swing | Empty, but its height stays |
| Phase C attack label | After contact | `attack +9° · measured` in ink, `--fs-cell`, next to the barrel end |

The controls are 44 px tall (`size="tap"`), not the `control` size. These
buttons are the only way into the replay on a phone.

## 10. Edge cases

- **No tracked flight** (most MiLB parks): no replay, as today
  (`useReplayPitches` returns null).
- **Tracked pitch, no `hitData`** on a ball in play: draw the swing and the
  contact; no exit trail; the side view says `NO TRACKING FOR THIS BALL`; the
  quality line shows no figures.
- **`hitData` with no distance**: use the chord from the coordinates
  (`flightModel` already does this). No coordinates: no spray, so draw the ball
  straight out (spray 0°) and add `· direction drawn` to the trajectory tag.
- **Launch angle missing**: treat as a grounder for the drawing; no apex label.
- **A bunt** (`hitData` with launch speed under 40 mph): draw the bat held
  still across the zone at contact, with no swing beats. Reason: a swing
  drawing for a bunt is false.
- **Popup and foul popup**: the side view clips the arc at the top of the strip
  and keeps the apex label under the arc.
- **Home run beyond 450 ft**: the trace leaves the strip on the right; the
  label stays in the axis row.
- **Switch hitter**: the side comes from this plate appearance's `batSide`.
- **Live game**: an at-bat still in progress has no replay (no change). A poll
  that rebuilds `pitchDetails` must not restart a running replay
  (`useReplayPitches` keys on content; keep `hit` inside that key).
- **Phase B data late**: bat speed arrives a median of 162 s after the pitch,
  p90 479 s. Until it arrives: default swing timing, `strength` 0.8, and the
  waiting figure. When it arrives, re-render the rest frame only. Never replay
  on a data change.
- **Long text**: figure labels are fixed English strings and fit on one line at
  336 units. The verdict is one of three strings. Nothing truncates.

## 11. Tests (`npm test`)

Each new pure module gets a test file. A bug fix ships with a test that fails
without the fix (root `CLAUDE.md`).

- `swing.js`: at `dt = 0` the sweet spot is at `Kb` within 0.01 ft; a
  right-handed batter's centre has negative x and a left-handed batter's
  positive x; θ rises with time across the whole swing (no reversal); a whiff's
  sweet spot at contact is 0.42 ft over the ball.
- `batted.js`: the fitted flight lands at the measured distance within 1 ft;
  the spray sign follows `coordX`; a launch angle under 8° never rises above
  the contact height; the exit ends inside 0.9 s.
- `flightModel.js` (moved): the Contact card's existing tests still pass
  unchanged; a start height of 3 ft gives the old numbers exactly.
- `pitchInfo.js`: `hit` is null for a pitch with no `hitData`; the paths match
  a recorded feed fixture.
- The quality line's verdict rules: one test per row of the table in 7.2,
  plus the boundaries (.500 and .250).
- Squared-up: a result above 1 shows as `100%`.

Then render the replay in Chromium against a recent game with a home run, a
grounder, a whiff and a foul (`docs/test-games.md`). Send Gary a screenshot of
the route with `?nointro` and the gamePk.

## 12. Accessibility

- **Scene label.** Build the `aria-label` from the data, per pitch:
  `Four-seam, 96.1 mph. Line drive, 104.8 mph off the bat, 312 feet. In play,
  out.` A whiff: `Slider, 87.4 mph. Swing and miss.` The label changes only
  when the pitch in view changes, never per frame.
- **Side view.** `role="img"` with `aria-label="Side view: line drive, 312
  feet, apex about 29 feet (drawn)."`.
- **Quality line.** Plain text in the DOM, in reading order, so a screen reader
  reads the figures and the verdict. No live region: the reader starts the
  replay, and the line is complete in the rest frame.
- **Focus order.** Play at-bat, then the pitch chips (or list rows), as today.
  The scene, the side view and the quality line take no focus.
- **Keyboard.** The existing `Button` and `Segmented` behaviour. No new keys.
- **Contrast.** Every text pair uses the token pairs `check-contrast.mjs`
  already holds. Two non-text checks from the prototype review: the barrel path
  must be at least 0.75 opacity on `--field-outfield`, and empty-state words
  use `--text-caption`, never `--graphite-soft` (3.28:1 fails).
- **Flashes.** One ring per contact. Nothing flashes more than 3 times a second.

## 13. Spoiler and guard checklist

- Everything here is reveal-only. `pitchDetails` exists only inside a revealed
  half, and the new fields ride on it. Do not read `hitData` anywhere else.
- The replay's timing depends on the play (a home run's replay is longer than a
  whiff's). That is safe, because the replay plays only after the reveal and
  after a tap. ADR-0046 forbids timing that is a function of the reveal BEFORE
  the reveal. Do not move any of this timing to a surface outside the seal.
- `npm run lint` runs the guards that apply: `check-typography` (no raw type
  sizes in `contact.css`), `check-raw-values`, `check-caps`,
  `check-spoiler-manifest` (phase B module), `check-dir-size`,
  `check-file-size`. Put SVG stroke widths in CSS with the
  `raw-value-exempt: SVG stroke width in the scene's own units` marker, as
  `card.css` does.

## 14. Out of scope

- A batter figure. A body would be a third kind of mark, neither measured nor
  useful.
- A camera pan after a fly ball, and numbers that count up.
- Bounce, overshoot and confetti. A home run gets the second landing ring and
  nothing more.
- Any change to how the Now Pitching card draws pitches.
- The real park's wall in the side view (a later pass could read it from
  `src/lib/ballpark/`).
