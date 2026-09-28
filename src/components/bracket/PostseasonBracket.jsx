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

function historyIdsFrom(history) {
  const ids = new Set()
  for (const season of history?.seasons ?? []) {
    for (const round of season.rounds ?? []) {
      for (const series of round.series ?? []) if (series.id) ids.add(series.id)
    }
  }
  return ids
}

export function PostseasonBracket({ bracket, cutoff }) {
  const [open, setOpen] = useState(false)
  // Re-seal on a day change (a different cutoff), computed during render —
  // the same pattern GameSelect.jsx uses for its own per-day resets, rather
  // than an effect.
  const [prevCutoff, setPrevCutoff] = useState(cutoff)
  if (cutoff !== prevCutoff) {
    setPrevCutoff(cutoff)
    setOpen(false)
  }
  const history = useAsync(() => loadPostseasonHistory(), [])
  const historyIds = useMemo(() => historyIdsFrom(history.data), [history.data])

  if (!bracket) return null

  return (
    <section className="pbkt" aria-label="Postseason">
      <BracketFold
        bracket={bracket}
        cutoff={cutoff}
        historyIds={historyIds}
        open={open}
        onToggle={() => setOpen((o) => !o)}
      />
      {open && <FullBracket bracket={bracket} cutoff={cutoff} historyIds={historyIds} />}
    </section>
  )
}
