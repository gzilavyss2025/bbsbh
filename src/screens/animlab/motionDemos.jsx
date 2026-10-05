import '../../styles/boxlines/boxlines.css'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AtBatBox } from '../../components/scoring/AtBatBox.jsx'
import { LensTear } from '../../components/scoring/lens/motion/LensTear.jsx'
import { glideTo } from '../../components/scoring/lens/useLens.js'
import { PitchLadder } from '../../components/scoring/PitchLadder.jsx'
import { PlayDiamond } from '../../components/scoring/PlayDiamond.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'

// ---------------------------------------------------------------------------
// THE MOTION STUDY'S DEMOS (issues #976-#983), for /animation-lab.
//
// Their own file because AnimationLab.jsx reached the 600-line cap when they
// landed (ADR-0038, scripts/check-file-size.mjs) — a subdirectory rather than a
// numbered sibling, for the same reason styles/motion/ is one. The Lab's own
// page structure stays in AnimationLab.jsx; only the demo components moved.
//
// EVERY DEMO BELOW IS A COMPONENT. Nothing else may be exported from this file
// — react-refresh needs a components-only module, and the invented data below
// is deliberately module-private.
//
// THE MOTION STUDY'S DEMOS (issues #976-#983). Every one below wears the REAL
// class hooks the app renders — not a copy of a keyframe, and never a game.
// The names, jersey numbers and pitch sequences are invented.

// Both "this game is in progress" dots at once, on the one 2.4s beat: the slate
// card's LIVE pill and the innings bar's live-edge status.
export function BreathDemo() {
  return (
    <div className="animlab__breathrow">
      <span className="gamecard__live">Live</span>
      <div className="liveedge">
        <span className="liveedge__dot" aria-hidden="true" />
        <span className="liveedge__label">Caught up — waiting on the next batter</span>
      </div>
    </div>
  )
}

// The slate card's '@' watermark in its real box: .gamecard__teams clips the
// 158px glyph, and both plates are aria-hidden texture behind the logo tiles.
// .gamecard__open is the hover root, exactly as on a real card.
export function AtMarkDemo() {
  return (
    <div className="gamecard">
      <button type="button" className="gamecard__open">
        <div className="gamecard__teams">
          <span className="gamecard__atmark" aria-hidden="true">
            <span className="gamecard__atmark-ghost">@</span>
            <span className="gamecard__atmark-ink">@</span>
          </span>
          <span className="gamecard__name gamecard__name--away">MILWAUKEE</span>
          <span className="gamecard__name gamecard__name--home">CHICAGO</span>
        </div>
      </button>
    </div>
  )
}

// Game 2's sheet behind game 1's card — the real .gamecardstack pair, so the
// hover moves the sheet and leaves the card standing.
export function RiffleDemo() {
  return (
    <div className="gamecardstack">
      <div className="gamecardstack__sheet" aria-hidden="true" />
      <div className="gamecard">
        <button type="button" className="gamecard__open">
          <div className="gamecard__teams">
            <span className="gamecard__name gamecard__name--away">MILWAUKEE</span>
            <span className="gamecard__name gamecard__name--home">CHICAGO</span>
          </div>
        </button>
      </div>
    </div>
  )
}

// A made-up batting order. Nine invented names — this page never reads a lineup.
const DEMO_ORDER = [
  ['Adcock, J', '4', '1B'],
  ['Ashburn, R', '1', 'CF'],
  ['Boudreau, L', '5', 'SS'],
  ['Camilli, D', '3', 'LF'],
  ['Doerr, R', '1', '2B'],
  ['Elliott, B', '7', '3B'],
  ['Ferrell, W', '2', 'RF'],
  ['Gordon, J', '6', 'DH'],
  ['Hegan, J', '8', 'C'],
]

// The real .lineup__list/.lineup__row recipe, `--row-i` set per row exactly as
// TeamInfo sets it — so this strip pauses additively and reads the true
// stagger, and so the hover rule is the one the app runs. The list is the flush
// body of a Card there (#1113, slice C3), so it is here too.
export function LineupDemo() {
  return (
    <Card as="div" body="flush">
      <ol className="lineup__list">
        {DEMO_ORDER.map(([name, jersey, pos], i) => (
          <li key={name} className="lineup__row" style={{ '--row-i': i }}>
            <span className="lineup__order">{i + 1}</span>
            <span className="lineup__namewrap">
              <span className="lineup__name">{name}</span>
            </span>
            <span className="lineup__jersey">{jersey}</span>
            <span className="lineup__pos">{pos}</span>
          </li>
        ))}
      </ol>
    </Card>
  )
}

// The struck line at two of its four sites, both mid-draw. The inner
// `.struckline` span is StruckLine's own shape, restated by hand because the
// demo has no substitution to hand the component — it is what makes the bar hug
// the name rather than the box, and a demo drawn without it would show a rule
// the app does not draw. `.is-drawing` is written on directly for the same
// reason: in the app it lands there only for a substitution the reader was
// watching (useBecameTrue), which is a transition a frozen frame cannot hold.
export function StrikeDemo() {
  return (
    <div className="animlab__strikerow">
      <span className="pbp__batline pbp__replaced">
        <span className="struckline is-drawing">
          Doerr, R<span className="pbp__pos">2B</span>
        </span>
      </span>
      <span className="defdiamond__name defdiamond__name--out">
        <span className="struckline is-drawing">
          Camilli<span className="defdiamond__enter"> (6th)</span>
        </span>
      </span>
    </div>
  )
}

// An invented pitch sequence: ball, called strike, foul, ball, ball in play.
const DEMO_LADDER = [
  { side: 'ball', label: '1' },
  { side: 'strike', label: '2' },
  { side: 'strike', label: '3' },
  { side: 'ball', label: '4' },
  { side: 'strike', label: 'X' },
]

// One at-bat cell wearing `.pbp__atbat--writing` — the class PlayByPlay puts on
// the first six cards of a half the reader has just unsealed. Real PitchLadder,
// real PlayDiamond, real code and out-circle marks. `out` swaps a double for a
// 6-3, which is what brings beat 4 (the stamp) into it.
export function WriteOnDemo({ out = false }) {
  return (
    <div className="pbp__atbat pbp__atbat--writing">
      <div className="pbp__side">
        <PitchLadder ladder={DEMO_LADDER} />
        <div className="pbp__play">
          {!out && <span className="pbp__code pbp__code--hit">2B</span>}
          <PlayDiamond reached={out ? 0 : 2} />
          {out && <span className="pbp__code pbp__code--center pbp__code--out">6-3</span>}
          {out && <span className="pbp__outcircle">1</span>}
        </div>
      </div>
    </div>
  )
}

// The Box Lines sheet's side entrance (ADR-0069): a cropped stand-in for the
// sheet — its head, its headline, two ruled rows — carrying the wide
// breakpoint's `boxlines-slidein` inline, so the lab runs it at any width and
// the frozen strip can hold it mid-settle. Made-up line, no game feed.
export function BoxLinesEntrance() {
  return (
    <div className="animlab-boxlines">
      <div
        className="sheet boxlines animlab-boxlines__sheet"
        style={{ animation: 'boxlines-slidein var(--dur-slow) var(--ease-out)' }}
      >
        <div className="boxlines__head">
          <div>
            <p className="boxlines__note">Game lines · regular season</p>
            <h2 className="sheet__title boxlines__title">Surname vs the Club</h2>
          </div>
        </div>
        <p className="boxlines__headline">Career vs CLB: 2 G, 12.0 IP, 3.00 ERA, 9 K, 4 BB</p>
        <ul className="boxlines__rows">
          <li className="boxline">
            <span className="boxline__link">
              <span className="boxline__season">2026</span>
              <span className="boxline__mark" />
              <span className="boxline__meta">
                <span className="boxline__date">6/1</span>
                <span className="boxline__where">vs CLB</span>
              </span>
              <span className="boxline__score">OWN 4, CLB 2</span>
              <span className="boxline__chev" />
              <span className="boxline__line">GS, 6.0 IP, 4 H, 2 R, 2 ER, 2 BB, 5 K</span>
            </span>
          </li>
          <li className="boxline boxline--band">
            <span className="boxline__link">
              <span className="boxline__season">2025</span>
              <span className="boxline__mark" />
              <span className="boxline__meta">
                <span className="boxline__date">8/9</span>
                <span className="boxline__where">@ CLB</span>
              </span>
              <span className="boxline__score">OWN 3, CLB 2</span>
              <span className="boxline__chev" />
              <span className="boxline__line">GS, 6.0 IP, 5 H, 2 R, 2 ER, 2 BB, 4 K</span>
            </span>
          </li>
        </ul>
      </div>
    </div>
  )
}

// THE SCORECARD LENS (#724 L7, ADR-0092), in the sheet's real classes: one
// `.sc-sheet--lens` table under `.scorecard`, whose tokens size the cell. The
// box is an invented double, RBI single, in the card fields AtBatBox reads.
const DEMO_DOUBLE = { codeKind: 'hit', code: '2B', reached: 2, rbi: 1, ladder: DEMO_LADDER }

function LensCells({ rows, paneRef = null, className = '', sheetClass = '', children = null }) {
  return (
    <div className={`scorecard ${sheetClass}`}>
      <div className={`sc-sheet__scroll ${className}`} ref={paneRef}>
        <table className="sc-sheet sc-sheet--lens">
          <tbody>
            {rows.map((cell, i) => (
              <tr key={i}>
                <td className="sc-sheet__cell">{cell}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {children}
    </div>
  )
}

function OpenedBox() {
  return (
    <>
      <LensTear seed={421} />
      <AtBatBox atbat={DEMO_DOUBLE} />
    </>
  )
}

function MovedBox() {
  return (
    <>
      <span className="sc-lens__moved" aria-hidden="true" />
      <AtBatBox atbat={{ codeKind: 'hit', code: '1B', reached: 3, ladder: DEMO_LADDER }} />
    </>
  )
}

// The tear alone, over the box it just opened: the frozen strip.
export function LensTearDemo() {
  return (
    <LensCells
      rows={[<OpenedBox key="box" />]}
    />
  )
}

// The tear AND the glide: a pane one box tall, the opened box over the next
// seal. Play runs the real tween (useLens's glideTo), which a frozen frame
// cannot hold: it is a scroll, not a CSS animation. It starts only in a
// running stage, so the page's first load moves nothing.
export function LensGlideDemo() {
  const pane = useRef(null)
  useEffect(() => {
    const el = pane.current
    if (!el?.closest('.animlab__live.is-running')) return undefined
    return glideTo(el, { top: el.scrollHeight - el.clientHeight, left: 0 })
  }, [])
  return (
    <LensCells
      paneRef={pane}
      className="animlab-lensglide"
      rows={[
        <OpenedBox key="box" />,
        <span key="seal" className="sc-ab__seal">
          <span className="sc-ab__sealtext">Tap</span>
        </span>,
      ]}
    />
  )
}

// The ride: near the top of the order the frame moves down one row on the
// glide's time, and the sheet stays put (lib/scorecard/geometry.js).
export function LensRideDemo() {
  const pane = useRef(null)
  const [at, setAt] = useState(null)
  // A layout effect, so the frame paints on row 1 before it rides to row 2.
  useLayoutEffect(() => {
    // The frame sits on a measured cell, as useLens's does.
    const cells = pane.current?.querySelectorAll('.sc-sheet__cell') ?? []
    const on = (cell) => ({ top: cell.offsetTop, width: cell.offsetWidth, height: cell.offsetHeight })
    if (cells.length < 2) return undefined
    setAt(on(cells[0]))
    if (!pane.current.closest('.animlab__live.is-running')) return undefined
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setAt(on(cells[1]))))
    return () => cancelAnimationFrame(id)
  }, [])
  return (
    <LensCells
      paneRef={pane}
      sheetClass="animlab-lensride"
      rows={[
        <AtBatBox key="box" atbat={DEMO_DOUBLE} />,
        <span key="seal" className="sc-ab__seal">
          <span className="sc-ab__sealtext">Tap</span>
        </span>,
      ]}
    >
      {at && <div className="sc-lens__frame" style={{ ...at, left: 0 }} />}
    </LensCells>
  )
}

// A runner's box, the highlighter fading off it.
export function LensMovedDemo() {
  return (
    <LensCells
      rows={[<MovedBox key="box" />]}
    />
  )
}

// The page turn's two beats, on the page's real class hooks.
export function LensTurnDemo({ beat }) {
  return (
    <div className={`scorecard-page scorecard-page--turn-${beat}`}>
      <LensCells rows={[<AtBatBox key="box" atbat={DEMO_DOUBLE} />]} />
    </div>
  )
}
