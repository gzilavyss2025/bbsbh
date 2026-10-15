// actionPhotoUrl (#1863): the player page hero's action photo URL.
import assert from 'node:assert/strict'
import test from 'node:test'
import { actionPhotoUrl } from '../src/lib/headshot/actionPhoto.js'

const BASE = 'https://img.mlbstatic.com/mlb-photos/image/upload'

test('no personId gives null', () => {
  assert.equal(actionPhotoUrl(null), null)
  assert.equal(actionPhotoUrl(undefined), null)
  assert.equal(actionPhotoUrl(0), null)
})

test('the default is the vertical variant at w_525', () => {
  assert.equal(
    actionPhotoUrl(592885),
    `${BASE}/w_525,q_auto:best/v1/people/592885/action/vertical/current`,
  )
})

test('the pitching variant is allowed', () => {
  assert.equal(
    actionPhotoUrl(669203, { variant: 'pitching' }),
    `${BASE}/w_525,q_auto:best/v1/people/669203/action/pitching/current`,
  )
})

test('the width parameter changes w_', () => {
  assert.match(actionPhotoUrl(592885, { width: 300 }), /\/w_300,q_auto:best\//)
})

test('hitting and unknown variants give null (hitting always 404s)', () => {
  assert.equal(actionPhotoUrl(592885, { variant: 'hitting' }), null)
  assert.equal(actionPhotoUrl(592885, { variant: 'nope' }), null)
})

test('the URL never carries the d_people:generic default, so a miss stays a 404', () => {
  assert.ok(!actionPhotoUrl(592885).includes('d_people'))
})
