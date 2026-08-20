import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { halfIndex } from '../api/select.js'
import { selectCatchUpTarget } from '../api/liveEdge.js'
import { computeDerivedByInning } from '../api/derive.js'
import {
  parseRevealMark,
  parseAtBatMark,
  parseBoxRevealMark,
  catchUpMarkIn,
  mergeMark,
  offerCatchUp,
  unlockedInnings,
} from './revealProgressCore.js'
import {
  BOX_REVEAL_PREFIX,
  clearBoxRevealMarksIn,
  readBoxRevealOwnerIn,
  writeBoxRevealOwnerIn,
} from '../lib/account/boxReveal.js'
import {
  ATBAT_MARK_PREFIX,
  REVEAL_MARK_PREFIX,
  clearRevealMarksIn,
  readRevealOwnerIn,
  writeRevealOwnerIn,
} from '../lib/account/revealOwner.js'

// localStorage key prefix + reader for the per-game reveal high-water mark.
// The parse/merge/unlock rules are the React-free core in revealProgressCore.js
// (unit-tested there); this hook owns only the storage I/O and React wiring.
const REVEAL_KEY = REVEAL_MARK_PREFIX
function readRevealMark(storageKey) {
  if (!storageKey) return -1
  try {
    return parseRevealMark(window.localStorage.getItem(storageKey))
  } catch {
    return -1
  }
}

// The account this device's reveal marks belong to, and the two operations the
// shared-device guard needs on them (OwnerGuards.jsx). The rules — WHY the
// adopt path removes the marks, and why the at-bat cursor goes with them — are
// the React-free core in src/lib/account/revealOwner.js; these three are the
// storage I/O, the same division of labour this file keeps everywhere else.
export function readRevealOwner() {
  try {
    return readRevealOwnerIn(window.localStorage)
  } catch {
    return ''
  }
}

export function writeRevealOwner(userId) {
  try {
    return writeRevealOwnerIn(window.localStorage, userId)
  } catch {
    return false
  }
}

// Take every reveal mark off this device and tell anything mounted about it.
//
// The announcement is the part that is easy to leave out and must not be: the
// browser fires `storage` only in OTHER tabs, so without this echo an innings
// viewer already on screen would keep rendering from React state after its key
// was removed underneath it — and would then re-persist that state, undoing the
// clear. Same mechanism, and same reason, as useStamps.js's notifyLocalChange.
export function clearRevealMarks() {
  let cleared = []
  try {
    cleared = clearRevealMarksIn(window.localStorage)
  } catch {
    return 0
  }
  for (const key of cleared) {
    try {
      window.dispatchEvent(new StorageEvent('storage', { key, newValue: null }))
    } catch {
      // StorageEvent unavailable — an open page re-seals on its next mount
      // instead, which is the same answer one frame later.
    }
  }
  return cleared.length
}

// This device's persisted mark for one game, read WITHOUT mounting the hook —
// for a surface that has to answer "is there anything here to catch up on?"
// before the innings viewer exists. Its one caller is GameView's lineup page
// (ADR-0054), which compares it against the live half to decide whether the
// "Catch up to live" button is worth drawing at all. Returns -1 for an unknown
// game, an unset key, or a mangled value — the same fail-closed parse every
// other reader of this key uses, and the same answer as "nothing revealed yet",
// which makes the offer appear rather than disappear. That is the harmless
// direction: the worst a spurious offer costs is a tap that lands the reader
// where they already were.
export function readRevealMarkFor(gamePk) {
  return gamePk ? readRevealMark(`${REVEAL_KEY}${gamePk}`) : -1
}

// CATCH UP TO LIVE (ADR-0054): ratchet one game's mark to `idx` from outside
// the hook, then let the innings viewer mount and read it.
//
// THE RATCHET IS NOT BYPASSED, which is the only thing that matters here. It
// goes through the same `mergeMark` every other source does — a tap, another
// tab's storage event, a signed-in device's cloud sync — so it cannot walk the
// mark backward, and a hostile or stale stored value cannot make it do so
// either (`parseRevealMark` collapses anything that is not a non-negative
// integer to -1, and -1 loses the merge). What it skips is only React: there is
// no mounted `useRevealProgress` to call `mergeRevealedThrough` on, because the
// reader is still on the lineup page and the innings viewer mounts a moment
// later and reads this key fresh.
//
// The synthetic `storage` echo is the same one `clearRevealMarks` above dispatches
// and exists for the same reason: the browser fires `storage` only in OTHER
// tabs, so without it a surface already mounted in THIS tab that listens on
// this key (the scorecard, a second innings view) would keep rendering from
// React state that is now behind the stored mark. A value, not a removal — so
// every listener treats it as the ordinary forward merge it is, never as the
// re-seal door a `newValue: null` means.
//
// Returns the mark now stored, or -1 if storage is unavailable (private mode),
// where the catch-up simply does not persist and the navigation still happens.
export function catchUpRevealTo(gamePk, idx) {
  if (!gamePk) return -1
  const key = `${REVEAL_KEY}${gamePk}`
  try {
    const next = catchUpMarkIn(window.localStorage, key, idx)
    if (next < 0) return -1
    try {
      window.dispatchEvent(new StorageEvent('storage', { key, newValue: String(next) }))
    } catch {
      // StorageEvent unavailable — a mounted page picks the mark up on its next
      // mount instead, which is the same answer one navigation later.
    }
    return next
  } catch {
    return -1
  }
}

// WHETHER "CATCH UP TO LIVE" IS WORTH OFFERING, and where it lands — the whole
// decision behind the lineup page's second button (ADR-0054), kept here rather
// than on that screen because both halves of it are about THIS key.
//
// It is the one bulk reveal in the scoring flow, so what it does is worth
// stating exactly: the caller ratchets this game's mark to the half BEFORE the
// one returned, then navigates to that half still SEALED. Every half up to
// there opens; the half you arrive in you still step through at-bat by at-bat,
// which is the whole point — you are picking the pencil up where the game is,
// not being handed the game. Between halves the target is the half just
// FINISHED, so the reader lands on the last real baseball that happened rather
// than on a half with nothing in it yet (selectCatchUpTarget, api/liveEdge.js).
//
// OFFERED ONLY WHEN IT WOULD MOVE SOMETHING. A reader already at or past the
// target gets null and the lineup page's ordinary "Innings ›" alone. So does a
// game at the top of the 1st: the target IS half 0, there is nothing before it
// to reveal, and `idx < 1` drops the offer rather than drawing a button that
// would do nothing.
//
// THE RETURNED INNING IS NEVER RENDERED, deliberately, and the one caller must
// keep it that way. A game in the 12th has to offer the same three words as a
// game in the 2nd, or the button itself would announce that this one went to
// extras before the reader ever tapped it — ADR-0008's protection spent by an
// offer rather than by a choice.
export function catchUpPlan(feed) {
  const target = selectCatchUpTarget(feed)
  return offerCatchUp(target, readRevealMarkFor(feed?.gamePk)) ? target : null
}

// (`revealMarkFor(gamePk)` used to live here — this device's persisted mark for
// one game, read without mounting the hook. Its only caller was
// StampsCloudSync, which pushed the mark to /api/reveal before minting so the
// stamp gate would pass. The gate was retired in ADR-0035's second amendment
// and the push went with it, leaving this an orphan; `check-dead-exports.mjs`
// is what said so. The hook below still reads the same key the same way.)

// localStorage key prefix + reader for the at-bat-mode stepping cursor (see
// ADR-0016): how many play-by-play entries of whichever half is currently
// being stepped through have been revealed so far. Stored as "{halfIdx}:
// {count}" — the caller compares halfIdx against the half it's actually
// showing (RollingLine and direct links both let a user jump to any unlocked
// half, not just the reveal frontier, so this can't assume "frontier" means
// "the half being viewed"). A stale value from a half that's since been
// fully committed is simply ignored rather than misread as live progress.
const ATBAT_KEY = ATBAT_MARK_PREFIX
function readAtBatMark(storageKey) {
  if (!storageKey) return { halfIdx: -1, count: 0 }
  try {
    return parseAtBatMark(window.localStorage.getItem(storageKey))
  } catch {
    return { halfIdx: -1, count: 0 }
  }
}

// Everything that advances with the reveal high-water mark: the mark itself
// (persisted per gamePk so leaving the innings view and returning — even in a
// new session — keeps your place, per InningViewer's spoiler-safety
// invariant), how many innings are currently unlocked (extras never spoil —
// ADR-0008), and the per-inning derived-stats cache (pitches/whiffs/Statcast
// superlatives), rebuilt only when the feed object itself changes, never on a
// bare re-render (ADR-0007).
//
// `regulation`/`actualCount` come from the caller (selectRegulationInnings /
// selectInningCount) since they're plain feed reads, not reveal state.
export function useRevealProgress(feed, regulation, actualCount) {
  const storageKey = feed?.gamePk ? `${REVEAL_KEY}${feed.gamePk}` : null
  const [revealedThrough, setRevealedThrough] = useState(() =>
    readRevealMark(storageKey),
  )

  const atBatStorageKey = feed?.gamePk ? `${ATBAT_KEY}${feed.gamePk}` : null
  const [atBatMark, setAtBatMark] = useState(() => readAtBatMark(atBatStorageKey))
  // How many entries have been stepped through for a given half-index — 0 for
  // any half other than the one the mark belongs to (a different half, or no
  // stepping done yet).
  const atBatCountFor = useCallback(
    (n, half) => (atBatMark.halfIdx === halfIndex(n, half) ? atBatMark.count : 0),
    [atBatMark],
  )

  // The one ratchet: revealedThrough only ever moves forward, from any
  // source (a tap, another tab's storage event, or a signed-in device's
  // cloud sync — see useRevealCloudSync.js). Exposed as mergeRevealedThrough
  // so every caller pushing in an externally-sourced value goes through the
  // same one-directional guarantee instead of re-implementing it.
  const mergeRevealedThrough = useCallback((idx) => {
    setRevealedThrough((prev) => mergeMark(prev, idx))
  }, [])

  // The one door back through the ratchet, and it is the key being REMOVED —
  // never a value. No stale or hostile value can re-seal a half through it,
  // because a removal is not a value: this app writes nothing to this key but a
  // non-negative integer, so its absence can only mean one of the two things
  // that take it away deliberately — "erase my Tally data", and the
  // shared-device guard finding these marks belong to a different account
  // (clearRevealMarks above). Both must re-seal a page that is already open;
  // leaving it open would be a score on screen that its reader never asked for.
  //
  // The at-bat cursor resets with it. It is the same reader's position in the
  // same game, and a cursor left pointing into a half that just re-sealed would
  // be written straight back to storage by the persist effect below.
  const resealAll = useCallback(() => {
    setRevealedThrough(-1)
    setAtBatMark({ halfIdx: -1, count: 0 })
  }, [])

  const revealTo = useCallback(
    (n, half) => {
      mergeRevealedThrough(halfIndex(n, half))
      // Whatever was mid-step just got fully committed — clear it so a later
      // half doesn't inherit a stale count.
      setAtBatMark({ halfIdx: -1, count: 0 })
    },
    [mergeRevealedThrough],
  )

  const revealAtBat = useCallback((n, half, count) => {
    setAtBatMark({ halfIdx: halfIndex(n, half), count })
  }, [])

  useEffect(() => {
    if (!storageKey || revealedThrough < 0) return
    try {
      window.localStorage.setItem(storageKey, String(revealedThrough))
    } catch {
      // Private-mode / storage-disabled — degrade to in-session memory only.
    }
  }, [storageKey, revealedThrough])

  // The 'storage' event only fires in OTHER tabs/windows on the same origin,
  // never the tab that made the write — so this picks up a reveal made in a
  // second tab on the same game without needing a reload. Same ratchet as
  // revealTo: only ever moves forward.
  useEffect(() => {
    if (!storageKey) return
    function onStorage(e) {
      if (e.key !== storageKey) return
      // A removal — `newValue: null` — is the re-seal door described above. A
      // MANGLED value is not: it parses to -1, which the ratchet ignores, and
      // must not additionally close a half that is already open.
      if (e.newValue == null) resealAll()
      // Same parse + forward-only merge as every other reveal source.
      else mergeRevealedThrough(parseRevealMark(e.newValue))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [storageKey, mergeRevealedThrough, resealAll])

  useEffect(() => {
    if (!atBatStorageKey) return
    try {
      if (atBatMark.halfIdx < 0) {
        window.localStorage.removeItem(atBatStorageKey)
      } else {
        window.localStorage.setItem(atBatStorageKey, `${atBatMark.halfIdx}:${atBatMark.count}`)
      }
    } catch {
      // Private-mode / storage-disabled — degrade to in-session memory only.
    }
  }, [atBatStorageKey, atBatMark])

  // How many innings are currently visible: regulation, plus one more for each
  // extra inning whose predecessor has already been fully revealed.
  const unlocked = useMemo(
    () => unlockedInnings(regulation, actualCount, revealedThrough),
    [regulation, actualCount, revealedThrough],
  )

  // Derived stats (pitches/whiffs/1st-pitch strikes) are parsed lazily and
  // cached: the map is only built the first time a box is actually revealed.
  // The cache is keyed on the feed object, so a Refresh (which fetches a fresh
  // feed) rebuilds it. Without this the map froze at whatever feed was present
  // on first reveal and pitch/whiff stats went stale for the live inning — the
  // play-by-play (read live from `feed`) would show a walk while PITCHES read 0.
  //
  // Wrapped in useCallback purely so its IDENTITY is stable per feed: it is a
  // prop on the memoized InningPage, and a plain function rebuilt each render
  // would miss that memo on every render. The cache key is unchanged and still
  // the feed object itself — the useCallback dependency is that same object, so
  // the two can never disagree.
  const derivedRef = useRef({ feed: null, map: null })
  const getDerived = useCallback(() => {
    if (derivedRef.current.feed !== feed) {
      derivedRef.current = { feed, map: computeDerivedByInning(feed) }
    }
    return derivedRef.current.map
  }, [feed])

  return {
    revealedThrough,
    revealTo,
    mergeRevealedThrough,
    unlocked,
    getDerived,
    atBatCountFor,
    revealAtBat,
  }
}

// localStorage key prefix for the box score's own mark (ADR-0049): "this reader
// has opened this game's box score by hand". One bit per gamePk, written as the
// string "1", parsed by parseBoxRevealMark — never a score, and unlike
// `bbsbh:reveal:{gamePk}` not even a position. It says only THAT the seal was
// lifted, never how far or on what.
//
// It lives beside the reveal mark rather than inside it on purpose. The box
// score's seal is one seal over one page; `revealedThrough` is the by-hand
// scoring frontier that the innings viewer, the scorecard's ink and the slate's
// "pick up your pencil" strip all read. Folding the box score into that mark
// would ratchet all three from a single tap on a different page — which is the
// exact leak ADR-0026 and ADR-0048 both keep their overrides away from.
const BOX_KEY = BOX_REVEAL_PREFIX
function readBoxMark(storageKey) {
  if (!storageKey) return false
  try {
    return parseBoxRevealMark(window.localStorage.getItem(storageKey))
  } catch {
    return false
  }
}

// The account this device's box-reveal bits belong to, and the two operations
// the shared-device guard needs on them (OwnerGuards.jsx). The rules
// are the React-free core in src/lib/account/boxReveal.js — including WHY the
// adopt path removes the bits rather than ignoring them; these three are the
// storage I/O, the same division of labour this file keeps everywhere else.
export function readBoxRevealOwner() {
  try {
    return readBoxRevealOwnerIn(window.localStorage)
  } catch {
    return ''
  }
}

export function writeBoxRevealOwner(userId) {
  try {
    return writeBoxRevealOwnerIn(window.localStorage, userId)
  } catch {
    return false
  }
}

// Take every box-reveal bit off this device and tell anything mounted about it.
//
// The announcement is the part that is easy to leave out and must not be: the
// browser fires `storage` only in OTHER tabs, so without this echo a box score
// already on screen would keep rendering open from React state after its key
// was removed underneath it — which is the exact page the guard exists to
// re-seal. Same mechanism, and same reason, as useStamps.js's notifyLocalChange.
export function clearBoxRevealMarks() {
  let cleared = []
  try {
    cleared = clearBoxRevealMarksIn(window.localStorage)
  } catch {
    return 0
  }
  for (const key of cleared) {
    try {
      window.dispatchEvent(new StorageEvent('storage', { key, newValue: null }))
    } catch {
      // StorageEvent unavailable — an open page re-seals on its next mount
      // instead, which is the same answer one frame later.
    }
  }
  return cleared.length
}

// The box score's own reveal state, persisted per game and mirrored across a
// signed-in reader's devices (BoxRevealCloudSync.jsx). ADR-0049 has the why;
// this is the storage I/O and the React wiring, the same division of labour
// useRevealProgress above keeps with revealProgressCore.js.
//
// A LATCH, in the same one-directional spirit as `mergeMark`: `false → true`
// from any source (this device's tap, another tab's `storage` event, another
// device's mark arriving from the cloud), and never back — with ONE exception,
// which is the key being REMOVED. No stale value can close a page through that
// door, because a removal is not a value: nothing in this app writes anything
// to this key but the string '1', so the key going away can only mean the two
// things that take it away deliberately — "erase my Tally data", and the
// shared-device guard finding these bits belong to a different account
// (clearBoxRevealMarks above). Both of those must re-seal an open page; leaving
// it open would be a score on screen that its reader never asked for, which is
// the whole defect ADR-0049's amendment records. Re-seeding otherwise happens
// only when the gamePk itself changes: a different game is a different
// question, and it is asked of storage afresh.
//
// The gamePk change is handled during render rather than in an effect because
// this value gates what renders. BoxScore stays mounted when the reader moves
// between games on the same tab, so an effect-based re-seed would paint one
// frame of the previous game's answer — a game the reader may not have opened.
// That frame would be the wrong direction of wrong: it would show, not seal.
export function useBoxScoreReveal(gamePk) {
  const storageKey = gamePk ? `${BOX_KEY}${gamePk}` : null
  const [mark, setMark] = useState(() => ({ key: storageKey, opened: readBoxMark(storageKey) }))
  let opened = mark.opened
  if (mark.key !== storageKey) {
    opened = readBoxMark(storageKey)
    setMark({ key: storageKey, opened })
  }

  const markBoxOpened = useCallback(() => {
    setMark((prev) => (prev.opened ? prev : { ...prev, opened: true }))
  }, [])

  // The one path back. Private to the storage listener below — no screen calls
  // this, and none should: re-sealing is a consequence of the bit being taken
  // off the device, never something the UI decides.
  const resealBox = useCallback(() => {
    setMark((prev) => (prev.opened ? { ...prev, opened: false } : prev))
  }, [])

  useEffect(() => {
    if (!storageKey || !opened) return
    try {
      window.localStorage.setItem(storageKey, '1')
    } catch {
      // Private-mode / storage-disabled — degrade to in-session memory only,
      // exactly as the reveal mark does. The seal simply returns next visit.
    }
  }, [storageKey, opened])

  // Same cross-tab pickup as the reveal mark: 'storage' fires only in the OTHER
  // tabs, so a box score opened in a second tab on the same game opens here too
  // without a reload. A null or mangled `newValue` parses to false, which the
  // latch ignores.
  useEffect(() => {
    if (!storageKey) return
    function onStorage(e) {
      if (e.key !== storageKey) return
      if (parseBoxRevealMark(e.newValue)) markBoxOpened()
      // A removal — `newValue: null` — is the re-seal door described above. A
      // mangled value is NOT: it fails closed by simply not opening the page,
      // and must not additionally close one that is already open.
      else if (e.newValue == null) resealBox()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [storageKey, markBoxOpened, resealBox])

  return { boxOpened: opened, markBoxOpened }
}
