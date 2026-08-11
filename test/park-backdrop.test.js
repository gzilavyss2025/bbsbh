import test from 'node:test'
import assert from 'node:assert/strict'

import { parkBackdrop } from '../src/lib/ballpark/parkBackdrop.js'
import { fieldIds, venueKey } from '../src/lib/ballpark/ballparkArt.js'

// The copy reader the real caller passes (useCopy().t), as a plain map lookup
// that answers '' for anything unset — exactly what the provider does for an id
// the registry does not know.
const reader = (overrides = {}) => (id) => overrides[id] ?? ''
const none = reader()

test('a bundled park resolves to its photo, centred by default', () => {
  const park = parkBackdrop('Fenway Park', none)
  assert.equal(park.cssUrl, 'url("/ballparks/fenwaypark.jpg")')
  assert.equal(park.focus, '50% 50%')
  assert.match(park.title, /^Fenway Park — Photo: /)
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
    [ids.credit]: 'Gary Z.',
  })
  const park = parkBackdrop('Wrigley Field', t)
  assert.equal(park.cssUrl, 'url("https://blob.example.com/wrigley.jpg")')
  assert.equal(park.focus, '50% 20%')
  assert.equal(park.title, 'Wrigley Field — Gary Z.')
})

test('an override drops the bundled credit rather than inheriting it', () => {
  // Somebody else's name under somebody else's photograph is a worse failure
  // than no credit at all — resolvePhoto's rule, pinned here too because this
  // surface is the one that shows the credit with no link beside it.
  const ids = fieldIds(venueKey('Wrigley Field'))
  const t = reader({ [ids.photo]: 'https://blob.example.com/wrigley.jpg' })
  assert.equal(parkBackdrop('Wrigley Field', t).title, 'Wrigley Field')
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
