// What a save to /api/copy is allowed to destroy.
//
// THE BUG THIS ENCODES. The inline ballpark editor used to read the current
// override map from `GET /api/copy`, merge its own six fields in, and POST the
// whole thing back. The POST deletes every key the body omits, so that read had
// to be perfectly fresh — and it could not be. The GET is CDN-cached
// (`s-maxage=60, stale-while-revalidate=600`) and `cache: 'no-store'` on a
// fetch controls the BROWSER's cache, not the shared edge. Production answered
// that read `X-Vercel-Cache: STALE, Age: 238`.
//
// So saving park B a minute after park A read a map that predated park A, and
// deleted park A's photo. It uploaded fine, it was stored fine, and it was gone
// by the next save. Ballpark photos went first because they were the fields
// being added at the time; the wordmarks saved days earlier were in every
// cached copy and survived, which is exactly what made it look like "photos
// don't sync, logos do."
//
// The fix moves the merge to the server, where the read is Redis and happens in
// the same request as the write. These tests pin the property that makes that
// safe: A PATCH MAY ONLY DELETE WHAT IT EXPLICITLY CLEARS. Everything else in
// the authoritative map survives a save that never mentioned it — no matter how
// stale the client's own view of the world is.
import assert from 'node:assert/strict'
import test from 'node:test'

import { acceptableBody, writePlan } from '../api/copy.js'
import { venueKey } from '../src/lib/ballpark/ballparkArt.js'

const FENWAY = venueKey('Fenway Park')
const WRIGLEY = venueKey('Wrigley Field')

const PHOTO = 'https://p6soal2x5kpgb0ll.public.blob.vercel-storage.com/ballparks/fenwaypark-photo-Ab3xY9.jpg'
const WORDMARK = 'https://p6soal2x5kpgb0ll.public.blob.vercel-storage.com/ballparks/wrigleyfield-wordmark-Kd8Lm2.png'

// --------------------------------------------------------------------------
// The regression
// --------------------------------------------------------------------------
test('a patch never deletes a field it does not name, however stale the client is', () => {
  // Fenway's photo was saved a moment ago and is in Redis. The browser saving
  // Wrigley has never seen it — under the old read-merge-write that is exactly
  // when it got erased.
  const prev = { [`ballpark.${FENWAY}Photo`]: PHOTO }
  const { clean, staleKeys } = writePlan(prev, {
    patch: { [`ballpark.${WRIGLEY}Wordmark`]: WORDMARK },
  })

  assert.deepEqual(staleKeys, [], 'a patch that names one park must delete nothing')
  assert.equal(clean[`ballpark.${FENWAY}Photo`], PHOTO, "the other park's photo survives")
  assert.equal(clean[`ballpark.${WRIGLEY}Wordmark`], WORDMARK)
})

test('a patch still clears the one field it explicitly empties', () => {
  const prev = {
    [`ballpark.${FENWAY}Photo`]: PHOTO,
    [`ballpark.${FENWAY}Credit`]: 'Gary',
  }
  const { clean, staleKeys } = writePlan(prev, {
    patch: { [`ballpark.${FENWAY}Photo`]: '' },
  })

  assert.deepEqual(staleKeys, [`ballpark.${FENWAY}Photo`])
  assert.equal(clean[`ballpark.${FENWAY}Photo`], undefined)
  assert.equal(clean[`ballpark.${FENWAY}Credit`], 'Gary', 'clearing one field spares its neighbours')
})

test('the six fields of one park do not disturb the other twenty-nine', () => {
  const prev = {
    [`ballpark.${WRIGLEY}Wordmark`]: WORDMARK,
    'scoresUnlocked.toggleLabel': 'Show me the scores',
  }
  const { clean, staleKeys } = writePlan(prev, {
    patch: {
      [`ballpark.${FENWAY}Name`]: 'The Fens',
      [`ballpark.${FENWAY}Photo`]: PHOTO,
      [`ballpark.${FENWAY}Credit`]: '',
      [`ballpark.${FENWAY}Focus`]: '50 20',
    },
  })

  assert.deepEqual(staleKeys, [])
  assert.equal(clean['scoresUnlocked.toggleLabel'], 'Show me the scores')
  assert.equal(clean[`ballpark.${WRIGLEY}Wordmark`], WORDMARK)
  assert.equal(clean[`ballpark.${FENWAY}Focus`], '50 20')
})

// --------------------------------------------------------------------------
// The full-map form the /admin panel still uses
// --------------------------------------------------------------------------
test('a full-map body still means "this is the complete state" and deletes omissions', () => {
  const prev = {
    [`ballpark.${FENWAY}Photo`]: PHOTO,
    [`ballpark.${WRIGLEY}Wordmark`]: WORDMARK,
  }
  const { clean, staleKeys } = writePlan(prev, {
    copy: { [`ballpark.${FENWAY}Photo`]: PHOTO },
  })

  assert.deepEqual(staleKeys, [`ballpark.${WRIGLEY}Wordmark`])
  assert.deepEqual(clean, { [`ballpark.${FENWAY}Photo`]: PHOTO })
})

test('a patch body wins when both are somehow present — the safer reading', () => {
  const prev = { [`ballpark.${WRIGLEY}Wordmark`]: WORDMARK }
  const { staleKeys } = writePlan(prev, {
    patch: { [`ballpark.${FENWAY}Name`]: 'The Fens' },
    copy: {},
  })

  assert.deepEqual(staleKeys, [], 'a stray empty copy map must not wipe the store')
})

// --------------------------------------------------------------------------
// The registry stays the closed set, on both body shapes
// --------------------------------------------------------------------------
test('a patch cannot introduce an unknown id or a javascript: image URL', () => {
  const { clean } = writePlan({}, {
    patch: {
      'not.a.registry.field': 'x',
      // eslint-disable-next-line no-script-url
      [`ballpark.${FENWAY}Photo`]: 'javascript:alert(1)',
    },
  })

  assert.deepEqual(clean, {})
})

test('a corrupted stored map cannot survive into the write plan', () => {
  const { clean, staleKeys } = writePlan(
    { 'not.a.registry.field': 'x' },
    { patch: { [`ballpark.${FENWAY}Name`]: 'The Fens' } },
  )

  assert.deepEqual(clean, { [`ballpark.${FENWAY}Name`]: 'The Fens' })
  assert.deepEqual(staleKeys, [], 'an id the registry never knew is not ours to delete')
})

// --------------------------------------------------------------------------
// acceptableBody
// --------------------------------------------------------------------------
test('acceptableBody admits both shapes and refuses everything else', () => {
  assert.equal(acceptableBody({ patch: {} }), true)
  assert.equal(acceptableBody({ copy: {} }), true)
  for (const bad of [null, undefined, {}, { patch: 'x' }, { copy: 7 }, { patch: [] }, { copy: [] }]) {
    assert.equal(acceptableBody(bad), false, `expected refusal for ${JSON.stringify(bad)}`)
  }
})
