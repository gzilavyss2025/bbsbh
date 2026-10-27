# Ballpark celebrations

The modern pixel-art study extends PR 2673's standalone cutscene kit. Home run,
strikeout and defensive-catch scenes are reviewed at `/animation-lab?nointro#ballpark`;
Gameday does not mount them yet. Browser recordings and pose sheets are exported
for the owner's cloud-session review; a localhost address is not a review deliverable.

## Art direction

The owner chose contemporary indie pixel art, citing Animal Well's craft and
atmosphere rather than retro sports art or photorealistic rendering. Preserve
readable team colors, convincing silhouette and body mechanics, layered stadium
depth, and restrained rim lighting. The approved concept and interview are the
basis for the new study; the old procedural cutscene stays available.

The character represents a team, not a likeness. Its rear view, helmet or cap,
covered arms and deep head/hand shadows avoid assigning an appearance to the named player. Do not infer race,
skin tone or appearance from player data. The player caption carries identity.

## Separate authoring concerns

- `cutscene/ballpark/choreography.js`: three finite actions and a pure clock.
  The frame track holds anticipation, a turn, the pump, then a confident settle.
  It ends after 2.8 seconds; it never cycles. Pose 9 is omitted from the playback
  because its lowered arm breaks the settling arc. It remains in the source atlas.
- The strikeout uses a dedicated cap-and-glove pitcher atlas: rise, compact
  pump, release and settle over 1.9 seconds. The defensive catch uses a separate
  full-body fielder: track, reach, catch, absorb, secure and acknowledge over
  2.8 seconds. Each has its own caption entrance and review beats.
- `scenes.js` pairs each role's artwork and choreography. This is an authored
  catalog, not a rule for which real game events earn a celebration.
- `assets.js`: shared image decode, bounded palette cache and conservative
  material recoloring, performed once per palette, not once per animation frame.
  `HOME_RUN_ART` describes the atlas grid and scene framing.
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

- `public/art/ballpark/night.png`: 1672 × 941 RGB, separate generic night ballpark.
- `public/art/ballpark/home-run.png`: 1448 × 1086 RGBA, a 4 × 3 grid of 362-pixel
  cells. One character per cell, helmet through thigh. Transparent backdrop.
- `public/art/ballpark/strikeout.png`: 1448 × 1086 RGBA, 4 × 3 cells, cap through
  thigh. Cap/glove pitcher art, distinct from the batter.
- `public/art/ballpark/catch.png`: 1448 × 1086 RGBA, 4 × 3 cells, a full-body
  fielding sequence. No appearance or handedness claim about a named player.

The renderer uses a 768 × 432 artboard and nearest-neighbor sampling. These are
high-resolution pixel-art study assets, not a final tightly indexed sprite pack.
They total about 6.5 MB before HTTP transfer compression. The stadium and selected
role's atlas load on demand; selecting another role fetches its atlas. `vite.config.js` excludes this study-art directory
from the PWA install precache. Replacing the art with smaller authored atlases
later does not change the scene's public interface.

## Next slices

1. Review the exported home-run, strikeout and catch playback, especially pose
   registration and catch contact. Generated frames need art review; passing
   tests is not art approval.
2. Add verified uniform material maps and park landmarks independently.
3. Integrate event triggers in a later pass, preserving Gameday's reveal boundary.
   Batting, pitching and fielding can choose close-ups or action sequences per event.

Provisional event lengths are 1–2 seconds for quick reactions, 2–3 seconds for
home runs and defensive highlights, and at most about 4 seconds for rare moments.
Actual reading time and choreography govern the final timing; skip stays available.
