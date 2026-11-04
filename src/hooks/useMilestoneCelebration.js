import { useCallback, useState } from 'react'
import { localStore } from '../lib/account/localStore.js'
import {
  MILESTONE_CELEBRATIONS_KEY,
  hasCelebratedMilestone,
  markMilestoneCelebrated,
  parseMilestoneCelebrations,
  serializeMilestoneCelebrations,
} from '../lib/milestoneCelebrations.js'

const store = localStore(
  MILESTONE_CELEBRATIONS_KEY,
  parseMilestoneCelebrations,
  serializeMilestoneCelebrations,
)

// One milestone collection's one-shot completion-animation state
// (src/lib/milestoneCelebrations.js) — same shape as
// src/hooks/preferences/usePromptDismiss.js, one id in, `[celebrated, mark]`
// out. Not cross-tab synced on purpose, same posture as that hook: a
// completion is device-scoped, and the worst case of skipping that wiring is
// the animation playing once more in an already-open second tab.
export function useMilestoneCelebration(id) {
  const [celebrations, setCelebrations] = useState(store.read)
  const celebrated = hasCelebratedMilestone(celebrations, id)
  const celebrate = useCallback(() => {
    setCelebrations((prev) => {
      const next = markMilestoneCelebrated(prev, id)
      if (next !== prev) store.write(next)
      return next
    })
  }, [id])
  return [celebrated, celebrate]
}
