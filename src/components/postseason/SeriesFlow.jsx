import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flowPanels } from '../../lib/postseason/seriesFlow.js'
import { chipColorsFor } from '../../lib/wpa/wpaBandColors.js'
import { ordinal } from '../../lib/format.js'
import { teamAbbr, teamLogoUrl } from '../../lib/teams.js'
import { Door } from '../ui/control/Door.jsx'
import { Pill } from '../ui/control/Pill.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { Card } from '../ui/frame/Card.jsx'

// HOW THE GAMES WENT: the series' win-chance strip. One panel per game, side by
// side, from one club's side; the line is that club's win chance across the
// game's plays, with the share above the middle in its colour and the share
// below in the other club's.
//
// SPOILER FOOTING (ADR-0087). Only COUNTED games, ones that went Final before
// the cutoff, have a line. Today's game and the games still to play are empty
// dashed slots, and their number is the bracket's own (counted + today +
// upcoming), never the live schedule's. See lib/postseason/seriesFlow.js. It
// draws win-probability data the page already loaded for the game-by-game log,
// so it adds no request. No SealBox: these games are not sealed.
//
//   series    { results, today, upcoming } as the page's seriesGameBuckets
//   gameSignals  { [gamePk]: { winProb } }
//   homeIdByPk   { [gamePk]: home club id }
//   clubs     the two series clubs, [{ id, abbreviation }] in slot order
//   defaultId the club the strip starts on (the reader's favourite when it is
//             in the series, else the Game 1 home club)
// The SVG is drawn in the CSS pixels of its own box (measured below), so its
// labels stay at their true type size at every width instead of scaling with
// a fixed viewBox. 360 is the first paint, before the box is measured.
const RAIL = 24
const PLOT_T = 6
const LABEL_H = 26
const GAP = 4
const MARK = 16

export function SeriesFlow({ series, gameSignals, homeIdByPk, clubs, defaultId }) {
  // The reader's pick holds only while it names a club in THIS series; until
  // then (and after a move to another series) the strip follows `defaultId`,
  // which can change after the first paint (the favourite club loads).
  const [chosenId, setPerspective] = useState(null)
  const plotRef = useRef(null)
  const perspectiveId = clubs.some((c) => c.id === chosenId) ? chosenId : (defaultId ?? clubs[0]?.id)
  const otherId = clubs.find((c) => c.id !== perspectiveId)?.id
  const panels = useMemo(
    () => flowPanels(series, gameSignals, perspectiveId, homeIdByPk),
    [series, gameSignals, perspectiveId, homeIdByPk],
  )
  const live = panels.map((p, i) => (p.kind === 'played' && p.points.length > 0 ? i : -1)).filter((i) => i !== -1)
  const lastPlayed = live.at(-1) ?? -1
  const [picked, setPicked] = useState(null)
  const selected = panels[live.includes(picked) ? picked : lastPlayed] ?? null
  // Left and right arrows step through the games that have a line.
  const step = (from, by) => {
    const k = live.indexOf(from) + by
    if (k < 0 || k >= live.length) return
    setPicked(live[k])
    plotRef.current?.querySelectorAll('[data-flow-panel]')[k]?.focus()
  }
  const [W, setW] = useState(360)
  const drawn = lastPlayed !== -1
  useLayoutEffect(() => {
    const el = plotRef.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(([entry]) => setW(Math.max(240, Math.round(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [drawn])
  // Nothing to draw: no counted game has a line (before Game 1, or every read
  // failed). The section is context, so it simply does not render.
  if (lastPlayed === -1) return null

  const PLOT_H = W >= 560 ? 96 : 72
  const MID = PLOT_T + PLOT_H / 2
  // A one-game round (the finished page's 2012-2021 wild cards) keeps a
  // panel's proportions, left aligned, instead of one strip the card wide.
  const slotW = panels.length === 1 ? Math.min(W - RAIL, 160) : (W - RAIL) / panels.length
  const abbr = (id) => teamAbbr({ id })
  // The club's chip colour, not its WPA band colour: a band can be a
  // pinstripe's white or cream ground (MIL, WSH), which would vanish here.
  const clubColor = (id) => chipColorsFor(id).primary
  const perColor = clubColor(perspectiveId)
  const oppColor = clubColor(otherId)
  const x = (i, t) => RAIL + i * slotW + t * (slotW - GAP)
  const y = (pct) => PLOT_T + (1 - pct / 100) * PLOT_H

  const switcher = (
    <span className="psseries__flowswitch">
      {clubs.map((c) => (
        <Pill
          key={c.id}
          role="control"
          fill="paper"
          pressed={c.id === perspectiveId}
          onClick={() => setPerspective(c.id)}
        >
          {abbr(c.id)}
        </Pill>
      ))}
    </span>
  )

  return (
    <section className="psseries__flowsection">
      <SectionHead look="label" action={switcher}>
        How the games went
      </SectionHead>
      <Card as="div" body="flush" className="psseries__flow">
        <div className="psseries__flowreadout" aria-live="polite">
          {selected && <Readout panel={selected} perspectiveId={perspectiveId} abbr={abbr} />}
          {selected?.kind === 'played' && (
            <Door
              onClick={() =>
                document
                  .getElementById(`game-${selected.gameNumber}`)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            >
              Game {selected.gameNumber}
            </Door>
          )}
        </div>
        <div className="psseries__flowbox" ref={plotRef}>
          <svg
            className="psseries__flowplot"
            width={W}
            height={PLOT_T + PLOT_H + LABEL_H}
            viewBox={`0 0 ${W} ${PLOT_T + PLOT_H + LABEL_H}`}
            role="group"
            aria-label={`Win chance for ${abbr(perspectiveId)} in each game`}
          >
            <RailMark teamId={perspectiveId} x={(RAIL - MARK) / 2 - 2} y={PLOT_T} />
            <RailMark teamId={otherId} x={(RAIL - MARK) / 2 - 2} y={PLOT_T + PLOT_H - MARK} />
            {panels.map((p, i) => {
              const x0 = x(i, 0)
              const w = slotW - GAP
              const hasLine = live.includes(i)
              const line = hasLine ? p.points.map((pt) => `${x(i, pt.x).toFixed(1)},${y(pt.y).toFixed(1)}`) : []
              const above = hasLine
                ? p.points.map((pt) => `${x(i, pt.x).toFixed(1)},${Math.min(y(pt.y), MID).toFixed(1)}`)
                : []
              const below = hasLine
                ? p.points.map((pt) => `${x(i, pt.x).toFixed(1)},${Math.max(y(pt.y), MID).toFixed(1)}`)
                : []
              const end = hasLine ? p.points[p.points.length - 1] : null
              const winnerId = p.winnerId
              const isSelected = selected === p
              return (
                <g
                  key={p.gameNumber}
                  className={`psseries__flowpanel psseries__flowpanel--${p.kind}${isSelected ? ' is-selected' : ''}`}
                  role={hasLine ? 'button' : undefined}
                  tabIndex={hasLine ? 0 : undefined}
                  aria-label={
                    hasLine
                      ? `Game ${p.gameNumber}, ${abbr(winnerId)} won. ${abbr(perspectiveId)} win chance low ${Math.round(p.low.pct)}%, high ${Math.round(p.high.pct)}%`
                      : undefined
                  }
                  aria-pressed={hasLine ? isSelected : undefined}
                  onClick={hasLine ? () => setPicked(i) : undefined}
                  data-flow-panel={hasLine ? '' : undefined}
                  onKeyDown={
                    hasLine
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setPicked(i)
                          } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                            e.preventDefault()
                            step(i, e.key === 'ArrowRight' ? 1 : -1)
                          }
                        }
                      : undefined
                  }
                >
                  <rect className="psseries__flowframe" x={x0} y={PLOT_T} width={w} height={PLOT_H} rx="2" />
                  {hasLine && (
                    <>
                      <polygon
                        points={`${above.join(' ')} ${x(i, 1)},${MID} ${x0},${MID}`}
                        fill={perColor}
                        fillOpacity="0.35"
                      />
                      <polygon
                        points={`${below.join(' ')} ${x(i, 1)},${MID} ${x0},${MID}`}
                        fill={oppColor}
                        fillOpacity="0.35"
                      />
                      <line className="psseries__flowmid" x1={x0} x2={x0 + w} y1={MID} y2={MID} />
                      <polyline className="psseries__flowline" points={line.join(' ')} fill="none" />
                      <circle
                        className="psseries__flowend"
                        cx={x(i, end.x)}
                        cy={y(end.y)}
                        r="4"
                        fill={clubColor(winnerId)}
                      />
                    </>
                  )}
                  {!hasLine && p.kind !== 'ahead' && (
                    <text className="psseries__flowempty" x={x0 + w / 2} y={MID + 4} textAnchor="middle">
                      {p.kind === 'today' ? 'Today' : 'No data'}
                    </text>
                  )}
                  <text
                    className="psseries__flowlabel"
                    x={hasLine && winnerId ? x0 + w / 2 - 7 : x0 + w / 2}
                    y={PLOT_T + PLOT_H + 17}
                    textAnchor="middle"
                  >
                    G{p.gameNumber}
                  </text>
                  {hasLine && winnerId && (
                    <RailMark teamId={winnerId} size={12} x={x0 + w / 2 + 6} y={PLOT_T + PLOT_H + 7} />
                  )}
                </g>
              )
            })}
          </svg>
        </div>
      </Card>
    </section>
  )
}

function Readout({ panel, perspectiveId, abbr }) {
  if (panel.kind !== 'played') return null
  const when = (pt) => `${pt.half === 'top' ? 'Top' : 'Bot'} ${ordinal(pt.inning)}`
  const club = abbr(perspectiveId)
  return (
    <span className="psseries__flowtext">
      <span className="psseries__flowgame">
        Game {panel.gameNumber} · {club} win chance
      </span>
      <span className="psseries__flowfacts">
        <span className="psseries__flowfact">
          Low <span className="psseries__flowpct">{Math.round(panel.low.pct)}%</span> {when(panel.low)}
        </span>
        <span className="psseries__flowfact">
          High <span className="psseries__flowpct">{Math.round(panel.high.pct)}%</span> {when(panel.high)}
        </span>
      </span>
    </span>
  )
}

// A club mark drawn as an SVG <image> of the logo file, not an HTML logo in a
// <foreignObject> (Safari mis-places foreignObject content in a scaled SVG).
function RailMark({ teamId, x, y, size = MARK }) {
  const href = teamLogoUrl(teamId)
  if (!href) return null
  return <image className="psseries__flowmark" href={href} x={x} y={y} width={size} height={size} aria-hidden="true" />
}
