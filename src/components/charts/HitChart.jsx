import { useId, useMemo, useState } from 'react'
import { BallparkDiagram } from '../ballpark/BallparkDiagram.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { ballparkFor } from '../../lib/ballpark/ballparkData.js'
import { VIEWBOX } from '../../lib/ballpark/ballparkGeometry.js'

// The Hit chart: every ball put in play, plotted where it was fielded on the
// park's own field drawing. Purely presentational — it fetches nothing, derives
// nothing, and imports no reveal-only module. `balls` arrives already gated by
// whoever renders this (`src/api/hitchart.js` is reveal-only; its caller is the
// one that decides the reader has earned these), which is the same contract
// every other component in charts/ works under.
//
// Two shapes of the same card:
//   'game' — the whole game, one club at a time: club chips, a tapped-ball
//            readout, the two switches, a key, and a four-number stat bar.
//   'half' — one half inning: no club to choose, dots numbered against a list
//            of that half's batters underneath.

// Only the drawing's dead sky is cropped away; the fixed 620x560 viewBox is the
// coordinate space `balls` x/y already live in, so the crop is a WINDOW onto it
// and never a rescale. This number is the ONE place the crop is stated: it sets
// both the viewBox handed to the diagram and the percentages the half's dot
// numbers are positioned by, which would otherwise drift apart. Set it to 0 if
// the diagram ever goes back to drawing its full frame.
const SKY_CROP = 50
const PLOT_H = VIEWBOX.h - SKY_CROP
const CROPPED_VIEWBOX = `0 ${SKY_CROP} ${VIEWBOX.w} ${PLOT_H}`

// The half's dot numbers ride beside their dot rather than on it — to its
// right normally, and to its LEFT once the dot is far enough over that the
// number would land on the posted right-field distance (the '355′' the drawing
// prints at the foul pole) or run out past the card. `RIGHT_EDGE` is where that
// flip happens, in the same viewBox units the dots themselves live in.
const NUMBER_OFFSET_X = 17
const RIGHT_EDGE = VIEWBOX.w * 0.78

// The data layer owns the real cut line (`HARD_HIT_MPH`) and the caller passes
// it down. It is repeated here rather than imported because that module is
// reveal-only: importing it for one number would put a spoiler-bearing module
// in this file's graph at render top-level, which ADR-0001 forbids outright.
const DEFAULT_HARD_HIT_MPH = 95

const DASH = '—'

const isHard = (ball, cut) => ball?.exitVelo != null && ball.exitVelo >= cut

// A ground ball's `distance` is the few feet it travelled before a fielder got
// to it. Reported as "12 FT" next to an exit velocity it reads as a broken
// number, so the readout simply drops it.
const carried = (ball) =>
  ball != null && ball.trajectory !== 'ground_ball' && ball.distance != null

function ordinal(n) {
  const teens = n % 100
  if (teens >= 11 && teens <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

const velo = (ball) => (ball?.exitVelo == null ? -1 : ball.exitVelo)
const veloText = (ball) => (ball?.exitVelo == null ? DASH : ball.exitVelo.toFixed(1))

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
  clubs = [],
  eyebrow,
  tag,
  variant = 'game',
  hardHitMph = DEFAULT_HARD_HIT_MPH,
}) {
  const isHalf = variant === 'half'
  // Two charts can share a page (a half card above the game card), and an SVG
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
  const park = ballparkFor(venue)
  if (!balls?.length || !park) return null

  // The half shows what happened; the game shows hits until you ask for outs.
  const plotted = isHalf ? inScope : inScope.filter((b) => b.hit || showOuts)
  const hardest = inScope.reduce((best, b) => (velo(b) > velo(best) ? b : best), null)
  // At rest the readout reports the hardest ball this club hit, so the strip is
  // never a blank frame waiting to be tapped.
  const current = inScope.find((b) => b.id === pickedBall) ?? hardest

  const hits = inScope.filter((b) => b.hit).length
  const hard = inScope.filter((b) => isHard(b, hardHitMph)).length

  const tagLines = Array.isArray(tag) ? tag : tag ? [tag] : []
  const fieldLabel = isHalf
    ? "Chart of this half inning's balls in play"
    : `Chart of the balls in play at ${park.name}`

  const chip = (on, tone) =>
    `hitchart__chip${on ? ` hitchart__chip--${tone}` : ''}`

  return (
    <div className={`hitchart hitchart--${isHalf ? 'half' : 'game'}`}>
      <div className="hitchart__head">
        <div>
          <p className="hitchart__eyebrow">{eyebrow ?? venue}</p>
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
      {!isHalf && clubs.length > 0 && (
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
            dist={park.dist}
            wall={park.wall}
            arc={park.arc}
            viewBox={CROPPED_VIEWBOX}
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
            {!isHalf && (
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
            )}
            {plotted.map((ball) => (
              <g
                key={ball.id}
                className="hitchart__ball"
                onClick={isHalf ? undefined : () => setPickedBall(ball.id)}
              >
                {!isHalf && current?.id === ball.id && (
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

          {/* An SVG <text> would scale with the drawing and end up a different
              size on every card width, so the half's dot numbers are HTML laid
              over the plot in percentages of the cropped viewBox instead. */}
          {isHalf &&
            plotted.map((ball, i) => {
              const flip = ball.x > RIGHT_EDGE
              const x = flip ? ball.x - NUMBER_OFFSET_X : ball.x + NUMBER_OFFSET_X
              return (
                <span
                  key={ball.id}
                  className={`hitchart__dotnum${flip ? ' hitchart__dotnum--flip' : ''}`}
                  style={{
                    left: `${((x / VIEWBOX.w) * 100).toFixed(2)}%`,
                    top: `${(((ball.y - SKY_CROP) / PLOT_H) * 100).toFixed(2)}%`,
                  }}
                >
                  {i + 1}
                </span>
              )
            })}
        </div>
      </div>

      {!isHalf && current && (
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

      {/* THE SWITCHES ARE THE GAME CARD'S. A half's chart held one of them, on
          its own row, to toggle rings the list underneath already reports in
          clay - a control that cost fifty pixels to restate what was three
          lines below it. The rings themselves stay: `showHard` opens true and
          the half never turns it off. */}
      {!isHalf && (
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
            className={chip(showHard, 'on-seal')}
            aria-pressed={showHard}
            onClick={() => setShowHard((v) => !v)}
          >
            <span className="hitchart__switch" aria-hidden="true" />
            Hard hits <span className="hitchart__count">{hardHitMph}+</span>
          </button>
        </div>
      )}

      {!isHalf && (
        <>
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
        </>
      )}

      {isHalf && (
        <>
          {/* The unit is carried once, by the column head, so no figure in the
              list below has to repeat it. */}
          <div className="hitchart__listhead">
            <span>Balls in play</span>
            <span>Exit velo · mph</span>
          </div>
          <ol className="hitchart__list">
            {plotted.map((ball, i) => (
              <li key={ball.id} className="hitchart__row">
                <span className="hitchart__rownum">{i + 1}</span>
                <span className="hitchart__rowname">{ball.batter}</span>
                <span className="hitchart__rowcode">{ball.code}</span>
                <span
                  className={`hitchart__rowvelo${
                    isHard(ball, hardHitMph) ? ' hitchart__rowvelo--hard' : ''
                  }`}
                >
                  {veloText(ball)}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}
