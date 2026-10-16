import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Headshot } from '../../../../../components/player/Headshot.jsx'
import { PlayerLink } from '../../../../../components/player/PlayerLink.jsx'
import { leagueLogoUrl } from '../../../../../lib/teams.js'
import { challengeDetail } from './challengeDetail.js'
import { FACE_SIZE, buildPlot, spread, tabPlacement, tickLabel } from './plotModel.js'
import { useDetailHover } from './useDetailHover.js'

// THE ABS CHALLENGES CARD'S PLOT — one face per qualified player, plus the MLB
// average as the league's logo, drawn where their figures meet (plotModel.js
// holds every number; this paints it).
//
// A face is the player's headshot in a square frame. It is a button: a tap or a
// click picks the man, which lights his row in the list and opens his name tab
// (a link to his page). On a mouse, hovering a face opens the app's player hover
// card with the figures that placed him here. Faces that would stack are spread
// apart; a thin leader and a dot keep the true place.
//
// Pixels come from the element's own size, measured once and again on resize, so
// the CSS decides the height (taller beside the list) and this follows.
const PAD = { l: 46, lSuccess: 52, r: 16, t: 16, b: 34 }

function useBox(ref) {
  const [box, setBox] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const read = () => setBox((b) => (b.w === el.clientWidth && b.h === el.clientHeight ? b : { w: el.clientWidth, h: el.clientHeight }))
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return box
}

function PlayerFace({ node, job, measure, picked, onPick }) {
  const { row } = node
  const detail = useMemo(() => challengeDetail(job, measure, row), [job, measure, row])
  const hover = useDetailHover(row.playerId, row.name, detail)
  const cls = [
    'chalplot__face',
    node.over ? 'chalplot__face--over' : '',
    node.thin ? 'chalplot__face--thin' : '',
    node.off ? 'chalplot__face--off' : '',
    picked ? 'is-on' : '',
  ].filter(Boolean).join(' ')
  const label =
    measure === 'success' ? `${row.name}, won ${row.won} of ${row.calls}` : `${row.name}, ${row.calls} called, ${row.exposureText} ${job.exposureLabel}`
  return (
    <button
      type="button"
      {...hover.anchorProps}
      {...hover.focusProps}
      className={cls}
      style={{ left: node.x, top: node.y }}
      aria-label={label}
      aria-pressed={picked}
      onClick={() => onPick(row.playerId)}
    >
      <Headshot personId={row.playerId} name={row.name} teamId={job.teamId} tint={false} className="chalplot__shot" />
    </button>
  )
}

function AverageFace({ node, picked, onPick }) {
  return (
    <button
      type="button"
      className={`chalplot__face${picked ? ' is-on' : ''}`}
      style={{ left: node.x, top: node.y }}
      aria-label="MLB average"
      aria-pressed={picked}
      onClick={() => onPick('mlb')}
    >
      <img className="chalplot__mlb" src={leagueLogoUrl()} alt="" />
    </button>
  )
}

// The picked man's name tab, set where it covers no other face. It measures
// itself once drawn, so the spot follows the length of his name.
function PickedTab({ node, others, box, minX, figure }) {
  const ref = useRef(null)
  const [w, setW] = useState(160)
  const mlb = node.id === 'mlb'
  useLayoutEffect(() => {
    if (ref.current) setW(ref.current.offsetWidth)
  }, [figure, node.id])
  const spot = tabPlacement(node, others, { tabWidth: w, size: FACE_SIZE, width: box.w, height: box.h, minX })
  return (
    <div ref={ref} className="chalplot__tab" style={{ left: spot.x, top: spot.y }}>
      {mlb ? <span>MLB average</span> : <PlayerLink id={node.row.playerId} name={node.row.name}>{node.row.name}</PlayerLink>}
      <span className="chalplot__tabfig">{figure}</span>
    </div>
  )
}

export function FacePlot({ job, measure, picked, onPick }) {
  const ref = useRef(null)
  const box = useBox(ref)
  const plot = useMemo(() => buildPlot(job, measure), [job, measure])
  const success = measure === 'success'
  const left = success ? PAD.lSuccess : PAD.l

  const layout = useMemo(() => {
    if (!box.w || !box.h) return null
    const iw = box.w - left - PAD.r
    const ih = box.h - PAD.t - PAD.b
    const sx = (v) => left + ((v - plot.x0) / (plot.x1 - plot.x0)) * iw
    const sy = (v) => PAD.t + ih - (Math.min(v, plot.y1) / plot.y1) * ih
    const base = [...plot.points.map((p) => ({ id: p.row.playerId, row: p.row, over: p.over, thin: p.thin, off: p.off, tx: sx(p.x), ty: sy(p.y) }))]
    if (plot.average) base.push({ id: 'mlb', tx: sx(plot.average.x), ty: sy(plot.average.y) })
    const half = FACE_SIZE / 2
    const nodes = spread(base, { size: FACE_SIZE, bounds: { minX: left + half, maxX: box.w - PAD.r, minY: PAD.t + half, maxY: sy(0) - half + 2 } })
    return { iw, ih, sx, sy, nodes }
  }, [box, plot, left])

  const pickedNode = layout?.nodes.find((n) => n.id === picked)
  const figureOf = (n) =>
    n.id === 'mlb'
      ? success ? job.averageSuccess : job.averageRate
      : success ? n.row.successText : n.row.rateText

  let line = null
  if (layout) {
    const { sx, sy } = layout
    if (success) {
      if (plot.line.flat != null) line = { x1: sx(plot.x0), y1: sy(plot.line.flat), x2: sx(plot.x1), y2: sy(plot.line.flat) }
    } else {
      const k = plot.line.slope
      let xb = plot.x1
      let yb = k * xb
      if (yb > plot.y1) {
        xb = plot.y1 / k
        yb = plot.y1
      }
      line = { x1: sx(plot.x0), y1: sy(k * plot.x0), x2: sx(xb), y2: sy(yb) }
    }
  }

  return (
    <div>
      <div ref={ref} className={`chalplot${plot.few ? ' chalplot--few' : ''}`} role="group" aria-label={`One face per player: ${plot.yTitle} against ${plot.xTitle}`}>
        {layout && (
          <>
            <svg className="chalplot__svg" viewBox={`0 0 ${box.w} ${box.h}`} aria-hidden="true">
              {plot.yt.map((t) => (
                <g key={t}>
                  <line className="chalplot__grid" x1={left} x2={box.w - PAD.r} y1={layout.sy(t)} y2={layout.sy(t)} />
                  <text className="chalplot__tick" x={left - 6} y={layout.sy(t) + 3} textAnchor="end">{success ? `${t}%` : t}</text>
                </g>
              ))}
              <line className="chalplot__axis" x1={left} x2={box.w - PAD.r} y1={layout.sy(0)} y2={layout.sy(0)} />
              {plot.xt.map((t) => (
                <text key={t} className="chalplot__tick" x={layout.sx(t)} y={layout.sy(0) + 14} textAnchor="middle">{tickLabel(t)}</text>
              ))}
              <text className="chalplot__title" transform={`translate(12 ${PAD.t + layout.ih / 2}) rotate(-90)`} textAnchor="middle">{plot.yTitle}</text>
              <text className="chalplot__title" x={left + layout.iw / 2} y={layout.sy(0) + 28} textAnchor="middle">{plot.xTitle}</text>
              {line && <line className="chalplot__line" {...line} />}
              {layout.nodes.map((n) => {
                const moved = Math.hypot(n.x - n.tx, n.y - n.ty) > FACE_SIZE * 0.6
                return (
                  !n.off && (
                    <g key={n.id}>
                      {moved && <line className="chalplot__leader" x1={n.tx} y1={n.ty} x2={n.x} y2={n.y} />}
                      <rect className="chalplot__anchor" x={n.tx - 2.5} y={n.ty - 2.5} width="5" height="5" />
                    </g>
                  )
                )
              })}
            </svg>
            {layout.nodes
              .slice()
              .sort((a, b) => (a.id === picked) - (b.id === picked))
              .map((n) =>
                n.id === 'mlb' ? (
                  <AverageFace key="mlb" node={n} picked={picked === 'mlb'} onPick={onPick} />
                ) : (
                  <PlayerFace key={n.id} node={n} job={job} measure={measure} picked={picked === n.id} onPick={onPick} />
                ),
              )}
            {pickedNode && (
              <PickedTab node={pickedNode} others={layout.nodes.filter((n) => n !== pickedNode)} box={box} minX={left} figure={figureOf(pickedNode)} />
            )}
          </>
        )}
      </div>
      <ul className="chalplot__key">
        <li><i className="chalplot__swatch" /> Below MLB average</li>
        <li><i className="chalplot__swatch chalplot__swatch--over" /> Above MLB average</li>
        <li><i className="chalplot__swatch chalplot__swatch--line" /> MLB average</li>
        {plot.legend.thin && <li><i className="chalplot__swatch chalplot__swatch--thin" /> Fewer than 5 reviews</li>}
        {plot.legend.off && <li><i className="chalplot__swatch chalplot__swatch--off" /> Past the top of the axis</li>}
      </ul>
    </div>
  )
}
