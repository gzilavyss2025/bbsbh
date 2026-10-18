import { useEffect, useState } from 'react'
import { BIG_PLAY_MS } from './beats.js'
import { markPlayed, shouldPlay } from '../../../lib/motion/playOnce.js'
import { motionIsReduced } from '../../../hooks/preferences/motionIsReduced.js'

// THE STAMP'S GATE: which big play to show right now, or null.
//
// It starts only once the denotation has INKED (`inked`), never on the card's
// arrival. Before the mark prints the reader has not been told what the play
// was, and a stamp is the play's name (ADR-0046: no timing or motion before a
// reveal may be a function of the reveal). Its length is `BIG_PLAY_MS[kind]`,
// read after the mark is legible, so it leaks nothing.
//
//  • A step change drops it at once (reset during render, like
//    useDenotationBeat), so tapping on never waits for a celebration.
//  • It plays once per at-bat per page load (`seen`): stepping back to a play
//    does not replay it. A stamp cut short by the next step is marked too —
//    the reader saw it start. The mark is written in an effect, so a StrictMode
//    double render cannot spend it before it plays (playOnce.js).
//  • Reduced motion skips it outright; the denotation is the account.
const seen = new Set()

// One key per at-bat across the whole page load. `atBatIndex` restarts at 0 in
// every game, so it is never a key on its own: without a gamePk, or without
// either id, there is no key and the stamp plays (null never marks as seen).
export function playKeyFor(gamePk, entry) {
  const id = entry.playId ?? entry.atBatIndex
  return gamePk == null || id == null ? null : `${gamePk}:${id}`
}

export function useBigPlayBeat(active, beatKey, inked, kind, playKey) {
  const [shown, setShown] = useState(null)
  const [firedFor, setFiredFor] = useState(undefined)
  const [prevBeat, setPrevBeat] = useState(beatKey)
  if (beatKey !== prevBeat) {
    setPrevBeat(beatKey)
    setShown(null)
    setFiredFor(undefined)
  }
  if (active && inked && kind && firedFor !== beatKey && !motionIsReduced() && shouldPlay(playKey, seen)) {
    setFiredFor(beatKey)
    setShown(kind)
  }
  useEffect(() => {
    if (!shown) return undefined
    markPlayed(playKey, seen)
    const id = setTimeout(() => setShown(null), BIG_PLAY_MS[shown])
    return () => clearTimeout(id)
  }, [shown, playKey])
  return shown
}
