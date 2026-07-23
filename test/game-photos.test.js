import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchGamePhotos } from '../src/api/gamePhotos.js'

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
