# Ballpark celebrations

The modern pixel-art study extends PR 2673's standalone cutscene kit. It is
reviewed at `/animation-lab?nointro#ballpark`; Gameday does not mount it yet.

## Art direction

The owner chose contemporary indie pixel art, citing Animal Well's craft and
atmosphere rather than retro sports art or photorealistic rendering. Preserve
readable team colors, convincing silhouette and body mechanics, layered stadium
depth, and restrained rim lighting. The approved concept and interview are the
basis for the new study; the old procedural cutscene stays available.

The character represents a team, not a likeness. Its rear view, helmet, sleeves
and gloves avoid assigning an appearance to the named player. Do not infer race,
skin tone or appearance from player data. The player caption carries identity.

## Separate authoring concerns

- `cutscene/ballpark/choreography.js`: the finite home-run action and pure clock.
  The frame track holds anticipation, a turn, the pump, then a confident settle.
  It ends after 2.8 seconds; it never cycles. Pose 9 is omitted from the playback
  because its lowered arm breaks the settling arc. It remains in the source atlas.
- `assets.js`: shared image decode, bounded palette cache and conservative
  material recoloring, performed once per palette, not once per animation frame.
  `HOME_RUN_ART` describes the atlas grid and scene framing.
- `drawBallpark.js`: canvas composition, no game data or player inference.
- `BallparkCelebration.jsx`: decode-aware playback, controlled-time inspection,
  completion, pause/resume, optional skip control, and both app and OS reduced
  motion. In reduced motion it presents the final composed frame. When hidden,
  playback pauses rather than consuming the sequence off-screen.
- `animlab/CutsceneMotionLab.jsx`: replay, pause, scrubbing, adjacent-pose review,
  slow playback, conservative club-palette previews and a frozen frame strip.

`character`, `backdrop` and `track` are independent props. A future pitcher or
fielder gets its own atlas and choreography; a future park gets its own background.
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

Original concept and both production-study assets were generated for this task
with the image generation tool. No third-party sprite gallery art is used by
the modern study. The original generated images remain in the session's
`/workspace/generated_images` folder; committed files are direct copies.

- `public/art/ballpark/night.png`: 1672 × 941 RGB, separate generic night ballpark.
- `public/art/ballpark/home-run.png`: 1448 × 1086 RGBA, a 4 × 3 grid of 362-pixel
  cells. One character per cell, helmet through thigh. Transparent backdrop.

The renderer uses a 768 × 432 artboard and nearest-neighbor sampling. These are
high-resolution pixel-art study assets, not a final tightly indexed sprite pack.
They total about 4 MB before HTTP transfer compression and load only when the
Animation Lab component mounts. `vite.config.js` excludes this study-art directory
from the PWA install precache. Replacing the art with smaller authored atlases
later does not change the scene's public interface.

## Next slices

1. Review the actual home-run playback, especially pelvis registration and the
   fast turn. Generated frames need art review; passing tests is not art approval.
2. Author a short strikeout reaction with cap/glove art and a defensive catch
   flowing into a reaction, using the same scene interface.
3. Add verified uniform material maps and park landmarks independently.
4. Integrate event triggers in a later pass, preserving Gameday's reveal boundary.
   Batting, pitching and fielding can choose close-ups or action sequences per event.

Provisional event lengths are 1–2 seconds for quick reactions, 2–3 seconds for
home runs and defensive highlights, and at most about 4 seconds for rare moments.
Actual reading time and choreography govern the final timing; skip stays available.
