// The first-visit intro's one-time flag (src/lib/account/intro.js, PRD §6.1).
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  INTRO_KEY,
  hasSeenIntro,
  markIntroSeenIn,
  parseIntro,
  serializeIntro,
} from '../src/lib/account/intro.js'

test('parseIntro degrades to null on anything malformed', () => {
  assert.equal(parseIntro(null), null)
  assert.equal(parseIntro(undefined), null)
  assert.equal(parseIntro('not json'), null)
  assert.equal(parseIntro('[]'), null)
  assert.equal(parseIntro('"a string"'), null)
  assert.equal(parseIntro(JSON.stringify({ seen: false })), null)
  assert.equal(parseIntro(JSON.stringify({})), null)
})

test('a valid stored flag round-trips, clamping step to 1 or 2', () => {
  assert.deepEqual(parseIntro(serializeIntro(1, 100)), { seen: true, step: 1, at: 100 })
  assert.deepEqual(parseIntro(serializeIntro(2, 100)), { seen: true, step: 2, at: 100 })
  // Anything that isn't literally 2 clamps to 1 — a step is either 1 or 2,
  // never a third value.
  assert.deepEqual(parseIntro(serializeIntro(3, 100)), { seen: true, step: 1, at: 100 })
  assert.deepEqual(parseIntro(serializeIntro(undefined, 100)), { seen: true, step: 1, at: 100 })
})

test('a malformed `at` collapses to 0 rather than a garbage clock', () => {
  assert.deepEqual(
    parseIntro(JSON.stringify({ seen: true, step: 1, at: 'whenever' })),
    { seen: true, step: 1, at: 0 },
  )
  assert.deepEqual(
    parseIntro(JSON.stringify({ seen: true, step: 1, at: -5 })),
    { seen: true, step: 1, at: 0 },
  )
})

test('hasSeenIntro is true only for a real seen record', () => {
  assert.equal(hasSeenIntro(null), false)
  assert.equal(hasSeenIntro(undefined), false)
  assert.equal(hasSeenIntro({}), false)
  assert.equal(hasSeenIntro({ seen: false }), false)
  assert.equal(hasSeenIntro({ seen: true, step: 1, at: 0 }), true)
})

test('serializeIntro defaults `now` to the real clock, and is always a valid document', () => {
  const parsed = parseIntro(serializeIntro(2))
  assert.equal(parsed.seen, true)
  assert.equal(parsed.step, 2)
  assert.ok(Number.isInteger(parsed.at) && parsed.at > 0)
})

// --------------------------------------------------------------------------
// markIntroSeenIn — the writer the erase sheet needs
// --------------------------------------------------------------------------

function fakeStorage(initial = {}, { throwOnWrite = false } = {}) {
  const map = { ...initial }
  return {
    map,
    getItem: (k) => (k in map ? map[k] : null),
    setItem: (k, v) => {
      if (throwOnWrite) throw new Error('quota')
      map[k] = String(v)
    },
  }
}

test('markIntroSeenIn writes a flag that hasSeenIntro then believes', () => {
  const storage = fakeStorage()
  assert.equal(markIntroSeenIn(storage, 1, 1234), true)
  assert.equal(hasSeenIntro(parseIntro(storage.getItem(INTRO_KEY))), true)
  assert.deepEqual(JSON.parse(storage.map[INTRO_KEY]), { seen: true, step: 1, at: 1234 })
})

test('markIntroSeenIn survives storage that throws, and says it failed', () => {
  // Private mode. The erase sheet is navigating away regardless; the point is
  // that it must not throw on the way out.
  assert.equal(markIntroSeenIn(fakeStorage({}, { throwOnWrite: true })), false)
  assert.equal(markIntroSeenIn(null), false)
  assert.equal(markIntroSeenIn({}), false)
})

test('a wiped device that re-seeds the flag does NOT look like a first visit', () => {
  // The bug this closes: clearTallyDataIn sweeps every `bbsbh:` key, including
  // this flag. Reloading then reopened the welcome modal, whose every exit
  // route commits a club pick — defaulting to the pinned club — and with
  // `bbsbh:prefsOwner` swept too the sync strategy falls back to `backfill`,
  // publishing that default over the user's real club on every device.
  const storage = fakeStorage()
  assert.equal(hasSeenIntro(parseIntro(storage.getItem(INTRO_KEY))), false, 'wiped: looks new')
  markIntroSeenIn(storage)
  assert.equal(hasSeenIntro(parseIntro(storage.getItem(INTRO_KEY))), true, 're-seeded: does not')
})
