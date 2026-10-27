// A scene spec says what a cutscene shows; the presets are the three Gameday big plays. A caller
// passes a preset name, or a spec of its own (optionally `preset` to start from one):
//   backdrop  a BACKDROPS name (cutsceneBackdrops.js) or a function (b, k, t)
//   poses     pose names in the beat cycle; one name holds still, two or more alternate at beatHz after beatAt
//   sprites   extra poses by name, rows from buildPose() (cutscenePoses.js), merged over the built-in four
//   facing    'right' (the reference faces right) or 'left' to mirror the batter
//   at        the batter's top-left at scale 2; the belt meets the band at y 38
//   extras    EXTRAS names (cutsceneExtras.js) or functions (b, t, k, o), drawn in order behind the batter
//   lines     the band's lines (BAND_LINES shape); `$headline`, `$name`, `$detail` read the words
//   sequence  SEQUENCE overrides, in seconds
import { WAIST } from './cutscenePoses.js'

export const SEQUENCE = {
  enterAt: 0.25,   // the crowd stands, chips fall, the bat flip starts
  typeAt: 0.45,    // the first letter of the typed line
  perLetter: 0.05,
  beatAt: 0.5,     // the pose cycle's first change
  beatHz: 3.3,
  flashFor: 0.5,   // the typed line flashes once complete
  hold: 1.6,       // seconds after the typed line completes until `end`
}
// Band lines. `typed` types in letter by letter; `after` is seconds after the typed line completes;
// `blink` gives a one-blink entrance; align 'center' (default), 'left' or 'right' with an 8 px margin.
export const BAND_LINES = [
  { text: '$headline', y: 102, scale: 2, colour: 'chalk', shadow: 'jerseyLight', typed: true },
  { text: '$name', y: 122, scale: 1, colour: 'chalk', after: 0.25, blink: true },
  { text: '$detail', y: 133, scale: 1, colour: 'trim', after: 0.45 },
]
export const SCENES = {
  hr: { poses: ['up', 'pump'], extras: ['chips', 'batFlip'] },
  slam: { poses: ['up', 'pump'], extras: ['chips', 'fireworks'] },
  rbi: { poses: ['point', 'point2'], extras: ['chips'] },
}
export function sceneOf(spec) {
  const own = typeof spec === 'string' ? SCENES[spec] || SCENES.hr : spec || SCENES.hr
  const base = own.preset ? SCENES[own.preset] || {} : {}
  const s = { backdrop: 'night', poses: ['up'], sprites: {}, facing: 'right', at: [40, 38], extras: [], lines: BAND_LINES, ...base, ...own }
  s.sequence = { ...SEQUENCE, ...(base.sequence || {}), ...(own.sequence || {}) }
  s.rows = own.rows ?? base.rows ?? WAIST   // the last sprite row drawn: waist-up by default
  return s
}
