import { useId, useMemo, useState } from 'react'
import { BallparkDiagram } from '../ballpark/BallparkDiagram.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { Card } from '../ui/frame/Card.jsx'
import { resolveBallparkLayout } from '../../lib/ballpark/layout/resolveLayout.js'
import { PLOT_VIEWBOX } from '../../lib/ballpark/ballparkGeometry.js'
import { ordinal } from '../../lib/format.js'

// The Hit chart: every ball put in play, plotted where it was fielded on the
// park's own field drawing. Purely presentational — it fetches nothing, derives
// nothing, and imports no reveal-only module. `balls` arrives already gated by
// whoever renders this (`src/api/hitchart.js` is reveal-only; its caller is the
// one that decides the reader has earned these), which is the same contract
// every other component in charts/ works under.
//
// The whole game, one club at a time: club chips, a tapped-ball readout, the
// two switches, a key, and a stat bar. The crop is ballparkGeometry.js's
// (PLOT_VIEWBOX), shared with the flight card so the two plot onto one window.

// The data layer owns the real cut line (`HARD_HIT_MPH`) and the caller passes
// it down. It is repeated here rather than imported because that module is
// reveal-only: importing it for one number would put a spoiler-bearing module
// in this file's graph at render top-level, which ADR-0001 forbids outright.
// Exported for the flight card (./BallFlight.jsx), which rings a hard-hit ball
// the same way this chart does — a THIRD spelling of the number is what the
// export exists to prevent.
export const DEFAULT_HARD_HIT_MPH = 95

const isHard = (ball, cut) => ball?.exitVelo != null && ball.exitVelo >= cut

// A ground ball's `distance` is the few feet it travelled before a fielder got
// to it. Reported as "12 FT" next to an exit velocity it reads as a broken
// number, so the readout simply drops it.
const carried = (ball) =>
  ball != null && ball.trajectory !== 'ground_ball' && ball.distance != null

const velo = (ball) => (ball?.exitVelo == null ? -1 : ball.exitVelo)

// The half of the inning as a triangle — broadcast shorthand, and the reason it
// is drawn rather than typed is that "T6"/"B6" reads as a letter grade at this
// size and an emoji triangle renders as a different glyph on every platform.
// The spoken form ("Top of the 6th") rides on the wrapper's role/label, so a
// screen reader never has to interpret the shape.
function InningMark({ inning, half }) {
  const top = half === 'top'
  return (
    <span
      className="hitchart__inning"
      role="img"
      aria-label={`${top ? 'Top' : 'Bottom'} of the ${ordinal(inning)}`}
    >
      <svg className="hitchart__arrow" viewBox="0 0 10 10" aria-hidden="true">
        <path d={top ? 'M5 1.4 9.2 8.6H0.8z' : 'M5 8.6 0.8 1.4h8.4z'} />
      </svg>
      {inning}
    </span>
  )
}

export function HitChart({
  balls,
  venue,
  venueId,
  gameDate,
  clubs = [],
  note,
  tag,
  hardHitMph = DEFAULT_HARD_HIT_MPH,
}) {
  // Two charts can share a page, and an SVG
  // gradient id is document-global — without a per-instance id the second
  // chart's <defs> would silently repaint the first one's heat rings.
  const heatId = `hitchart-heat-${useId()}`

  const [pickedClub, setPickedClub] = useState(null)
  const [showOuts, setShowOuts] = useState(false)
  const [showHard, setShowHard] = useState(true)
  const [pickedBall, setPickedBall] = useState(null)

  // null IS a selection here - it is the All chip, and it is where the card
  // opens. The chart's first answer should be the whole night's contact, not
  // one club's half of it chosen for the reader by list order.
  const clubId = pickedClub

  const inScope = useMemo(
    () => (clubId == null ? balls ?? [] : (balls ?? []).filter((b) => b.teamId === clubId)),
    [balls, clubId],
  )

  // The park record is static geometry, not game state. A MiLB venue has none —
  // and without the field the dots' coordinates mean nothing — so the card
  // stands down entirely rather than drawing marks on empty paper.
  const park = resolveBallparkLayout({ venueId, venueName: venue, gameDate })
  if (!balls?.length || !park) return null

  // Hits until you ask for outs.
  const plotted = inScope.filter((b) => b.hit || showOuts)
  const hardest = inScope.reduce((best, b) => (velo(b) > velo(best) ? b : best), null)
  // At rest the readout reports the hardest ball this club hit, so the strip is
  // never a blank frame waiting to be tapped.
  const current = inScope.find((b) => b.id === pickedBall) ?? hardest

  const hits = inScope.filter((b) => b.hit).length
  const hard = inScope.filter((b) => isHard(b, hardHitMph)).length

  const tagLines = Array.isArray(tag) ? tag : tag ? [tag] : []
  const fieldLabel = `Chart of the balls in play at ${venue || park.name}`

  const chip = (on, tone) =>
    `hitchart__chip${on ? ` hitchart__chip--${tone}` : ''}`

  return (
    <Card as="div" body="flush" className="hitchart hitchart--game">
      <div className="hitchart__head">
        <div>
          <p className="hitchart__note">{note ?? venue}</p>
          <h2 className="hitchart__headline">Hit chart</h2>
          <div className="hitchart__rule" />
        </div>
        {tagLines.length > 0 && (
          <p className="hitchart__tag">
            {tagLines.map((line, i) => (
              <span key={line} className="hitchart__tagline">
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </p>
        )}
      </div>

      {/* The club rides its own MARK, not its name — the chart is already a
          picture, and a knocked-out crest identifies a club faster than four
          letters do. A selected chip fills navy, so it asks for the precomputed
          `mono` knockout art rather than filtering the colour mark white
          (ADR-0031). */}
      {clubs.length > 0 && (
        <div className="hitchart__chiprow">
          {/* ALL, AND IT LEADS. The clubs beside it filter DOWN from this, so
              the row reads the way it behaves: everything, then one side or the
              other. It carries a word where the others carry a crest because
              there is no mark for "both", and a word beside two crests says
              plainly that it is not a third club. */}
          <button
            type="button"
            className={chip(clubId == null, 'club')}
            aria-pressed={clubId == null}
            aria-label={`Both clubs, ${balls.length} balls in play`}
            onClick={() => {
              setPickedClub(null)
              setPickedBall(null)
            }}
          >
            All
            <span className="hitchart__count">{balls.length}</span>
          </button>
          {clubs.map((club) => {
            const on = club.teamId === clubId
            return (
              <button
                key={club.teamId}
                type="button"
                className={chip(on, 'club')}
                aria-pressed={on}
                aria-label={`${club.name}, ${club.count} balls in play`}
                onClick={() => {
                  setPickedClub(club.teamId)
                  setPickedBall(null)
                }}
              >
                <TeamLogo
                  teamId={club.teamId}
                  name={club.name}
                  size={22}
                  variant={on ? 'mono' : 'base'}
                />
                <span className="hitchart__count">{club.count}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="hitchart__fieldwrap">
        <div className="hitchart__plot">
          <BallparkDiagram
            className="hitchart__field"
            layout={park}
            viewBox={PLOT_VIEWBOX}
            label={fieldLabel}
          >
            <defs>
              {/* Clay into kraft: the same heat ramp the app's other "this one
                  was struck" marks use, run through paper inks. */}
              <linearGradient id={heatId} x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" className="hitchart__heat-from" />
                <stop offset="100%" className="hitchart__heat-to" />
              </linearGradient>
            </defs>
            {/* THE THUMB TARGETS, ALL OF THEM, IN ONE LAYER UNDER THE ART. A
                dot draws at 6.5 units — about 7 CSS px on a phone — so each
                carries a transparent circle far larger than itself: 24 units,
                about 25 CSS px, against the 18.6 px this used to offer.
                WHAT THE LAYER BUYS IS THAT ENLARGEMENT, FOR FREE. SVG
                hit-testing takes the topmost painted element, so with the
                target inside each ball's own group a later ball's invisible
                circle sits over an earlier ball's visible dot — and the bigger
                the target, the more dots it swallows. Measured on gamePk 823035
                with all 32 balls plotted: 27 of 32 separately selectable at the
                old 17-unit target, 26 at 24 units the old way, 27 at 24 units
                this way. (The five that never separate are balls sharing a
                landing coordinate — their ART overlaps, which no layering
                fixes.) One layer underneath keeps every dot's own art above
                every target, so a bigger target costs no precision. */}
            <g className="hitchart__taps">
              {plotted.map((ball) => (
                <circle
                  key={ball.id}
                  className="hitchart__tap"
                  cx={ball.x}
                  cy={ball.y}
                  r="24"
                  onClick={() => setPickedBall(ball.id)}
                />
              ))}
            </g>
            {plotted.map((ball) => (
              <g
                key={ball.id}
                className="hitchart__ball"
                onClick={() => setPickedBall(ball.id)}
              >
                {current?.id === ball.id && (
                  <circle className="hitchart__picked" cx={ball.x} cy={ball.y} r="18" />
                )}
                {showHard && isHard(ball, hardHitMph) && (
                  <circle
                    className="hitchart__heat"
                    cx={ball.x}
                    cy={ball.y}
                    r={ball.hit ? 12 : 11}
                    stroke={`url(#${heatId})`}
                  />
                )}
                {ball.homeRun ? (
                  <rect
                    className="hitchart__hr"
                    x={ball.x - 8}
                    y={ball.y - 8}
                    width="16"
                    height="16"
                    transform={`rotate(45 ${ball.x} ${ball.y})`}
                  />
                ) : (
                  <circle
                    className={ball.hit ? 'hitchart__hit' : 'hitchart__out'}
                    cx={ball.x}
                    cy={ball.y}
                    r={ball.hit ? 6.5 : 5.5}
                  />
                )}
              </g>
            ))}
          </BallparkDiagram>
        </div>
      </div>

      {current && (
        <div className="hitchart__readout">
          {/* TWO ROWS, NOT TWO COLUMNS. Side by side, the measurements held a
              nowrap column wide enough that a two-word name wrapped underneath
              itself on every phone — a three-line strip whose height moved with
              the batter. The scorer's own denotation belongs beside the name it
              describes anyway, which is where it sits in his book. */}
          <span className="hitchart__who">
            <span className="hitchart__batter">{current.batter}</span>
            <span className="hitchart__code">{current.code}</span>
          </span>
          <span className="hitchart__meta">
            {current.exitVelo != null && <>{current.exitVelo} mph · </>}
            {carried(current) && <>{current.distance} ft · </>}
            <InningMark inning={current.inning} half={current.half} />
          </span>
        </div>
      )}

      <div className="hitchart__chiprow hitchart__chiprow--switches">
        <button
          type="button"
          className={chip(showOuts, 'on-ink')}
          aria-pressed={showOuts}
          onClick={() => setShowOuts((v) => !v)}
        >
          <span className="hitchart__switch" aria-hidden="true" />
          Show outs
        </button>
        <button
          type="button"
          className={chip(showHard, 'on-marker')}
          aria-pressed={showHard}
          onClick={() => setShowHard((v) => !v)}
        >
          <span className="hitchart__switch" aria-hidden="true" />
          Hard hits <span className="hitchart__count">{hardHitMph}+</span>
        </button>
      </div>

        <div className="hitchart__key">
        <span className="hitchart__keyitem">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle className="hitchart__hit" cx="8" cy="8" r="4.4" />
          </svg>
          Hit
        </span>
        <span className="hitchart__keyitem">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle className="hitchart__out" cx="8" cy="8" r="4.6" />
          </svg>
          Out
        </span>
        <span className="hitchart__keyitem">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <rect
              className="hitchart__hr"
              x="4.6"
              y="4.6"
              width="8.8"
              height="8.8"
              transform="rotate(45 9 9)"
            />
          </svg>
          Home run
        </span>
        <span className="hitchart__keyitem">
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <circle
              className="hitchart__heat hitchart__heat--key"
              cx="10"
              cy="10"
              r="6.6"
              stroke={`url(#${heatId})`}
            />
            <circle className="hitchart__hit" cx="10" cy="10" r="3.4" />
          </svg>
          Hard hit
        </span>
      </div>

      {/* TWO NUMBERS, NOT FOUR. The other two were already on the card:
          "In play" is the count printed on the lit chip above, and
          "Hardest" is the figure the readout rests on when nothing is
          tapped. A stat bar that repeats its own page reads as filler and
          costs a phone sixty pixels of height to do it. */}
      <div className="hitchart__facts">
        <div className="hitchart__fact">
          <p className="hitchart__factlabel">Hits</p>
          <p className="hitchart__factvalue">{hits}</p>
        </div>
        <div className="hitchart__fact">
          <p className="hitchart__factlabel">Hard</p>
          <p className="hitchart__factvalue">{hard}</p>
        </div>
      </div>
    </Card>
  )
}
