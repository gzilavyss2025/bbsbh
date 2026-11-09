import { useEffect, useRef, useState } from 'react'
import { SealBox } from '../../../../components/SealBox.jsx'
import { PressureMeter } from '../../../../components/charts/PressureMeter.jsx'
import { useAsync } from '../../../../hooks/useAsync.js'
import { fetchWinProbability } from '../../../../api/winprob/feed.js'
import { selectLastLi, selectWinProbPath } from '../../../../api/winprob.js'
import { loadCutoffs, pressureLabel, tenseBars } from '../../../../api/tensest/tenseBars.js'
import { reachOf } from './GamedaySheets.jsx'

// Gameday's Pressure meter (#3006): how tense the last play the reader revealed
// was, against the whole season. Phone: a row on the hero's floor, over the trail.
// Tablet: its own row over the stage. Desktop (L, D): its own card above the
// pitcher's. The play's leverage is score-revealing (a full meter in the 9th says
// the game is close), so it is read only inside a SealBox reveal function, through
// selectWinProbPath's step clamp: the same `at` the Win % sheet uses
// (GamedaySheets.jsx). Nothing revealed: a dark, empty meter, and nothing fetched.
export function GamedayPressure({ ctx }) {
  const pk = ctx.feed?.gamePk
  const reach = reachOf(ctx)
  // Fetched only once a play can show (never fetched-then-hidden). A final game's
  // feed is read once; a live one is read again as the reveal moves, so its newest
  // plays are there. That re-read is useAsync's `reload`, which keeps the last answer
  // on screen while the next loads; a deps change would blank the meter (#2925).
  const live = ctx.feed?.gameData?.status?.abstractGameState !== 'Final'
  const step = reach && live ? `${ctx.mark}:${reach.here}:${reach.cut}` : null
  // The read is shared (api/winprob/feed.js): a final game's feed once for the visit; a live one
  // fresh on every step (maxAgeMs 0), which the Win % sheet then reuses.
  const opts = live ? { maxAgeMs: 0 } : { final: true }
  const { data: wp, reload } = useAsync(() => (pk && reach ? fetchWinProbability(pk, opts) : Promise.resolve(null)), [pk, !!reach])
  const firstStep = useRef(step)
  useEffect(() => {
    if (step == null || step === firstStep.current) return
    firstStep.current = step
    reload()
  }, [step, reload])
  const { data: cutoffs } = useAsync(() => loadCutoffs(), [])
  // One live region for the whole page visit, so each new reading is announced.
  const [said, setSaid] = useState('')
  return (
    <>
      {!reach || !wp || !cutoffs ? <PressureMeter big bars={null} /> : (
        <SealBox key={`${ctx.inning}-${ctx.half}`} forceRevealed coverless>
          {() => {
            const at = { throughHalf: ctx.mark ?? -1, stepHalfIndex: reach.here, throughAtBatIndex: reach.cut }
            const bars = tenseBars(selectLastLi(selectWinProbPath(wp, at)), cutoffs)
            return (
              <>
                <PressureMeter big bars={bars} cutoffs={cutoffs} />
                <Announce say={setSaid} text={bars ? `${pressureLabel(bars, cutoffs)}, last play.` : ''} />
              </>
            )
          }}
        </SealBox>
      )}
      {/* Only while a reading is on screen: never a reading from another position. */}
      <p className="sr-only" role="status">{reach && wp && cutoffs ? said : ''}</p>
    </>
  )
}

// Hands the words up to the page's one status line after a reveal renders.
function Announce({ say, text }) {
  useEffect(() => { say(text) }, [say, text])
  return null
}
