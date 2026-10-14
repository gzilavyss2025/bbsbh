import { useState } from 'react'
import { MenuRail } from '../../components/ui/control/MenuRail.jsx'
import { StatTile } from '../../components/ui/frame/StatTile.jsx'
import { Entry, Frame } from './Entry.jsx'
import '../../styles/player-next/pitcher/mound.css'
import '../../styles/player-next/batter/contact.css'
import '../../styles/player-next/both/splits.css'
import '../player/next/modules/splits/parts.css'
import { Row } from '../player/next/modules/splits/LineRows.jsx'
import '../../styles/player-next/pitcher/arsenal.css'
import { pitchMark } from '../../lib/pitch/pitchTypes.js'
import { ArsenalCard } from '../player/next/modules/arsenal/ArsenalCard.jsx'
import { flightPath } from '../player/next/modules/arsenal/flightView.js'
import { LEAD, totalMs } from '../player/next/modules/arsenal/timeline.js'

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

// On the mound's entrance (board MoundCard): the days-since fill draws, the Day chip stamps and
// pulses, the bars grow one after the next and their counts fade in, the average draws. The
// real classes with invented figures.
const DEMO_OUTINGS = [[10, 88], [28, 95], [46, 79], [64, 101], [82, 92]]
function MoundDemo() {
  return (
    <div className="mound mound--in">
      <div className="mound__block mound__block--track">
        <div className="mound__trk">
          <span className="mound__chip">
            <span className="mono"><b>9/30</b> · 92 P</span>
          </span>
          <span className="mound__now" style={{ left: '70%' }}>
            <span className="mound__day">Day 5</span>
          </span>
          <div className="mound__rail">
            <span className="mound__fill" style={{ width: '70%' }} />
            <span className="mound__zone" style={{ left: '70%', width: '14%' }} />
          </div>
        </div>
      </div>
      <div className="mound__block">
        <div className="mound__plot mono">
          <span className="mound__avg" style={{ bottom: '82%' }} />
          {DEMO_OUTINGS.map(([left, p], k) => (
            <span key={left} className={`mound__bar${k === DEMO_OUTINGS.length - 1 ? ' mound__bar--last' : ''}`} style={{ left: `${left}%`, width: '6%', height: `${Math.round((p / 110) * 100)}%`, '--k': k }}>
              <span className="mound__pv">{p}</span>
            </span>
          ))}
        </div>
      </div>
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

// The menu rail (#2073, slice 05): the real MenuRail on invented cards. The strip is the
// real panel body (.menurail__body--a) frozen through its rise.
const RAIL_ITEMS = [
  { key: 'one', title: 'First kind', meta: '41%', figures: 'Invented line one' },
  { key: 'two', title: 'Second kind', meta: '27%', figures: 'Invented line two' },
  { key: 'three', title: 'Third kind', meta: '19%', figures: 'Invented line three' },
]
const RAIL_BODY = <p className="hint">Invented panel text.</p>

function MenuRailDemo() {
  const [picked, setPicked] = useState(null)
  return <MenuRail label="Invented kinds" items={RAIL_ITEMS} picked={picked} onPick={setPicked} panel={() => RAIL_BODY} backLabel="All kinds" />
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

// The Arsenal card's timeline (#2073, slice 12): an invented three-pitch arm, the paths built by the real
// flightPath. Each frozen frame pins the card's clock with `at`; the live card plays from its own Replay
// (the lab's Play remounts it, but its in-view key is already seen, so it shows the last frame).
const DEMO_ARM = [
  // code, usage %, mph, rpm, [x0, z0, pfxX, pfxZ, extension, plateTime], landing { x, h } ft
  ['FF', 52, 94.1, 2310, [-1.9, 5.8, -6.5, 9.1, 6.4, 0.41], { x: 0.2, h: 3.0 }],
  ['SL', 30, 85.6, 2540, [-2.0, 5.7, 3.0, 1.0, 6.3, 0.45], { x: 0.5, h: 2.0 }],
  ['CH', 18, 86.2, 1750, [-1.9, 5.7, -7.5, 4.0, 6.3, 0.45], { x: -0.4, h: 1.8 }],
]
const DEMO_ROWS = DEMO_ARM.map(([code, pct, velo, spin, [x0, z0, pfxX, pfxZ, extension, plateTime], landing]) => ({
  code,
  mark: pitchMark(code),
  pitches: 100,
  pct,
  velo,
  spin,
  flight: plateTime,
  whiffPct: null,
  xwoba: null,
  landing,
  path: flightPath({ x0, z0, pfxX, pfxZ, extension, plateTime }, landing),
}))
const DEMO_END = totalMs(DEMO_ROWS.map((r) => ({ code: r.code, ft: r.path.T, rpm: r.spin })), 3)

function ArsenalTimelineEntry() {
  return (
    <Entry
      title="Pitch arsenal: the timeline"
      note={
        <>
          The Arsenal card (#2073, modules/arsenal/timeline.js): one clock draws the mix bar, the menu rows and
          the side view. {LEAD}ms of build-up, then every pitch leaves the one release point at one-third speed.
          Press the card&rsquo;s own Replay. Reduced motion shows the last frame.
        </>
      }
      live={<ArsenalCard rows={DEMO_ROWS} id="animlab" />}
    >
      <span className="animlab__stagelabel">The timeline, 0 → {DEMO_END}ms</span>
      <div className="animlab__frozen">
        {[0, 300, LEAD, 1100, 1500, 2000, DEMO_END].map((ms) => (
          <Frame key={ms} label={`${ms}ms`}>
            <ArsenalCard rows={DEMO_ROWS} id={`animlab-${ms}`} at={ms} />
          </Frame>
        ))}
      </div>
    </Entry>
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
      <Entry
        title="Menu rail — unfold, fold and rise"
        note={
          <>
            The shared menu (#2073, styles/motion/menurail.css). Tap a card: the row folds into a rail and the
            panel opens over 400ms on the unfold curve; the panel body rises 8px as it fades in, 380ms on the
            stamp curve, and again on every new pick. Tap the picked card: the content stays while the panel
            folds. Off under reduced motion.
          </>
        }
        live={<MenuRailDemo />}
      >
        <span className="animlab__stagelabel">The rise on a pick, 0 → 380ms</span>
        <div className="animlab__frozen">
          {[0, 95, 190, 285, 380].map((ms) => (
            <Frame key={ms} label={`${ms}ms`} delayMs={ms}>
              <div className="menurail__body menurail__body--a">{RAIL_BODY}</div>
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
      <Entry
        title="On the mound — the card comes in"
        note={
          <>
            The pitcher&rsquo;s On the mound card (board MoundCard). The days-since fill draws, the
            Day chip stamps, then pulses four times and rests; the outing bars grow one after the
            next, their counts fade in, and the average line draws. Off under reduced motion.
          </>
        }
        live={<MoundDemo />}
      />
      <ArsenalTimelineEntry />
    </>
  )
}
