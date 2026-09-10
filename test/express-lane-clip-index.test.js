// Express Lane Tier 2 — the clip index (src/api/expresslane/clipIndex.js).
//
// Every test here runs offline. The Savant resolver takes an injectable
// fetcher, so the parse, the memoization, the degradation path and the
// sequential queue are all exercised with a fake — no live network, and no
// request to a host that blocks automated access.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseSportyVideoHtml,
  resolveClipUrl,
  clipPosterUrl,
  buildClipIndex,
  loadClipIndex,
  saveClipIndex,
} from '../src/api/expresslane/clipIndex.js'

// The shape the Savant page returns: a video element whose source is an
// opaque sporty-clips mp4.
const page = (token) =>
  `<!doctype html><html><body><video controls playsinline>` +
  `<source src="https://sporty-clips.mlb.com/${token}.mp4" type="video/mp4">` +
  `</video></body></html>`

// A fetcher that answers from a map of playId -> body, records what it was
// asked for, and refuses to be called twice at once.
function fakeFetcher(bodies, { status = 200 } = {}) {
  const calls = []
  let inFlight = 0
  let maxInFlight = 0
  const impl = async (url, options) => {
    // Behave like the real thing: a caller that has already given up gets a
    // rejection, not a body.
    if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    calls.push(url)
    inFlight += 1
    maxInFlight = Math.max(maxInFlight, inFlight)
    await Promise.resolve()
    inFlight -= 1
    const id = decodeURIComponent(String(url).split('playId=')[1] ?? '')
    const body = bodies[id]
    if (body === undefined) return { ok: false, status: 404, text: async () => '' }
    return { ok: status === 200, status, text: async () => body }
  }
  return { impl, calls, get maxInFlight() { return maxInFlight } }
}

// --- the parse ------------------------------------------------------------

test('the parse pulls the sporty-clips mp4 out of the page', () => {
  assert.equal(
    parseSportyVideoHtml(page('abc123XYZ')),
    'https://sporty-clips.mlb.com/abc123XYZ.mp4',
  )
})

test('the parse unescapes an ampersand carried in an attribute', () => {
  const html = '<source src="https://sporty-clips.mlb.com/a-b&amp;c.mp4">'
  assert.equal(parseSportyVideoHtml(html), 'https://sporty-clips.mlb.com/a-b&c.mp4')
})

test('the parse returns null rather than throwing on anything else', () => {
  assert.equal(parseSportyVideoHtml(''), null)
  assert.equal(parseSportyVideoHtml(null), null)
  assert.equal(parseSportyVideoHtml(undefined), null)
  assert.equal(parseSportyVideoHtml('<html><body>Not found</body></html>'), null)
})

test('the parse never picks up the Referer-locked host', () => {
  // fastball-clips is the same asset and is unusable from this origin. Nothing
  // in this module may resolve to it.
  const html = '<source src="https://fastball-clips.mlb.com/824634/home/xyz.mp4">'
  assert.equal(parseSportyVideoHtml(html), null)
})

// --- the shared resolver --------------------------------------------------

test('the resolver asks Savant for one playId and returns the mp4', async () => {
  const fake = fakeFetcher({ 'id-basic': page('tok-basic') })
  const url = await resolveClipUrl('id-basic', { fetchImpl: fake.impl })
  assert.equal(url, 'https://sporty-clips.mlb.com/tok-basic.mp4')
  assert.deepEqual(fake.calls, ['https://baseballsavant.mlb.com/sporty-videos?playId=id-basic'])
})

test('the resolver memoizes a hit — the token is deterministic', async () => {
  const fake = fakeFetcher({ 'id-memo': page('tok-memo') })
  const first = await resolveClipUrl('id-memo', { fetchImpl: fake.impl })
  const second = await resolveClipUrl('id-memo', { fetchImpl: fake.impl })
  assert.equal(first, second)
  assert.equal(fake.calls.length, 1, 'one request, not two')
})

test('the resolver memoizes the REQUEST, so callers on one tick share it', async () => {
  const fake = fakeFetcher({ 'id-tick': page('tok-tick') })
  const [a, b, c] = await Promise.all([
    resolveClipUrl('id-tick', { fetchImpl: fake.impl }),
    resolveClipUrl('id-tick', { fetchImpl: fake.impl }),
    resolveClipUrl('id-tick', { fetchImpl: fake.impl }),
  ])
  assert.equal(a, b)
  assert.equal(b, c)
  assert.equal(fake.calls.length, 1)
})

test('a clip that has not published yet is null, and is NOT cached', async () => {
  // Clips lag the pitch by 8 to 26 minutes. Caching the miss would seal a game
  // against its own film for the length of the session.
  const missing = fakeFetcher({})
  assert.equal(await resolveClipUrl('id-late', { fetchImpl: missing.impl }), null)
  const arrived = fakeFetcher({ 'id-late': page('tok-late') })
  assert.equal(
    await resolveClipUrl('id-late', { fetchImpl: arrived.impl }),
    'https://sporty-clips.mlb.com/tok-late.mp4',
  )
  assert.equal(arrived.calls.length, 1, 'it asked again')
})

test('the resolver degrades rather than throwing', async () => {
  const refused = fakeFetcher({ 'id-403': page('x') }, { status: 403 })
  assert.equal(await resolveClipUrl('id-403', { fetchImpl: refused.impl }), null)

  const broken = async () => {
    throw new TypeError('Failed to fetch')
  }
  assert.equal(await resolveClipUrl('id-throw', { fetchImpl: broken }), null)

  const empty = fakeFetcher({ 'id-empty': '<html>no clip here</html>' })
  assert.equal(await resolveClipUrl('id-empty', { fetchImpl: empty.impl }), null)
})

test('the resolver asks nothing at all for a missing playId', async () => {
  const fake = fakeFetcher({})
  assert.equal(await resolveClipUrl(null, { fetchImpl: fake.impl }), null)
  assert.equal(await resolveClipUrl('', { fetchImpl: fake.impl }), null)
  assert.equal(await resolveClipUrl(undefined, { fetchImpl: fake.impl }), null)
  assert.equal(fake.calls.length, 0)
})

test('an already-aborted signal gives null, and asks for nothing', async () => {
  const fake = fakeFetcher({ 'id-abort': page('tok-abort') })
  const controller = new AbortController()
  controller.abort()
  const url = await resolveClipUrl('id-abort', { fetchImpl: fake.impl, signal: controller.signal })
  assert.equal(url, null)
  assert.equal(fake.calls.length, 0)
})

test('a signal aborted mid-flight gives null, not a throw', async () => {
  const controller = new AbortController()
  const slow = async (_url, options) =>
    new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () =>
        reject(new DOMException('Aborted', 'AbortError')),
      )
    })
  const pending = resolveClipUrl('id-midflight', { fetchImpl: slow, signal: controller.signal })
  controller.abort()
  assert.equal(await pending, null)
})

// --- posters --------------------------------------------------------------

test('a poster derives from the playId with no network call', () => {
  assert.equal(
    clipPosterUrl('uuid-1'),
    'https://img.mlbstatic.com/mlb-photos/image/upload/w_640,q_auto:good/fastball/uuid-1_home.jpg',
  )
  assert.equal(
    clipPosterUrl('uuid-1', { feed: 'away', width: 320 }),
    'https://img.mlbstatic.com/mlb-photos/image/upload/w_320,q_auto:good/fastball/uuid-1_away.jpg',
  )
  // Every clip exists in both booths, so an unknown value falls to the home
  // feed rather than building a URL for a booth that does not exist.
  assert.ok(clipPosterUrl('uuid-1', { feed: 'radio' }).endsWith('_home.jpg'))
  assert.equal(clipPosterUrl(null), null)
  assert.equal(clipPosterUrl(''), null)
})

// --- the index ------------------------------------------------------------

test('the index carries an entry for every requested playId', async () => {
  const fake = fakeFetcher({ 'ix-a': page('ta'), 'ix-c': page('tc') })
  const index = await buildClipIndex(['ix-a', 'ix-b', 'ix-c'], { fetchImpl: fake.impl })
  assert.deepEqual([...index.keys()], ['ix-a', 'ix-b', 'ix-c'])
  assert.equal(index.get('ix-a').mp4Url, 'https://sporty-clips.mlb.com/ta.mp4')
  // The one with no clip is "not posted yet", never a missing key.
  assert.equal(index.get('ix-b').mp4Url, null)
  assert.equal(index.get('ix-b').durationSec, null)
  assert.ok(index.get('ix-b').posterUrl, 'a poster still derives')
  assert.equal(index.get('ix-c').mp4Url, 'https://sporty-clips.mlb.com/tc.mp4')
})

test('the index resolves one at a time, never in parallel', async () => {
  // A burst is the shape that gets a client blocked, silently and mid-game.
  const fake = fakeFetcher({ 'sq-1': page('t1'), 'sq-2': page('t2'), 'sq-3': page('t3') })
  await buildClipIndex(['sq-1', 'sq-2', 'sq-3'], { fetchImpl: fake.impl })
  assert.equal(fake.maxInFlight, 1)
  assert.deepEqual(
    fake.calls.map((u) => u.split('playId=')[1]),
    ['sq-1', 'sq-2', 'sq-3'],
  )
})

test('the index stops asking once the answers stop arriving', async () => {
  // The publication frontier of a game that just ended, and a host that has
  // started refusing, look the same from here and want the same answer.
  const fake = fakeFetcher({ 'cb-0': page('t0') })
  const ids = ['cb-0', 'cb-1', 'cb-2', 'cb-3', 'cb-4', 'cb-5', 'cb-6', 'cb-7']
  const index = await buildClipIndex(ids, { fetchImpl: fake.impl, maxConsecutiveMisses: 3 })
  assert.equal(index.size, 8, 'every id still gets an entry')
  assert.equal(fake.calls.length, 4, 'one hit, then three misses, then it stopped')
  for (const id of ids.slice(1)) assert.equal(index.get(id).mp4Url, null)
})

test('a run of misses resets on a hit', async () => {
  const fake = fakeFetcher({ 'rs-0': page('a'), 'rs-2': page('b'), 'rs-4': page('c') })
  const ids = ['rs-0', 'rs-1', 'rs-2', 'rs-3', 'rs-4']
  const index = await buildClipIndex(ids, { fetchImpl: fake.impl, maxConsecutiveMisses: 2 })
  assert.equal(fake.calls.length, 5)
  assert.equal(index.get('rs-4').mp4Url, 'https://sporty-clips.mlb.com/c.mp4')
})

test('an abort stops the queue and marks the rest not posted', async () => {
  const fake = fakeFetcher({ 'ab-1': page('t1'), 'ab-2': page('t2') })
  const controller = new AbortController()
  controller.abort()
  const index = await buildClipIndex(['ab-1', 'ab-2'], {
    fetchImpl: fake.impl,
    signal: controller.signal,
  })
  assert.equal(index.size, 2)
  assert.equal(index.get('ab-1').mp4Url, null)
  assert.equal(fake.calls.length, 0)
})

test('an optional duration rides along, from a Map or a plain object', async () => {
  const fake = fakeFetcher({ 'du-1': page('t1'), 'du-2': page('t2') })
  const fromMap = await buildClipIndex(['du-1'], {
    fetchImpl: fake.impl,
    durations: new Map([['du-1', 11.4]]),
  })
  assert.equal(fromMap.get('du-1').durationSec, 11.4)
  const fromObject = await buildClipIndex(['du-2'], {
    fetchImpl: fake.impl,
    durations: { 'du-2': 7.5 },
  })
  assert.equal(fromObject.get('du-2').durationSec, 7.5)
})

test('the index tolerates an empty or missing list', async () => {
  assert.equal((await buildClipIndex(null)).size, 0)
  assert.equal((await buildClipIndex([])).size, 0)
  assert.equal((await buildClipIndex([null, ''])).size, 0)
})

test('the index carries the booth into every poster', async () => {
  const fake = fakeFetcher({ 'bo-1': page('t1') })
  const index = await buildClipIndex(['bo-1'], { fetchImpl: fake.impl, feed: 'away' })
  assert.ok(index.get('bo-1').posterUrl.endsWith('_away.jpg'))
})

// --- the IndexedDB cache --------------------------------------------------

test('with no IndexedDB the cache is simply empty, and a write says so', async () => {
  // Node has none, a private-browsing window may refuse one, and WebKit evicts
  // by origin under pressure. An empty read is normal, not an error.
  assert.equal((await loadClipIndex(823035, { idb: undefined })).size, 0)
  assert.equal((await loadClipIndex(823035, { idb: null })).size, 0)
  assert.equal(await saveClipIndex(823035, new Map(), { idb: null }), false)
})

test('an IndexedDB that throws on open degrades the same way', async () => {
  const hostile = {
    open() {
      throw new DOMException('denied')
    },
  }
  assert.equal((await loadClipIndex(823035, { idb: hostile })).size, 0)
  assert.equal(await saveClipIndex(823035, new Map(), { idb: hostile }), false)
})
