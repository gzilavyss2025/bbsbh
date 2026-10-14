import { StatTile } from '../../components/ui/frame/StatTile.jsx'
import { Entry, Frame } from './Entry.jsx'
import '../../styles/player-next/batter/contact.css'

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

// The Contact dots drop in (#2073, slice 17a): the real .fcontact__dots and .fcontact__dot
// classes on the card's own viewBox. The spots are invented.
const DROP_DOTS = [
  [250, 330, 'out'], [330, 300, 'single'], [420, 250, 'double'], [190, 260, 'out'],
  [300, 180, 'hr'], [470, 330, 'single'], [140, 340, 'triple'], [380, 160, 'hr'],
]
function ContactDropDemo() {
  return (
    <svg className="fcontact__field" viewBox="10 40 600 485" aria-hidden="true">
      <g className="fcontact__dots fcontact__dots--play fcontact__dots--a">
        {DROP_DOTS.map(([cx, cy, k], i) => (
          <circle
            key={i}
            className={`fcontact__dot fcontact__dot--${k}`}
            cx={cx}
            cy={cy}
            r={k === 'hr' ? 11 : 9}
            style={{ '--fcontact-f': (i / (DROP_DOTS.length - 1)).toFixed(3) }}
          />
        ))}
      </g>
    </svg>
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
        title="Contact — the dots drop in"
        note={
          <>
            The batter Contact field (#2073). Each dot scales from 2.4 to 1 and fades in over 460ms on the
            stamp curve, staggered across the set over 620ms. A view or type pick plays it again. Off under
            reduced motion.
          </>
        }
        live={<ContactDropDemo />}
      >
        <span className="animlab__stagelabel">The drop, 0 → 1080ms</span>
        <div className="animlab__frozen">
          {[0, 150, 300, 600, 900, 1080].map((ms) => (
            <Frame key={ms} label={`${ms}ms`} delayMs={ms}>
              <ContactDropDemo />
            </Frame>
          ))}
        </div>
      </Entry>
    </>
  )
}
