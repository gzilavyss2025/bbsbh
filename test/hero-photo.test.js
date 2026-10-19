// Coverage for pickHeroPhoto (src/api/gamePhotos.js): which still, if any,
// stands in for MLB's "CONDENSED GAME" graphic poster on the box score's video
// row. The fixtures reuse the same title/taxonomy cases test/game-photos.test.js
// pins for classifyPhotoAsset, since a hero-photo regression here is the same
// classification bug wearing a different hat.
import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { pickHeroPhoto } from '../src/api/gamePhotos.js'

function withShapeProbe(shapes, run) {
  let probes = 0
  const fetchMock = mock.method(globalThis, 'fetch', async (url) => {
    probes += 1
    const m = /\/upload\/fl_getinfo\/(mlb\/.+)$/.exec(String(url))
    const shape = m && shapes[m[1]]
    if (!shape) return { ok: false, status: 404, json: async () => ({}) }
    return { ok: true, status: 200, json: async () => ({ input: shape }) }
  })
  return Promise.resolve(run())
    .then((result) => ({ result, probes }))
    .finally(() => {
      fetchMock.mock.restore()
    })
}

function highlightItem({ id, title = '', taxonomy = [] }) {
  return {
    image: {
      title,
      templateUrl: `https://img.mlbstatic.com/mlb-images/image/upload/{formatInstructions}/mlb/${id}`,
    },
    keywordsAll: taxonomy.map((value) => ({ type: 'taxonomy', value })),
  }
}

test('pickHeroPhoto resolves a photographer still from its filename alone, no shape probe', async () => {
  const { result, probes } = await withShapeProbe({}, () =>
    pickHeroPhoto([highlightItem({ id: 'shot1', title: 'GettyImages-2288816314' })]),
  )
  assert.deepEqual(result, {
    original: 'https://img.mlbstatic.com/mlb-images/image/upload/mlb/shot1.jpg',
    thumb: 'https://img.mlbstatic.com/mlb-images/image/upload/w_480/mlb/shot1.jpg',
  })
  assert.equal(probes, 0)
})

test('pickHeroPhoto stops at the first photographer still and never probes the rest', async () => {
  const { result, probes } = await withShapeProbe({}, () =>
    pickHeroPhoto([
      highlightItem({ id: 'shot1', title: 'GettyImages-1111111' }),
      highlightItem({ id: 'shot2', title: 'GettyImages-2222222' }),
      highlightItem({ id: 'shot3', title: 'GettyImages-3333333' }),
    ]),
  )
  assert.equal(result.original.endsWith('shot1.jpg'), true)
  assert.equal(probes, 0)
})

test('pickHeroPhoto falls back to a broadcast frame when no photographer still exists', async () => {
  const { result } = await withShapeProbe(
    { 'mlb/card1.jpg': { width: 1920, height: 1080 }, 'mlb/frame1.jpg': { width: 1280, height: 720 } },
    () =>
      pickHeroPhoto([
        highlightItem({ id: 'card1', title: 'Bullpen availability', taxonomy: ['darkroom-bullpen'] }),
        highlightItem({ id: 'frame1', title: "Andy Pages' two-run single - thumbnail" }),
      ]),
  )
  assert.equal(result.original.endsWith('frame1.jpg'), true)
})

test('pickHeroPhoto returns null rather than a graphic card', async () => {
  const { result } = await withShapeProbe({ 'mlb/card1.jpg': { width: 1920, height: 1080 } }, () =>
    pickHeroPhoto([highlightItem({ id: 'card1', title: 'Bullpen availability', taxonomy: ['darkroom-bullpen'] })]),
  )
  assert.equal(result, null)
})

test('pickHeroPhoto skips the condensed-game card itself even though it is 1280x720 like a real frame', async () => {
  // The exact graphic this feature exists to REPLACE — a still tagged
  // condensed-game must never come back as its own hero photo.
  const { result } = await withShapeProbe(
    { 'mlb/poster1.jpg': { width: 1280, height: 720 }, 'mlb/frame1.jpg': { width: 1280, height: 720 } },
    () =>
      pickHeroPhoto([
        highlightItem({
          id: 'poster1',
          title: 'Condensed Game: PIT@NYY - 7/20/26 - thumbnail',
          taxonomy: ['condensed-game'],
        }),
        highlightItem({ id: 'frame1', title: "Andy Pages' two-run single - thumbnail" }),
      ]),
  )
  assert.equal(result.original.endsWith('frame1.jpg'), true)
})

test('pickHeroPhoto returns null for a game with no items', async () => {
  assert.equal(await pickHeroPhoto([]), null)
  assert.equal(await pickHeroPhoto(undefined), null)
})

test('pickHeroPhoto probes a repeated crop/density variant of the same photo only once', async () => {
  const { result, probes } = await withShapeProbe({ 'mlb/frame1.jpg': { width: 1280, height: 720 } }, () =>
    pickHeroPhoto([
      highlightItem({ id: 'frame1', title: "Andy Pages' two-run single - thumbnail" }),
      highlightItem({ id: 'frame1', title: "Andy Pages' two-run single - thumbnail" }),
    ]),
  )
  assert.equal(result.original.endsWith('frame1.jpg'), true)
  assert.equal(probes, 1)
})

// Never legible as plain text — pickHeroPhoto's return carries only URLs, no
// headline/focus — because this feeds a file the slate fetches whole for
// every game on the date, revealed or not (see the module header).
test('pickHeroPhoto never returns anything beyond original/thumb URLs', async () => {
  const { result } = await withShapeProbe({}, () =>
    pickHeroPhoto([highlightItem({ id: 'shot1', title: 'GettyImages-1111111' })]),
  )
  assert.deepEqual(Object.keys(result).sort(), ['original', 'thumb'])
})
