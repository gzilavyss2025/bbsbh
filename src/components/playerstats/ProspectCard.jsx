import { useEffect, useRef, useState } from 'react'
import '../../styles/31d-prospect-card.css'
import { dotFraction, deviationBar } from '../../lib/percentileStrip.js'
import { SPORT_LABEL } from '../../lib/teams.js'
import { ProspectPill } from '../badges/ProspectPill.jsx'

const DASH = '—'
const CHART_H = 140
const PLOT_TOP = 26
const PLOT_BOTTOM = 24
const PLOT_LEFT = 38
const PLOT_RIGHT = 14

function outsToIp(outs) {
  return `${Math.floor(outs / 3)}.${outs % 3}`
}

function sampleSizeLabel(metric, sampleSize) {
  return metric === 'OPS' ? `${sampleSize} PA` : `${outsToIp(sampleSize)} IP`
}

function sampleFloorLabel(metric, sampleSize) {
  return metric === 'OPS' ? `${sampleSize}+ PA` : `${outsToIp(sampleSize)}+ IP`
}

function comparisonGroup(metricOrGroup) {
  return metricOrGroup === 'ERA' || metricOrGroup === 'pitching' ? 'pitchers' : 'hitters'
}

function confidenceLabel(confidence) {
  if (confidence === 'early') return 'Early sample'
  if (confidence === 'building') return 'Building sample'
  return 'Established sample'
}

function ordinal(value) {
  const mod100 = value % 100
  const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : value % 10 === 1 ? 'st' : value % 10 === 2 ? 'nd' : value % 10 === 3 ? 'rd' : 'th'
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

function movementLabel(movement) {
  if (!Number.isFinite(movement?.delta)) return null
  const amount = Math.abs(movement.delta)
  const date = shortDate(movement.sinceDate)
  return `${movement.delta > 0 ? 'Up' : movement.delta < 0 ? 'Down' : 'Even'} ${amount} percentile ${amount === 1 ? 'point' : 'points'}${date ? ` since ${date}` : ''}`
}

export function ProspectCard({ view, level, badge, group }) {
  if (!view) return null
  const hasBadge = badge?.rank || badge?.orgRank

  return (
    <section className="prospectcard">
      <header className="prospectcard__head">
        <div>
          <span className="prospectcard__kicker">Player development</span>
          <h3 className="prospectcard__title">Prospect performance</h3>
        </div>
        {hasBadge && <ProspectPill {...badge} />}
      </header>

      <div className="prospectcard__body">
        {view.state === 'none' && (
          <EmptyStanding level={level} />
        )}

        {view.state === 'unqualified' && (
          <EarlyStanding view={view} level={level} />
        )}

        {view.state === 'qualified' && <QualifiedStanding view={view} level={level} />}

        {view.ageEdge && <AgeContext view={view} level={level} group={group} />}
      </div>
    </section>
  )
}

function EmptyStanding({ level }) {
  return (
    <div className="prospectcard__empty">
      <span className="prospectcard__emptylabel">Current-level standing</span>
      <p>{DASH} No qualified data{level ? ` at ${level}` : ''} yet</p>
      <span>The percentile will appear after a current-level sample is available.</span>
    </div>
  )
}

function EarlyStanding({ view, level }) {
  return (
    <div className="prospectcard__empty">
      <span className="prospectcard__emptylabel">{view.metric}{level ? ` vs ${level}` : ''}</span>
      <p>Early sample — {sampleSizeLabel(view.metric, view.sampleSize)}</p>
      <span>
        {sampleSizeLabel(view.metric, view.floor)} needed to join the qualified {level ? `${level} ` : ''}
        {comparisonGroup(view.metric)} population.
      </span>
    </div>
  )
}

function QualifiedStanding({ view, level }) {
  const dot = dotFraction(view.percentile)
  const bar = deviationBar(view.percentile)
  const movement = movementLabel(view.movement)
  const hasTrendData = view.trend.points.some((point) => point.percentile != null)

  return (
    <>
      <div className="prospectcard__lead">
        <span className="prospectcard__metric">{view.metric}{level ? ` vs ${level}` : ''}</span>
        <strong className="prospectcard__percentile">{ordinal(view.percentile)} percentile</strong>
        <p className="prospectcard__comparison">
          {view.standing.replace(` ${view.metric}`, '')} among {view.populationSize} qualified {level ? `${level} ` : ''}
          {comparisonGroup(view.metric)} with {sampleFloorLabel(view.metric, view.floor)}
        </p>
      </div>

      <div
        className="prospectcard__scale"
        role="img"
        aria-label={`${ordinal(view.percentile)} percentile on a scale from 0 to 100; 50 is the level average benchmark`}
      >
        <div className="prospectcard__track" aria-hidden="true">
          <span
            className={`prospectcard__confdot prospectcard__confdot--${view.confidence ?? 'established'}`}
            style={dot != null ? { '--pct': dot } : undefined}
          />
          {bar && (
            <span
              className={`prospectcard__bar prospectcard__bar--${bar.side}`}
              style={{ '--start': bar.start, '--width': bar.width }}
            />
          )}
        </div>
        <div className="prospectcard__scalelabels" aria-hidden="true">
          <span>0</span>
          <span>50 · Level average</span>
          <span>100</span>
        </div>
      </div>

      <dl className="prospectcard__facts">
        <div className="prospectcard__fact">
          <dt>Sample</dt>
          <dd>{confidenceLabel(view.confidence)} — {sampleSizeLabel(view.metric, view.sampleSize)}</dd>
        </div>
        <div className="prospectcard__fact">
          <dt>Movement</dt>
          <dd className={movement ? `prospectcard__move prospectcard__move--${view.movement.delta > 0 ? 'up' : view.movement.delta < 0 ? 'down' : 'even'}` : undefined}>
            {movement ?? 'No comparison period yet'}
          </dd>
        </div>
        <div className="prospectcard__fact">
          <dt>Band</dt>
          <dd>{view.tierLabel}{level ? ` for ${level}` : ''} {view.metric}</dd>
        </div>
      </dl>

      {hasTrendData && (
        <TrendDisclosure trend={view.trend} metric={view.metric} level={level} />
      )}
    </>
  )
}

function AgeContext({ view, level, group }) {
  return (
    <aside className="prospectcard__age">
      <span>Age vs level</span>
      <p>
        {view.ageEdge.years} {view.ageEdge.years === 1 ? 'year' : 'years'} {view.ageEdge.direction} than the average qualified
        {level ? ` ${level}` : ''} {comparisonGroup(view.metric ?? group).slice(0, -1)}.
      </p>
    </aside>
  )
}

function TrendDisclosure({ trend, metric, level }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="prospectcard__trend">
      <button
        type="button"
        className="prospectcard__disclose"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'Hide season trend' : 'Show season trend'}
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && <TrendChart trend={trend} metric={metric} level={level} />}
    </div>
  )
}

function useChartWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(560)

  useEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const update = () => setWidth(Math.max(280, Math.round(element.getBoundingClientRect().width)))
    update()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, width]
}

function TrendChart({ trend, metric, level }) {
  const [wrapRef, width] = useChartWidth()
  const { points, promotions } = trend
  const plotWidth = Math.max(1, width - PLOT_LEFT - PLOT_RIGHT)
  const plotHeight = CHART_H - PLOT_TOP - PLOT_BOTTOM
  const x = (index) => PLOT_LEFT + (points.length > 1 ? (index / (points.length - 1)) * plotWidth : plotWidth / 2)
  const y = (percentile) => PLOT_TOP + plotHeight - (percentile / 100) * plotHeight
  const qualified = points.map((point, index) => ({ ...point, index })).filter((point) => point.percentile != null)
  const promotionDates = new Set(promotions.map((promotion) => promotion.date))
  const segments = []

  for (let index = 1; index < qualified.length; index++) {
    const previous = qualified[index - 1]
    const current = qualified[index]
    if (promotionDates.has(current.date)) continue
    segments.push({
      x1: x(previous.index),
      y1: y(previous.percentile),
      x2: x(current.index),
      y2: y(current.percentile),
      dashed: current.index - previous.index > 1,
    })
  }

  const firstDate = shortDate(points[0]?.date)
  const lastDate = shortDate(points.at(-1)?.date)
  const latest = qualified.at(-1)
  const gapCount = points.filter((point) => point.percentile == null).length
  const eventSummary = promotions.map((promotion) => {
    const direction = promotion.direction === 'up' ? 'promoted' : 'moved down'
    return `${direction} to ${SPORT_LABEL[promotion.toSportId] ?? 'a new level'} on ${shortDate(promotion.date)}`
  }).join('; ')
  const accessibleSummary = [
    `${metric}${level ? ` at ${level}` : ''} percentile trend from ${firstDate} to ${lastDate}`,
    latest ? `latest checkpoint ${ordinal(latest.percentile)} percentile` : null,
    gapCount ? `${gapCount} unqualified ${gapCount === 1 ? 'checkpoint' : 'checkpoints'}` : null,
    eventSummary || null,
  ].filter(Boolean).join('. ')

  return (
    <div className="prospectcard__chartwrap" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${width} ${CHART_H}`}
        width="100%"
        height={CHART_H}
        className="prospectcard__chart"
        role="img"
        aria-label={accessibleSummary}
      >
        <text x={PLOT_LEFT - 8} y={PLOT_TOP + 3} textAnchor="end" className="prospectcard__axislabel">100</text>
        <text x={PLOT_LEFT - 8} y={y(50) + 3} textAnchor="end" className="prospectcard__axislabel">50</text>
        <text x={PLOT_LEFT - 8} y={PLOT_TOP + plotHeight} textAnchor="end" className="prospectcard__axislabel">0</text>
        <line x1={PLOT_LEFT} y1={y(50)} x2={width - PLOT_RIGHT} y2={y(50)} className="prospectcard__chartref" />
        <text x={PLOT_LEFT + 5} y={y(50) - 4} className="prospectcard__chartreflabel">Level average</text>
        {segments.map((segment, index) => (
          <line
            key={index}
            x1={segment.x1}
            y1={segment.y1}
            x2={segment.x2}
            y2={segment.y2}
            className={segment.dashed ? 'prospectcard__chartline prospectcard__chartline--gap' : 'prospectcard__chartline'}
          />
        ))}
        {qualified.map((point, index) => (
          <circle
            key={point.date}
            cx={x(point.index)}
            cy={y(point.percentile)}
            r={index === qualified.length - 1 ? 4 : 2.5}
            className="prospectcard__chartdot"
          />
        ))}
        {promotions.map((promotion, index) => {
          const pointIndex = points.findIndex((point) => point.date === promotion.date)
          if (pointIndex < 0) return null
          const markerX = x(pointIndex)
          const nearRight = markerX > width - 150
          const label = `${promotion.direction === 'up' ? 'Promoted' : 'Moved down'} to ${SPORT_LABEL[promotion.toSportId] ?? ''}`
          return (
            <g key={`${promotion.date}-${index}`}>
              <line x1={markerX} y1={PLOT_TOP} x2={markerX} y2={PLOT_TOP + plotHeight} className="prospectcard__chartmark" />
              <path d={`M ${markerX} ${PLOT_TOP} l 7 4 l -7 4 z`} className="prospectcard__chartflag" />
              <text
                x={markerX + (nearRight ? -9 : 9)}
                y={PLOT_TOP - 7}
                className="prospectcard__chartmarklabel"
                textAnchor={nearRight ? 'end' : 'start'}
              >
                {label}
              </text>
            </g>
          )
        })}
        <text x={PLOT_LEFT} y={CHART_H - 4} className="prospectcard__axisdate">{firstDate}</text>
        <text x={width - PLOT_RIGHT} y={CHART_H - 4} textAnchor="end" className="prospectcard__axisdate">{lastDate}</text>
        {latest && (
          <text x={x(latest.index) - 6} y={Math.max(PLOT_TOP + 10, y(latest.percentile) - 7)} textAnchor="end" className="prospectcard__latest">
            {latest.percentile}
          </text>
        )}
      </svg>
      <p className="prospectcard__chartcaption">
        Weekly checkpoints · {firstDate}–{lastDate}
        {gapCount ? ` · ${gapCount} below the qualification floor` : ''}
      </p>
    </div>
  )
}
