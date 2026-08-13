import { useEffect, useState } from 'react'
import { DENOTATION_HOLD_MS } from './beats.js'
import { motionIsReduced } from '../../../hooks/preferences/motionIsReduced.js'

// THE BEAT (ADR-0046) — the hold between a focused at-bat card arriving and
// its scorebook denotation printing, as a hook so PlayByPlay.jsx carries the
// call and not the argument.
//
// The card arrives whole except for one cell. The batter is named, the pitch
// ladder is up, the prose account is readable — and the denotation, the code
// the reader is about to pencil onto paper, is blank for DENOTATION_HOLD_MS.
// Then it lands, with a 3% scale overshoot settling to rest (the `--ink`
// class, styles/focus/atbat.css). The loop gets a downbeat instead of forty
// identical instant swaps a half.
//
// ===========================================================================
// THE HOLD IS A CONSTANT AND MUST STAY ONE
// ===========================================================================
// It is the same 180ms for a strikeout, a walk and a grand slam. A hold that
// varied with the play — scaled by pitch count, by RBI, by whether anybody
// scored, by anything read out of the entry — would announce the play in the
// length of its own pause, and a reader learns to read that inside one inning.
// That is a spoiler spelled in time rather than in DOM, and every seal on the
// screen would still be intact while it leaked.
//
// So note what this hook does NOT take: the entry, the feed, the code, the
// codeKind. Its only inputs are whether focus mode is on and which step is
// showing. Anything that weights a big play may only begin once the mark is
// already legible — at that point the reader knows, so it leaks nothing — and
// must therefore start from the ink-set's END, never from the hold's start.
// Read beats.js's header before adding an argument to any of this.
//
// It is not a gate either. Everything already revealed is on screen for the
// whole hold; `stepCap` remains the single reveal boundary (PlayByPlay.jsx's
// own header). This delays INK, not data.
//
// `active` is focus mode; outside it there is no beat at all and the card
// prints as it always has. `beatKey` is the step on screen — see PlayByPlay's
// note on why it cannot be the card's React key. Returns the class suffix for
// the denotation cells, '' when there is nothing to hold.
export function useDenotationBeat(active, beatKey) {
  const holdWanted = active && !motionIsReduced()
  const [inked, setInked] = useState(!holdWanted)
  // Reset computed during render on a step change, not in an effect — the same
  // pattern useFocusMode's half-change reset and Headshot.jsx use, and the
  // reason a repeat batter (a club batting around) still gets his hold.
  const [prevBeat, setPrevBeat] = useState(beatKey)
  if (beatKey !== prevBeat) {
    setPrevBeat(beatKey)
    setInked(!holdWanted)
  }
  useEffect(() => {
    if (inked) return undefined
    const id = setTimeout(() => setInked(true), DENOTATION_HOLD_MS)
    return () => clearTimeout(id)
  }, [inked, beatKey])
  if (!active) return ''
  // A held cell keeps its box (opacity, not display), so the diamond under the
  // top reach code never jumps up a line and back down as the mark arrives.
  return inked ? ' pbp__code--ink' : ' pbp__code--held'
}
