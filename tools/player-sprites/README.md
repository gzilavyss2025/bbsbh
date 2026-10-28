# Player sprite template

Original, editable vector templates for standing catcher (with equipment), infielder,
outfielder, set pitcher, and batting from either side. These are authoring assets;
they do not replace the shipped Gameday atlas or its animations.

The checked-in [example sheet](examples/index.html) previews the default combination.

Edit `player.json`, then run from the repository root:

```sh
node tools/player-sprites/export.mjs
```

Open `.scratch/player-sprites/index.html` to compare all six poses. Each SVG has a
transparent background, a fixed 192 × 256 frame and the same ground anchor, so
height changes stay visible when sprites share a scene. Import the SVG into a vector
editor to tune its named parts (`jersey`, `piping`, `arms`, `legs`, `cap`, equipment).

Set `heightInches` (54–84) and `weightPounds` (100–350). Height changes stature;
weight changes width relative to height. This is a visual approximation, not an
anatomical model. All twelve color channels accept six-digit hex and can be tuned
independently, including catcher equipment, socks, skin, and bat.

Keep multiple uniform combinations as separate JSON files:

```sh
node tools/player-sprites/export.mjs /path/to/away.json .scratch/away-sprites
```

For hand-tuned poses, copy an entry from `poses` in `template.mjs` into the matching
key under `poses` in your JSON. Each arm/leg uses `[x1,y1,x2,y2,x3,y3]` for its three
joints; `glove` uses `[x,y]`, and `bat` uses `[x1,y1,x2,y2]`. Coordinates use the
160 × 200 local authoring space. Left batting mirrors right batting by default;
its overrides use the same coordinates before mirroring. Keep joint coordinates
inside the frame with room for strokes. The SVG renderer is also importable as
`renderSprite(config, poseName)` without filesystem or browser dependencies.

These are static templates, not animation sheets. For pixel output, rasterize a
finished SVG at the target resolution in your art tool; vector scaling preserves
the editable source.
