// The play-by-play Watch button's two film sources
// (src/components/highlights/watchClip.js).
//
// The button used to render only where MLB had cut an edited highlight, which
// is about 7% of plays — 23 clips against 327 pitches on gamePk 824634. Every
// pitch has a raw clip keyed on the same playId the card already holds, so the
// widened condition is what these tests pin: the package still wins when there
// is one, and a bare playId is enough on its own — on a game that HAS raw film.
//
// That last clause is the correction. A playId is not a promise: MiLB games,
// anything before 2016 and the All-Star game all carry playIds and no clips at
// all, so the widened button drew on every at-bat of those games and answered
// every tap with "hasn't posted yet — clips usually land 8 to 26 minutes after
// the play", days after the final out. The per-game answer rides in as
// `filmEligible` (filmCanExist, api/expresslane/eligibility.js).
//
// Offline, like every test in this suite. The resolver takes an injected
// fetcher, so nothing here touches a host that blocks automated access.
import assert from 'node:assert/strict'
import test from 'node:test'
import { CLIP_PACKAGE, CLIP_RAW, watchClipSource, resolveRawClip, createClipLookup } from '../src/components/highlights/watchClip.js'

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

test('a playId on a game with no raw film offers nothing', () => {
  // THE MiLB / pre-2016 / All-Star case. Every at-bat of a Triple-A game
  // carries a playId — 239 of them on gamePk 816825, a Buffalo-Charlotte game
  // that was two days finished — and not one of them resolves to a clip. A
  // button that can only ever say "not posted yet" is worse than no button, so
  // there is no button.
  assert.equal(watchClipSource(null, 'play-3', { filmEligible: false }), null)
})

test('an edited package still draws where raw film cannot exist', () => {
  // MLB cuts highlights for MiLB games and for seasons long before 2016, and
  // the package is already in hand by the time this is asked — fetched, and
  // joined to the play on its guid. The per-game rule is about RAW clips, so
  // gating the package on it too would throw away film that plays.
  const item = { guid: 'play-4', title: 'A produced cut' }
  assert.equal(watchClipSource(item, 'play-4', { filmEligible: false }), CLIP_PACKAGE)
})

test('a caller that says nothing about the game still gets the raw clip', () => {
  // The default is permissive on purpose: losing a working clip because a
  // caller could not answer is the worse failure of the two.
  assert.equal(watchClipSource(null, 'play-5'), CLIP_RAW)
  assert.equal(watchClipSource(null, 'play-5', {}), CLIP_RAW)
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

// --- the lookup both Watch buttons share (useWatchClip) ---------------------

// A lookup wired to the real resolver and a fake host, collecting what it hands
// back. `clipUrlCache` is module-wide, so each test uses playIds of its own.
function lookupOver(fake) {
  const got = []
  const resolve = (id, opts) => resolveRawClip(id, { ...opts, fetchImpl: fake.impl })
  return { got, lookup: createClipLookup((r) => got.push(r), resolve) }
}

test('a hit is reused: a second tap on the same play asks the host nothing', async () => {
  const fake = fakeFetcher({ 'lk-hit': page('lk-token') })
  const { got, lookup } = lookupOver(fake)
  await lookup.start('lk-hit')
  await lookup.start('lk-hit')
  assert.equal(fake.calls.length, 1)
  assert.deepEqual(got.map((r) => r.src), [
    'https://sporty-clips.mlb.com/lk-token.mp4',
    'https://sporty-clips.mlb.com/lk-token.mp4',
  ])
})

test('a miss is never kept: the next tap asks again and gets the clip once it posts', async () => {
  const bodies = {}
  const fake = fakeFetcher(bodies)
  const { got, lookup } = lookupOver(fake)
  await lookup.start('lk-late')
  assert.equal(got[0].src, null)
  assert.notEqual(got[0].notice, '')
  bodies['lk-late'] = page('lk-posted')
  await lookup.start('lk-late')
  assert.equal(fake.calls.length, 2)
  assert.equal(got[1].src, 'https://sporty-clips.mlb.com/lk-posted.mp4')
})

// A resolver the test settles by hand, so an answer can arrive late.
function deferredResolve() {
  const waiting = []
  const resolve = (id, opts) => new Promise((done) => waiting.push({ id, opts, done }))
  return { waiting, resolve }
}

test('an abort drops a late answer', async () => {
  const d = deferredResolve()
  const got = []
  const lookup = createClipLookup((r) => got.push(r), d.resolve)
  const tap = lookup.start('lk-abort')
  lookup.cancel()
  assert.equal(d.waiting[0].opts.signal.aborted, true)
  d.waiting[0].done({ src: 'late.mp4', notice: '' })
  await tap
  assert.deepEqual(got, [])
})

test('a newer tap supersedes the one still in flight', async () => {
  const d = deferredResolve()
  const got = []
  const lookup = createClipLookup((r) => got.push(r), d.resolve)
  const first = lookup.start('lk-one')
  const second = lookup.start('lk-two')
  d.waiting[1].done({ src: 'two.mp4', notice: '' })
  d.waiting[0].done({ src: 'one.mp4', notice: '' })
  await Promise.all([first, second])
  assert.deepEqual(got.map((r) => r.src), ['two.mp4'])
})

test('a double-tap on a play still resolving asks the host once', async () => {
  // The clip host blocks a client that bursts (clipIndex.js). A second tap on
  // the same play while its lookup is in flight must not send a second
  // request, and must not abort the first one.
  const d = deferredResolve()
  const got = []
  const lookup = createClipLookup((r) => got.push(r), d.resolve)
  const first = lookup.start('lk-double')
  const second = lookup.start('lk-double')
  assert.equal(d.waiting.length, 1, 'one request to the host')
  assert.equal(d.waiting[0].opts.signal.aborted, false, 'the first lookup keeps going')
  d.waiting[0].done({ src: 'double.mp4', notice: '' })
  await Promise.all([first, second])
  assert.deepEqual(got.map((r) => r.src), ['double.mp4'])
})

test('an unmounted lookup hands nothing back', async () => {
  // The hook's effect cleanup is `cancel`.
  const d = deferredResolve()
  const got = []
  const lookup = createClipLookup((r) => got.push(r), d.resolve)
  const tap = lookup.start('lk-gone')
  lookup.cancel()
  d.waiting[0].done({ src: 'gone.mp4', notice: '' })
  await tap
  assert.deepEqual(got, [])
})
