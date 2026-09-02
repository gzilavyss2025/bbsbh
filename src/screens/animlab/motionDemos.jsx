import '../../styles/boxlines/boxlines.css'
import { PitchLadder } from '../../components/scoring/PitchLadder.jsx'
import { PlayDiamond } from '../../components/scoring/PlayDiamond.jsx'

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
// stagger, and so the hover rule is the one the app runs.
export function LineupDemo() {
  return (
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
            <p className="boxlines__kicker">Box lines · regular season</p>
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
