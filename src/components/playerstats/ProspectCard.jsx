import { useState } from 'react'
import '../../styles/31d-prospect-card.css'
import { dotFraction, deviationBar } from '../../lib/percentileStrip.js'
import { SPORT_LABEL } from '../../lib/teams.js'
import { ProspectPill } from '../badges/ProspectPill.jsx'
import { LevelDots } from '../badges/ProspectTrendPill.jsx'

const DASH = '—'

// "30 outs" -> "10.0 IP", the same shape statsLevels.js's own outsToIp uses —
// duplicated locally rather than imported, since that helper isn't exported
// (this is the first caller outside statsLevels.js that's needed one).
function outsToIp(outs) {
  return `${Math.floor(outs / 3)}.${outs % 3}`
}

function sampleSizeLabel(metric, sampleSize) {
  return metric === 'OPS' ? `${sampleSize} PA` : `${outsToIp(sampleSize)} IP`
}

// The Analytics shelf's prospect card — the one thing that actually fills the
// space StatcastPercentiles/AdvancedStatsCard leave empty for a MiLB player.
// Pure presentation: every fact on it comes pre-computed off
// prospectCardView (src/api/prospectTrend.js), so this file has no math of
// its own beyond turning a percentile into a track position (dotFraction,
// deviationBar — the SAME scale math the Statcast strip already trained
// readers on, not a new ring/radar; see that module's ADR-0040 note) and the
// trend panel's own chart geometry, which IS local to this file since it's
// pixels, not a fact.
//
// `view` is prospectCardView's output; `level` is the SPORT_LABEL string for
// the header ("AA"); `badge` is prospectBadge's {rank, orgRank, orgTeamId,
// orgTeamName} for the header's ProspectPill. Renders nothing only when the
// caller has nothing at all to say (PlayerPage doesn't call this without
// either a rank badge or a trend entry, so `view` is never itself null here —
// but the guard costs nothing and keeps the component safe to call directly).
export function ProspectCard({ view, level, badge }) {
  if (!view) return null
  const hasBadge = badge?.rank || badge?.orgRank

  return (
    <section className="prospectcard">
      <header className="prospectcard__head">
        <span className="prospectcard__eyebrow">Prospect standing{level ? ` — ${level}` : ''}</span>
        {hasBadge && <ProspectPill {...badge} />}
      </header>

      <div className="prospectcard__body">
        {view.state === 'none' && (
          <p className="prospectcard__dash">
            {DASH} No stats-based standing yet{level ? ` at ${level}` : ''}
          </p>
        )}

        {view.state === 'unqualified' && (
          <p className="prospectcard__dash">
            Too early — {sampleSizeLabel(view.metric, view.sampleSize)} (
            {sampleSizeLabel(view.metric, view.floor)} needed)
          </p>
        )}

        {view.state === 'qualified' && <QualifiedRows view={view} />}

        {view.ageEdge && (
          <>
            <hr className="prospectcard__rule" />
            <div className="prospectcard__fact">
              <span className="prospectcard__facttitle">Age vs. level</span>
              <p className="prospectcard__factvalue">
                {view.ageEdge.years} {view.ageEdge.years === 1 ? 'yr' : 'yrs'} {view.ageEdge.direction} than the
                average{level ? ` ${level}` : ''} {view.metric === 'ERA' ? 'pitcher' : 'hitter'}
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function QualifiedRows({ view }) {
  const dot = dotFraction(view.percentile)
  const bar = deviationBar(view.percentile)
  const moving = Number.isFinite(view.movement?.delta) && Math.abs(view.movement.delta) >= 5
  const hasTrendData = view.trend.points.some((p) => p.percentile != null)

  return (
    <>
      <div className="prospectcard__track" aria-hidden="true">
        <span className={`prospectcard__confdot prospectcard__confdot--${view.confidence ?? 'established'}`}
          style={dot != null ? { '--pct': dot } : undefined}
        />
        {bar && (
          <span
            className={`prospectcard__bar prospectcard__bar--${bar.side}`}
            style={{ '--start': bar.start, '--width': bar.width }}
          />
        )}
      </div>
      <p className="prospectcard__standing">
        {view.standing}
        {moving && (
          <span className={`prospectcard__move prospectcard__move--${view.movement.delta > 0 ? 'up' : 'down'}`}>
            {view.movement.delta > 0 ? '▲' : '▼'}
          </span>
        )}
        <span className="prospectcard__pop"> of {view.populationSize} qualified</span>
      </p>
      {(view.confidence === 'early' || view.confidence === 'building') && (
        <p className="prospectcard__confcaption">
          {view.confidence === 'early' ? 'Early read' : 'Building sample'} — {sampleSizeLabel(view.metric, view.sampleSize)}
        </p>
      )}

      <div className="prospectcard__tierrow">
        <LevelDots tier={view.tier} />
        <span className="prospectcard__tierlabel">{view.tierLabel}</span>
      </div>

      {hasTrendData && <TrendDisclosure trend={view.trend} movement={view.movement} />}
    </>
  )
}

const CHART_W = 280
const CHART_H = 64
// Room above the plot for a promotion marker's flag label — the marker's
// vertical tick still runs the full plot height (design intent: "full chart
// height"), just starting below the label instead of behind it.
const CHART_TOP = 16
const CHART_VIEW_H = CHART_H + CHART_TOP

function TrendDisclosure({ trend, movement }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="prospectcard__trend">
      <button
        type="button"
        className="prospectcard__disclose"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? 'Hide trend' : 'Trend →'}
      </button>
      {open && <TrendChart trend={trend} movement={movement} />}
    </div>
  )
}

// Chart geometry lives here, not in src/api/prospectTrend.js — it's pixels
// (a fixed viewBox), not a fact, and prospectCardView already handed over the
// one thing that IS a fact: which weeks are gaps. A gap (an unqualified week)
// breaks the solid line into a dashed one across it, never an interpolated or
// invented point — same "omit under the sample floor" rule PercentileStrip
// already applies to a single row, extended here across a time axis.
function TrendChart({ trend, movement }) {
  const { points, promotions } = trend
  const n = points.length
  const x = (i) => (n > 1 ? (i / (n - 1)) * CHART_W : CHART_W / 2)
  const y = (pct) => CHART_TOP + CHART_H - (pct / 100) * CHART_H

  const qualified = points.map((p, i) => ({ ...p, i })).filter((p) => p.percentile != null)
  const segments = []
  for (let k = 1; k < qualified.length; k++) {
    const a = qualified[k - 1]
    const b = qualified[k]
    segments.push({ x1: x(a.i), y1: y(a.percentile), x2: x(b.i), y2: y(b.percentile), dashed: b.i - a.i > 1 })
  }

  const refY = y(50)

  return (
    <div className="prospectcard__chartwrap">
      <svg viewBox={`0 0 ${CHART_W} ${CHART_VIEW_H}`} width="100%" height={CHART_VIEW_H} className="prospectcard__chart">
        <line x1={0} y1={refY} x2={CHART_W} y2={refY} className="prospectcard__chartref" />
        {segments.map((s, i) => (
          <line
            key={i}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            className={s.dashed ? 'prospectcard__chartline prospectcard__chartline--gap' : 'prospectcard__chartline'}
          />
        ))}
        {qualified.map((p, i) => (
          <circle
            key={i}
            cx={x(p.i)}
            cy={y(p.percentile)}
            r={i === qualified.length - 1 ? 3.5 : 2}
            className="prospectcard__chartdot"
          />
        ))}
        {promotions.map((p, i) => {
          const idx = points.findIndex((pt) => pt.date === p.date)
          if (idx < 0) return null
          const px = x(idx)
          return (
            <g key={i}>
              <line x1={px} y1={CHART_TOP} x2={px} y2={CHART_VIEW_H} className="prospectcard__chartmark" />
              <text x={px} y={CHART_TOP - 3} className="prospectcard__chartmarklabel" textAnchor="middle">
                {p.direction === 'up' ? '↑' : '↓'} {SPORT_LABEL[p.toSportId] ?? ''}
              </text>
            </g>
          )
        })}
      </svg>
      {Number.isFinite(movement?.delta) && (
        <p className="prospectcard__chartcaption">
          {movement.delta > 0 ? '+' : ''}
          {movement.delta} since {movement.sinceDate}
        </p>
      )}
    </div>
  )
}
