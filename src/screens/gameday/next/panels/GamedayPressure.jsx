import { SealBox } from '../../../../components/SealBox.jsx'
import { PressureMeter } from '../../../../components/charts/PressureMeter.jsx'
import { useAsync } from '../../../../hooks/useAsync.js'
import { fetchWinProbability } from '../../../../api/game.js'
import { selectLastLi, selectWinProbPath } from '../../../../api/winprob.js'
import { loadCutoffs, pressureLabel, tenseBars } from '../../../../api/tensest/tenseBars.js'
import { reachOf } from './GamedaySheets.jsx'

// Gameday's Pressure meter (#3006): how tense the last play the reader revealed
// was, against the whole season. Phone: beside the hero's scorebook box. Desktop
// (L, D): its own card above the pitcher's. The play's leverage is score-revealing
// (a full meter in the 9th says the game is close), so it is read only inside a
// SealBox reveal function, through selectWinProbPath's step clamp: the same `at`
// the Win % sheet uses (GamedaySheets.jsx). Nothing revealed: a dark, empty meter.
export function GamedayPressure({ ctx }) {
  const pk = ctx.feed?.gamePk
  const reach = reachOf(ctx)
  // Read again as the reveal moves, so a live game's newest plays are there; the
  // last answer stays on screen while the next one loads (useAsync), so no flash.
  const { data: wp } = useAsync(() => (pk ? fetchWinProbability(pk) : Promise.resolve(null)), [pk, ctx.mark, reach?.here, reach?.cut])
  const { data: cutoffs } = useAsync(() => loadCutoffs(), [])
  if (!reach || !wp || !cutoffs) return <PressureMeter big bars={null} />
  return (
    <SealBox key={`${ctx.inning}-${ctx.half}`} forceRevealed coverless>
      {() => {
        const at = { throughHalf: ctx.mark ?? -1, stepHalfIndex: reach.here, throughAtBatIndex: reach.cut }
        const bars = tenseBars(selectLastLi(selectWinProbPath(wp, at)), cutoffs)
        return (
          <>
            <PressureMeter big bars={bars} cutoffs={cutoffs} />
            {/* The words, once per reveal, for a screen reader. */}
            <p className="sr-only" role="status">{bars ? `${pressureLabel(bars, cutoffs)}, last play.` : ''}</p>
          </>
        )
      }}
    </SealBox>
  )
}
