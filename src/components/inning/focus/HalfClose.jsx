import { revealInning } from '../../../api/linescore.js'
import { SealBox } from '../../SealBox.jsx'
import { HalfCloseRule } from './HalfCloseRule.jsx'

// The closed half's four figures, for focus mode's closing rule (ADR-0046).
// HalfCloseRule.jsx draws it; this reads it.
//
// SPOILER FOOTING — identical to HalfTally.jsx's, deliberately, because it is
// the same read at the same moment. `revealInning` is reveal-only (ADR-0001):
// callable only from inside a SealBox's reveal render function, never at
// render top level. That is exactly the shape below. The caller mounts this
// only for a half at or under the reveal mark AND only in the post-half hold,
// so `forceRevealed` states a fact rather than bypassing one, and
// `api/spoiler-manifest.json` lists this file on that module's importer
// allowlist.
//
// R/H/LOB are the batting side's; E is a FIELDING stat and belongs to the side
// in the field this half (ADR-0006) — the same pairing StatBox and HalfTally
// make, and the same trap if it is copied carelessly.
//
// THE SEQUENCE MAY NOT START BEFORE THE HALF COMMITS, which is why nothing
// here decides when it runs: `phase` is handed down from useFocusMode, whose
// `postHalf` is the commit itself. A rule that began drawing a beat early
// would say the third out had been recorded on a half the reader has not
// finished stepping, which is the same spoiler as printing the run — just
// spelled in time (see beats.js).
export function HalfClose({ feed, inning, half, battingSide, phase, doubleRule = false }) {
  return (
    // Keyed on the half, same idiom HalfTally uses: this component is mounted
    // and unmounted by `postHalf` today, so nothing can currently outlive a
    // half change — the key makes that a property of the component rather than
    // of one call site, which is the discipline every SealBox on this screen
    // keeps (ADR-0002).
    <SealBox key={`${inning}-${half}`} forceRevealed coverless>
      {() => {
        const line = revealInning(feed, inning, battingSide)
        const fieldLine = revealInning(feed, inning, battingSide === 'away' ? 'home' : 'away')
        return (
          <HalfCloseRule
            phase={phase}
            doubleRule={doubleRule}
            figures={[
              { k: 'R', v: line?.runs ?? 0 },
              { k: 'H', v: line?.hits ?? 0 },
              { k: 'E', v: fieldLine?.errors ?? 0 },
              { k: 'LOB', v: line?.leftOnBase ?? 0 },
            ]}
          />
        )
      }}
    </SealBox>
  )
}
