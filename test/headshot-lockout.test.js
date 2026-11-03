import { test } from 'node:test'
import assert from 'node:assert/strict'
import { playerPhotosOff } from '../src/lib/headshot/lockout.js'
import { coachHeadshotUrl, headshotSources, milbHeadshotUrl, realHeadshotUrl } from '../src/lib/teams.js'
import { actionPhotoUrl } from '../src/lib/headshot/actionPhoto.js'

const withSwitch = (value, fn) => {
  const prev = process.env.VITE_PLAYER_PHOTOS_OFF
  if (value === undefined) delete process.env.VITE_PLAYER_PHOTOS_OFF
  else process.env.VITE_PLAYER_PHOTOS_OFF = value
  try { fn() } finally {
    if (prev === undefined) delete process.env.VITE_PLAYER_PHOTOS_OFF
    else process.env.VITE_PLAYER_PHOTOS_OFF = prev
  }
}

test('playerPhotosOff is on only for the exact value 1', () => {
  assert.equal(playerPhotosOff({ VITE_PLAYER_PHOTOS_OFF: '1' }), true)
  assert.equal(playerPhotosOff({ VITE_PLAYER_PHOTOS_OFF: '0' }), false)
  assert.equal(playerPhotosOff({}), false)
  assert.equal(playerPhotosOff(undefined), false)
})

test('switch off: player photo URLs are built as usual', () => {
  withSwitch(undefined, () => {
    assert.match(realHeadshotUrl(592450), /headshot\/silo/)
    assert.match(actionPhotoUrl(592450), /action\/vertical/)
    assert.equal(headshotSources(592450, { mlb: true }).length, 2)
  })
})

test('switch on: no player photo URL, so Headshot falls to the team logo', () => {
  withSwitch('1', () => {
    assert.equal(realHeadshotUrl(592450), null)
    assert.equal(milbHeadshotUrl(592450), null)
    assert.equal(actionPhotoUrl(592450), null)
    // Coaches are not in the union; their photos stay.
    assert.match(coachHeadshotUrl(592450), /coach/)
    assert.deepEqual(headshotSources(592450, { mlb: true }), [coachHeadshotUrl(592450)])
    assert.deepEqual(headshotSources(592450), [coachHeadshotUrl(592450)])
    assert.deepEqual(headshotSources(1, { coach: true }), [coachHeadshotUrl(1)])
  })
})
