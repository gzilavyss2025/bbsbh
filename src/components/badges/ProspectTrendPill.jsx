import { confidenceLabel, confidenceState, levelTier, movementState, tierLabel } from '../../api/prospectTrend.js'

// A compact, always-visible /prospects Ledger cell for bbsbh's own
// level-relative OPS/ERA percentile (src/api/prospectTrend.js,
// gen-prospect-trend.mjs) — meant to sit next to the weekly-refreshed
// Pipeline rank without reading as a second, competing rank. Unlike
// RadarPill (a third-party opinion, tap-to-reveal inside a roster row's
// flex-wrap), this lives in a plain table cell, so it stays a static line —
// Ledger's rows are fixed-shape, with no open/close state to lift.
//
// The exact percentile, named standing band, sample confidence, and movement
// each get one job. The former five-dot tier row duplicated the named band and
// competed with the percentile, so the board now uses the band label alone.
function bandFor(tier) {
  return tier <= 2 ? 'low' : tier >= 4 ? 'high' : 'mid'
}

function DirectionTriangle({ up }) {
  return (
    <svg viewBox="0 0 20 20" width="11" height="11" aria-hidden="true">
      {up ? (
        <polygon points="8.5,3.5 14.5,14.5 2.5,14.5" fill="currentColor" />
      ) : (
        <polygon points="2.5,3.5 14.5,3.5 8.5,14.5" fill="currentColor" />
      )}
    </svg>
  )
}

// A percentile wobbles a point or two on a single good night, so the arrow
// stays off until the move is big enough to be about the player. Five points is
// roughly one rung on the band scale above.
const METRIC = { hitting: 'OPS', pitching: 'ERA' }
function ordinal(value) {
  const mod100 = value % 100
  const suffix = mod100 >= 11 && mod100 <= 13
    ? 'th'
    : value % 10 === 1
      ? 'st'
      : value % 10 === 2
        ? 'nd'
        : value % 10 === 3
          ? 'rd'
          : 'th'
  return `${value}${suffix}`
}

function shortDate(apiDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(apiDate ?? '')
  if (!match) return ''
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function outsToIp(outs) {
  return `${Math.floor(outs / 3)}.${outs % 3}`
}

function sampleLabel(entry) {
  if (!Number.isFinite(entry?.sampleSize)) return null
  return entry.group === 'pitching' ? `${outsToIp(entry.sampleSize)} IP` : `${entry.sampleSize} PA`
}

// `entry` comes from prospectTrendById (prospectTrend.js). Two distinct
// empty states, on purpose: `entry == null` is bbsbh's own data gap (no
// current-level line at all — off the board, injured all season, a fresh
// promotion the generator hasn't caught up to yet), same em dash every other
// empty Ledger cell on this page uses; `qualified === false` is a real,
// present row that just hasn't cleared the playing-time floor, worth saying
// plainly rather than folding into the same silent dash.
const DASH = '—'

export function ProspectTrendPill({ entry, level }) {
  const metric = METRIC[entry?.group] ?? 'Performance'
  const comparison = level ? `${metric} vs ${level}` : `${metric} vs level`
  if (!entry) {
    return (
      <span className="prospecttrend prospecttrend--unqualified">
        <span className="prospecttrend__headline">{comparison}</span>
        <span className="prospecttrend__meta">{DASH} No standing yet</span>
      </span>
    )
  }
  if (!entry.qualified || !Number.isFinite(entry.percentile)) {
    return (
      <span className="prospecttrend prospecttrend--unqualified">
        <span className="prospecttrend__headline">{comparison}</span>
        <span className="prospecttrend__meta">Too early{sampleLabel(entry) ? ` · ${sampleLabel(entry)}` : ''}</span>
      </span>
    )
  }
  const tier = levelTier(entry.percentile)
  const movement = movementState(entry.movement)
  const moving = movement?.direction === 'up' || movement?.direction === 'down'
  const confidence = confidenceState(entry.sampleSize, entry.group)
  const sampleConfidence = confidenceLabel(confidence)
  const movementDate = shortDate(movement?.sinceDate)
  return (
    <span className="prospecttrend">
      <span className="prospecttrend__headline">{comparison} · {ordinal(entry.percentile)} percentile</span>
      <span className="prospecttrend__details">
        <span className={`prospecttrend__band prospecttrend__band--${bandFor(tier)}`}>
          {tierLabel(tier)} band
        </span>
        <span className="prospecttrend__sample">{sampleConfidence}{sampleLabel(entry) ? ` · ${sampleLabel(entry)}` : ''}</span>
        <span className={`prospecttrend__move${moving ? ` prospecttrend__move--${movement.direction}` : ''}`}>
          {moving ? <DirectionTriangle up={movement.direction === 'up'} /> : <span className="prospecttrend__steady" aria-hidden="true" />}
          {moving ? `${movement.direction === 'up' ? 'Up' : 'Down'} ${movement.amount} pts${movementDate ? ` since ${movementDate}` : ''}` : `Steady${movementDate ? ` since ${movementDate}` : ''}`}
        </span>
      </span>
    </span>
  )
}
