import { useCallback, useState } from 'react'
import {
  MILESTONE_CELEBRATIONS_KEY,
  hasCelebratedMilestone,
  markMilestoneCelebrated,
  parseMilestoneCelebrations,
  serializeMilestoneCelebrations,
} from '../lib/milestoneCelebrations.js'

function readCelebrations() {
  try {
    return parseMilestoneCelebrations(window.localStorage.getItem(MILESTONE_CELEBRATIONS_KEY))
  } catch {
    return {}
  }
}

function writeCelebrations(map) {
  try {
    window.localStorage.setItem(MILESTONE_CELEBRATIONS_KEY, serializeMilestoneCelebrations(map))
  } catch {
    // Private mode — the mark still applies for the rest of this visit, via
    // the React state the caller holds.
  }
}

// One milestone collection's one-shot completion-animation state
// (src/lib/milestoneCelebrations.js) — same shape as
// src/hooks/preferences/usePromptDismiss.js, one id in, `[celebrated, mark]`
// out. Not cross-tab synced on purpose, same posture as that hook: a
// completion is device-scoped, and the worst case of skipping that wiring is
// the animation playing once more in an already-open second tab.
export function useMilestoneCelebration(id) {
  const [celebrations, setCelebrations] = useState(readCelebrations)
  const celebrated = hasCelebratedMilestone(celebrations, id)
  const celebrate = useCallback(() => {
    setCelebrations((prev) => {
      const next = markMilestoneCelebrated(prev, id)
      if (next !== prev) writeCelebrations(next)
      return next
    })
  }, [id])
  return [celebrated, celebrate]
}
