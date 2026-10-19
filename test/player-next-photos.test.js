// The Photos module's pure view (src/screens/player/next/modules/photos/photosView.js, #2021).
// The spoiler half: a game still being played never contributes a photo (its headlines can read the result).
import test from 'node:test'
import assert from 'node:assert/strict'
import { mergePhotos, newestFirst, photoCell, photoGames } from '../src/screens/player/next/modules/photos/photosView.js'

const split = (gamePk, date, gameNumber = 1) => ({ date, gameType: 'R', game: { gamePk, gameNumber } })
// fetchFinalScores' map: only the games the schedule calls Final, scored, and not resuming today.
const finals = (...pks) => new Map(pks.map((pk) => [pk, {}]))
// 2026-10-14 at noon Pacific.

test('a game contributes photos once the schedule calls it final, whatever its date (ADR-0117)', () => {
  assert.deepEqual(photoGames([split(1, '2026-10-14'), split(2, '2026-10-13')], finals(1, 2)), [
    { gamePk: 1, apiDate: '2026-10-14' },
    { gamePk: 2, apiDate: '2026-10-13' },
  ])
})

test('a game that is not final (still on, or suspended) contributes no photo', () => {
  assert.deepEqual(photoGames([split(1, '2026-10-12'), split(2, '2026-10-13')], finals(1)), [
    { gamePk: 1, apiDate: '2026-10-12' },
  ])
})

test('a final game from the day before is kept; rows with no gamePk or no date are dropped; newest first', () => {
  const rows = [split(1, '2026-10-11'), split(2, '2026-10-13'), split(null, '2026-10-12'), split(3, '')]
  assert.deepEqual(photoGames(newestFirst(rows), finals(1, 2, 3, null)), [
    { gamePk: 2, apiDate: '2026-10-13' },
    { gamePk: 1, apiDate: '2026-10-11' },
  ])
})

test('the walk reads the log newest first, game 2 of a doubleheader before game 1, and keeps that order', () => {
  const rows = newestFirst([split(1, '2026-04-01'), split(4, '2026-09-27', 1), split(5, '2026-09-27', 2), split(3, '2026-06-15')])
  assert.deepEqual(rows.map((s) => s.game.gamePk), [5, 4, 3, 1])
  assert.deepEqual(photoGames(rows, finals(1, 3, 4, 5)).map((g) => g.gamePk), [5, 4, 3, 1])
})

test('photos are merged by id: a photo two games carry shows once', () => {
  const a = { id: 'a' }
  const b = { id: 'b' }
  assert.deepEqual(mergePhotos([a], [b, { id: 'a' }]), [a, b])
})

test('a cell captions with the headline; with none it has no caption, only its date', () => {
  const p = { id: 'x', original: 'O', thumb: 'T', headline: 'Turang lines a double', apiDate: '2026-09-27' }
  assert.deepEqual(photoCell(p), { id: 'x', href: 'O', thumb: 'T', date: '9/27', caption: 'Turang lines a double' })
  const bare = photoCell({ ...p, headline: '' })
  assert.equal(bare.caption, '')
  assert.equal(bare.date, '9/27')
})
