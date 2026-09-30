import { readableTextColor } from '../../../lib/contrast.js'

// The chart's colour KEY — the header swatches, the readout's change pill and
// the swing pills — takes each club's BAND colour, so a reader can match a
// pill to the band it describes. The band is the curated one (wpaBandColors.js:
// Guardians grey, not the chip navy), which the chip colours often are not.

const HEX = /^#[0-9a-f]{6}$/i
const LIGHT = '#FFFFFF'
const DARK = '#1B2A3A' // --ink-1

// { fill, text } for one club. `band` is the band's fill colour (a pinstripe
// band passes its line colour); `chip` is chipColorsFor(teamId), used when the
// band is not a plain hex.
export function winProbKeyColor(band, chip) {
  if (!HEX.test(band ?? '')) return { fill: chip.primary, text: chip.text }
  return { fill: band, text: readableTextColor(band, LIGHT, DARK) }
}

// Straight-line RGB distance below which two fills read as the same colour
// on a small swatch or pill.
const CLASH = 48

function distance(a, b) {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [x, y] = [rgb(a), rgb(b)]
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
}

// Both keys, and when they clash, the away key moves to the first of the club's
// secondary, then primary chip colour that clears the home fill, so the two
// pills never read as one club. If neither clears it, the away key takes white
// or the ink navy, whichever is farther from the home fill. The home key keeps
// the band colour.
export function winProbKeyPair(away, home, awayChip) {
  if (!HEX.test(away.fill) || !HEX.test(home.fill) || distance(away.fill, home.fill) >= CLASH) return { away, home }
  const clear = [awayChip.secondary, awayChip.primary]
    .find((c) => HEX.test(c ?? '') && distance(c, home.fill) >= CLASH)
  const fill = clear ?? (distance(LIGHT, home.fill) >= distance(DARK, home.fill) ? LIGHT : DARK)
  return { away: winProbKeyColor(fill, awayChip), home }
}

// A figure pill's inline style in a key colour: the pill's own custom
// properties, never a repaint (system/pill.css).
export function winProbKeyPill(key) {
  return { '--pill-fill': key.fill, '--pill-edge': key.fill, '--pill-text': key.text }
}
