import { useMemo } from 'react'
import { useAsync } from '../useAsync.js'
import { fetchNotable } from '../../api/notable/notable.js'
import { buildLastTimeNotes, detectNoHitters } from '../../api/callout-notes/lastTime.js'

// The "last time" callouts (lastTime.js, ADR-0101). The feat index names results, so each hook
// fetches it only once there is a feat on screen that the reader has already revealed: a play
// card (which exists only for a revealed play) that completes a triple play or a cycle, or the
// Final box score's Insights card (which mounts inside the box score's SealBox). A card with no
// feat, and a failed load, fetch and add nothing.

// The box score's Insights notes plus the "last time" lines of a no-hitter (Final only).
export function useRollupNotes(feed, notes) {
  const feats = useMemo(() => detectNoHitters(feed), [feed])
  const { data } = useAsync(() => (feats.length ? fetchNotable() : null), [feats.length])
  return useMemo(() => {
    if (!data) return notes
    const extra = feats.flatMap((feat) => buildLastTimeNotes(data, feed, feat))
    return extra.length ? [...(notes ?? []), ...extra].sort((a, b) => b.score - a.score) : notes
  }, [data, feats, feed, notes])
}
