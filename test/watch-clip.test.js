// The play-by-play Watch button's two film sources
// (src/components/highlights/watchClip.js).
//
// The button used to render only where MLB had cut an edited highlight, which
// is about 7% of plays — 23 clips against 327 pitches on gamePk 824634. Every
// pitch has a raw clip keyed on the same playId the card already holds, so the
// widened condition is what these tests pin: the package still wins when there
// is one, and a bare playId is enough on its own.
//
// Offline, like every test in this suite. The resolver takes an injected
// fetcher, so nothing here touches a host that blocks automated access.
import assert from 'node:assert/strict'
import test from 'node:test'
import { CLIP_PACKAGE, CLIP_RAW, watchClipSource, resolveRawClip } from '../src/components/highlights/watchClip.js'

// What the Savant lookup returns for a play that has a clip.
const page = (token) =>
  `<video><source src="https://sporty-clips.mlb.com/${token}.mp4" type="video/mp4"></video>`

// Answers from a map of playId -> body, and counts what it was asked for.
function fakeFetcher(bodies) {
  const calls = []
  const impl = async (url) => {
    calls.push(url)
    const id = decodeURIComponent(String(url).split('playId=')[1] ?? '')
    const body = bodies[id]
    if (body === undefined) return { ok: false, status: 404, text: async () => '' }
    return { ok: true, status: 200, text: async () => body }
  }
  return { impl, calls }
}

// --- which source a play offers -------------------------------------------

test('an edited package wins, even though the raw clip is also there', () => {
  // Both exist for this play. The package is a produced cut with a title and
  // more than one angle; the raw clip is 7.5 seconds of one pitch. The better
  // one must win, so the raw path is a floor under the package and never a
  // replacement for it.
  const item = { guid: 'play-1', title: 'Jackson Chourio homers' }
  assert.equal(watchClipSource(item, 'play-1'), CLIP_PACKAGE)
})

test('a bare playId offers the raw clip', () => {
  // THE WIDENED CONDITION. The button's whole gate used to be the package, so
  // a play with a playId and no package showed nothing at all.
  assert.equal(watchClipSource(null, 'play-2'), CLIP_RAW)
  assert.equal(watchClipSource(undefined, 'play-2'), CLIP_RAW)
})

test('no package and no playId offers nothing', () => {
  assert.equal(watchClipSource(null, null), null)
  assert.equal(watchClipSource(null, undefined), null)
  assert.equal(watchClipSource(null, ''), null)
})

// --- the tap --------------------------------------------------------------

test('one tap makes one request and hands back the playable mp4', async () => {
  const fake = fakeFetcher({ 'tap-hit': page('token-hit') })
  const view = await resolveRawClip('tap-hit', { fetchImpl: fake.impl })
  assert.equal(view.src, 'https://sporty-clips.mlb.com/token-hit.mp4')
  assert.equal(view.notice, '')
  // One request, for one playId. A whole half resolved up front is what gets
  // the client blocked.
  assert.equal(fake.calls.length, 1)
})

test('a clip that has not published yet degrades to a notice, never a broken frame', async () => {
  const fake = fakeFetcher({})
  const view = await resolveRawClip('tap-miss', { fetchImpl: fake.impl })
  assert.equal(view.src, null)
  assert.match(view.notice, /yet/)
})

test('a refusal degrades the same way rather than throwing', async () => {
  const view = await resolveRawClip('tap-refused', {
    fetchImpl: async () => {
      throw new Error('network down')
    },
  })
  assert.equal(view.src, null)
  assert.ok(view.notice.length > 0)
})

test('a reader who leaves before the clip lands gets a notice, not a crash', async () => {
  const controller = new AbortController()
  controller.abort()
  const view = await resolveRawClip('tap-aborted', {
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => page('never-read') }),
    signal: controller.signal,
  })
  assert.equal(view.src, null)
  assert.ok(view.notice.length > 0)
})

test('a play with no playId is never asked about', async () => {
  const fake = fakeFetcher({})
  const view = await resolveRawClip(null, { fetchImpl: fake.impl })
  assert.equal(view.src, null)
  assert.equal(fake.calls.length, 0)
})
