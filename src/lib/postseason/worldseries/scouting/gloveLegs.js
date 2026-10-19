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
const MIN_REAL = 4

// (data from loadClubDefenseRunning, { clubA, clubB }) -> [{ key, group, label, unit, signed, a, b, lead }]
// in a fixed order, or null when a club has no row or fewer than MIN_REAL measures have a real
// value for BOTH clubs.
export function gloveLegsModel(data, { clubA, clubB }) {
  const pair = clubsFor(data, clubA, clubB)
  if (!pair) return null
  const rows = MEASURES.map((m) => {
    const [a, b] = pair.map((c) => (real(c[m.key]) ? c[m.key] : null))
    return { ...m, unit: m.unit ?? '', signed: Boolean(m.signed), a, b, lead: leadSide(a, b) }
  })
  return rows.filter((r) => real(r.a) && real(r.b)).length >= MIN_REAL ? rows : null
}
