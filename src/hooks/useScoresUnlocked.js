import { useCallback, useEffect, useState } from 'react'
import { isUnlocked, msUntilReset, nextResetAt } from '../lib/scoresUnlocked.js'
import { toApiDate } from '../lib/dates.js'
import {
  SPOILED_DAYS_KEY,
  addSpoiledDay,
  isDaySpoiled,
  parseSpoiledDays,
  removeSpoiledDay,
  serializeSpoiledDays,
} from '../lib/spoiledDays.js'

// The site-wide "Scores Unlocked" pass (ADR-0026) — the app's one opt-in
// departure from the spoiler rule. This hook is its single React entry point; it
// never touches or reads a score, only consent state.
//
// TWO pieces of state, and the distinction is the whole design:
//
//   1. bbsbh:scoresUnlocked — the ACTIVE pass, stored as an EXPIRY timestamp
//      (never a boolean). `passActive` is true only while now < expiry and the
//      value is in-window, so it fails sealed on anything malformed, stale, or
//      left running overnight. While it's on, everything renders unsealed and a
//      live game you open keeps pace with itself.
//
//   2. bbsbh:spoiledDays — the DAYS you consented to (src/lib/spoiledDays.js).
//      Durable. 8am doesn't mean "everything re-seals", it means "the pass stops
//      applying to NEW days" — a day you agreed to spoil stays open, because
//      pretending the next morning that you might still hand-score it is a
//      fiction.
//
// Neither is a reveal mark. Nothing here writes `revealedThrough`, so no amount
// of using the pass can corrupt, advance, or cloud-sync what you uncovered by
// hand. See effectiveReveal's `commitReveals` for the other end of that promise.
//
// Three things keep the expiry honest against a backgrounded tab:
//   - a `storage` listener re-reads when another same-device tab flips it;
//   - a `visibilitychange` re-check re-evaluates on foreground, because mobile
//     Safari suspends/throttles timers and the armed timeout may never fire;
//   - the armed timeout expires a foregrounded tab exactly at 8am.
// Every path funnels through refresh(), which also deletes an expired key so a
// stale value can't linger.

export const SCORES_UNLOCKED_KEY = 'bbsbh:scoresUnlocked'

function readKey(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeKey(key, value) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Private mode / storage disabled — the in-session state still applies to
    // this tab, same degrade as every other preference hook.
  }
}

function dropKey(key) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore — the value is already treated as sealed
  }
}

export function useScoresUnlocked() {
  const [expiry, setExpiry] = useState(() => readKey(SCORES_UNLOCKED_KEY))
  const [days, setDays] = useState(() => parseSpoiledDays(readKey(SPOILED_DAYS_KEY)))

  // Re-read storage and normalize: an expired/garbage expiry is cleared and
  // collapsed to null, so `passActive` below can trust `expiry`. The day list is
  // re-parsed at the same time so a cross-tab consent shows up here too.
  const refresh = useCallback(() => {
    let cur = readKey(SCORES_UNLOCKED_KEY)
    if (cur != null && !isUnlocked(cur)) {
      dropKey(SCORES_UNLOCKED_KEY)
      cur = null
    }
    setExpiry(cur)
    setDays(parseSpoiledDays(readKey(SPOILED_DAYS_KEY)))
  }, [])

  // Consent: start the pass AND record today as a day the user agreed to see
  // plainly. Recording it now (rather than at the 8am rollover) is what makes the
  // promise durable even if this tab never survives to see 8am.
  const enable = useCallback(() => {
    const at = String(nextResetAt())
    writeKey(SCORES_UNLOCKED_KEY, at)
    setExpiry(at)
    const today = toApiDate(new Date())
    setDays((prev) => {
      const next = addSpoiledDay(prev, today)
      writeKey(SPOILED_DAYS_KEY, serializeSpoiledDays(next))
      return next
    })
  }, [])

  // Turning the pass off the same day takes the consent back — this is what makes
  // an accidental tap on the confirm button recoverable. It only ever un-does
  // TODAY: an older day, already locked in when its pass expired, is never passed
  // to removeSpoiledDay and so can't be walked back from here.
  const disable = useCallback(() => {
    dropKey(SCORES_UNLOCKED_KEY)
    setExpiry(null)
    const today = toApiDate(new Date())
    setDays((prev) => {
      const next = removeSpoiledDay(prev, today)
      writeKey(SPOILED_DAYS_KEY, serializeSpoiledDays(next))
      return next
    })
  }, [])

  // Clean up an expired value on mount (state may have initialized to a stale one).
  useEffect(() => {
    refresh()
  }, [refresh])

  // Cross-tab: pick up another tab's consent/withdrawal live.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === SCORES_UNLOCKED_KEY || e.key === SPOILED_DAYS_KEY || e.key === null) refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  // Foreground re-check — mandatory, since a timer armed hours ago may have been
  // suspended while the tab was backgrounded (mobile Safari).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  // Arm a timer to expire the pass exactly at 8am for a tab that stays foregrounded.
  useEffect(() => {
    const ms = msUntilReset(expiry)
    if (ms == null) return undefined
    const id = setTimeout(refresh, ms + 100)
    return () => clearTimeout(id)
  }, [expiry, refresh])

  const passActive = isUnlocked(expiry)
  // The predicate every game surface asks: should THIS date render plainly? True
  // while the pass is running (any game you open during the window), and true
  // forever after for a day you consented to.
  const spoilersOffFor = useCallback(
    (dateStr) => passActive || isDaySpoiled(days, dateStr),
    [passActive, days],
  )

  return {
    passActive,
    resetAt: passActive ? Number(expiry) : null,
    spoiledDays: days,
    spoilersOffFor,
    enable,
    disable,
  }
}
