import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyPhotoAsset,
  fetchGamePhotos,
  onlyPhotographer,
  photosForPlayer,
  photosForTeam,
  withoutGraphics,
} from '../src/api/gamePhotos.js'

function mockContentFetch(body) {
  return async () => ({ ok: true, status: 200, json: async () => body })
}

async function withMockedFetch(body, run) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = mockContentFetch(body)
  try {
    await run()
  } finally {
    globalThis.fetch = originalFetch
  }
}

// The content endpoint and the CDN's `fl_getinfo` shape probe are different
// hosts, so a classification test has to answer both. `shapes` maps a photo id
// to the `{input:{width,height}}` Cloudinary reports for it; an id left out
// probes as a failure, which is the `unknown` path.
function withMockedGame(body, shapes, run) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    const getinfo = /\/upload\/fl_getinfo\/(mlb\/.+)$/.exec(String(url))
    if (!getinfo) return { ok: true, status: 200, json: async () => body }
    const shape = shapes[getinfo[1]]
    if (!shape) return { ok: false, status: 404, json: async () => ({}) }
    return { ok: true, status: 200, json: async () => ({ input: shape }) }
  }
  return Promise.resolve(run()).finally(() => {
    globalThis.fetch = originalFetch
  })
}

// One highlight item shaped like the real feed: the photo id rides
// `image.templateUrl`, attribution rides `keywordsAll`.
function item({ id, title = '', headline = '', players = [], teams = [], taxonomy = [] }) {
  return {
    headline,
    image: {
      title,
      templateUrl: `https://img.mlbstatic.com/mlb-images/image/upload/{formatInstructions}/mlb/${id}`,
    },
    keywordsAll: [
      ...players.map((p) => ({ type: 'player', value: `playerid-${p.id}`, displayName: p.name })),
      ...teams.map((t) => ({ type: 'team', value: `teamid-${t.id}`, displayName: t.name })),
      ...taxonomy.map((v) => ({ type: 'taxonomy', value: v, displayName: v })),
    ],
  }
}

const gameWith = (items) => ({ highlights: { highlights: { items } } })

const SHOT_3x2 = { width: 4000, height: 2668 }
const BROADCAST_FRAME = { width: 1280, height: 720 }
const STATCAST_CARD = { width: 1920, height: 1080 }

test('fetchGamePhotos strips the resize transform back to the original upload', async () => {
  await withMockedFetch(
    {
      editorial: {
        recap: {
          photo: {
            cuts: {
              full: {
                src: 'https://img.mlbstatic.com/mlb-images/image/upload/t_16x9/t_w2208/mlb/abc123.jpg',
              },
            },
          },
        },
      },
    },
    async () => {
      const photos = await fetchGamePhotos(825061)
      assert.equal(photos.length, 1)
      assert.equal(
        photos[0].original,
        'https://img.mlbstatic.com/mlb-images/image/upload/mlb/abc123.jpg',
      )
    },
  )
})

test('fetchGamePhotos builds a thumbnail by inserting a bare width param', async () => {
  await withMockedFetch(
    {
      photo: 'https://img.mlbstatic.com/mlb-images/image/upload/t_w2208/mlb/abc123.jpg',
    },
    async () => {
      const [photo] = await fetchGamePhotos(825061)
      assert.equal(
        photo.thumb,
        'https://img.mlbstatic.com/mlb-images/image/upload/w_480/mlb/abc123.jpg',
      )
    },
  )
})

test('fetchGamePhotos dedupes repeated crop/density variants of the same photo id', async () => {
  await withMockedFetch(
    {
      variants: [
        'https://img.mlbstatic.com/mlb-images/image/upload/t_16x9/t_w2208/mlb/abc123.jpg',
        'https://img.mlbstatic.com/mlb-images/image/upload/t_1x1/t_w1080/mlb/abc123.jpg',
        'https://img.mlbstatic.com/mlb-images/image/upload/mlb/abc123.jpg',
      ],
    },
    async () => {
      const photos = await fetchGamePhotos(825061)
      assert.equal(photos.length, 1)
    },
  )
})

test('fetchGamePhotos appends .jpg when the id segment carries no extension', async () => {
  await withMockedFetch(
    { photo: 'https://img.mlbstatic.com/mlb-images/image/upload/t_w2208/mlb/abc123' },
    async () => {
      const [photo] = await fetchGamePhotos(825061)
      assert.equal(
        photo.original,
        'https://img.mlbstatic.com/mlb-images/image/upload/mlb/abc123.jpg',
      )
    },
  )
})

test('fetchGamePhotos rejects unresolved {formatInstructions} template rows', async () => {
  await withMockedFetch(
    {
      template: 'https://img.mlbstatic.com/mlb-images/image/upload/t_w2208/mlb/{formatInstructions}',
      real: 'https://img.mlbstatic.com/mlb-images/image/upload/t_w2208/mlb/abc123.jpg',
    },
    async () => {
      const photos = await fetchGamePhotos(825061)
      assert.equal(photos.length, 1)
      assert.ok(photos[0].original.endsWith('mlb/abc123.jpg'))
    },
  )
})

test('fetchGamePhotos ignores non-mlbstatic strings and other CDN hosts', async () => {
  await withMockedFetch(
    {
      unrelated: 'https://example.com/mlb-images/image/upload/mlb/abc123.jpg',
      note: 'just a plain string, not a URL',
    },
    async () => {
      const photos = await fetchGamePhotos(825061)
      assert.deepEqual(photos, [])
    },
  )
})

test('fetchGamePhotos degrades to [] when the content endpoint fails', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) })
  try {
    const photos = await fetchGamePhotos(999999)
    assert.deepEqual(photos, [])
  } finally {
    globalThis.fetch = originalFetch
  }
})

// --- classification (see the module header for the field evidence) ---

test('classifyPhotoAsset reads an agency/stills filename as a photographer shot', () => {
  for (const title of [
    'GettyImages-2288816314',
    'AP26207729897463',
    'f6411e6b-7736-4575-b20b-a467802ded73Vasquez',
    '8e5270c4-a70a-429e-bb44-b13122f9d87cthumbnail6160372631499957687',
    'AndrewBenintendi_Getty_20260720',
    'LuisAngelAcuna_Greenfly_20260720',
  ]) {
    assert.equal(classifyPhotoAsset({ title }), 'photographer', title)
  }
})

test('classifyPhotoAsset trusts the filename before any shape probe', () => {
  // A wire still MLB happens to serve at 16:9 must not read as a graphic —
  // the name settles it, which is also why these cost no probe at all.
  assert.equal(
    classifyPhotoAsset({ title: 'GettyImages-2288816314', shape: STATCAST_CARD }),
    'photographer',
  )
})

test('classifyPhotoAsset reads a 3:2 original as a photographer shot whatever it is named', () => {
  // The case filenames alone get wrong: MLB's CMS renames a large share of
  // stills to the same "<headline> - thumbnail" it gives auto frame grabs.
  assert.equal(
    classifyPhotoAsset({ title: "Brady Singer's six Ks - thumbnail", shape: SHOT_3x2 }),
    'photographer',
  )
})

test('classifyPhotoAsset separates a broadcast frame from a Statcast card by width', () => {
  assert.equal(classifyPhotoAsset({ title: 'slack-w', shape: BROADCAST_FRAME }), 'broadcast')
  assert.equal(classifyPhotoAsset({ title: 'slack-w', shape: STATCAST_CARD }), 'graphic')
})

test('classifyPhotoAsset catches a condensed-game card served at broadcast size', () => {
  // "CONDENSED GAME" over the two clubs' marks — a designed card, but 1280x720
  // like a frame grab, so only the taxonomy tag distinguishes it.
  assert.equal(
    classifyPhotoAsset({
      title: 'Condensed Game: PIT@NYY - 7/20/26 - thumbnail',
      taxonomy: ['condensed-game'],
      shape: BROADCAST_FRAME,
    }),
    'graphic',
  )
})

test('classifyPhotoAsset keeps a "Data Viz" clip\'s broadcast frame out of the graphics', () => {
  // Tagged data-visualization, but the thumbnail is an ordinary broadcast
  // frame — treating that tag as a graphic signal dropped a real photo.
  assert.equal(
    classifyPhotoAsset({
      title: "Data Viz: Salvador Perez's 440-foot home run - thumbnail",
      taxonomy: ['data-visualization', 'in-game-data-visualization'],
      shape: BROADCAST_FRAME,
    }),
    'broadcast',
  )
})

test('classifyPhotoAsset never lets taxonomy override a non-16:9 shape', () => {
  assert.equal(
    classifyPhotoAsset({ title: 'whatever', taxonomy: ['darkroom-bat-track'], shape: SHOT_3x2 }),
    'photographer',
  )
})

test('classifyPhotoAsset reports unknown rather than guessing when the probe fails', () => {
  assert.equal(classifyPhotoAsset({ title: 'guardians7hrs', shape: null }), 'unknown')
})

// --- attribution + wiring ---

test('fetchGamePhotos attributes each photo to its subject player and team', async () => {
  const body = gameWith([
    item({
      id: 'aaa111',
      title: 'GettyImages-2288816314',
      headline: "Ceddanne Rafaela's solo homer (15)",
      players: [{ id: 678882, name: 'Ceddanne Rafaela' }],
      teams: [{ id: 111, name: 'Boston Red Sox' }],
    }),
  ])
  await withMockedGame(body, { 'mlb/aaa111.jpg': SHOT_3x2 }, async () => {
    const [photo] = await fetchGamePhotos(823919)
    assert.equal(photo.kind, 'photographer')
    assert.equal(photo.focus.playerId, 678882)
    assert.equal(photo.focus.playerName, 'Ceddanne Rafaela')
    assert.equal(photo.focus.teamId, 111)
    assert.equal(photo.focus.teamName, 'Boston Red Sox')
    assert.equal(photo.headline, "Ceddanne Rafaela's solo homer (15)")
  })
})

test('fetchGamePhotos records every tagged player so a montage is findable under each', async () => {
  const body = gameWith([
    item({
      id: 'aaa111',
      title: 'GettyImages-1',
      players: [
        { id: 1, name: 'First Guy' },
        { id: 2, name: 'Second Guy' },
      ],
      teams: [{ id: 158, name: 'Milwaukee Brewers' }],
    }),
  ])
  await withMockedGame(body, { 'mlb/aaa111.jpg': SHOT_3x2 }, async () => {
    const photos = await fetchGamePhotos(823919)
    assert.deepEqual(photos[0].focus.playerIds, [1, 2])
    assert.equal(photosForPlayer(photos, 2).length, 1)
    assert.equal(photosForPlayer(photos, 99).length, 0)
    assert.equal(photosForTeam(photos, 158).length, 1)
    assert.equal(photosForTeam(photos, 111).length, 0)
  })
})

test('fetchGamePhotos classifies a mixed game and sorts photographer shots first', async () => {
  const body = gameWith([
    item({ id: 'card1', title: 'Bullpen availability for Boston', taxonomy: ['darkroom-bullpen'] }),
    item({ id: 'frame1', title: "Andy Pages' two-run single - thumbnail" }),
    item({ id: 'shot1', title: 'GettyImages-2288816314' }),
  ])
  const shapes = {
    'mlb/card1.jpg': STATCAST_CARD,
    'mlb/frame1.jpg': BROADCAST_FRAME,
    'mlb/shot1.jpg': SHOT_3x2,
  }
  await withMockedGame(body, shapes, async () => {
    const photos = await fetchGamePhotos(823919)
    assert.deepEqual(
      photos.map((p) => p.kind),
      ['photographer', 'broadcast', 'graphic'],
    )
    assert.deepEqual(
      withoutGraphics(photos).map((p) => p.id),
      ['mlb/shot1.jpg', 'mlb/frame1.jpg'],
    )
  })
})

test('onlyPhotographer drops broadcast frames as well as graphic cards', async () => {
  const body = gameWith([
    item({ id: 'card1', title: 'Bullpen availability for Boston', taxonomy: ['darkroom-bullpen'] }),
    item({ id: 'frame1', title: "Andy Pages' two-run single - thumbnail" }),
    item({ id: 'shot1', title: 'GettyImages-2288816314' }),
  ])
  const shapes = {
    'mlb/card1.jpg': STATCAST_CARD,
    'mlb/frame1.jpg': BROADCAST_FRAME,
    'mlb/shot1.jpg': SHOT_3x2,
  }
  await withMockedGame(body, shapes, async () => {
    const photos = await fetchGamePhotos(823919)
    assert.deepEqual(
      onlyPhotographer(photos).map((p) => p.id),
      ['mlb/shot1.jpg'],
    )
  })
})

test('withoutGraphics keeps an unclassifiable photo rather than dropping it silently', async () => {
  // No shape came back, so the kind is `unknown` — failing open is the whole
  // point: a lost photo is worse here than a stray card.
  const body = gameWith([item({ id: 'mystery', title: 'guardians7hrs' })])
  await withMockedGame(body, {}, async () => {
    const photos = await fetchGamePhotos(823919)
    assert.equal(photos[0].kind, 'unknown')
    assert.equal(withoutGraphics(photos).length, 1)
  })
})

test('fetchGamePhotos still sweeps up a photo parked outside the highlight items', async () => {
  // The legacy recursive walk — an editorial article photo has no highlight
  // item to attribute it to, but must not vanish from the gallery.
  const body = {
    ...gameWith([item({ id: 'shot1', title: 'GettyImages-1' })]),
    editorial: {
      recap: {
        photo: {
          cuts: { full: { src: `${'https://img.mlbstatic.com/mlb-images/image/upload'}/t_16x9/mlb/stray1.jpg` } },
        },
      },
    },
  }
  await withMockedGame(body, { 'mlb/shot1.jpg': SHOT_3x2, 'mlb/stray1.jpg': SHOT_3x2 }, async () => {
    const photos = await fetchGamePhotos(823919)
    assert.equal(photos.length, 2)
    const stray = photos.find((p) => p.id === 'mlb/stray1.jpg')
    assert.equal(stray.kind, 'photographer')
    assert.equal(stray.focus.playerId, null)
    assert.deepEqual(stray.focus.playerIds, [])
  })
})
