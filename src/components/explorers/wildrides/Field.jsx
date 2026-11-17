import { BallparkDiagram } from '../../ballpark/BallparkDiagram.jsx'
import { resolveBallparkLayout } from '../../../lib/ballpark/layout/resolveLayout.js'
import { HOME as GEO_HOME, PLOT_VIEWBOX } from '../../../lib/ballpark/ballparkGeometry.js'
import { hitCoordToSvg } from '../../../lib/ballpark/hitProjection.js'
import { ballFlightPath } from '../../../lib/ballpark/ballFlight.js'
import { motionIsReduced } from '../../../hooks/preferences/motionIsReduced.js'

// ---- the field: Gameday's own park drawing (BallparkDiagram, the one BallFlight uses),
// in its feet-scale coordinates, with the ball, runners and call laid over it.
const HOME = [GEO_HOME.x, GEO_HOME.y]
export function Field({ ref, game }) {
  const park = resolveBallparkLayout({ venueId: game.venue, gameDate: game.date })
  const overlay = (
    <>
      <path data-trail className="wr-trail" />
      <circle data-ball cx={HOME[0]} cy={HOME[1]} r="8" className="wr-ball" />
      <text data-flash x={HOME[0]} y="150" textAnchor="middle" className="wr-flash" />
    </>
  )
  if (!park) {
    return (
      <svg ref={ref} viewBox={PLOT_VIEWBOX} className="wr-field" aria-hidden="true">
        {overlay}
      </svg>
    )
  }
  return (
    <div ref={(el) => ref && (ref.current = el?.querySelector('svg') ?? null)} className="wr-field">
      <BallparkDiagram layout={park} viewBox={PLOT_VIEWBOX} label={park.name ?? 'Ballpark'}>
        {overlay}
      </BallparkDiagram>
    </div>
  )
}

const FLASH = { home_run: 'HOME RUN', single: 'SINGLE', double: 'DOUBLE', triple: 'TRIPLE', strikeout: 'STRIKEOUT', walk: 'WALK', field_error: 'ERROR' }

// The ball resting where this beat's ball landed, and its call: no flight (a skip or jump).
export function showCall(svg, b) {
  if (!svg || !b) return
  const ball = svg.querySelector('[data-ball]')
  const land = b.spray ? hitCoordToSvg(b.spray[0], b.spray[1]) : null
  ball.setAttribute('cx', land?.x ?? HOME[0])
  ball.setAttribute('cy', land?.y ?? HOME[1])
  svg.querySelector('[data-trail]').style.opacity = 0
  svg.querySelector('[data-flash]').textContent = FLASH[b.type] ?? b.event
}

export function playBall(svg, b, done) {
  if (!svg) return done()
  const ball = svg.querySelector('[data-ball]')
  const trail = svg.querySelector('[data-trail]')
  const flash = svg.querySelector('[data-flash]')
  flash.textContent = ''
  trail.style.opacity = 0
  const finish = () => {
    flash.textContent = FLASH[b.type] ?? b.event
    setTimeout(done, motionIsReduced() ? 0 : 550)
  }
  if (motionIsReduced() || !b.spray) {
    ball.setAttribute('cx', HOME[0])
    ball.setAttribute('cy', HOME[1])
    return finish()
  }
  const land = hitCoordToSvg(b.spray[0], b.spray[1])
  const { d } = ballFlightPath(land, b.launchAngle, b.trajectory)
  trail.setAttribute('d', d)
  const L = trail.getTotalLength()
  trail.style.strokeDasharray = `${L}`
  trail.style.opacity = 0.85
  const t0 = performance.now()
  const dur = b.type === 'home_run' ? 1100 : 800
  const step = (t) => {
    const u = Math.min(1, (t - t0) / dur)
    const p = trail.getPointAtLength(u * L)
    ball.setAttribute('cx', p.x)
    ball.setAttribute('cy', p.y)
    trail.style.strokeDashoffset = `${L * (1 - u)}`
    if (u < 1) requestAnimationFrame(step)
    else finish()
  }
  requestAnimationFrame(step)
}
