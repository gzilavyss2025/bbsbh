import { useEffect, useMemo, useState } from 'react'
import '../../../../../styles/player-next/batter/contact.css'
import { fetchPersonStats } from '../../../../../api/person-fetch.js'
import { MLB_LOG_GAME_TYPES } from '../../../../../api/boxlines/rows.js'
import { fetchSprayFor, sprayView } from '../../../../../api/spray.js'
import { rate3 } from '../../../../../api/person/shared.js'
import { BattedBallMix } from '../../../../../components/charts/BattedBallMix.jsx'
import { MenuRail } from '../../../../../components/ui/control/MenuRail.jsx'
import { FactGrid } from '../../../../../components/ui/frame/FactGrid.jsx'
import { SectionHead } from '../../../../../components/ui/frame/SectionHead.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { useInViewOnce } from '../../../../../hooks/scroll/useInViewOnce.js'
import { viewKey } from '../../../../../lib/motion/inViewOnce.js'
import { HOME } from '../../../../../lib/ballpark/ballparkGeometry.js'
import { hitCoordToSvg } from '../../../../../lib/ballpark/hitProjection.js'
import { FlightMarks, useFlightClock } from './ContactFlight.jsx'
import { flightFrame, flightOf } from './contactFlight.js'
import { COLORS, VIEWS, ballDetail, contactBalls, contactView, firstView, markKey, menuRows, mixRows, pickBalls } from './contactView.js'

// The batter Contact module (#1888): where each ball went, tapped for its exit velocity, launch
// angle and xBA, and how his contact ends by ball type. An open surface (ADR-0034): one season of
// decided games, no seal. The spray store and its contact sibling carry the balls; the game log
// only dates them, for the asOf cutoff and the detail line.
const VIEWBOX = '10 40 600 485'
const FOUL_FT = 330
const FENCE_FT = 400
const pt = (deg, ft) => {
  const r = (deg * Math.PI) / 180
  return `${(HOME.x + ft * Math.sin(r)).toFixed(1)} ${(HOME.y - ft * Math.cos(r)).toFixed(1)}`
}
// Fence: 330 ft at the lines easing to 400 ft in center, the nameless park of the spray map.
const FENCE = `M ${Array.from({ length: 31 }, (_, i) => {
  const d = -45 + 3 * i
  return pt(d, FENCE_FT - (FENCE_FT - FOUL_FT) * Math.abs(d / 45) ** 1.6)
}).join(' L ')}`
const LINES = `M ${pt(-45, FOUL_FT)} L ${HOME.x} ${HOME.y} L ${pt(45, FOUL_FT)}`
const DIAMOND = `M ${HOME.x} ${HOME.y} L ${pt(45, 90)} L ${pt(0, 127.3)} L ${pt(-45, 90)} Z`

const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`)
const one = (x, unit = '') => (x == null ? '—' : `${Math.round(x)}${unit}`)

const load = (id, season) =>
  Promise.all([
    fetchSprayFor(id, { seasonYear: season, contact: true }),
    fetchPersonStats(id, { type: 'gameLog', group: 'hitting', season, gameType: MLB_LOG_GAME_TYPES }).catch(() => []),
  ])

export default function ContactModule({ bio, asOf, season, onEmpty, onCount }) {
  const { data, error } = useAsync(() => load(bio.id, season), [bio.id, season])
  const [pickedView, setView] = useState(null) // null opens on the first view with balls
  const [color, setColor] = useState('result')
  const [type, setType] = useState(null)
  const [sel, setSel] = useState(null)
  const [shot, setShot] = useState(0) // counts taps, so a second tap on one ball flies it again
  // The dots drop in the first time the field is in view (spec.md, the one-shot rule), and
  // again on each view or type pick: `gen` swaps the a/b class, which restarts the drop.
  const [gen, setGen] = useState(0)
  const [fieldRef, phase] = useInViewOnce(viewKey(bio.id, 'contact'))

  const card = useMemo(() => {
    if (!data) return null
    const dates = new Map((data[1] ?? []).map((g) => [g.game?.gamePk, g.date]))
    const balls = sprayView(data[0], bio.id)?.balls
    return balls && contactView(contactBalls(balls, dates, asOf))
  }, [data, bio.id, asOf])
  const view = pickedView ?? (card ? firstView(card.counts) : 'hr')
  const mix = useMemo(() => card && mixRows(card.balls), [card])
  const shown = useMemo(() => (card ? pickBalls(card.balls, view, type) : []), [card, view, type])
  const marks = useMemo(() => shown.map((b) => ({ b, p: hitCoordToSvg(b.x, b.y) })).filter((m) => m.p), [shown])

  const cur = sel && shown.includes(sel) ? sel : null
  const curMark = cur ? marks.find((m) => m.b === cur) : null
  const model = useMemo(
    () => (curMark ? flightOf(curMark.b, Math.hypot(curMark.p.x - HOME.x, curMark.p.y - HOME.y)) : null),
    [curMark],
  )
  const t = useFlightClock(shot, model)
  const dotR = (b) => (b.result === 'hr' ? 11 : 9)
  const frame = model ? flightFrame(model, t, { home: HOME, land: curMark.p, dotR: dotR(cur), hr: cur.result === 'hr' }) : null
  const flying = !!frame?.flying
  const tap = (b) => { setSel(b); setShot((s) => s + 1) }

  const empty = !!error || (!!data && !card)
  useEffect(() => {
    if (empty) onEmpty()
  }, [empty, onEmpty])
  useEffect(() => {
    onCount(card ? `${card.balls.length} in play` : undefined)
  }, [card, onCount])

  if (empty) return null
  if (!card) return <div ref={fieldRef} className="fcontact fcontact--wait" aria-busy="true"><p className="hint">Loading the contact…</p></div>

  const detail = cur && ballDetail(cur)
  const pick = (set, v) => { set(v); setSel(null); setGen((g) => g + 1) }
  // wait: the dots hide until the field shows. play: the first sighting this visit.
  // gen > 0: a pick since. rest (seen before, Back in the same tab): the dots show still.
  const dotsCls =
    phase === 'wait'
      ? 'fcontact__dots fcontact__dots--wait'
      : phase === 'play' || gen
        ? `fcontact__dots fcontact__dots--play fcontact__dots--${gen % 2 ? 'b' : 'a'}`
        : 'fcontact__dots'
  return (
    <div ref={fieldRef} className="fcontact">
      <div className="fcontact__bar">
        <div className="fcontact__chips" role="group" aria-label="Which balls">
          {VIEWS.map(([k, name]) => (
            <button key={k} type="button" className="pnext-pick" aria-pressed={k === view} disabled={!card.counts[k]} onClick={() => pick(setView, k)}>
              {name} {card.counts[k]}
            </button>
          ))}
        </div>
        <div className="fcontact__chips" role="group" aria-label="Color by">
          {COLORS.map(([k, name]) => (
            <button key={k} type="button" className="pnext-pick" aria-pressed={k === color} onClick={() => setColor(k)}>{name}</button>
          ))}
        </div>
      </div>
      <div className="fcontact__grid">
        <div className="fcontact__plot">
          <svg className="fcontact__field" viewBox={VIEWBOX} role="group" aria-label={`Spray field of ${shown.length} balls in play`}>
            <g className="spray__art" aria-hidden="true">
              <path className="spray__fence" d={FENCE} />
              <path className="spray__foul" d={LINES} />
              <path className="spray__diamond" d={DIAMOND} />
            </g>
            <g className={dotsCls}>
                {marks.map(({ b, p }, i) => (
                <circle
                  key={i}
                  className={`fcontact__dot fcontact__dot--${markKey(b, color)}${b === cur ? ' fcontact__dot--sel' : ''}${b === cur && flying ? ' fcontact__dot--hide' : ''}`}
                  style={{ '--fcontact-f': marks.length > 1 ? (i / (marks.length - 1)).toFixed(3) : '0' }}
                cx={p.x}
                  cy={p.y}
                  r={dotR(b)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${ballDetail(b).eyebrow}${b.exitVelo == null ? '' : `, ${b.exitVelo} mph`}`}
                  onClick={() => tap(b)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(b) } }}
                />
              ))}
            </g>
            {frame && <FlightMarks frame={frame} home={HOME} />}
          </svg>
        </div>
        <div className={`fcontact__detail${flying ? ' fcontact__detail--fly' : ''}`}>
          <span className="sr-only" aria-live="polite">
            {cur && !flying ? `${detail.eyebrow}${cur.distance == null ? '' : `, ${cur.distance} feet`}, ${detail.when}` : ''}
          </span>
          {detail ? (
            <>
              <span className="fcontact__eyebrow">
                {flying ? (cur.launchAngle != null && cur.launchAngle < 10 ? 'On the ground' : 'In the air') : detail.eyebrow}
              </span>
              <span className="fcontact__when">{detail.when}</span>
              <span className="fcontact__big">
                {flying && cur.distance != null ? Math.round(cur.distance * frame.fr) : detail.big}
                <small>{detail.unit}</small>
              </span>
              <dl className="fcontact__stats">
                {detail.stats.map(([k, v], i) =>
                  i < 2 ? (
                    <div key={k}><dd>{v}</dd><dt>{k}</dt></div>
                  ) : (
                    <div key={k} className="fcontact__rise" style={{ '--fcontact-i': i - 2 }}><dd>{v}</dd><dt>{k}</dt></div>
                  ),
                )}
              </dl>
            </>
          ) : (
            <p className="hint">Tap a ball to see its exit velocity, launch angle and xBA.</p>
          )}
        </div>
      </div>
      <p className="fcontact__note">
        Exit velocity, launch angle, distance and xBA are Statcast, one value per ball. A missing value prints a dash.
        Spray angle is read from the hit location, on a standard field, not the park where he hit the ball.
      </p>
      {mix && (
        <>
          <SectionHead look="rule" as="h3" note={`${mix.reduce((t, r) => t + r.n, 0)} balls with a launch angle`}>How contact ends</SectionHead>
          <BattedBallMix battedBall={{ rows: mix }} />
          <MenuRail
            label="Batted ball type"
            items={menuRows(mix).map((r) => ({
              key: r.key,
              title: r.title,
              meta: r.meta,
              mark: (
                <svg className="fcontact__swatch" viewBox="0 0 16 16" aria-hidden="true">
                  <circle className={`fcontact__dot--${r.key}`} cx="8" cy="8" r="6" />
                </svg>
              ),
              figures: <span className="fcontact__mfig">{r.hits} hits · {r.outs} outs</span>,
            }))}
            picked={type}
            onPick={(k) => pick(setType, k)}
            panel={(k) => <TypeFacts row={mix.find((r) => r.key === k)} />}
            backLabel="All batted balls"
          />
          <p className="fcontact__note">
            Share is of balls with a launch angle. The right-hand figure is his average on those balls (hits over balls in play).
            Hard is 95 mph or more. Pick a ball type to see its averages and to show only those balls on the field.
          </p>
        </>
      )}
    </div>
  )
}

// The averages of one ball type: the MenuRail panel.
function TypeFacts({ row }) {
  if (!row) return null
  return (
    <FactGrid className="fcontact__facts">
      {[
        ['Avg exit velo', one(row.ev, ' mph')],
        ['Hard hit', pct(row.hard)],
        ['Barrels', row.barrel],
        ['Avg launch angle', one(row.la, '°')],
        ['Avg distance', one(row.dist, ' ft')],
        ['Avg xBA', row.xba == null ? '—' : rate3(row.xba)],
      ].map(([k, v]) => (
        <div className="fact" key={k}><dt className="fact__label">{k}</dt><dd className="fact__value">{v}</dd></div>
      ))}
    </FactGrid>
  )
}
