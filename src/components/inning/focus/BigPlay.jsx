import { createPortal } from 'react-dom'
import { BigPlayStamp } from './BigPlayStamp.jsx'
import { bigPlayKind } from './bigPlay.js'
import { playKeyFor, useBigPlayBeat } from './useBigPlayBeat.js'

// The big-play stamp for one at-bat card: classify the entry, hold the stamp
// until the denotation has inked (`inked`), and draw it. Windowed cards only.
// It portals to <body>: the stamp is a fixed overlay, and a transformed or
// filtered ancestor (the card's own deal, a page turn) would otherwise pin it
// to the card instead of the viewport.
export function BigPlay({ entry, gamePk, windowed, beatKey, inked }) {
  const kind = useBigPlayBeat(windowed, beatKey, inked, bigPlayKind(entry), playKeyFor(gamePk, entry))
  return kind ? createPortal(<BigPlayStamp kind={kind} />, document.body) : null
}
