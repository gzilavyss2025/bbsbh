// The bracket above the slate cards, MLB only, for every date in the
// postseason window (#1224, slice 5). Folded by default — Concept D's picked
// look: Concept B's ticket fold, Concept A's full "back page" bracket behind
// "Open the bracket". GameSelect.jsx owns the fetch (usePostseasonBracket)
// and the window check (isPostseasonWindow); this component only draws what
// it is handed, plus its own read of postseason-history.json for seriesHref
// (trap 7 — a series links to the finished page only once that file holds
// its id).
import '../../styles/80-postseason-bracket.css'
import { useMemo, useState } from 'react'
import { useAsync } from '../../hooks/useAsync.js'
import { loadPostseasonHistory } from '../../api/postseasonHistory.js'
import { BracketFold } from './BracketFold.jsx'
import { FullBracket } from './FullBracket.jsx'
import { bracketOpensByItself } from '../../lib/postseason/bracketDisplay.js'

function historyIdsFrom(history) {
  const ids = new Set()
  for (const season of history?.seasons ?? []) {
    for (const round of season.rounds ?? []) {
      for (const series of round.series ?? []) if (series.id) ids.add(series.id)
    }
  }
  return ids
}

// On a day with no postseason game (an off day, or the champion's days before
// the offseason page), the full bracket is the page: it is always open, and
// there is no door to close it (Gary, 2026-09-28). `autoOpen={false}` keeps it
// folded, for the offseason page's Season record row. `slateDate` is the day
// the slate shows; a day after today reads today's bracket, with no tickets.
export function PostseasonBracket({ bracket, cutoff, slateDate = null, autoOpen = true }) {
  // null = the day's default; a tap sets it.
  const [choice, setChoice] = useState(null)
  // Re-seal on a day change (a different cutoff), computed during render —
  // the same pattern GameSelect.jsx uses for its own per-day resets, rather
  // than an effect.
  const [prevCutoff, setPrevCutoff] = useState(cutoff)
  if (cutoff !== prevCutoff) {
    setPrevCutoff(cutoff)
    setChoice(null)
  }
  const history = useAsync(() => loadPostseasonHistory(), [])
  const historyIds = useMemo(() => historyIdsFrom(history.data), [history.data])

  if (!bracket) return null
  const alwaysOpen = autoOpen && bracketOpensByItself(bracket, slateDate)
  const open = alwaysOpen || (choice ?? false)

  return (
    <section className="pbkt" aria-label="Postseason">
      <BracketFold
        bracket={bracket}
        cutoff={cutoff}
        slateDate={slateDate}
        historyIds={historyIds}
        open={open}
        showDoor={!alwaysOpen}
        onToggle={() => setChoice(!open)}
      />
      {open && <FullBracket bracket={bracket} cutoff={cutoff} historyIds={historyIds} />}
    </section>
  )
}
