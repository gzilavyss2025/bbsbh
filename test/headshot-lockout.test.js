import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LOCKOUT_STARTS_AT, playerPhotosOff } from '../src/lib/headshot/lockout.js'
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

const BEFORE = Date.parse('2026-12-02T05:00:59Z')
const AFTER = Date.parse('2026-12-02T05:01:00Z') // 12:01 a.m. ET, Dec 2

test('with no override, the switch turns on when the CBA lapses', () => {
  assert.equal(LOCKOUT_STARTS_AT, AFTER)
  assert.equal(playerPhotosOff({}, BEFORE), false)
  assert.equal(playerPhotosOff({}, AFTER), true)
})

test('the env override wins over the date both ways', () => {
  assert.equal(playerPhotosOff({ VITE_PLAYER_PHOTOS_OFF: '1' }, BEFORE), true)
  assert.equal(playerPhotosOff({ VITE_PLAYER_PHOTOS_OFF: '0' }, AFTER), false)
  assert.equal(playerPhotosOff({ VITE_PLAYER_PHOTOS_OFF: 'yes' }, BEFORE), false)
})

test('switch forced off: player photo URLs are built as usual', () => {
  withSwitch('0', () => {
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

test('outside Vite with no override, photos stay on even after the date (tests stay stable)', () => {
  withSwitch(undefined, () => {
    assert.equal(playerPhotosOff(undefined, AFTER), false)
  })
})
