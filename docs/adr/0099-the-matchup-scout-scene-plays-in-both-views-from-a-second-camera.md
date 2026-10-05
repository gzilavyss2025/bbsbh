# The Matchup Scout's scene plays in both views, from a second camera

**Status:** Accepted (Gary approved the mockup on 2026-10-05; supersedes ADR-0093 decision 5)
**Date:** 2026-10-05
**Issue:** #1490

## Context

ADR-0093 decision 5 kept the Now Pitching scene (`PitchScene.jsx`) to the
Matchup Scout's Hitter's view. The scene's camera stands behind the plate. In
the Pitcher's view the maps put first base on the viewer's left, so the
scene's arcs would break the other way from the maps.

Gary asked on 2026-10-05: "Can we always see the animation of the pitches on
both the pitcher's or hitter's view?" He also asked for the scene's
background to look like the Now Pitching card's, "the pitcher's mound and the
home plate", in both views. He reviewed a working mockup
(`.scratch/scout-polish/mockup.html`) and approved it.

A mirrored picture does not answer the ask. A mirror flips the pitcher's arm
and every break, so a right-hander would throw from the wrong side. The
Pitcher's view needs a camera that stands where a telecast camera stands.

## Decision

**1. The scene shows in both views and is always on.** It still respects
reduced motion and still stops off screen (`PitchScene.jsx`). The View
control moves onto the scene's bar, because the scene is the first thing it
changes.

**2. The Pitcher's view has its own camera.** `src/lib/pitcherCard/camera.js`
exports `camera(view)`, a pinhole camera. The Pitcher's view is a centre-field
telecast camera at (0, 420, 16) ft, aimed at (0, 0, 2.6), focal length 9000
px, principal point (168, 82). In that view, first base (+x) lands on the
viewer's left, the same side the maps draw it. The Hitter's view stays the
card's own projection (`scene.js` `proj`). `camera('hitter')` reproduces it
point for point, and a test holds the two together.

**3. The arcs stay generic on the page.** They use the league-average shapes
(`MOVE`, `SPOT`) at the pitcher's speed, as on the card. The bar says so:
"typical shape · ⅓ speed". The pitch modal on the Meetings tab draws a real
flight from one Savant row (`realFlight`), in the same scene and view.

**4. The mound in the Pitcher's view is PLACED, not projected.** The plate
dirt, both batter's boxes, the plate and the zone box are projected through
the camera. The mound is a fixed ellipse at the foot of the frame, with the
rubber on it (`scene.js` `pitcherStage`). This is a deliberate compromise. No
honest camera shows the mound and a readable zone at once in a 336 × 178
frame. The mound is 7 ft below a telecast camera's line of sight and 20 ft or
more from it, while the zone is 1.9 ft tall at about 420 ft. In the mockup
session's camera tests (recorded in #1490), every placement that kept the mound in frame drew the zone only
about 15–20 px tall. So the zone camera is honest, and the mound is there for
orientation.

## Consequences

- The Now Pitching card does not change. Every new `PitchScene` prop (`view`,
  `slow`, `zone`) is off by default, and `test/pitcher-card-model.test.js`
  still passes unchanged.
- `test/scout-scene.test.js` pins the cameras: in each view, a pitch to the
  first-base side lands on the same screen side as the first-base region's
  rect (`regionRect`). It also pins that the real flight ends at
  `plate_x` / `plate_z` on the front of the plate.
- The Pitcher's-view picture is not a photograph. The mound sits where no lens
  would put it. A reader who compares the scene with a telecast frame will
  see the mound closer and larger. That is the cost of a readable zone.
- ADR-0093 decisions 1–4 and 6 stand. The scene is still a picture of the
  view, never a stored fact.

## Alternatives weighed

- **Keep the scene in the Hitter's view only** (ADR-0093 decision 5).
  Rejected by Gary's ask on 2026-10-05.
- **Mirror the Hitter's-view scene for the Pitcher's view.** Rejected: a
  mirror puts a right-hander's arm on the wrong side and flips every break.
- **Frame the mound and the zone with one honest camera.** Rejected: in the
  mockup session's tests the zone shrank to about 15–20 px, too small to read
  a location.
