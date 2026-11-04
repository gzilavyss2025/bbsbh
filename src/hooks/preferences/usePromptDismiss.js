import { useCallback, useState } from 'react'
import { localStore } from '../../lib/account/localStore.js'
import {
  PROMPTS_KEY,
  hasSeenPrompt,
  markPromptSeen,
  parsePrompts,
  serializePrompts,
} from '../../lib/account/prompts.js'

const store = localStore(PROMPTS_KEY, parsePrompts, serializePrompts)

// One contextual prompt's one-shot dismissal state
// (src/lib/account/prompts.js). Every prompt in My Tally's contextual list
// (PRD §6.2 — first-stamp, third-game) is this hook
// plus its own trigger condition and copy; the store is the only part worth
// sharing. Not cross-tab synced on purpose: a dismissal is device-scoped, and
// the worst case of skipping that wiring is a prompt showing once more in an
// already-open second tab, which is harmless.
export function usePromptDismiss(id) {
  const [prompts, setPrompts] = useState(store.read)
  const dismissed = hasSeenPrompt(prompts, id)
  const dismiss = useCallback(() => {
    setPrompts((prev) => {
      const next = markPromptSeen(prev, id)
      if (next !== prev) store.write(next)
      return next
    })
  }, [id])
  return [dismissed, dismiss]
}
