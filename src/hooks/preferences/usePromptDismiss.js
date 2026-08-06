import { useCallback, useState } from 'react'
import {
  PROMPTS_KEY,
  hasSeenPrompt,
  markPromptSeen,
  parsePrompts,
  serializePrompts,
} from '../../lib/account/prompts.js'

function readPrompts() {
  try {
    return parsePrompts(window.localStorage.getItem(PROMPTS_KEY))
  } catch {
    return {}
  }
}

function writePrompts(map) {
  try {
    window.localStorage.setItem(PROMPTS_KEY, serializePrompts(map))
  } catch {
    // Private mode — the dismissal still applies for the rest of this visit,
    // via the React state the caller holds.
  }
}

// One contextual prompt's one-shot dismissal state
// (src/lib/account/prompts.js). Every prompt in My Tally's contextual list
// (PRD §6.2 — first-stamp, third-game, scores-unlocked-local) is this hook
// plus its own trigger condition and copy; the store is the only part worth
// sharing. Not cross-tab synced on purpose: a dismissal is device-scoped, and
// the worst case of skipping that wiring is a prompt showing once more in an
// already-open second tab, which is harmless.
export function usePromptDismiss(id) {
  const [prompts, setPrompts] = useState(readPrompts)
  const dismissed = hasSeenPrompt(prompts, id)
  const dismiss = useCallback(() => {
    setPrompts((prev) => {
      const next = markPromptSeen(prev, id)
      if (next !== prev) writePrompts(next)
      return next
    })
  }, [id])
  return [dismissed, dismiss]
}
