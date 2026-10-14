import { hitterCounters } from '../../../../../api/scout/hitterGrid.js'
import { GRID, inZone } from '../../../../../lib/zone/zoneGeometry.js'

// The batter Plate approach's pure view (#1887): what the hitter did with each pitch, from the
// hitter-grid counters (ADR-0096, #1911). Season sums over Final games; an open surface.
// A cell index is the grid's feed frame (commandCell order); the card draws a column through viewCol.

// The five ways a pitch ended, hitter's side first. A foul tip is a whiff (Gary, 2026-10-13).
export const OUTCOMES = ['In play', 'Ball', 'Foul', 'Called', 'Whiff']
export const MIN_CELL = 10 // a cell under this many pitches prints nothing
const MIN_TYPE = 10 // a pitch type under this many is left out of the mix

const sum = (a) => a.reduce((x, y) => x + y, 0)
const rate = (n, d) => (d > 0 ? n / d : null)
const ALL = Array.from({ length: GRID * GRID }, (_, i) => i)
const ZONE = ALL.filter((i) => inZone({ col: i % GRID, row: Math.floor(i / GRID) }))
const OUT = ALL.filter((i) => !ZONE.includes(i))

export const fmtPct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)
export const fmtMph = (v) => (v == null ? '—' : v.toFixed(1))
const whole = (v) => Math.round(v * 100)

// The figures one cut prints (#1887; slice 16 moved them here from PlateModule's table row,
// unchanged): the five outcomes as whole-number labels (a share under 8% prints none), the
// two sides, the count, the speed and the whiff. `name` makes the card's aria-label.
export function outcomeFigures(name, v) {
  const n = v.n.toLocaleString()
  const mph = fmtMph(v.rates.mph)
  const whiff = fmtPct(v.rates.whiff)
  const bad = v.pitcher == null ? '—' : `${whole(v.pitcher)}% pitcher's`
  return {
    segs: v.segs ? v.segs.map((k) => ({ n: k, label: k / v.n >= 0.08 ? String(whole(k / v.n)) : '' })) : [],
    good: v.hit == null ? '—' : `${whole(v.hit)}% hitter's`,
    bad,
    n,
    mph,
    whiff,
    aria: `${name}: Pitches ${n}, MPH ${mph}, Whiff ${whiff}, ${bad}`,
  }
}

// [inPlay, ball, foul, called, whiff] over some cells; null when the plate counters are not on file.
function mix(c, at = ALL) {
  if (!c.calledStrikes || !c.inPlay) return null
  const add = (f) => at.reduce((t, i) => t + c[f][i], 0)
  const [pitches, swings, whiffs, called, inPlay] = ['pitches', 'swings', 'whiffs', 'calledStrikes', 'inPlay'].map(add)
  return [inPlay, pitches - swings - called, swings - whiffs - inPlay, called, whiffs]
}

// One cut of the grid -> null | { n, swings, rates, segs, hit, pitcher, cells }.
// `hit` is the share of pitches that ended in play or as a ball, `pitcher` the share that ended
// as a called strike or a whiff. Both and `segs` are null without the plate file.
export function plateView(grid, { hand = null, code = null } = {}) {
  const c = grid && hitterCounters(grid, { hand, code, scope: 'R' })
  const n = c && sum(c.pitches)
  if (!n) return null
  const swings = sum(c.swings)
  const count = (f, at) => at.reduce((t, i) => t + c[f][i], 0)
  const speed = c.speedSum && sum(c.speedSum)
  const segs = mix(c)
  const cells = ALL.map((i) => {
    const m = mix(c, [i])
    const cn = c.pitches[i]
    return { i, n: cn, hit: m && cn >= MIN_CELL ? (m[0] + m[1]) / cn : null, segs: m }
  })
  // Rank the cells that print by the hitter's share into five bands (0 = the pitcher's, 4 = the hitter's).
  const ranked = cells.filter((x) => x.hit != null).sort((a, b) => a.hit - b.hit)
  cells.forEach((x) => { x.band = x.hit == null ? null : Math.min(4, Math.floor((ranked.findIndex((y) => y.hit === x.hit) / ranked.length) * 5)) })
  return {
    n,
    swings,
    rates: {
      swing: rate(swings, n),
      chase: rate(count('swings', OUT), count('pitches', OUT)),
      zone: rate(count('pitches', ZONE), n),
      whiff: rate(sum(c.whiffs), swings),
      mph: speed ? speed / n : null,
    },
    segs,
    hit: segs && (segs[0] + segs[1]) / n,
    pitcher: segs && (segs[3] + segs[4]) / n,
    cells,
  }
}

// The pitches thrown at him by one hand (or both, `hand` null), for the hand chips.
export const pitchesVs = (grid, hand) => {
  const c = hitterCounters(grid, { hand, scope: 'R' })
  return c ? sum(c.pitches) : 0
}

// One row per pitch type with MIN_TYPE pitches or more, biggest first: { code, n, view }.
export function pitchRows(grid, hand) {
  const codes = Object.keys(grid?.reg?.mlb ?? {})
  return codes
    .map((code) => ({ code, view: plateView(grid, { hand, code }) }))
    .filter((r) => r.view && r.view.n >= MIN_TYPE)
    .map((r) => ({ ...r, n: r.view.n }))
    .sort((a, b) => b.n - a.n)
}
