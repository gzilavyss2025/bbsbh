import { prospectTrendById, prospectCardFor, confidenceLabel, movementState } from '../../../../../api/prospectTrend.js'
import { tenureFact } from '../../../../../api/levelTenure.js'
import { outsToIp } from '../../../../../lib/math/innings.js'
import { ordinal } from '../../../../../lib/format.js'
import { SPORT_LABEL } from '../../../../../lib/teams.js'
import { inMinors } from '../innings/inningsView.js'

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const GROUP_WORD = { OPS: 'hitters', ERA: 'pitchers' }

// PA for a hitter, outs for a pitcher (the file's own unit), said the way the page says it.
const amount = (metric, n) => (metric === 'OPS' ? `${n} PA` : `${outsToIp(n)} IP`)
const count = (metric, n) => (metric === 'OPS' ? String(n) : outsToIp(n))
const unit = (metric) => (metric === 'OPS' ? 'PA' : 'IP')

function moveText(movement) {
  const m = movementState(movement)
  if (!m) return null
  const [, mo, d] = (m.sinceDate ?? '').split('-').map(Number)
  const since = mo ? ` since ${MONTH[mo - 1]} ${d}` : ''
  return m.direction === 'steady' ? `Steady${since}` : `${m.direction === 'up' ? 'Up' : 'Down'} ${m.amount} percentile points${since}`
}

// The Prospect performance card (#2068). Null hides the card: an MLB player, no trend row, or a page
// dated in an earlier season than the nightly file (it is the latest snapshot; `asOf` cannot rewind it).
// The level is the trend row's, not the live club's (#1359).
export function prospectView(snapshot, tenureSnap, bio, asOf) {
  if (!inMinors(bio)) return null
  const entry = prospectTrendById(snapshot, bio.id)
  if (!entry) return null
  if (asOf && asOf.slice(0, 4) < (snapshot.generatedAt ?? '').slice(0, 4)) return null
  const { view, sportId } = prospectCardFor(
    snapshot, entry, bio.birthDate, null, tenureFact(tenureSnap, entry.sportId, entry.group, entry.sampleSize),
  )
  const level = SPORT_LABEL[sportId]
  const metric = view.metric
  const t = view.tenure
  const tenure = t && (t.pct >= 100
    ? `${amount(metric, t.sampleSize)}, already past a typical ${level} stay (median ${amount(metric, t.median)})`
    : `${amount(metric, t.sampleSize)}, about ${t.pct}% of a typical ${level} stay (median ${amount(metric, t.median)})`)
  const e = view.ageEdge
  const age = e && `${e.years} ${e.years === 1 ? 'year' : 'years'} ${e.direction} than the average qualified ${level} ${GROUP_WORD[metric].slice(0, -1)}.`
  const base = { state: view.state, count: level, heading: `${metric} vs ${level}`, metric, tenure, age }
  if (view.state === 'unqualified') {
    return { ...base, title: `Early sample · ${amount(metric, view.sampleSize)}`, need: `${amount(metric, view.floor)} needed to join the qualified ${level} ${GROUP_WORD[metric]} population.`, tileNum: count(metric, view.sampleSize), tileCap: `${unit(metric)} of ${count(metric, view.floor)}` }
  }
  return {
    ...base,
    pct: view.percentile,
    ordinal: ordinal(view.percentile),
    suffix: ordinal(view.percentile).slice(String(view.percentile).length),
    standing: view.standing,
    tierLabel: view.tierLabel,
    comparison: `Compared with ${view.populationSize} qualified ${level} ${GROUP_WORD[metric]} with at least ${amount(metric, view.floor)}`,
    confidence: `${confidenceLabel(view.confidence)} · ${amount(metric, view.sampleSize)}`,
    movement: moveText(view.movement),
  }
}
