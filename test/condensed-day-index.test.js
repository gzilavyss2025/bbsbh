// Coverage for the per-day condensed-game index's generation-side policy
// (scripts/lib/highlights.mjs, src/api/gamePhotos.js's pickHeroPhoto): which
// content item becomes a day file's entry for a game, what gets stored about
// it, and which still (if any) becomes that entry's hero photo.
//
// This is the piece that decides what the home slate's revealed result cards
// render, so a regression here ships a wrong poster — or worse, a title (or a
// hero-photo field) that carries a score — to the app's most spoiler-sensitive
// surface.
//
// The condensedEntry fixtures are shaped from real items in gamePk 824403's
// content package (NYM@CLE, 2026-08-04), read 2026-08-06. The pickHeroPhoto
// fixtures reuse the same title/taxonomy cases test/game-photos.test.js pins
// for classifyPhotoAsset, since a hero-photo regression here is the same
// classification bug wearing a different hat.
import assert from 'node:assert/strict'
import test from 'node:test'
import { condensedEntry, dayIndexEntry } from '../scripts/lib/highlights.mjs'
import { pickHeroPhoto } from '../src/api/gamePhotos.js'

const tax = (values) => values.map((value) => ({ type: 'taxonomy', value }))
const cuts = [
  { aspectRatio: '16:9', width: 1920, src: 'https://img.mlbstatic.com/wide.jpg' },
  { aspectRatio: '16:9', width: 640, src: 'https://img.mlbstatic.com/640.jpg' },
  { aspectRatio: '4:3', width: 800, src: 'https://img.mlbstatic.com/tall.jpg' },
]

const condensed = {
  id: 'condensed-game-nym-cle-8-4-26',
  title: 'Condensed Game: NYM@CLE - 8/4/26',
  duration: '00:12:20',
  keywordsAll: tax(['condensed-game', 'vod']),
  image: { cuts },
  playbacks: [
    { name: 'hlsCloud', url: 'https://cuts.mlb.com/x.m3u8' },
    { name: 'mp4Avc', url: 'https://cuts.mlb.com/x.mp4' },
  ],
}
// The recap sits in the same package and is NOT interchangeable: its title
// carries the final score.
const recap = {
  id: 'luis-torrens-four-rbis-fuels-mets-6-2-win',
  title: "Luis Torrens' four RBIs fuels Mets' 6-2 win",
  duration: '00:03:15',
  keywordsAll: tax(['game-recap', 'vod']),
  image: { cuts },
  playbacks: [{ name: 'mp4Avc', url: 'https://cuts.mlb.com/recap.mp4' }],
}
const clip = {
  id: 'carson-benges-solo-home-run',
  title: "Carson Benge's solo home run (12)",
  keywordsAll: tax(['highlight', 'hitting']),
  image: { cuts },
  playbacks: [{ name: 'mp4Avc', url: 'https://cuts.mlb.com/clip.mp4' }],
}

test('condensedEntry stores what the card needs to render AND to play', () => {
  const entry = condensedEntry([clip, recap, condensed])
  assert.equal(entry.id, condensed.id)
  assert.equal(entry.title, condensed.title)
  assert.equal(entry.duration, '00:12:20')
  // The smallest 16:9 cut at least 640 wide — a card thumbnail wants neither
  // end of MLB's ~20-width ladder.
  assert.equal(entry.poster, 'https://img.mlbstatic.com/640.jpg')
  // Already resolved, so the reader re-derives nothing and a tap needs no
  // network at all.
  assert.deepEqual(entry.playbacks, {
    hls: 'https://cuts.mlb.com/x.m3u8',
    mp4: 'https://cuts.mlb.com/x.mp4',
  })
})

// The whole reason a score-carrying title never reaches a slate card: the
// recap is never mistaken for the condensed cut, even when it is the only
// long-form video in the package.
test('condensedEntry never falls back to the recap', () => {
  assert.equal(condensedEntry([clip, recap]), null)
})

test('condensedEntry is null when there is nothing to play', () => {
  assert.equal(condensedEntry([]), null)
  assert.equal(condensedEntry(undefined), null)
  // Tagged condensed but with no playable rendition — a poster with no video
  // behind it would be a card that dead-ends on tap.
  assert.equal(condensedEntry([{ ...condensed, playbacks: [] }]), null)
})

// A game whose condensed cut carries no usable still still plays; the card's
// own render is what decides how to cope with a missing poster.
test('condensedEntry tolerates a missing image', () => {
  const entry = condensedEntry([{ ...condensed, image: null }])
  assert.equal(entry.poster, null)
  assert.equal(entry.playbacks.mp4, 'https://cuts.mlb.com/x.mp4')
})

// --- pickHeroPhoto: the hero-photo pick that replaces MLB's own
// "CONDENSED GAME" graphic poster on the slate's revealed result cards ---

function withShapeProbe(shapes, run) {
  const originalFetch = globalThis.fetch
  let probes = 0
  globalThis.fetch = async (url) => {
    probes += 1
    const m = /\/upload\/fl_getinfo\/(mlb\/.+)$/.exec(String(url))
    const shape = m && shapes[m[1]]
    if (!shape) return { ok: false, status: 404, json: async () => ({}) }
    return { ok: true, status: 200, json: async () => ({ input: shape }) }
  }
  return Promise.resolve(run())
    .then((result) => ({ result, probes }))
    .finally(() => {
      globalThis.fetch = originalFetch
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

// --- dayIndexEntry: what actually lands in the day file ---

test('dayIndexEntry composes the condensed cut with its hero photo', () => {
  const heroPhoto = { original: 'https://img.mlbstatic.com/mlb-images/image/upload/mlb/shot1.jpg', thumb: '...' }
  const entry = dayIndexEntry(condensedEntry([condensed]), heroPhoto)
  assert.equal(entry.title, condensed.title)
  assert.equal(entry.heroPhoto, heroPhoto)
})

test('dayIndexEntry stores null rather than omitting the field when there is no hero photo', () => {
  const entry = dayIndexEntry(condensedEntry([condensed]), null)
  assert.equal(entry.heroPhoto, null)
  assert.ok('heroPhoto' in entry)
})
