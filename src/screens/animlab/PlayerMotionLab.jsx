import { useState } from 'react'
import { MenuRail } from '../../components/ui/control/MenuRail.jsx'
import { StatTile } from '../../components/ui/frame/StatTile.jsx'
import { Entry, Frame } from './Entry.jsx'
import '../../styles/player-next/pitcher/mound.css'

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
    </>
  )
}
