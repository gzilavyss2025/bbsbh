import { clubsFor } from '../../../../api/clubDefenseRunning.js'
import { leadSide } from '../hotBats.js'

// GLOVE AND LEGS (#2316): the six season measures of the two Series clubs, from
// api/clubDefenseRunning.js. Higher is better for all six. `lead` is 'a', 'b' or null: a tie
// or a missing value leads for nobody, so the card marks a leader only where the figures differ.
const MEASURES = [
  { key: 'oaa', group: 'Defense', label: 'Outs above average', signed: true },
  { key: 'framingRuns', group: 'Defense', label: 'Catcher framing runs', signed: true },
  { key: 'sprintSpeed', group: 'Running', label: 'Sprint speed', unit: 'ft/s' },
  { key: 'stolenBases', group: 'Running', label: 'Stolen bases' },
  { key: 'stolenBaseSuccess', group: 'Running', label: 'Stolen-base success', unit: '%' },
  { key: 'extraBasesTaken', group: 'Running', label: 'Extra bases taken', unit: '%' },
]
const real = (v) => Number.isFinite(v)
// One decimal, the way the card prints it, so the leader is picked on what is on screen. A -0 becomes 0.
const round1 = (v) => Math.round(v * 10) / 10 || 0
const MIN_REAL = 4

// (data from loadClubDefenseRunning, { clubA, clubB }) -> [{ key, group, label, unit, signed, a, b, lead }]
// in a fixed order, one row per measure: `a` is clubA's figure, `b` clubB's, either null when it has
// none. The whole card is null when a club has no row, or when fewer than MIN_REAL measures have a
// real value for BOTH clubs. Above that, a measure with a null side stays in as a row and draws a gap.
export function gloveLegsModel(data, { clubA, clubB }) {
  const pair = clubsFor(data, clubA, clubB)
  if (!pair) return null
  const rows = MEASURES.map((m) => {
    const [a, b] = pair.map((c) => (real(c[m.key]) ? round1(c[m.key]) : null))
    return { ...m, unit: m.unit ?? '', signed: Boolean(m.signed), a, b, lead: leadSide(a, b) }
  })
  return rows.filter((r) => real(r.a) && real(r.b)).length >= MIN_REAL ? rows : null
}

// A figure as the card prints it: one decimal only when it has a fraction (so a float tail in the
// file never shows), a "+" on a positive signed measure, a "%" on a percent.
export function gloveFigure(r, v) {
  const n = Number.isInteger(v) ? v : v.toFixed(1)
  return `${r.signed && v > 0 ? '+' : ''}${n}${r.unit === '%' ? '%' : ''}`
}
