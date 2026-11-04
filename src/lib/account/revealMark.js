import { parseRevealMark } from '../../hooks/revealProgressCore.js'
import { REVEAL_MARK_PREFIX } from './revealOwner.js'

// The per-game reveal high-water mark's key prefix and storage reader, split out
// of useRevealProgress.js so a surface that only asks "has this game been
// started?" (offseason PickedGame, ClassicCard) does not pull the hook's
// derive.js/linescore.js graph into its chunk (#2879). Reads the stored
// half-index only, never a score; the fail-closed parse is parseRevealMark.
export const REVEAL_KEY = REVEAL_MARK_PREFIX

export function readRevealMark(storageKey) {
  if (!storageKey) return -1
  try {
    return parseRevealMark(window.localStorage.getItem(storageKey))
  } catch {
    return -1
  }
}

// This device's persisted mark for one game, read WITHOUT mounting the hook.
// -1 for an unknown game, an unset key, or a mangled value — "nothing revealed".
export function readRevealMarkFor(gamePk) {
  return gamePk ? readRevealMark(`${REVEAL_KEY}${gamePk}`) : -1
}
