import test from 'node:test'
import assert from 'node:assert/strict'

import { parkBackdrop } from '../src/lib/ballpark/parkBackdrop.js'
import { fieldIds, resolvePhoto, venueKey } from '../src/lib/ballpark/ballparkArt.js'
import { FIELD_IDS } from '../src/copy/registry.js'

// The copy reader the real caller passes (useCopy().t), as a plain map lookup
// that answers '' for anything unset — exactly what the provider does for an id
// the registry does not know.
const reader = (overrides = {}) => (id) => overrides[id] ?? ''
const none = reader()

test('a bundled park resolves to its photo, centred by default', () => {
  const park = parkBackdrop('Fenway Park', none)
  assert.equal(park.cssUrl, 'url("/ballparks/fenwaypark.jpg")')
  // The mobile-sized companion (scripts/gen-ballpark-thumbs.mjs) a touch
  // device's scroll reveal arms instead of the full photo above.
  assert.equal(park.mobileCssUrl, 'url("/ballparks/thumb/fenwaypark.webp")')
  assert.equal(park.focus, '50% 50%')
  assert.equal(park.name, 'Fenway Park')
})

test('an alias venue name resolves to the one shared photo', () => {
  // BALLPARKS holds "Minute Maid Park" as an alias of the Daikin Park record,
  // so a feed still spelling it the old way must not miss the art.
  const renamed = parkBackdrop('Minute Maid Park', none)
  assert.equal(renamed.cssUrl, parkBackdrop('Daikin Park', none).cssUrl)
})

test('a one-off neutral site degrades to nothing', () => {
  assert.equal(parkBackdrop('Field of Dreams', none), null)
  assert.equal(parkBackdrop('London Stadium', none), null)
})

test('an MiLB park degrades to nothing, and picks the art up the day it lands', () => {
  assert.equal(parkBackdrop('Fifth Third Field', none), null)
  // The whole degradation story: nothing about this module knows about levels,
  // so a minor-league park works the moment its photo exists in the copy store.
  const ids = fieldIds(venueKey('Fifth Third Field'))
  const withArt = reader({ [ids.photo]: 'https://example.com/fifththird.jpg' })
  assert.equal(parkBackdrop('Fifth Third Field', withArt).cssUrl, 'url("https://example.com/fifththird.jpg")')
})

test('an owner override wins over the bundled photo, with their own crop', () => {
  const ids = fieldIds(venueKey('Wrigley Field'))
  const t = reader({
    [ids.photo]: 'https://blob.example.com/wrigley.jpg',
    [ids.focus]: '50 20',
  })
  const park = parkBackdrop('Wrigley Field', t)
  assert.equal(park.cssUrl, 'url("https://blob.example.com/wrigley.jpg")')
  // No build step makes a thumbnail for an admin's own upload, so mobile
  // falls back to the same full photo rather than a smaller companion.
  assert.equal(park.mobileCssUrl, 'url("https://blob.example.com/wrigley.jpg")')
  assert.equal(park.focus, '50% 20%')
  assert.equal(park.name, 'Wrigley Field')
})

test('resolvePhoto drops the bundled credit rather than inheriting it on an override', () => {
  // Somebody else's name under somebody else's photograph is a worse failure
  // than no credit at all. parkBackdrop no longer surfaces credit at all (no
  // hover title on the slate card), but resolvePhoto's own rule still backs
  // the Ballpark card's real, linked attribution — pinned here since this
  // file already holds the fixtures for it.
  const photo = resolvePhoto('Wrigley Field', { photo: 'https://blob.example.com/wrigley.jpg' })
  assert.equal(photo.creditText, '')
})

test('a src that would not be safe in a CSS url() yields no backdrop', () => {
  const ids = fieldIds(venueKey('Wrigley Field'))
  for (const bad of ['javascript:alert(1)', 'http://example.com/x.jpg', 'https://e.com/a b.jpg']) {
    assert.equal(parkBackdrop('Wrigley Field', reader({ [ids.photo]: bad })), null, bad)
  }
})

test('no venue name at all is not an error', () => {
  assert.equal(parkBackdrop('', none), null)
  assert.equal(parkBackdrop(undefined, none), null)
})

// The registry connection, pinned. The test above ("picks the art up the day
// it lands") proves parkBackdrop's OWN plumbing; this proves the id it looks
// up is actually one an admin's save can reach — milbParkFields() in
// registry.js derives the exact same venueKey(rawFeedName) scheme this module
// falls back to for an uncatalogued park, and the two are free to drift apart
// silently (neither imports the other). If they ever did, a MiLB owner's
// upload would keep "succeeding" while the slate card quietly never showed it.
test('a real MiLB park (off the generated list) has a registry id for the backdrop to find', () => {
  const ids = fieldIds(venueKey('Louisville Slugger Field'))
  assert.ok(FIELD_IDS.includes(ids.photo), `${ids.photo} is a real registry field`)
  assert.ok(FIELD_IDS.includes(ids.focus), `${ids.focus} is a real registry field`)
})
