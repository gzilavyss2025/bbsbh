import { useRef, useState } from 'react'
import { motionIsReduced } from '../../../../hooks/preferences/motionIsReduced.js'
import { sealTearSeed } from '../../../../lib/sealTear.js'
import { TURN_IDLE, turnStep } from '../../../../lib/scorecard/turn.js'

// The lens's one-shot motion (#724 L7, docs/motion.md): what a tap in the lens
// sets going, and nothing else. The look of each beat is CSS
// (styles/motion/scorecard-lens.css); this hook only says WHEN.
//
// THE GATE IS THE TAP (G13). `beat` is set by a reveal tap and by nothing
// else, so a cold load, a poll, a return visit and a force-reveal (the lens is
// off then) start none of it. It is the existing `armed` gate made narrower: it
// is cleared when the reader leaves the lens or the page turns, so a beat never
// plays again on a sheet the reader comes back to. It carries:
//  • `n`, the tap's number: useLens glides the pane when it is new, and the
//    runner-move tint remounts on it, so a runner moved by two plays in a row
//    fades twice;
//  • `at`, the box the tap opened (`slot:colIndex` of the old frontier), where
//    the seal's two halves fly off (LensTear.jsx);
//  • `seed`, the tear's split line: lib/sealTear.js's seed for this game and
//    half, plus 1000 per at-bat of the half, so no two seals of a game share
//    one, and this seal tears like every other seal in the app;
//  • `still`: reduced motion at the tap. No tear and no glide then, and the
//    runner tint holds still until the next tap.
//
// THE PAGE TURN. `turn(fn)` runs the turn's out beat, then `fn` (the side
// switch), then the in beat; `onAnimationEnd` steps it. Under reduced motion
// `fn` runs at once. The tap lock (ScorecardPage) is a constant 700 ms, longer
// than both beats, and it never reads what the tap did (ADR-0046). The steps
// are lib/scorecard/turn.js's turnStep: if the reader leaves the lens in the
// out beat, the switch still runs, at once (the out beat's end never comes).
//
// THE QUIET SEAL. At the live edge the frontier is the AT BAT box. When a poll
// brings that at-bat's end, the seal takes the box's place with no breath
// (`quiet`): the feed often runs ahead of the TV picture, so it must not call
// for a tap. The next tap moves the frontier, and the next seal breathes.
export function useLensMotion({ lens, side, frontier, edge }) {
  const taps = useRef(0)
  const [beat, setBeat] = useState(null)
  const [turn, setTurn] = useState(TURN_IDLE)
  const step = (event) => {
    const next = turnStep(turn, event)
    setTurn(next)
    next.run?.()
  }
  const [was, setWas] = useState({ lens, side })
  if (was.lens !== lens || was.side !== side) {
    setWas({ lens, side })
    setBeat(null)
    if (was.lens !== lens) step({ type: 'leave' })
  }

  const at = frontier ? `${frontier.slot}:${frontier.colIndex}` : null
  const [edgeAt, setEdgeAt] = useState(null)
  if (edge && edgeAt !== `${side}:${at}`) setEdgeAt(`${side}:${at}`)

  return {
    beat,
    turning: turn.turning,
    quiet: !edge && edgeAt === `${side}:${at}`,
    tapped(gamePk, halfIndex, count) {
      taps.current += 1
      const seed = sealTearSeed(gamePk, halfIndex) + 1000 * count
      setBeat({ n: taps.current, at, seed, still: motionIsReduced() })
    },
    turn(fn) {
      if (motionIsReduced()) return fn()
      step({ type: 'start', fn })
    },
    onAnimationEnd(e) {
      step({ type: 'end', name: e.animationName })
    },
  }
}
