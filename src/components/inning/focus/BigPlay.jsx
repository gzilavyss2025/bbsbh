import { BigPlayStamp } from './BigPlayStamp.jsx'
import { bigPlayKind } from './bigPlay.js'
import { useBigPlayBeat } from './useBigPlayBeat.js'

// The big-play stamp for one at-bat card: classify the entry, hold the stamp
// until the denotation has inked (`inked`), and draw it. Windowed cards only.
export function BigPlay({ entry, windowed, beatKey, inked }) {
  const kind = useBigPlayBeat(windowed, beatKey, inked, bigPlayKind(entry), entry.playId ?? entry.atBatIndex)
  return kind ? <BigPlayStamp kind={kind} /> : null
}
