import { confidenceState, levelTier } from '../../api/prospectTrend.js'

// A compact, always-visible /prospects Ledger cell for bbsbh's own
// level-relative OPS/ERA percentile (src/api/prospectTrend.js,
// gen-prospect-trend.mjs) — meant to sit next to the weekly-refreshed
// Pipeline rank without reading as a second, competing rank. Unlike
// RadarPill (a third-party opinion, tap-to-reveal inside a roster row's
// flex-wrap), this lives in a plain table cell, so it stays a static line —
// Ledger's rows are fixed-shape, with no open/close state to lift.
//
// THE ROW OF FIVE DOTS *is* the cell — the "at a glance" scan signal
// (levelTier, api/prospectTrend.js): 1-2 lit red mark him below his level's
// pack, 3 lit kraft-brown is in line with it, 4-5 lit green mark him above
// it. Reading a whole page of rows for who's over/underperforming is a color
// scan across this one column, not a sentence-by-sentence read — the spoken
// standing ("Top 7% OPS", "Bottom 12% ERA") standingLabel builds no longer
// prints, on purpose; it still carries the accessible name (role="img" +
// aria-label below), since a screen reader still needs the stat and the
// exact number a colored dot can't say on its own.
//
// The dot fill is the only load-bearing color here besides the movement
// arrow, which borrows --accent-positive/--accent-negative the same
// restrictive way RadarPill's own tag does (color marks the DIRECTION it
// moved, never the level) — its triangle carries the direction on its own
// shape so the colour there is never load-bearing either.
const DOT_COUNT = 5

// tier 1-2 => 'low' (red), 3 => 'mid' (kraft brown), 4-5 => 'high' (green).
function bandFor(tier) {
  return tier <= 2 ? 'low' : tier >= 4 ? 'high' : 'mid'
}

// Exported: ProspectCard.jsx (the player-page Analytics card) draws the same
// dot row beside its own tier text label, rather than inventing a second dot
// component that could drift from this one's tier→color mapping.
export function LevelDots({ tier }) {
  const band = bandFor(tier)
  return (
    <span className={`prospecttrend__dots prospecttrend__dots--${band}`} aria-hidden="true">
      {Array.from({ length: DOT_COUNT }, (_, i) => (
        <span key={i} className={i < tier ? 'prospecttrend__dot prospecttrend__dot--filled' : 'prospecttrend__dot'} />
      ))}
    </span>
  )
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
const MOVE_FLOOR = 5
const METRIC = { hitting: 'OPS', pitching: 'ERA' }
const BAND_LABEL = {
  1: 'Bottom band',
  2: 'Below band',
  3: 'Middle band',
  4: 'Above band',
  5: 'Top band',
}

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
  const delta = entry.movement?.delta
  const moving = Number.isFinite(delta) && Math.abs(delta) >= MOVE_FLOOR
  const confidence = confidenceState(entry.sampleSize, entry.group)
  const confidenceLabel = confidence === 'early' ? 'Early sample' : confidence === 'building' ? 'Building sample' : 'Established'
  return (
    <span className="prospecttrend">
      <span className="prospecttrend__headline">{comparison} · {ordinal(entry.percentile)} percentile</span>
      <span className="prospecttrend__details">
        <span className={`prospecttrend__band prospecttrend__band--${tier}`}>
          <LevelDots tier={tier} />
          <span>{BAND_LABEL[tier]}</span>
        </span>
        <span className="prospecttrend__sample">{confidenceLabel}{sampleLabel(entry) ? ` · ${sampleLabel(entry)}` : ''}</span>
        <span className={`prospecttrend__move${moving ? ` prospecttrend__move--${delta > 0 ? 'up' : 'down'}` : ''}`}>
          {moving ? <DirectionTriangle up={delta > 0} /> : <span className="prospecttrend__steady" aria-hidden="true" />}
          {moving ? `${delta > 0 ? 'Up' : 'Down'} ${Math.abs(delta)} pt` : 'Steady'}
        </span>
      </span>
    </span>
  )
}
