// Palette slots and small outlined sprites for the fixed overhead Gameday field.
// StageCanvas resolves these slots through the existing --stage-* tokens.

// One slot per --stage-* token that the drawing paints with. The remaining
// slots include the zone card temperatures and the overhead field materials.
export const TOKENS = [
  'sky', 'sky-haze', 'crowd-1', 'crowd-2', 'crowd-3', 'crowd-4', 'wall-deep', 'wall', 'wall-lit',
  'grass', 'grass-lit', 'grass-far', 'grass-foul', 'dirt', 'dirt-lit', 'chalk', 'outline', 'shadow', 'shadow-dirt',
  'kit-navy', 'kit-trim', 'kit-road', 'kit-road-shade', 'kit-red', 'skin', 'skin-shade', 'bat', 'landing', 'frame',
  'zone-cold', 'zone-cool', 'zone-lukewarm', 'zone-warm', 'zone-hot',
  'overhead-night', 'overhead-turf', 'overhead-turf-lit', 'overhead-turf-shade', 'overhead-clay',
  'overhead-clay-lit', 'overhead-gold', 'overhead-cloth', 'overhead-cloth-shade', 'overhead-equipment', 'overhead-leather',
]
export const S = Object.fromEntries(TOKENS.map((n, i) => [n.replace(/-(\w)/g, (_, c) => c.toUpperCase()), i]))

export const newBuf = (w, h) => ({ w, h, px: new Uint8Array(w * h) })
export const put = (b, x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.px[y * b.w + x] = c }
export function rect(b, x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(b, x + i, y + j, c) }

export const KIT = {
  home: { H: S.kitNavy, F: S.skin, J: S.chalk, T: S.kitRed, P: S.chalk, S: S.kitNavy, K: S.outline, s: S.skin },
  road: { H: S.kitNavy, F: S.skin, J: S.kitRoad, T: S.kitTrim, P: S.kitRoad, S: S.kitNavy, K: S.outline, s: S.skin },
  ump: { H: S.outline, F: S.skin, J: S.outline, T: S.kitNavy, P: S.kitRoadShade, S: S.outline, K: S.outline, s: S.skin },
}
// Feet at (x, y). The outline is every empty pixel next to the figure.
export function sprite(b, rows, x, y, kit, flip) {
  const h = rows.length, w = rows[0].length, x0 = Math.round(x - w / 2), y0 = Math.round(y - h)
  const at = (i, j) => (j < 0 || j >= h || i < 0 || i >= w ? '.' : rows[j][flip ? w - 1 - i : i])
  for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) {
    const ch = at(i, j)
    if (ch !== '.') put(b, x0 + i, y0 + j, kit[ch])
    else if (at(i - 1, j) !== '.' || at(i + 1, j) !== '.' || at(i, j - 1) !== '.' || at(i, j + 1) !== '.') put(b, x0 + i, y0 + j, S.outline)
  }
}
