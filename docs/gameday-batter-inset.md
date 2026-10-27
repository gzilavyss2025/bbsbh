# Gameday batter inset

`public/art/gameday/batter-ready.webp` is a static two-cell atlas for the lower-left plate inset.
The left cell is the right-handed hitter; the right cell is the mirrored left-handed hitter.
It is independent of the celebration atlases and has no animation track.

Generated with the built-in imagegen tool on 2026-10-27, using the existing
`public/art/ballpark/home-run.png` only for the cream/navy/gold pixel-art style.
The owner requested a tighter stance matching MLB Gameday. The official
[upper-body reference](https://prod-gameday.mlbstatic.com/responsive-gameday-assets/1.3.0/images/batters/2024/right/119_jersey_4_2024.png)
and [leg reference](https://prod-gameday.mlbstatic.com/responsive-gameday-assets/1.3.0/images/batters/2026/right/119_pants_1_2026.png)
were generation inputs for posture. These MLB source assets are not shipped.
The character represents a batting role, not the named player's likeness or actual uniform.

The selected generated source is 1536 x 1024 RGBA. The committed atlas is
768 x 512, lossless WebP with the source alpha preserved, 188,260 bytes.
CSS selects an equal half and the shared `stage/battingSide.js` resolves switch hitters
opposite the pitcher's hand. No fetch or revealed result is inferred from the art.
The existing zone values retain their orientation when the batter changes sides. The grid and plate share one width; the title is omitted.

`zonemap/batterPalette.js` exposes independent equipment, jersey, trim and optional pants colors. `BatterSprite` accepts these hex overrides through its optional `colors` prop; without overrides it follows `teamId`. Equipment and jersey default to the batting club primary, piping to its secondary, while trousers remain neutral. This reads the existing MLB/MiLB identity resolver: affiliate own colors first, parent organization only as the established fallback, then neutral for unknown identities. The source shading, wooden bat and gloves remain distinct. `batterArt.js` shares one image decode and caches up to eight prepared palettes; no pixel recoloring runs in the field animation loop. Inset artwork load failure falls back to the source while the zone grid remains usable.

## Final generation prompt

Use case: stylized-concept
Asset type: TWO-CELL transparent batter sprite atlas for a hot/cold zone inset.
Image 1 is STYLE REFERENCE ONLY: match the shaded modern pixel-art cream uniform, navy helmet and sleeves, gold trim, gloves. Images 2 and 3 are STANCE REFERENCES: MLB Gameday upper-body and pants layers. Match their exact compact side-on, slightly front-facing batting stance, not the rear-facing open stance from the style reference. Feet aligned narrowly in depth toward the pitcher, knees softly bent, torso and hips closed/square, both hands beside the rear shoulder, elbows tucked and bat angled diagonally back. The face stays in helmet shadow, no visible likeness. Show the same frontal/side camera as the MLB references: chest/side of torso visible, never back or backside.
Create exactly two equal columns in one landscape atlas. LEFT cell one full-body RIGHT-HANDED hitter facing screen right, matching the MLB references. RIGHT cell the mirrored LEFT-HANDED hitter facing screen left. Same size, scale, padding, foot baseline. Entire bat and both shoes visible. Adult athletic proportions. No uniform logos, lettering, text, grid, plate, zone, scenery, ground, shadows, glow, colored haze or background. Isolated figures only on genuinely transparent alpha. Crisp restrained shaded pixel-art treatment legible at 140px tall. DO NOT use the wide open hips, splayed feet, exaggerated crouch, or rear-view pose of Image 1.
