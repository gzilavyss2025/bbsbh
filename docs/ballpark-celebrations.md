# Ballpark celebrations

The modern pixel-art system extends PR 2673's standalone cutscene kit. Home run,
grand slam, strikeout and defensive-catch scenes are inspected at
`/animation-lab?nointro#ballpark` and are connected to the revealed Gameday stage.
The owner approved the visual direction and future development after the first
animation; do not stop for further video/GIF approval rounds. Cloud-local URLs
are for agent verification, not owner review.

## Art direction

The owner chose contemporary indie pixel art, citing Animal Well's craft and
atmosphere rather than retro sports art or photorealistic rendering. Preserve
readable team colors, convincing silhouette and body mechanics, layered stadium
depth, and restrained rim lighting. The approved concept and interview are the
basis for the new study. It replaces the old code-drawn cutscene (#2673), which
the #2676 stack removed.

The character represents a team, not a likeness. Its rear view, helmet or cap,
covered arms and deep head/hand shadows avoid assigning an appearance to the named player. Do not infer race,
skin tone or appearance from player data. The player caption carries identity.

## Separate authoring concerns

- `cutscene/ballpark/variants.js`: the approved fist pump, confetti win,
  victory hop, home-run salute, and cap-and-glove strikeout pump. Each uses its
  own row of six generated poses and a finite authored track. Confetti holds
  the raised-arm pose; the hop includes a finite takeoff and landing offset.
- `choreography.js`: the shared pure clock, the original default batter track,
  and the defensive catch's track. Catch keeps its separate full-body atlas.
- `effects.js`: deterministic pixel sparkles, confetti, starbursts and fireworks.
  These take the club palette, respect scrubbing, and finish with the action.
  Reduced motion paints the final settled pose without moving effects.
- `scenes.js` pairs each role's artwork and choreography. This is an authored
  catalog, not a rule for which real game events earn a celebration.
- `assets.js`: shared image decode, bounded palette cache and conservative
  material recoloring, performed once per palette, not once per animation frame.
  The new study's measured source cells exclude generated gutters and normalize
  to six 256-pixel playback cells without stretching the character. Each action
  prepares only its own row; all five share one source download.
- `atlas.js` isolates the connected character within each cell before recoloring.
  This removes neighboring-cell shoe fragments and disconnected generation
  debris without trimming the glove's reach. The source files stay intact.
- `materials.js` classifies equipment and gold piping separately from orange/brown
  glove leather. The leather regression was observed failing before the hue fix.
- `flight.js` supplies the catch's illustrative ball path. Its arrival matches
  the catch beat; the ball stays hidden once caught. It is not a measured play.
- `drawBallpark.js`: canvas composition, no game data or player inference.
- `BallparkCelebration.jsx`: decode-aware playback, controlled-time inspection,
  completion, pause/resume, optional skip control, and both app and OS reduced
  motion. In reduced motion it presents the final composed frame. When hidden,
  playback pauses rather than consuming the sequence off-screen.
- `animlab/CutsceneMotionLab.jsx`: replay, pause, scrubbing, adjacent-pose review,
  slow playback, conservative club-palette previews and a frozen frame strip.

`character`, `backdrop` and `track` are independent props. Pitcher and fielder
scenes have their own atlases and choreography; a future park gets its own background.
Do not recolor a batter into a pitcher and call it a new animation. Future tracks
must use valid frame indices in their matching atlas and ascending beat times.
Review their framing and anatomy, not only whether the file decodes.

## Gameday integration

`stage/GamedayStage.js` selects one completed result only inside its existing
SealBox reveal subtree. `integration/celebrationForPlay.js` receives that one
play and pre-game identity data, never an uncapped list of future plays:

- A completed home run uses the batter and batting club; four RBI selects the
  longer confetti sequence. Other home runs use the bat salute.
- A non-homer RBI uses the fist pump; two or more RBI use the victory hop.
  Both retain the result-specific RBI headline.
- A completed strikeout with a recorded out uses the pitcher pump and fielding club.
  Dropped-third-strike reaches and a strikeout on which a run scores do not
  receive a celebratory reaction.
- Defense requires a recorded air out, at least the existing moments engine's
  measured hard-hit floor (110 mph), and a credited LF/CF/RF putout of the batter.
  Missing tracking or credited fielder means no cutscene, not a guessed highlight.
  Fixture 815625, at-bat 102, supplies a real positive case: Ryan Kreidler catches
  a 113.1 mph line drive. Other ordinary outs keep the existing field animation.

Pitch/event sub-steps never receive their at-bat's eventual celebration. The
existing tap rule controls playback: one reveal tap starts it, a tap during it
finishes it without advancing, and the next tap advances. Cold loads, returns,
polls and force-reveals do not start it. No control label or pre-reveal duration
depends on the sealed result (ADR-0046, ADR-0123).

`integration/GamedayPlayCanvas.jsx` loads the decorative component only for a
selected result. The ordinary field's end state stays behind it until art is
ready. Import/image failure restores the field and releases playback; a bounded
post-reveal watchdog also prevents a stalled download holding the scoring control.
The Skip button (bottom right, while it plays) uses the same completion callback
for ordinary celebrations. Once one ends, Replay (top right) plays the same at-bat
again through the tap rule's `replay`, as a trail card does; keyboard focus moves
Skip → Replay at the end and Replay → Skip on the restart. `.gdcelebration`'s
z-index lifts the scene over the field and its hover targets, and `preparedArt`
lets a replayed scene start ready, so the field never flashes through.
App/OS reduced motion shows the final pose without an extra animation-skip tap,
and offers no Replay.

The scene contains within the existing stage at each layout size. Once ready,
its letterbox covers the old field; the legacy engine's body-portal big-play
stamp is suppressed while the new scene supplies the title. A qualifying play
that ends a half or the game celebrates before its checkpoint. Its final pose
stays on screen until the bottom Next › button opens the summary; that press
does not reveal another play, turn the half, or change the scoring frontier.
Next can also dismiss the animation early. Reduced motion keeps this same
explicit handoff. The ending scene has no separate Skip or Replay control. Ordinary
ending plays do not add a hold. Cold/return visits retain the existing read-back
flow without replaying celebrations. Eligibility is reported from the revealed
stage subtree as a presentation flag only.

Result flags, identities, and putout-credit paths were verified against the live
824716 feed during implementation. Names and kit colors come from data, never
from the generated character's apparent identity.

## Uniforms

The lab reads the same live `teamChipColors()` resolver as other club surfaces.
Primary maps to the source's navy equipment, secondary to its gold piping; cream
cloth and cool bright rim lights remain neutral. Missing club data falls back
to stage token colors. This is a conservative, team-inspired kit preview, not a
claim about the jersey worn in a particular game.

Identity Lab's per-treatment color notes are available for later authored kits.
They are not anatomical uniform assignments; a primary swatch cannot tell us
the exact fabric, piping, helmet, belt or pant stripe. Add verified uniforms as
explicitly authored material maps/art, without changing the animation clock.
The first version uses color-based masks rather than a separately painted
material mask; edge pixels and unusual source palettes require visual review.

## Assets and provenance

Original concept and the production-study assets were generated for this task
with the image generation tool. No third-party sprite gallery art is used by
the modern study. The original generated images remain in the session's
`/workspace/generated_images` folder; committed files are direct copies.

- `public/art/ballpark/celebrations.png`: 1374 × 1145 RGBA generated study,
  five rows of six poses (fist pump, confetti win, hop, bat salute, pitcher pump).
  `variants.js` records the source rectangles; no third-party art is used.
- `public/art/ballpark/night.png`: 1672 × 941 RGB, separate generic night ballpark.
- `public/art/ballpark/home-run.png`: 1448 × 1086 RGBA, a 4 × 3 grid of 362-pixel
  cells. One character per cell, helmet through thigh. Transparent backdrop.
- `public/art/ballpark/strikeout.png`: 1448 × 1086 RGBA, 4 × 3 cells, cap through
  thigh. Cap/glove pitcher art, distinct from the batter.
- `public/art/ballpark/catch.png`: 1448 × 1086 RGBA, 4 × 3 cells, a full-body
  fielding sequence. No appearance or handedness claim about a named player.

The renderer uses a 768 × 432 artboard and nearest-neighbor sampling. These are
high-resolution pixel-art study assets, not a final tightly indexed sprite pack.
The new shared study is about 1.8 MB before HTTP transfer compression. The stadium
and selected atlas load on demand; switching between the five new actions reuses
the study download. The catch still fetches its separate atlas. The older batter
and pitcher sources remain as original study assets; the catalog uses the new poses. `vite.config.js` excludes this study-art directory
from the PWA install precache. Replacing the art with smaller authored atlases
later does not change the scene's public interface.

## Next slices

1. Add verified uniform material maps and park landmarks independently.
2. Extend the scene library as new event types require it. Batting, pitching
   and fielding can choose close-ups or action sequences per event.
3. Additional celebrations must preserve the explicit Next handoff into a
   checkpoint and the scoring frontier's existing reveal contract.

Provisional event lengths are 1–2 seconds for quick reactions, 2–3 seconds for
home runs and defensive highlights, and at most about 4 seconds for rare moments.
Actual reading time and choreography govern the final timing; skip stays available.
