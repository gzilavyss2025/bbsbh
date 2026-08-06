// What this device is holding, and the two things My Tally lets you do about
// it: take it with you (the Game Log export) and take it away (erase).
//
// React-free and dependency-free apart from the stamp rules it reuses, so every
// rule below is pinned by test/local-data.test.js rather than inferred from a
// dialog's click handler. Same split as preferencesStorage.js: the storage
// object is passed IN, every access is individually guarded, and no path here
// throws — a browser that blocks storage answers "nothing" rather than crashing
// the settings page a user opened precisely to clean up.
//
// ---------------------------------------------------------------------------
// WHAT IS SCORE-FREE ABOUT ALL OF THIS
// ---------------------------------------------------------------------------
// Two things are counted here and neither is a result:
//
//   * `countGamesInProgress` counts KEYS, never values. `bbsbh:reveal:{gamePk}`
//     holds a half-index; this module never reads one. A count of how many
//     games you have open is a fact about you, exactly like the reveal mark
//     itself (ADR-0022).
//   * `buildGameLogExport` writes out the LOCAL stamp records — gamePk, mode,
//     note, date, placement, clocks. A local stamp record has never held a
//     score: the Logbook resolves those at render time from api/logbook.js
//     (ADR-0035), which is exactly why a signed-out visitor's book is
//     score-free on disk. Keep it that way — an export that carried a final
//     score would put one in a file, which is a spoiler surface with a
//     filename.
//
// ---------------------------------------------------------------------------
// WHY ERASE TAKES EVERY `bbsbh:` KEY
// ---------------------------------------------------------------------------
// "Erase my Tally data" has to mean it. Enumerating a hand-written list of key
// names would go stale the first time a feature adds one — and the failure mode
// is silent, leaving something behind for a user who asked to be forgotten. So
// the rule is the namespace, not a list: everything this app wrote under
// `bbsbh:` goes, including the dev lab's scratch state and the admin copy
// cache. Nothing outside the namespace is touched.
import { allStamps } from '../stamps.js'

// Every key this app has ever written is namespaced. That prefix IS the
// definition of "your Tally data on this device".
export const TALLY_PREFIX = 'bbsbh:'

// One key per game you have opened, `bbsbh:reveal:{gamePk}`. Note the trailing
// colon: `bbsbh:reveal-atbat:{gamePk}` (the transient at-bat cursor, ADR-0016)
// deliberately does NOT match, so stepping through a half never inflates the
// count of games in your pencil.
export const REVEAL_PREFIX = 'bbsbh:reveal:'

// Bumped only if the shape below changes incompatibly. A reader that does not
// recognise the version should say so rather than guess.
export const GAME_LOG_EXPORT_VERSION = 1

function keyAt(storage, i) {
  try {
    return storage.key(i)
  } catch {
    return null
  }
}

// Every `bbsbh:` key currently in this storage, or [] if it cannot be read at
// all. Snapshotted into an array before anything mutates it — removing while
// iterating `storage.key(i)` re-indexes the remaining keys underneath you and
// silently skips every other one.
export function tallyKeysIn(storage) {
  if (!storage) return []
  let length = 0
  try {
    length = Number(storage.length) || 0
  } catch {
    return []
  }
  const out = []
  for (let i = 0; i < length; i += 1) {
    const key = keyAt(storage, i)
    if (typeof key === 'string' && key.startsWith(TALLY_PREFIX)) out.push(key)
  }
  return out
}

// How many games this device has a reveal mark for — "games in your pencil".
// Counts key NAMES only; the marks themselves are never read here.
export function countGamesInProgress(storage) {
  return tallyKeysIn(storage).filter((key) => key.startsWith(REVEAL_PREFIX)).length
}

// Erase everything this app wrote on this device. Returns the number of keys
// removed, so the confirmation can be specific without naming any of them.
//
// A key that refuses to be removed is skipped rather than thrown over: a
// partial erase that reports its true count is honest, and an exception here
// would leave the user staring at a dialog that did nothing.
export function clearTallyDataIn(storage) {
  const keys = tallyKeysIn(storage)
  let cleared = 0
  for (const key of keys) {
    try {
      storage.removeItem(key)
      cleared += 1
    } catch {
      // Storage refused this key. Keep going — the rest can still go.
    }
  }
  return cleared
}

// The Game Log, as a file you own. Deliberately the LOCAL records and nothing
// resolved: no club names, no ballpark, no score, nothing fetched. What comes
// out is what this device wrote down.
export function buildGameLogExport(stamps, { now = Date.now() } = {}) {
  const games = allStamps(stamps).map((entry) => ({
    gamePk: entry.gamePk,
    date: entry.date,
    mode: entry.mode,
    note: entry.note ?? '',
    stampedAt: entry.stampedAt,
    placement: entry.placement ?? null,
  }))
  return {
    app: 'tally-baseball',
    kind: 'game-log',
    version: GAME_LOG_EXPORT_VERSION,
    exportedAt: new Date(Number.isFinite(now) ? now : 0).toISOString(),
    count: games.length,
    games,
  }
}

// `tally-game-log-2026-08-06.json`. Dated so a second export a month later
// does not overwrite the first in a downloads folder.
export function gameLogFilename(now = Date.now()) {
  const iso = new Date(Number.isFinite(now) ? now : 0).toISOString()
  return `tally-game-log-${iso.slice(0, 10)}.json`
}
