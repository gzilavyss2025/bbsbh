import { standingLabel } from '../../api/prospectTrend.js'

// A compact, always-visible /prospects Ledger cell for bbsbh's own
// level-relative OPS/ERA percentile (src/api/prospectTrend.js,
// gen-prospect-trend.mjs) — meant to sit next to the weekly-refreshed
// Pipeline rank without reading as a second, competing rank. Unlike
// RadarPill (a third-party opinion, tap-to-reveal inside a roster row's
// flex-wrap), this lives in a plain table cell, so it stays a static line —
// Ledger's rows are fixed-shape, with no open/close state to lift.
//
// IT DOES NOT PRINT THE PERCENTILE — standingLabel (api/prospectTrend.js) turns
// it into the phrase a broadcast would use, carrying the stat with it: "Top 7%
// OPS", "Bottom 12% ERA". The stat rides in every cell rather than being defined
// in a caption under the table, because a column has to say what it measures
// without a sentence somewhere else doing it — and this one measures a different
// stat depending on whether the row is a bat or an arm.
//
// The percentile is plain ink, same as every other Ledger column; only the
// movement arrow borrows --accent-positive/--accent-negative, the same
// restriction RadarPill's own tag observes (color marks the DIRECTION it
// moved, never the level itself), and the triangle carries the direction on
// its own shape so the colour is never load-bearing.
function DirectionTriangle({ up }) {
  return (
    <svg viewBox="0 0 20 20" width="8" height="8" aria-hidden="true">
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

// `entry` comes from prospectTrendById (prospectTrend.js). Two distinct
// empty states, on purpose: `entry == null` is bbsbh's own data gap (no
// current-level line at all — off the board, injured all season, a fresh
// promotion the generator hasn't caught up to yet), same em dash every other
// empty Ledger cell on this page uses; `qualified === false` is a real,
// present row that just hasn't cleared the playing-time floor, worth saying
// plainly rather than folding into the same silent dash.
const DASH = '—'

export function ProspectTrendPill({ entry }) {
  if (!entry) return <span className="prospecttrend prospecttrend--unqualified">{DASH}</span>
  const label = entry.qualified ? standingLabel(entry.percentile, entry.group) : null
  if (!label) {
    return <span className="prospecttrend prospecttrend--unqualified">Too early</span>
  }
  const delta = entry.movement?.delta
  return (
    <span className="prospecttrend">
      <span className="prospecttrend__value">{label}</span>
      {Number.isFinite(delta) && Math.abs(delta) >= MOVE_FLOOR && (
        <span className={`prospecttrend__move prospecttrend__move--${delta > 0 ? 'up' : 'down'}`}>
          <DirectionTriangle up={delta > 0} />
        </span>
      )}
    </span>
  )
}
