import { StatTile } from '../../components/ui/frame/StatTile.jsx'
import { Entry, Frame } from './Entry.jsx'
import '../../styles/player-next/both/splits.css'
import '../player/next/modules/splits/parts.css'
import { Row } from '../player/next/modules/splits/LineRows.jsx'

// ---------------------------------------------------------------------------
// THE PLAYER PAGE'S MOTION (#2073) on /animation-lab.
//
// Its own file because AnimationLab.jsx is at the 600-line cap
// (scripts/check-file-size.mjs, ADR-0038). Every slice of the player motion work
// adds its entry HERE, not to AnimationLab.jsx. Each demo wears the real class
// names the player page renders; every figure is invented, never a live feed.
//
// A demo whose animation has its own delay needs a matching rule in the
// additive half of the `.animlab__frame` freeze list
// (styles/46-consent-modal.css), or its frozen strip shows the wrong moment.

const RISE_TILES = [
  ['AVG', '.281'],
  ['HR', '18'],
  ['SB', '24'],
]

// Three stat tiles in the shared player rise (styles/motion/player-rise.css),
// one --stagger-step apart, as a row of cards rises on the page.
function RiseDemo() {
  return (
    <div className="animlab__breathrow">
      {RISE_TILES.map(([label, value], i) => (
        <div key={label} className="player-rise" style={{ '--rise-i': i }}>
          <StatTile label={label} value={value} caption="Invented" />
        </div>
      ))}
    </div>
  )
}

// The Splits card's entrance (board Splits): a part rises and its bars grow, one row after the
// next. The real rows of LineRows.jsx with invented figures; `is-in` is set at once, so Play replays.
const DEMO_SPLITS = [
  { key: 'b', label: 'Season', count: 412, avg: '.262', rest: '/.331/.428', ops: '.759', delta: 'base', hr: 14, k: '19%', bb: '9%', fill: { kind: 'base', scale: 0.63 }, tick: 63 },
  { key: 'l', label: 'vs LHP', count: 118, avg: '.281', rest: '/.350/.470', ops: '.820', delta: '+.061', hr: 5, k: '17%', bb: '10%', fill: { kind: 'pos', scale: 0.68 }, tick: 63 },
  { key: 'r', label: 'vs RHP', count: 294, avg: '.254', rest: '/.323/.411', ops: '.734', delta: '-.025', hr: 9, k: '20%', bb: '9%', fill: { kind: 'neg', scale: 0.61 }, tick: 63 },
]
function SplitsRiseDemo() {
  return (
    <div className="splitsmod">
      <section className="splitsmod__part is-in" aria-label="By handedness, invented">
        {DEMO_SPLITS.map((l, i) => (
          <Row key={l.key} base={i === 0} i={i} line={l} layout="slash" />
        ))}
      </section>
    </div>
  )
}

export function PlayerMotionLab() {
  return (
    <>
      <Entry
        title="Player page — the rise"
        note={
          <>
            A card or a row on the player page comes up 6px as it fades in, over 420ms on the stamp
            curve, the first time it comes into view (#2073, styles/motion/player-rise.css). A row
            waits one 55ms step per place. Off under reduced motion.
          </>
        }
        live={<RiseDemo />}
      >
        <span className="animlab__stagelabel">The rise, 0 → 530ms</span>
        <div className="animlab__frozen">
          {[0, 110, 210, 320, 420, 530].map((ms) => (
            <Frame key={ms} label={`${ms}ms`} delayMs={ms}>
              <RiseDemo />
            </Frame>
          ))}
        </div>
      </Entry>
      <Entry
        title="Splits — a part rises, its bars grow"
        note={
          <>
            The player page&rsquo;s Splits card (board Splits). A part rises 14px as it first comes
            into view, then each bar grows from the left, one row after the next. A fold the reader
            opens runs the same rise on its rows. Off under reduced motion.
          </>
        }
        live={<SplitsRiseDemo />}
      />
    </>
  )
}
