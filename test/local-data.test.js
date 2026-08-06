// My Tally's local-data helpers (src/lib/account/localData.js) — the counting,
// the export, and the erase behind /profile's "Sync & data" section.
//
// Three of these pin things that are cheap to get wrong and expensive to notice:
// the reveal count must not swallow the at-bat cursor keys, the erase must not
// skip half the keys by removing while it iterates, and the export must not
// carry anything that came out of a ballpark.
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GAME_LOG_EXPORT_VERSION,
  REVEAL_PREFIX,
  TALLY_PREFIX,
  buildGameLogExport,
  clearTallyDataIn,
  countGamesInProgress,
  gameLogFilename,
  tallyKeysIn,
} from '../src/lib/account/localData.js'

// A localStorage stand-in with the real `length`/`key(i)` enumeration shape —
// which is the whole point, since that shape is what makes remove-while-
// iterating a bug rather than a style note.
function fakeStorage(seed = {}, { throwOnRead = false, refuse = () => false } = {}) {
  const data = { ...seed }
  return {
    data,
    get length() {
      if (throwOnRead) throw new Error('SecurityError')
      return Object.keys(data).length
    },
    key(i) {
      if (throwOnRead) throw new Error('SecurityError')
      return Object.keys(data)[i] ?? null
    },
    getItem(k) {
      return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null
    },
    removeItem(k) {
      if (refuse(k)) throw new Error('QuotaExceededError')
      delete data[k]
    },
  }
}

// --------------------------------------------------------------------------
// tallyKeysIn
// --------------------------------------------------------------------------

test('only the bbsbh: namespace is this app’s data', () => {
  const storage = fakeStorage({
    'bbsbh:prefs': '{}',
    'bbsbh:stamps': '{}',
    'clerk:session': 'not ours',
    theme: 'not ours',
  })
  assert.deepEqual(tallyKeysIn(storage).sort(), ['bbsbh:prefs', 'bbsbh:stamps'])
  assert.equal(TALLY_PREFIX, 'bbsbh:')
})

test('an unreadable or absent storage yields no keys rather than throwing', () => {
  assert.deepEqual(tallyKeysIn(null), [])
  assert.deepEqual(tallyKeysIn(fakeStorage({ 'bbsbh:prefs': '{}' }, { throwOnRead: true })), [])
})

// --------------------------------------------------------------------------
// countGamesInProgress
// --------------------------------------------------------------------------

// The at-bat cursor is a transient stepping position inside one half
// (ADR-0016), not a game you have open. `bbsbh:reveal-atbat:` shares eleven
// characters with `bbsbh:reveal:` and differs only at the twelfth, so a prefix
// test written one character short double-counts every game being stepped
// through.
test('the games-in-progress count is reveal marks only, never the at-bat cursor', () => {
  const storage = fakeStorage({
    'bbsbh:reveal:1': '4',
    'bbsbh:reveal:2': '7',
    'bbsbh:reveal-atbat:1': '3',
    'bbsbh:stamps': '{}',
    'bbsbh:prefs': '{}',
  })
  assert.equal(countGamesInProgress(storage), 2)
  assert.equal(REVEAL_PREFIX, 'bbsbh:reveal:')
})

test('nothing opened yet counts as zero, not as an error', () => {
  assert.equal(countGamesInProgress(fakeStorage({})), 0)
  assert.equal(countGamesInProgress(null), 0)
})

// --------------------------------------------------------------------------
// clearTallyDataIn
// --------------------------------------------------------------------------

// The regression this test exists for: `storage.key(i)` re-indexes the moment a
// key is removed, so removing inside the enumeration loop skips every other
// key — and an erase that quietly leaves half the data behind is worse than one
// that fails loudly.
test('erase removes every bbsbh: key, including when they are adjacent', () => {
  const storage = fakeStorage({
    'bbsbh:prefs': '{}',
    'bbsbh:prefsOwner': 'user_a',
    'bbsbh:stamps': '{}',
    'bbsbh:spoiledDays': '[]',
    'bbsbh:reveal:1': '4',
    'bbsbh:reveal:2': '7',
    'bbsbh:scoresUnlocked': '123',
    'bbsbh:search:recent': '[]',
    theme: 'kept',
  })
  assert.equal(clearTallyDataIn(storage), 8)
  assert.deepEqual(Object.keys(storage.data), ['theme'])
})

test('a key that refuses to be removed is skipped, and the count stays honest', () => {
  const storage = fakeStorage(
    { 'bbsbh:prefs': '{}', 'bbsbh:stamps': '{}' },
    { refuse: (k) => k === 'bbsbh:stamps' },
  )
  assert.equal(clearTallyDataIn(storage), 1)
  assert.deepEqual(Object.keys(storage.data), ['bbsbh:stamps'])
})

test('erasing an unreadable storage is a no-op, not a crash', () => {
  assert.equal(clearTallyDataIn(null), 0)
})

// --------------------------------------------------------------------------
// buildGameLogExport
// --------------------------------------------------------------------------

const STAMPS = {
  745000: {
    state: 'on',
    mode: 'watched',
    note: 'sat behind the plate',
    date: '2026-04-12',
    stampedAt: 1_760_000_000_000,
    updatedAt: 1_760_000_000_000,
    placement: { page: 1, x: 0.25, y: 0.3, tilt: 2 },
  },
  745001: {
    state: 'on',
    mode: 'followed',
    note: '',
    date: '2026-05-03',
    stampedAt: 1_761_000_000_000,
    updatedAt: 1_761_000_000_000,
    placement: null,
  },
  // Tombstoned — un-stamped, so it is not in the collection any more.
  745002: {
    state: 'off',
    mode: 'watched',
    note: 'nope',
    date: '2026-06-01',
    stampedAt: 1_762_000_000_000,
    updatedAt: 1_762_000_000_000,
  },
}

test('the export carries the live collection, oldest game first', () => {
  const out = buildGameLogExport(STAMPS, { now: 1_770_000_000_000 })
  assert.equal(out.version, GAME_LOG_EXPORT_VERSION)
  assert.equal(out.kind, 'game-log')
  assert.equal(out.count, 2)
  assert.deepEqual(
    out.games.map((g) => g.gamePk),
    [745000, 745001],
  )
})

// The one assertion that matters most here. A local stamp record has never held
// a score — the Logbook resolves those at render time (ADR-0035) — and this
// export must never become the place one first appears on disk.
test('nothing in the export came out of a ballpark', () => {
  const out = buildGameLogExport(STAMPS, { now: 1_770_000_000_000 })
  const fields = new Set(out.games.flatMap((g) => Object.keys(g)))
  assert.deepEqual(
    [...fields].sort(),
    ['date', 'gamePk', 'mode', 'note', 'placement', 'stampedAt'],
  )
  const text = JSON.stringify(out)
  for (const forbidden of ['score', 'runs', 'home', 'away', 'winner', 'final']) {
    assert.equal(text.includes(forbidden), false, `export mentions "${forbidden}"`)
  }
})

test('an empty or malformed collection exports an empty book rather than throwing', () => {
  assert.equal(buildGameLogExport({}).count, 0)
  assert.equal(buildGameLogExport(null).count, 0)
  assert.equal(buildGameLogExport(undefined).games.length, 0)
})

test('the filename is dated so a second export never overwrites the first', () => {
  assert.equal(gameLogFilename(Date.UTC(2026, 7, 6, 12)), 'tally-game-log-2026-08-06.json')
})
