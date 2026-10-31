// #2511: photos of your paper scorecard on a stamp. Device only, up to 4 a stamp.
import assert from 'node:assert/strict'
import test from 'node:test'

import { MAX_PHOTOS, withPhoto, withoutPhoto, loadPhotos, savePhotos, clearAllPhotos, photoExportFilename } from '../src/lib/scorecard-photos/store.js'

const photo = (id) => ({ id, blob: { size: 1 }, addedAt: id })

test('a stamp holds at most four photos', () => {
  assert.equal(MAX_PHOTOS, 4)
  let list = []
  for (let i = 1; i <= 5; i++) list = withPhoto(list, photo(i))
  assert.deepEqual(list.map((p) => p.id), [1, 2, 3, 4])
})

test('removing one photo keeps the others in order', () => {
  const list = [photo(1), photo(2), photo(3)]
  assert.deepEqual(withoutPhoto(list, 2).map((p) => p.id), [1, 3])
  assert.deepEqual(withoutPhoto(list, 9).map((p) => p.id), [1, 2, 3])
})

test('no IndexedDB (or a hostile one) degrades to empty and false, never a throw', async () => {
  assert.deepEqual(await loadPhotos(823035, { idb: undefined }), [])
  assert.equal(await savePhotos(823035, [photo(1)], { idb: null }), false)
  assert.equal(await clearAllPhotos({ idb: null }), false)
  const hostile = { open() { throw new Error('denied') } }
  assert.deepEqual(await loadPhotos(823035, { idb: hostile }), [])
})

test('the photo export has its own dated file name', () => {
  assert.equal(photoExportFilename(Date.parse('2026-10-31T12:00:00Z')), 'tally-scorecard-photos-2026-10-31.json')
})
