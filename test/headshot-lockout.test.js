import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LOCKOUT_STARTS_AT, photoEnv, playerPhotosOff } from '../src/lib/headshot/lockout.js'
import { coachHeadshotUrl, headshotSources, milbHeadshotUrl, realHeadshotUrl } from '../src/lib/teams.js'
import { actionPhotoUrl } from '../src/lib/headshot/actionPhoto.js'
import { posterArtSources } from '../src/lib/preview/posterArt.js'

const withSetting = (value, fn) => {
  const prev = process.env.VITE_PLAYER_PHOTOS
  if (value === undefined) delete process.env.VITE_PLAYER_PHOTOS
  else process.env.VITE_PLAYER_PHOTOS = value
  try { fn() } finally {
    if (prev === undefined) delete process.env.VITE_PLAYER_PHOTOS
    else process.env.VITE_PLAYER_PHOTOS = prev
  }
}

const BEFORE = Date.parse('2026-12-02T05:00:59Z')
const AFTER = Date.parse('2026-12-02T05:01:00Z') // 12:01 a.m. ET, Dec 2

test('with no setting, the switch turns on when the CBA lapses', () => {
  assert.equal(LOCKOUT_STARTS_AT, AFTER)
  assert.equal(playerPhotosOff({}, BEFORE), false)
  assert.equal(playerPhotosOff({}, AFTER), true)
})

test('VITE_PLAYER_PHOTOS wins over the date both ways', () => {
  assert.equal(playerPhotosOff({ VITE_PLAYER_PHOTOS: 'off' }, BEFORE), true)
  assert.equal(playerPhotosOff({ VITE_PLAYER_PHOTOS: 'on' }, AFTER), false)
  assert.equal(playerPhotosOff({ VITE_PLAYER_PHOTOS: 'yes' }, BEFORE), false)
  assert.equal(playerPhotosOff({ VITE_PLAYER_PHOTOS: 'yes' }, AFTER), true)
})

test('photoEnv: the app reads Vite env as-is, so an unset setting follows the date', () => {
  const vite = { MODE: 'production' }
  assert.equal(photoEnv(vite, { VITE_PLAYER_PHOTOS: 'on' }), vite)
  assert.equal(playerPhotosOff(photoEnv(vite, {}), AFTER), true)
})

test('photoEnv: outside Vite, photos stay on unless process.env says otherwise', () => {
  assert.equal(playerPhotosOff(photoEnv(undefined, {}), AFTER), false)
  assert.equal(playerPhotosOff(photoEnv(undefined, undefined), AFTER), false)
  assert.equal(playerPhotosOff(photoEnv(undefined, { VITE_PLAYER_PHOTOS: 'off' }), BEFORE), true)
})

test('photos on: every rung is built as usual', () => {
  withSetting('on', () => {
    assert.deepEqual(headshotSources(592450, { mlb: true }), [realHeadshotUrl(592450), coachHeadshotUrl(592450)])
    assert.equal(headshotSources(592450).length, 3)
    assert.match(actionPhotoUrl(592450), /action\/vertical/)
  })
})

test('photos off: an MLB player has no photo rung at all, not even coach', () => {
  withSetting('off', () => {
    assert.deepEqual(headshotSources(592450, { mlb: true }), [])
    assert.equal(actionPhotoUrl(592450), null)
  })
})

test('photos off: minor leaguers and coaches keep their photos', () => {
  withSetting('off', () => {
    assert.deepEqual(headshotSources(808000), [realHeadshotUrl(808000), milbHeadshotUrl(808000), coachHeadshotUrl(808000)])
    assert.deepEqual(headshotSources(1, { coach: true }), [coachHeadshotUrl(1)])
    assert.match(realHeadshotUrl(592450), /headshot\/silo/)
  })
})

test('photos off: the preview poster drops MLB faces and keeps MiLB ones', () => {
  // 158 Brewers (MLB) at 556 Nashville (AAA): only the MLB side loses its photos.
  const model = {
    venue: { name: '' },
    away: { id: 158 },
    home: { id: 556 },
    starters: { away: { id: 1 }, home: { id: 2 } },
    lineups: { away: [{ id: 3, order: 1 }], home: [{ id: 4, order: 1 }] },
  }
  withSetting('off', () => {
    const { sources } = posterArtSources(model, {}, (k) => k)
    assert.equal(sources.awayShot, null)
    assert.equal(sources['shot:away:1'], null)
    assert.match(sources.homeShot, /people\/2\//)
    assert.match(sources['shot:home:1'], /people\/4\//)
  })
})
