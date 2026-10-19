// The contact replay's quality line and swing timing from Savant's bat tracking
// (docs/contact-replay.md §3.4, §6.2, §6.3, §7.2). Pure, reveal-only like the replay that calls it.
import { clamp } from '../math/number.js'

// The verdict cutoffs, in one place (§7.2: a first cut, tuned on real games).
export const HARD_LUCK_XBA = 0.5 // an out at or above this
export const LUCKY_XBA = 0.25 // a hit below this

// The later signals (#1771, docs/contact-replay.md §7.3): a first cut, tuned on real games.
export const BLAST_SUM = 164 // Savant's blast: squared-up % + bat speed (mph) at or above this
export const FAST_SWING_MPH = 75 // Savant's "fast swing"
export const SHORTEN_MPH = 5 // two strikes: this far under his own season bat speed (the league gap is only ~2)
export const TOPPED_GAP = -20 // launch angle minus attack angle, at or under this: driven down
export const UNDER_GAP = 45 // at or over this: the bat went under the ball (2026-10-13 and 14: the 10th and 90th percentiles are -23 and 45)

const HITS = new Set(['single', 'double', 'triple', 'home_run'])
const NEITHER = new Set(['field_error', 'fielders_choice', 'catcher_interf']) // not a clean hit or out
const PARKS = 30
const DEFAULT_SWING_SEC = 0.16

// §3.4. Null when any input is missing.
export function squaredUp(exitVelo, batSpeed, mph) {
  if (exitVelo == null || !(batSpeed > 0)) return null // a missing bat speed is unknown, not a measured 0 (`1.23 * null` is 0)
  const v = exitVelo / (1.23 * batSpeed + 0.2116 * mph)
  return Number.isFinite(v) ? v : null
}

// §6.2: the swing takes 0.16 s at 72 mph of bat speed, 0.14 to 0.18 s at any other.
export const swingSeconds = (batSpeed) => (batSpeed > 0 ? clamp((DEFAULT_SWING_SEC * 72) / batSpeed, 0.14, 0.18) : DEFAULT_SWING_SEC)

// §6.3: the squared-up fraction, capped at 1; 0.8 until bat speed arrives.
export const ringStrength = (su) => (su == null ? 0.8 : Math.min(1, su))

export function verdictFor(eventType, tr) {
  if (!tr) return null
  const isHit = HITS.has(eventType)
  if (!isHit && !NEITHER.has(eventType) && tr.xba != null && tr.xba >= HARD_LUCK_XBA) return 'Hard-luck out'
  if (isHit && tr.xba != null && tr.xba < LUCKY_XBA) return 'Lucky hit'
  return tr.barrel ? 'Barrel' : null
}

// §7.3. Short pencil notes, never stamps. `norm` is his season bat speed, `tr.attackDeg` is final-tier only.
export function swingNotes(p, tr, { norm } = {}) {
  const notes = []
  const bs = tr?.batSpeed
  if (bs == null) return notes
  const su = p.swing === 'inplay' ? squaredUp(p.hit?.exitVelo, bs, Number(p.mph)) : null
  if (su != null && Math.min(1, su) * 100 + bs >= BLAST_SUM) notes.push('Blast')
  else if (bs >= FAST_SWING_MPH) notes.push('Fast swing')
  if (p.twoStrikes && norm != null && bs <= norm - SHORTEN_MPH) notes.push('Shortened up with two strikes')
  const gap = p.swing === 'inplay' && tr.attackDeg != null && p.hit?.launchAngle != null ? p.hit.launchAngle - tr.attackDeg : null
  if (gap != null && gap <= TOPPED_GAP) notes.push('Topped it')
  else if (gap != null && gap >= UNDER_GAP) notes.push('Got under it')
  return notes
}

const pct = (v) => `${Math.round(Math.min(1, v) * 100)}%`

// `tr` is the pitch's /gf row (or undefined); `mlb` false means no /gf was asked for (§10), so no waiting figures.
// Returns { figs: [{ num, label, wait? }], verdict, notes }.
export function qualityFigures(p, tr, { eventType, mlb, norm }) {
  const figs = []
  if (p.swing === 'inplay') {
    if (p.hit?.exitVelo == null) return { figs, verdict: null, notes: [] }
    figs.push({ num: p.hit.exitVelo.toFixed(1), label: 'mph off the bat' })
    if (mlb) {
      const su = squaredUp(p.hit.exitVelo, tr?.batSpeed, Number(p.mph))
      figs.push(su == null ? { num: '—', label: 'squared up · waits for bat speed', wait: true } : { num: pct(su), label: 'squared up' })
      if (tr?.xba != null) figs.push({ num: tr.xba.toFixed(3).replace(/^0/, ''), label: 'xBA' })
      if (eventType === 'home_run' && tr?.hrParks != null) figs.push({ num: `${tr.hrParks} of ${PARKS}`, label: 'parks a home run' })
    }
    return { figs, verdict: mlb ? verdictFor(eventType, tr) : null, notes: mlb ? swingNotes(p, tr, { norm }) : [] }
  }
  if (mlb && tr?.batSpeed != null) figs.push({ num: tr.batSpeed.toFixed(1), label: 'mph bat speed' })
  if (p.swing === 'whiff' && p.breakH != null) figs.push({ num: `${Math.abs(p.breakH).toFixed(1)} in`, label: 'horizontal break' })
  return { figs, verdict: null, notes: mlb ? swingNotes(p, tr, { norm }) : [] }
}
