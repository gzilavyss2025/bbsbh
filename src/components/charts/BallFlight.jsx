import { useEffect, useId, useRef, useState } from 'react'
import { BallparkDiagram } from '../ballpark/BallparkDiagram.jsx'
import { ModalPortal } from '../ui/ModalPortal.jsx'
import { ballparkFor } from '../../lib/ballpark/ballparkData.js'
import { PLOT_VIEWBOX } from '../../lib/ballpark/ballparkGeometry.js'
import { ballFlightPath } from '../../lib/ballpark/ballFlight.js'
import { hoverCardPosition } from '../../lib/playerHoverPosition.js'
import { useMediaQuery, HOVER_CARD_QUERY } from '../../hooks/useMediaQuery.js'
import { DEFAULT_HARD_HIT_MPH } from './HitChart.jsx'

// WHERE THIS ONE BALL WENT. The play-by-play's base diamond is the handle: point
// at it on a desktop and the flight opens beside the card; tap it on a phone and
// it opens as a sheet you dismiss by tapping anywhere on it. Only a ball that was
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

// Hover intent, not a hair trigger. A pointer travelling down the feed's right
// rail crosses every diamond on the way to the one it wants; at zero delay each
// of them opened a card. Same argument, same shape, as the player hover card's
// (lib/playerHoverStore.js) — the show delay is the longer of the two.
const SHOW_DELAY_MS = 220
const HIDE_DELAY_MS = 120

// What the popover is expected to occupy, for the flip/clamp math. The card is
// a fixed width by CSS; the height is the drawing's own aspect at that width
// plus the head and the numbers under it.
const CARD_WIDTH = 300
const CARD_HEIGHT = 356

const DASH = '—'

// A ground ball's `distance` is the few feet it travelled before a fielder got
// to it — reported as "12 FT" beside an exit velocity it reads as a broken
// number, so the strip drops it. Same rule the hit chart's readout uses.
const carried = (ball) => ball.trajectory !== 'ground_ball' && ball.distance != null

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
// the popover and the sheet can never drift into two different pictures.
function FlightPlot({ ball, park }) {
  // An SVG gradient id is document-global, and a phone can hold this card open
  // over a feed that already rendered a hit chart carrying rings of its own.
  const heatId = `bflight-heat-${useId()}`
  const { d, grounded } = ballFlightPath({ x: ball.x, y: ball.y }, ball.launchAngle, ball.trajectory)
  return (
    <BallparkDiagram
      className="bflight__field"
      dist={park.dist}
      wall={park.wall}
      arc={park.arc}
      viewBox={PLOT_VIEWBOX}
      label={`Flight of the ball at ${park.name}`}
    >
      <defs>
        <linearGradient id={heatId} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" className="bflight__heat-from" />
          <stop offset="100%" className="bflight__heat-to" />
        </linearGradient>
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
      <path className={`bflight__path${grounded ? ' bflight__path--ground' : ''}`} d={d} />
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

// The measurements, under the drawing. Every one of them is null-guarded: a park
// can track where a ball landed and report no exit velocity or launch angle for
// it, which is a dash rather than a missing tile — the strip keeps its shape.
function FlightFacts({ ball }) {
  return (
    <div className="bflight__facts">
      <div className="bflight__fact">
        <p className="bflight__factlabel">Exit velo</p>
        <p className="bflight__factvalue">
          {ball.exitVelo == null ? DASH : ball.exitVelo.toFixed(1)}
          <span className="bflight__unit"> mph</span>
        </p>
      </div>
      <div className="bflight__fact">
        <p className="bflight__factlabel">Launch</p>
        <p className="bflight__factvalue">
          {ball.launchAngle == null ? DASH : `${ball.launchAngle}°`}
        </p>
      </div>
      <div className="bflight__fact">
        <p className="bflight__factlabel">Distance</p>
        <p className="bflight__factvalue">
          {carried(ball) ? (
            <>
              {ball.distance}
              <span className="bflight__unit"> ft</span>
            </>
          ) : (
            DASH
          )}
        </p>
      </div>
    </div>
  )
}

// THE HEAD READS DOWNWARD: who, then what he did. The result used to sit
// opposite the name as the bare denotation alone — "RODRÍGUEZ … 1B" — which
// puts the one word the card exists to explain in a shorthand you have to
// already know, at the far end of the line from the name it belongs to. The
// scorer's mark stays, as a chip beside the plain word rather than instead of
// it.
//
// `onClose` is a REAL flex item in this row, never an absolutely positioned
// corner: floated over the head it sat on the rule underneath and crowded
// whatever the result line ended with. The popover passes none, and the row
// simply closes up.
function FlightBody({ ball, park, name, code, closeRef, onClose }) {
  return (
    <>
      <div className="bflight__head">
        <span className="bflight__ttl">
          <span className="bflight__who">{name}</span>
          <span className="bflight__result">
            <span className="bflight__outcome">{outcomeWord(ball)}</span>
            {code && <span className="bflight__code">{code}</span>}
          </span>
        </span>
        {onClose && (
          <button
            ref={closeRef}
            type="button"
            className="bflight__close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        )}
      </div>
      <FlightPlot ball={ball} park={park} />
      <FlightFacts ball={ball} />
    </>
  )
}

export function BallFlight({ ball, batter, code = '' }) {
  const hoverCapable = useMediaQuery(HOVER_CARD_QUERY)
  const btnRef = useRef(null)
  const closeRef = useRef(null)
  const timer = useRef(null)
  // The trigger's own box at hover time. The card positions off it once and
  // closes when the page moves, rather than tracking it live.
  const [anchor, setAnchor] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => {
    if (!anchor) return
    // A captured rect describes where the trigger WAS. Once the feed scrolls the
    // card is anchored to nothing real, so it closes instead of following. The
    // wheel/touchmove pair catches the case `scroll` misses: a wheel tick with
    // nothing left to scroll fires no scroll event at all, and the card would
    // sit through the intent to travel.
    const close = () => {
      clearTimeout(timer.current)
      setAnchor(null)
    }
    const onKey = (e) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, { capture: true, passive: true })
    window.addEventListener('wheel', close, { passive: true })
    window.addEventListener('touchmove', close, { passive: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, { capture: true })
      window.removeEventListener('wheel', close)
      window.removeEventListener('touchmove', close)
    }
  }, [anchor])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    // The sheet takes focus and hands it back, the same contract every other
    // dialog here keeps (StrikeZoneModal). The close button is the target
    // because it is the only thing in the card a keyboard can act on.
    const trigger = document.activeElement
    closeRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      if (trigger instanceof HTMLElement) trigger.focus()
    }
  }, [open])

  // Static park geometry. A MiLB venue has none, and without the field the
  // ball's coordinates mean nothing, so the whole handle stands down.
  const park = ballparkFor(ball?.venue)
  if (!ball || !park) return null

  const name = batter?.last || batter?.fullName || ''
  const show = (immediate) => {
    if (!hoverCapable || !btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    clearTimeout(timer.current)
    if (immediate) setAnchor(rect)
    else timer.current = setTimeout(() => setAnchor(rect), SHOW_DELAY_MS)
  }
  const hide = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setAnchor(null), HIDE_DELAY_MS)
  }
  const label = `Ball flight for ${name || 'this at-bat'}, ${outcomeWord(ball)}`
  const pos = anchor
    ? hoverCardPosition(anchor, { width: window.innerWidth, height: window.innerHeight }, {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
      })
    : null

  return (
    <>
      {/* THE DIAMOND IS THE HANDLE. The button lies over the whole tally cell
          rather than wrapping the drawing, because the scorer's marks — a
          fielding chain penciled dead centre, the out-number circle — are
          absolutely positioned siblings ON TOP of that drawing, and a button
          under them would lose every tap that landed on the code. Nothing in
          the cell is interactive otherwise, so the cell can be the target. */}
      <button
        ref={btnRef}
        type="button"
        className="pbp__flightbtn"
        aria-label={label}
        onMouseEnter={() => show(false)}
        onMouseLeave={hide}
        onFocus={() => show(true)}
        onBlur={hide}
        onClick={() => {
          clearTimeout(timer.current)
          setAnchor(null)
          setOpen(true)
        }}
      />
      {pos && !open && (
        <ModalPortal>
          <div
            className="bflight bflight--hover"
            role="dialog"
            aria-label={label}
            style={{ left: pos.left, top: pos.top }}
          >
            <FlightBody ball={ball} park={park} name={name} code={code} />
          </div>
        </ModalPortal>
      )}
      {open && (
        <ModalPortal>
          {/* TAP ANYWHERE TO PUT IT AWAY — the scrim and the sheet alike. There
              is nothing on this card to press, so a tap can only ever mean "I
              am done reading it", and hunting for a corner ✕ on a phone is the
              worse of the two. The ✕ stays for the pointer that expects one and
              for a keyboard, which needs a real focus target. */}
          <div className="scrim scrim--center" onClick={() => setOpen(false)}>
            <div className="bflight bflight--modal" role="dialog" aria-modal="true" aria-label={label}>
              <FlightBody
                ball={ball}
                park={park}
                name={name}
                code={code}
                closeRef={closeRef}
                onClose={() => setOpen(false)}
              />
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  )
}
