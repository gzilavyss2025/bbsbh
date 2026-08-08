import { useCallback, useEffect, useState } from 'react'
import { gameDayAt, isUnlocked, msUntilReset, nextResetAt } from '../lib/scoresUnlocked.js'
import {
  SPOILED_DAYS_KEY,
  addSpoiledDay,
  applyRemoteStates,
  isDaySpoiled,
  isDayString,
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

// A same-tab echo of the `storage` event. The browser fires `storage` only in
// OTHER tabs, so without this, two mounted instances of this hook (the slate and
// a game view, or the cloud-sync component) would not see each other's writes
// until a reload. Dispatching the event ourselves lets the listener below serve
// as the single refresh path for every source — another tab, this tab, or the
// cloud merge — instead of each one needing its own wiring.
function notifyLocalChange(key) {
  try {
    window.dispatchEvent(new StorageEvent('storage', { key }))
  } catch {
    // StorageEvent unavailable (very old browsers) — cross-instance updates
    // degrade to next-render/next-load. Nothing is lost, only immediacy.
  }
}

export function useScoresUnlocked() {
  const [expiry, setExpiry] = useState(() => readKey(SCORES_UNLOCKED_KEY))
  const [days, setDays] = useState(() => parseSpoiledDays(readKey(SPOILED_DAYS_KEY)))

  // Re-read storage and normalize: an expired/garbage expiry is cleared and
  // collapsed to null, so `passActive` below can trust `expiry`. The day list is
  // re-parsed at the same time so a cross-tab consent shows up here too.
  //
  // THE TWO READS ARE NOT SYMMETRIC, and the asymmetry is the load-bearing part.
  // This function is the same-tab echo's landing point, so it runs SYNCHRONOUSLY
  // inside `enable`/`disable`, right after those queue their state updates and
  // before React has applied any of them:
  //
  //   - The EXPIRY key is written (or dropped) synchronously by both, BEFORE
  //     they notify. Reading it eagerly here is therefore already correct.
  //   - The DAY MAP is not. It is persisted from INSIDE the `setDays` updater
  //     below, which React runs at render time — after this listener has already
  //     run. An eager `parseSpoiledDays(readKey(...))` would read the map as it
  //     stood BEFORE the change and queue that stale value behind the change,
  //     so React would apply the updater and then revert it, leaving state stale
  //     while localStorage held the new value.
  //
  // What that cost was the one thing this pass promises is cheap: turning it
  // back off did not re-seal the day until a reload, because `days` still
  // carried today and `spoilersOffFor` reads it. Same defect, same fix, as
  // useStamps.js's storage listener — read from INSIDE the updater, which puts
  // the read after the write rather than in front of it.
  const refresh = useCallback(() => {
    let cur = readKey(SCORES_UNLOCKED_KEY)
    if (cur != null && !isUnlocked(cur)) {
      dropKey(SCORES_UNLOCKED_KEY)
      cur = null
    }
    setExpiry(cur)
    setDays(() => parseSpoiledDays(readKey(SPOILED_DAYS_KEY)))
  }, [])

  // Consent: start the pass AND record the current GAME day as a day the user
  // agreed to see plainly. Recording it now (rather than at the 8am rollover) is
  // what makes the promise durable even if this tab never survives to see 8am.
  //
  // gameDayAt, not the calendar date: the day recorded must be the day the pass
  // covers, and between midnight and 8am those differ. Read that function's
  // header — pairing `nextResetAt` with `toApiDate(new Date())` is what let a
  // 1am consent permanently unseal a whole day of unplayed baseball.
  const enable = useCallback(() => {
    const at = String(nextResetAt())
    writeKey(SCORES_UNLOCKED_KEY, at)
    setExpiry(at)
    const day = gameDayAt()
    setDays((prev) => {
      const next = addSpoiledDay(prev, day)
      writeKey(SPOILED_DAYS_KEY, serializeSpoiledDays(next))
      return next
    })
    notifyLocalChange(SCORES_UNLOCKED_KEY)
    notifyLocalChange(SPOILED_DAYS_KEY)
  }, [])

  // Turning the pass off takes the consent back — this is what makes an
  // accidental tap on the confirm button recoverable. Symmetric with `enable`:
  // it un-does the current GAME day, so a consent given at 11pm is still
  // walk-back-able at 1am. An older day, already locked in when its pass
  // expired, is never passed to removeSpoiledDay and so can't be reached here.
  //
  // `alsoDay` is the one exception, and it exists for a state this device may
  // not have created: a day mirrored in as 'on' by another device's consent
  // (SpoiledDaysCloudSync), which unseals the slate here with no local pass
  // behind it. The slate's switch passes the date it is actually showing so
  // that day can be re-sealed from the surface it is unsealing — see
  // GameSelect.jsx. Ignored unless it is a real YYYY-MM-DD, because the profile
  // page wires this straight to onClick and would otherwise hand it an event.
  const disable = useCallback((alsoDay = null) => {
    dropKey(SCORES_UNLOCKED_KEY)
    setExpiry(null)
    const day = gameDayAt()
    setDays((prev) => {
      let next = removeSpoiledDay(prev, day)
      if (isDayString(alsoDay)) next = removeSpoiledDay(next, alsoDay)
      writeKey(SPOILED_DAYS_KEY, serializeSpoiledDays(next))
      return next
    })
    notifyLocalChange(SCORES_UNLOCKED_KEY)
    notifyLocalChange(SPOILED_DAYS_KEY)
  }, [])

  // The only way a remote state map reaches local state (SpoiledDaysCloudSync).
  // Deliberately NOT a union: an explicit 'off' from another device removes the
  // day here, which is what lets a same-day undo propagate instead of being
  // silently reversed by stale remote state. See spoiledDays.js's sync header.
  const mergeRemoteDays = useCallback((remote) => {
    setDays((prev) => {
      const next = applyRemoteStates(prev, remote)
      writeKey(SPOILED_DAYS_KEY, serializeSpoiledDays(next))
      return next
    })
  }, [])

  // Clean up an expired value on mount (state may have initialized to a stale one).
  // This is synchronizing with an external system (localStorage) on mount —
  // the textbook case an Effect exists for — not adjusting state from props;
  // the rule can't see through `refresh`'s indirection to tell the two apart.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    mergeRemoteDays,
    enable,
    disable,
  }
}
