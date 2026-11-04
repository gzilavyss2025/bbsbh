import { useEffect, useId, useRef, useState } from 'react'
import { BallparkDiagram } from '../ballpark/BallparkDiagram.jsx'
import { ModalPortal } from '../ui/ModalPortal.jsx'
import { Card } from '../ui/frame/Card.jsx'
import { resolveBallparkLayout } from '../../lib/ballpark/layout/resolveLayout.js'
import { PLOT_VIEWBOX } from '../../lib/ballpark/ballparkGeometry.js'
import { ballFlightPath } from '../../lib/ballpark/ballFlight.js'
import { DEFAULT_HARD_HIT_MPH } from './HitChart.jsx'
import { IconButton } from '../ui/control/IconButton.jsx'
import { FlightClock } from './CountUp.jsx'

// WHERE THIS ONE BALL WENT. The play-by-play's base diamond is the handle: tap it
// and the flight opens as a sheet you dismiss by tapping anywhere on it. Only a ball that was
// actually PUT IN PLAY offers it — a strikeout and a walk have no flight, and a
// park that tracked no landing coordinate has nothing to draw, so the handle
// simply isn't there (the MiLB degrade, one more time).
//
// It is the hit chart's per-play sibling and deliberately shares its ink: the
// same landing marks (ink dot for a hit, open circle for an out, an amber
// diamond for a home run), the same clay heat ring at 95 mph. What it adds is
// the PATH — home plate to the landing spot — which is the one thing a chart of
// thirty dots cannot show without becoming a bowl of spaghetti. Read
// lib/ballpark/ballFlight.js for what the bend in that path does and does not
// claim.
//
// Purely presentational, same contract as every other component in charts/: it
// fetches nothing and imports no reveal-only module. `ball` arrives on an at-bat
// card that only exists inside its own half's SealBox reveal.

const isHard = (ball) => ball.exitVelo != null && ball.exitVelo >= DEFAULT_HARD_HIT_MPH

// What the play WAS, in words. The feed's own phrase when it sent one; a plain
// three-way fallback when it did not, so this line is never blank — an empty
// slot under the name would read as a card that failed to load.
function outcomeWord(ball) {
  if (ball.result) return ball.result
  if (ball.homeRun) return 'Home run'
  return ball.hit ? 'Hit' : 'Out'
}

// The drawing, the path, and the mark where the ball came down. One component so
// the sheet has one picture.
// How long the opened card's ball takes to land (Gary, 2026-10-29): a grounder skims, a liner is
// quick, a fly ball hangs, a popup hangs longest; anything else by its carry. Real hang times sped
// up to well under a second, so the card settles fast.
export function flightMs(ball) {
  const t = ball?.trajectory ?? ''
  if (t === 'ground_ball' || t === 'bunt_grounder') return 450
  if (t === 'line_drive') return 600
  if (t === 'fly_ball') return 850
  if (t === 'popup' || t === 'bunt_popup') return 950
  return Math.min(950, Math.max(450, (ball?.distance ?? 200) * 2.4))
}

function FlightPlot({ ball, park }) {
  // An SVG gradient id is document-global, and a phone can hold this card open
  // over a feed that already rendered a hit chart carrying rings of its own.
  const heatId = `bflight-heat-${useId()}`
  const drawId = `bflight-draw-${useId()}`
  const { d, grounded } = ballFlightPath({ x: ball.x, y: ball.y }, ball.launchAngle, ball.trajectory)
  return (
    <BallparkDiagram
      className="bflight__field"
      layout={park}
      viewBox={PLOT_VIEWBOX}
      label={`Flight of the ball at ${ball.venue || park.name}`}
    >
      <defs>
        <linearGradient id={heatId} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" className="bflight__heat-from" />
          <stop offset="100%" className="bflight__heat-to" />
        </linearGradient>
        {/* The path draws out from the plate (the opened card only, 69-hit-chart.css): a solid copy
            of it, stroked on over the flight, masks the drawn line, so a dashed grounder draws too. */}
        <mask id={drawId} maskUnits="userSpaceOnUse">
          <path className="bflight__draw" d={d} pathLength="1" />
        </mask>
      </defs>
      {/* The path rides UNDER the landing mark, so the mark reads as the end of
          it rather than as a bead threaded on it. A ball on the ground is drawn
          dashed as well as straight: the line is then the route a fielder ran it
          down along, not a flight.

          THE MARKS ARE BIGGER THAN THE HIT CHART'S, and have to be. Both draw
          into the same 620-unit-wide drawing, but that chart runs full-bleed
          across a card while this one is 300px wide — the chart's 6.5-unit dot
          comes out under 3px here, a speck at the end of a line. These are sized
          to read at THIS width; nothing about the coordinates changed. */}
      <path className={`bflight__path${grounded ? ' bflight__path--ground' : ''}`} d={d} mask={`url(#${drawId})`} />
      {isHard(ball) && (
        <circle
          className="bflight__heat"
          cx={ball.x}
          cy={ball.y}
          r={ball.hit ? 21 : 20}
          stroke={`url(#${heatId})`}
        />
      )}
      {ball.homeRun ? (
        <rect
          className="bflight__hr"
          x={ball.x - 13}
          y={ball.y - 13}
          width="26"
          height="26"
          transform={`rotate(45 ${ball.x} ${ball.y})`}
        />
      ) : (
        <circle
          className={ball.hit ? 'bflight__hit' : 'bflight__out'}
          cx={ball.x}
          cy={ball.y}
          r={ball.hit ? 12 : 11}
        />
      )}
    </BallparkDiagram>
  )
}

// Just the ✕ (floated over the drawing's corner by CSS) and the plot.
function FlightBody({ ball, park, closeRef, onClose }) {
  return (
    <>
      {onClose && (
        <div className="bflight__head bflight__head--bare">
          <IconButton ref={closeRef} mark="md" onClick={onClose} label="Close">
            ✕
          </IconButton>
        </div>
      )}
      <FlightPlot ball={ball} park={park} />
    </>
  )
}

// `extra`: more for the opened card only, under the drawing (Gameday's Savant figures).
export function BallFlight({ ball, batter, extra = null }) {
  const closeRef = useRef(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    // The sheet takes focus and hands it back, the same contract every other
    // dialog here keeps (StrikeZoneModal). The close button is the target: it
    // is the first thing in the card a keyboard can act on.
    const trigger = document.activeElement
    closeRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      if (trigger instanceof HTMLElement) trigger.focus()
    }
  }, [open])

  // Static park geometry. A MiLB venue has none, and without the field the
  // ball's coordinates mean nothing, so the whole handle stands down.
  const park = resolveBallparkLayout({ venueId: ball?.venueId, venueName: ball?.venue, gameDate: ball?.gameDate })
  if (!ball || !park) return null

  const name = batter?.last || batter?.fullName || ''
  const label = `Ball flight for ${name || 'this at-bat'}, ${outcomeWord(ball)}`
  return (
    <>
      {/* THE DIAMOND IS THE HANDLE. The button lies over the whole tally cell
          rather than wrapping the drawing, because the scorer's marks — a
          fielding chain penciled dead centre, the out-number circle — are
          absolutely positioned siblings ON TOP of that drawing, and a button
          under them would lose every tap that landed on the code. Nothing in
          the cell is interactive otherwise, so the cell can be the target. */}
      <button
        type="button"
        className="pbp__flightbtn"
        aria-label={label}
        onClick={() => setOpen(true)}
      />
      {open && (
        <ModalPortal>
          {/* TAP ANYWHERE TO PUT IT AWAY — the scrim and the sheet alike. Any tap can only mean "I am done reading
              it", and hunting for a corner ✕ on a phone is the worse of the
              two. The ✕ stays for the pointer that expects one and for a
              keyboard, which needs a real focus target. */}
          <div className="scrim scrim--center" onClick={() => setOpen(false)}>
            {/* The opened card plays the flight: the path draws, the mark lands, the figures count up (Gary, 2026-10-29). */}
            <FlightClock.Provider value={flightMs(ball)}>
            <Card as="div" body="flush" className="bflight bflight--modal" style={{ '--flight-ms': `${flightMs(ball)}ms` }} role="dialog" aria-modal="true" aria-label={label}>
              <FlightBody
                ball={ball}
                park={park}
                closeRef={closeRef}
                onClose={() => setOpen(false)}
              />
              {extra}
            </Card>
            </FlightClock.Provider>
          </div>
        </ModalPortal>
      )}
    </>
  )
}
