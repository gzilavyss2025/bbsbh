// The Advanced module's pure view (#2012). A role's facts (api/person/advanced.js), the raw bundle (for the
// sample counts) and the league row (api/player/leagueAverages.js) in; tiles out. No React, no fetch.
import { DASH, fixed2, rate2, rate3 } from '../../../../../api/person/shared.js'

const AVERAGE = '100 = MLB average'
const pct = (n) => `${(n * 100).toFixed(1)}%`
const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))

// Tile order per role: [label, league caption from the row, lead tile]. A fact is found by its label.
const LAYOUT = {
  hitting: [
    ['wOBA'],
    ['wRC+', () => AVERAGE, true],
    ['K%', (r) => r.k != null && `MLB ${pct(r.k)}`],
    ['BB%', (r) => r.bb != null && `MLB ${pct(r.bb)}`],
    ['BB/K', (r) => r.bbk != null && `MLB ${rate2(r.bbk)}`],
    ['ISO', (r) => r.iso != null && `MLB ${rate3(r.iso)}`],
    ['BABIP', (r) => r.babip != null && `MLB ${rate3(r.babip)}`],
    ['P/PA', (r) => r.ppa != null && `MLB ${fixed2(r.ppa)}`],
  ],
  // A starter's Quality starts and a reliever's Inherited scored compete for the last place: a pitcher has one.
  pitching: [
    ['FIP', (r, s) => s?.era != null && `ERA ${s.era}`],
    ['ERA−', () => AVERAGE, true],
    ['K%', (r) => r.k != null && `MLB ${pct(r.k)}`],
    ['BB%', (r) => r.bb != null && `MLB ${pct(r.bb)}`],
    ['K−BB%', (r) => r.kbb != null && `MLB ${pct(r.kbb)}`],
    ['Ground ball %'],
    ['Opp. AVG / OPS', (r) => r.avg != null && r.ops != null && `MLB ${rate3(r.avg)} / ${rate3(r.ops)}`],
    ['Quality starts'],
    ['Inherited scored'],
  ],
}

// October has no league row to read against: K% and BB% give their counts instead ("4 of 27 PA").
const COUNTS = {
  hitting: { 'K%': 'strikeOuts', 'BB%': 'baseOnBalls', of: 'plateAppearances', unit: 'PA' },
  pitching: { 'K%': 'strikeOuts', 'BB%': 'baseOnBalls', of: 'battersFaced', unit: 'BF' },
}

function sampleOf(role, s) {
  const g = num(s?.gamesPlayed)
  const parts =
    role === 'pitching'
      ? [g != null && `${g} G`, num(s?.gamesStarted) != null && `${num(s.gamesStarted)} GS`, s?.inningsPitched && `${s.inningsPitched} IP`]
      : [g != null && `${g} G`, num(s?.plateAppearances) != null && `${num(s.plateAppearances)} PA`]
  return parts.filter(Boolean).join(' · ')
}

export function advancedView({ role, facts, bundle, rates, post = false }) {
  const byLabel = new Map((facts ?? []).map((x) => [x.label, x]))
  const season = bundle?.season
  const counts = COUNTS[role]
  const tiles = LAYOUT[role]
    .filter(([label]) => byLabel.has(label))
    .map(([label, league, lead]) => {
      const { value, note } = byLabel.get(label)
      const missing = value == null || value === DASH
      // The league row is a regular-season rate: October shows counts or nothing.
      const n = post ? num(season?.[counts[label]]) : null
      const of = num(season?.[counts.of])
      const caption = missing ? '' : post ? (n != null && of != null ? `${n} of ${of} ${counts.unit}` : '') : (league?.(rates ?? {}, season) || '')
      return { key: label, label, value: missing ? DASH : value, note, caption, lead: !!lead, missing }
    })
  return tiles.length ? { sample: sampleOf(role, season), tiles } : null
}
