import { useEffect, useRef } from 'react'
import { selectGameRosterIds } from '../api/select.js'
import { prefetchHeadshots } from '../lib/prefetchHeadshots.js'

// Warms the headshot CDN for every face that could show up in the at-bat
// feed — both teams' full box score rosters (starters, bench, bullpen) — the
// moment a game has something to step through (InningViewer passes `ready`
// as `firstPitchThrown`). Roster membership is spoiler-free
// (selectGameRosterIds, same footing as selectBullpen/selectBench), so this
// needs no reveal gate of its own.
//
// `warmedIds` dedupes across re-renders and feed refetches so a live game's
// periodic reload doesn't reissue an Image() fetch for a face already
// warmed; new ids (a late roster move) are still picked up on the next feed
// update.
export function useHeadshotPrefetch(feed, ready) {
  const warmedIds = useRef(new Set())
  useEffect(() => {
    if (!ready) return
    const fresh = selectGameRosterIds(feed).filter((id) => !warmedIds.current.has(id))
    if (!fresh.length) return
    fresh.forEach((id) => warmedIds.current.add(id))
    prefetchHeadshots(fresh)
  }, [feed, ready])
}
