// Request-level coverage for the four `runtime: 'nodejs'` serverless functions.
//
// This is the test that was missing. The previous smoke check imported each
// module and called it with a Web `Request` — a shape Vercel's Node runtime
// never passes — so all three shipped to production throwing
// `TypeError: Invalid URL` on every single request. Every case here drives the
// handler with the NODE shape instead: `req.url` a bare path, `headers` a plain
// lower-cased object, and a `res` to write through.
//
// No Redis or Clerk env is set, so these exercise the unconfigured paths, which
// is exactly where the crash lived: reveal.js and copy.js both parse the URL
// BEFORE they check whether the store is configured.
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AUTH_NOT_CONFIGURED,
  INVALID_TOKEN,
  NO_TOKEN,
  authPreflight,
  authenticateUser,
  bearerToken,
} from '../api/_lib/auth.js'
import { redisConfigFromEnv } from '../api/_lib/redis.js'
import copyHandler from '../api/copy.js'
import revealHandler, {
  isFullyWrappedUp,
  plannedWrites,
  recentGamesView,
  sanitizeSnapshot,
} from '../api/reveal.js'
import spoiledDaysHandler from '../api/spoiled-days.js'
import stampsHandler, { mint, mintRefusal, seasonRows, stampEntry } from '../api/stamps.js'
import { applyRemoteStamps, isStamped } from '../src/lib/stamps.js'

// A stand-in for Node's (IncomingMessage, ServerResponse) pair.
function nodeReq(url, { method = 'GET', headers = {}, body } = {}) {
  return { url, method, headers, body }
}
function nodeRes() {
  const headers = {}
  return {
    statusCode: 0,
    payload: null,
    headers,
    setHeader(k, v) {
      headers[k] = v
    },
    end(p) {
      this.payload = p
    },
    get json() {
      return JSON.parse(this.payload)
    },
  }
}

async function call(handler, req) {
  const res = nodeRes()
  const returned = await handler(req, res)
  // Node path writes through `res` and returns undefined; if a handler ever
  // returns a Response instead, surface that rather than silently passing.
  if (returned !== undefined) {
    return { status: returned.status, json: await returned.json(), viaResponse: true }
  }
  return { status: res.statusCode, json: res.json, headers: res.headers }
}

// --------------------------------------------------------------------------
// The regression: a bare path must not throw
// --------------------------------------------------------------------------
test('reveal handler survives the bare path Vercel passes', async () => {
  // The exact URL from the production stack trace.
  const out = await call(revealHandler, nodeReq('/api/reveal?gamePk=1'))
  // Unconfigured -> 501, NOT a 500 from ERR_INVALID_URL.
  assert.equal(out.status, 501)
  assert.deepEqual(out.json, { error: 'sync not configured' })
})

test('reveal handler still validates its query off the parsed path', async () => {
  // gamePk is read from searchParams — proof the URL actually parsed, rather
  // than the handler skipping the query entirely.
  const out = await call(revealHandler, nodeReq('/api/reveal'))
  assert.equal(out.status, 400)
  assert.deepEqual(out.json, { error: 'gamePk required' })
})

test('reveal handler accepts DELETE (the manual "remove from my pencil") on the bare path', async () => {
  // Same unconfigured-store posture as the other verbs: 501, not the 405 a
  // method PUT never added to the allow-list would get further down.
  const out = await call(revealHandler, nodeReq('/api/reveal?gamePk=1', { method: 'DELETE' }))
  assert.equal(out.status, 501)
  assert.deepEqual(out.json, { error: 'sync not configured' })
})

// --------------------------------------------------------------------------
// The cloud scorebook index's auto-drop ("go away once you've unlocked every
// half inning and the game is over") — pure logic, no Redis needed. Same
// split as stamps.js's mint/mintRefusal: the Redis-touching handler just
// wires these answers to hset/hdel, so the actual RULE is tested here
// directly instead of through a fake store.
// --------------------------------------------------------------------------
test('sanitizeSnapshot carries a valid finalHalfIndex through', () => {
  const snap = sanitizeSnapshot({
    date: '2026-08-06',
    away: 'PIT',
    home: 'MIL',
    finalHalfIndex: 17, // bottom of the 9th
  })
  assert.equal(snap.finalHalfIndex, 17)
})

test('sanitizeSnapshot drops a malformed or missing finalHalfIndex to null', () => {
  const live = sanitizeSnapshot({ date: '2026-08-06', away: 'PIT', home: 'MIL' })
  assert.equal(live.finalHalfIndex, null)
  const hostile = sanitizeSnapshot({
    date: '2026-08-06',
    away: 'PIT',
    home: 'MIL',
    finalHalfIndex: -3,
  })
  assert.equal(hostile.finalHalfIndex, null)
})

// --------------------------------------------------------------------------
// plannedWrites — what a POST /api/reveal body is allowed to store (ADR-0049)
//
// Two writes over one address: the half-index mark, and the box score's own
// bit. Either may arrive alone. The validation is pure so the one decision that
// says what a request may write is pinned here rather than only reachable
// through a live Redis and a Clerk token.
// --------------------------------------------------------------------------
test('plannedWrites takes a mark on its own — the shape every older client sends', () => {
  assert.deepEqual(plannedWrites({ revealedThrough: 7 }), { mark: 7, box: false })
  assert.deepEqual(plannedWrites({ revealedThrough: 0 }), { mark: 0, box: false })
})

test('plannedWrites takes the box bit on its own, with no mark invented for it', () => {
  // The ORDINARY case for a box score: a reader opens one on a game they have
  // never hand-revealed a half of. `mark: null` is what keeps the endpoint from
  // storing a 0 and claiming they had.
  assert.deepEqual(plannedWrites({ boxRevealed: true }), { mark: null, box: true })
})

test('plannedWrites takes both together', () => {
  assert.deepEqual(plannedWrites({ revealedThrough: 4, boxRevealed: true }), { mark: 4, box: true })
})

test('plannedWrites refuses a body that asks for nothing', () => {
  for (const body of [{}, null, undefined, { boxRevealed: false }, { game: {} }]) {
    assert.equal(plannedWrites(body).error, 'nothing to store')
  }
})

test('plannedWrites refuses a malformed mark even when the box bit rides along', () => {
  // A bad field is refused outright rather than dropped while the rest of the
  // request quietly succeeds.
  for (const raw of [-1, 2.5, 201, '7', NaN, Infinity, true]) {
    assert.equal(
      plannedWrites({ revealedThrough: raw, boxRevealed: true }).error,
      'revealedThrough out of range',
      `${String(raw)} must be refused`,
    )
  }
})

test('plannedWrites demands the box bit be spelled `true`', () => {
  // This bit lifts a seal. A truthy string or a 1 from some future client is a
  // shape we never agreed to, and reads as no write at all.
  for (const raw of [1, '1', 'true', {}]) {
    assert.equal(plannedWrites({ boxRevealed: raw }).error, 'nothing to store')
    assert.equal(plannedWrites({ revealedThrough: 3, boxRevealed: raw }).box, false)
  }
})

test('isFullyWrappedUp is false for a live game (finalHalfIndex still null)', () => {
  assert.equal(isFullyWrappedUp({ finalHalfIndex: null, revealedThrough: 11 }), false)
})

test('isFullyWrappedUp is false for a finished game not yet fully revealed', () => {
  assert.equal(isFullyWrappedUp({ finalHalfIndex: 17, revealedThrough: 10 }), false)
})

test('isFullyWrappedUp is true once revealedThrough reaches the game’s real last half', () => {
  assert.equal(isFullyWrappedUp({ finalHalfIndex: 17, revealedThrough: 17 }), true)
  // Extras: revealedThrough can run past finalHalfIndex too (the mark only
  // ever ratchets forward), not just land on it exactly.
  assert.equal(isFullyWrappedUp({ finalHalfIndex: 17, revealedThrough: 19 }), true)
})

test('recentGamesView splits finished entries into "done" and keeps the rest, newest first', () => {
  const all = {
    // Live game, still in progress — belongs in the list.
    778241: { date: '2026-08-06', away: 'PIT', home: 'MIL', finalHalfIndex: null, revealedThrough: 5, updatedAt: 3000 },
    // Finished AND fully revealed — has nothing left to pick up.
    778240: { date: '2026-08-05', away: 'PIT', home: 'MIL', finalHalfIndex: 17, revealedThrough: 17, updatedAt: 2000 },
    // Finished but not yet fully revealed — still belongs in the list.
    778239: { date: '2026-08-04', away: 'TOR', home: 'CHC', finalHalfIndex: 21, revealedThrough: 10, updatedAt: 1000 },
  }
  const { games, done } = recentGamesView(all)
  assert.deepEqual(games.map((g) => g.gamePk), [778241, 778239])
  assert.deepEqual(done, ['778240'])
})

test('recentGamesView degrades to no games/no prune for an empty or missing hash', () => {
  assert.deepEqual(recentGamesView({}), { games: [], done: [] })
  assert.deepEqual(recentGamesView(null), { games: [], done: [] })
})

test('copy handler serves the public read from a bare path', async () => {
  const out = await call(copyHandler, nodeReq('/api/copy'))
  assert.equal(out.status, 200)
  assert.deepEqual(out.json, { copy: {} }) // no store configured -> defaults
  assert.match(out.headers['cache-control'], /max-age=60/)
})

test('copy handler reads ?history=1 off the parsed path', async () => {
  const out = await call(copyHandler, nodeReq('/api/copy?history=1'))
  // Admin-only branch, and unconfigured -> 501. Reaching it at all proves the
  // searchParams were parsed.
  assert.equal(out.status, 501)
})

test('spoiled-days handler survives a bare path', async () => {
  const out = await call(spoiledDaysHandler, nodeReq('/api/spoiled-days'))
  assert.equal(out.status, 501)
  assert.deepEqual(out.json, { error: 'sync not configured' })
})

// --------------------------------------------------------------------------
// Method + body handling under the Node shape
// --------------------------------------------------------------------------
test('every handler rejects an unsupported method without throwing', async () => {
  for (const [name, handler, url] of [
    ['reveal', revealHandler, '/api/reveal?gamePk=1'],
    ['copy', copyHandler, '/api/copy'],
    ['spoiled-days', spoiledDaysHandler, '/api/spoiled-days'],
    ['stamps', stampsHandler, '/api/stamps?season=2026'],
  ]) {
    const out = await call(handler, nodeReq(url, { method: 'PUT' }))
    assert.equal(out.status, 405, `${name} rejects PUT`)
  }
})

test('a POST body arrives via Vercel’s pre-parsed req.body', async () => {
  // Vercel's Node runtime parses a JSON body onto req.body — the handler must
  // read it there rather than calling req.json(), which does not exist.
  const out = await call(
    spoiledDaysHandler,
    nodeReq('/api/spoiled-days', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { day: '2026-07-25', state: 'on' },
    }),
  )
  // Unconfigured store short-circuits before the body is used; the point is
  // that nothing threw on the way there.
  assert.equal(out.status, 501)
})

// --------------------------------------------------------------------------
// Auth header lookup under the Node shape (plain object, not Headers)
// --------------------------------------------------------------------------
test('authorization is read from Node plain-object headers', async () => {
  // With CLERK_SECRET_KEY unset, authenticate() returns null regardless — but
  // it must reach that decision by reading `headers.authorization` as an object
  // property, not by calling `.get()` on it and throwing.
  const out = await call(
    copyHandler,
    nodeReq('/api/copy', {
      method: 'POST',
      headers: { authorization: 'Bearer nope', 'content-type': 'application/json' },
      body: { copy: {} },
    }),
  )
  assert.equal(out.status, 501) // store unconfigured; no TypeError en route
})

// --------------------------------------------------------------------------
// Logbook stamps (ADR-0035)
// --------------------------------------------------------------------------
// The score-bearing endpoint, so the unconfigured path matters more here than
// anywhere else: with no store it must refuse cleanly, and — the part worth
// pinning — it must refuse BEFORE any statsapi fetch or reveal-gate work, so an
// unconfigured deploy cannot be used to probe game data at all.
test('stamps handler survives the bare path on every verb it accepts', async () => {
  for (const [method, url, body] of [
    ['GET', '/api/stamps?season=2026', undefined],
    ['GET', '/api/stamps?seasons=1', undefined],
    ['GET', '/api/stamps?export=1', undefined],
    ['POST', '/api/stamps', { gamePk: 778241, mode: 'watched' }],
    ['DELETE', '/api/stamps?gamePk=778241', undefined],
  ]) {
    const out = await call(
      stampsHandler,
      nodeReq(url, { method, body, headers: { 'content-type': 'application/json' } }),
    )
    assert.equal(out.status, 501, `${method} ${url}`)
    assert.deepEqual(out.json, { error: 'sync not configured' })
  }
})

test('stamps responses are never shared-cacheable', async () => {
  // A stamp carries a final score. This is the one response in the codebase
  // where a shared cache would leak one directly.
  const out = await call(stampsHandler, nodeReq('/api/stamps?season=2026'))
  assert.equal(out.headers['cache-control'], 'private, no-store')
})

// --------------------------------------------------------------------------
// The read side of un-stamp propagation (ADR-0035's second known gap)
// --------------------------------------------------------------------------
// The bug this closes: a removal is stored as an explicit 'off' tombstone, but
// every GET filtered tombstones out of its response — so the removal reached
// the server and stopped there. A second device saw the gamePk simply ABSENT,
// absence correctly means "no opinion" to the merge, and it went on showing a
// stamp its owner had taken back.
//
// The rows are built by a pure function precisely so these rules are testable
// without a Redis round trip (the handler's own Redis path can't run in CI at
// all — @upstash/redis needs a live REST endpoint and Clerk needs a real
// token). What is exercised here is the wire contract itself, end to end: the
// rows the endpoint emits, fed to the very merge the client runs on them.
const STORED = {
  778241: { state: 'on', mode: 'watched', stampedAt: 1000, updatedAt: 1000, note: '', date: '2026-04-20' },
  778242: { state: 'off', mode: 'watched', stampedAt: 900, updatedAt: 2000, note: '', date: '2026-04-21' },
}
const FACTS = { 778241: { gamePk: 778241, status: 'Final' }, 778242: { gamePk: 778242, status: 'Final' } }

test('the display payload stays live-only — a tombstone has nothing to render', () => {
  const rows = seasonRows(STORED, FACTS)
  assert.deepEqual(rows.map((r) => r.gamePk), [778241])
})

test('the sync payload carries tombstones, so a removal can travel', () => {
  const rows = seasonRows(STORED, FACTS, { includeRemoved: true })
  assert.deepEqual(rows.map((r) => r.gamePk).sort(), [778241, 778242])
  const dead = rows.find((r) => r.gamePk === 778242)
  assert.equal(dead.state, 'off')
  // A tombstone never joins the facts cache: there is no stamp left to draw,
  // and shipping a final score for a game the user un-stamped would be the
  // wrong direction entirely.
  assert.equal(dead.game, null)
  // It still carries the clock the merge decides on.
  assert.equal(dead.updatedAt, 2000)
})

test('every row states its own state, including the live ones', () => {
  // The client used to hardcode 'on' when reading these rows. A payload that
  // cannot express a removal is how the gap survived a fix on either side
  // alone, so the live rows say 'on' out loud rather than by omission.
  for (const row of seasonRows(STORED, FACTS, { includeRemoved: true })) {
    assert.ok(row.state === 'on' || row.state === 'off', String(row.gamePk))
  }
  assert.equal(seasonRows(STORED, FACTS)[0].state, 'on')
})

test('a live row still joins its facts, and survives a missing blob', () => {
  const rows = seasonRows(STORED, {}, { includeRemoved: true })
  assert.equal(rows.find((r) => r.gamePk === 778241).game, null)
  assert.equal(seasonRows(STORED, FACTS)[0].game.gamePk, 778241)
})

test('rows sort newest game first regardless of tombstones', () => {
  const rows = seasonRows(STORED, FACTS, { includeRemoved: true })
  assert.deepEqual(rows.map((r) => r.date), ['2026-04-21', '2026-04-20'])
})

// The end of the round trip: the endpoint's tombstone, merged by the client's
// own rules, must actually remove the stamp on the second device.
test('a tombstone from the endpoint removes the stamp on another device', () => {
  // Device B's local collection: both games stamped, and it has never heard
  // about the removal.
  const local = {
    778241: { state: 'on', mode: 'watched', stampedAt: 1000, updatedAt: 1000, note: '', date: '2026-04-20' },
    778242: { state: 'on', mode: 'watched', stampedAt: 900, updatedAt: 900, note: '', date: '2026-04-21' },
  }

  // Exactly what StampsCloudSync builds from the export rows: `game` dropped,
  // `state` READ rather than assumed.
  const remote = {}
  for (const row of seasonRows(STORED, FACTS, { includeRemoved: true })) {
    remote[row.gamePk] = {
      state: row.state === 'off' ? 'off' : 'on',
      mode: row.mode,
      stampedAt: row.stampedAt,
      updatedAt: row.updatedAt,
      note: row.note,
      date: row.date,
    }
  }

  const merged = applyRemoteStamps(local, remote)
  assert.equal(isStamped(merged, 778241), true)
  assert.equal(isStamped(merged, 778242), false, 'the un-stamped game must not survive the merge')
  // And the tombstone is KEPT, not deleted — deleting it is what would let the
  // next sync union the stale 'on' back in.
  assert.equal(merged[778242].state, 'off')

  // The old payload, for contrast: filter the tombstone out and the stamp
  // stays. This is the bug, pinned so it cannot come back.
  const oldStyle = {}
  for (const row of seasonRows(STORED, FACTS)) {
    oldStyle[row.gamePk] = { ...row, state: 'on', game: undefined }
  }
  assert.equal(isStamped(applyRemoteStamps(local, oldStyle), 778242), true)
})

// --------------------------------------------------------------------------
// Minting (ADR-0035's second amendment — the reveal gate is gone)
// --------------------------------------------------------------------------
// The bug this closes: `POST /api/stamps` refused to mint unless the server
// could read a `reveal:{userId}:{gamePk}` mark or a spoiled-day consent for the
// game. The ordinary way to stamp — tapping the affordance inside the box
// score's `SealBox` — writes NEITHER, because that SealBox deliberately
// persists nothing (an `onReveal` there would let a box score opened under the
// Scores Unlocked pass ratchet the whole game's `revealedThrough`). So the
// normal flow 403'd, and nineteen real stamps could not be uploaded.
//
// `mint` takes its Redis client as a parameter, so the real path runs here
// against a fake — the one Redis-backed branch in this file, and worth it
// because this branch IS the feature.
function fakeRedis(seed = {}) {
  const store = { ...seed }
  const hashes = {}
  return {
    calls: [],
    store,
    hashes,
    async get(key) {
      this.calls.push(`get ${key}`)
      return store[key] ?? null
    },
    async hget(key, field) {
      this.calls.push(`hget ${key} ${field}`)
      return hashes[key]?.[field] ?? null
    },
    async hset(key, obj) {
      hashes[key] = { ...(hashes[key] ?? {}), ...obj }
    },
    async hlen(key) {
      return Object.keys(hashes[key] ?? {}).length
    },
    async sadd() {},
    async set(key, value) {
      store[key] = value
    },
  }
}

// A Final game already in the shared facts cache, so no statsapi fetch happens.
const FINAL_GAME = {
  gamePk: 778241,
  date: '2026-04-20',
  gameNumber: 1,
  sportId: 1,
  gameType: 'R',
  venue: 'Rogers Centre',
  innings: 9,
  homeBattedLast: true,
  status: 'Final',
  away: { id: 136, abbreviation: 'SEA', name: 'Seattle Mariners', runs: 3, hits: 7, errors: 0 },
  home: { id: 141, abbreviation: 'TOR', name: 'Toronto Blue Jays', runs: 5, hits: 9, errors: 1 },
  winnerId: 141,
  decisions: { winner: '', loser: '', save: '' },
}

const mintReq = (body) =>
  nodeReq('/api/stamps', { method: 'POST', headers: { 'content-type': 'application/json' }, body })

test('a Final game mints with no reveal mark and no day consent', async () => {
  // This is the case that used to 403. Nothing in the fake store answers to
  // `reveal:u1:778241` or `spoiled:u1`, which is exactly the state a real
  // box-score stamp leaves behind.
  const redis = fakeRedis({ 'game:final:778241': FINAL_GAME })
  const res = nodeRes()
  await mint(mintReq({ gamePk: 778241, mode: 'watched' }), res, redis, 'u1')

  assert.equal(res.statusCode, 201)
  assert.equal(res.json.stamp.gamePk, 778241)
  assert.equal(res.json.stamp.state, 'on')
  // And it must not have gone looking for permission on the way.
  assert.equal(
    redis.calls.some((c) => c.startsWith('get reveal:') || c.startsWith('hget spoiled:')),
    false,
    'the mint must not read a reveal mark or a consent map',
  )
})

test('an unfinished game is still refused — a stamp is permanent, a live score is not', () => {
  assert.deepEqual(mintRefusal({ ...FINAL_GAME, status: 'Live' }), {
    error: 'game not final',
    status: 409,
  })
  assert.deepEqual(mintRefusal(null), { error: 'game not found', status: 404 })
  // Resolvable but with a date no season can be read from: nothing to shard on.
  assert.deepEqual(mintRefusal({ ...FINAL_GAME, date: 'April 20' }), {
    error: 'game not found',
    status: 404,
  })
  assert.equal(mintRefusal(FINAL_GAME), null)
})

test('the mint takes nothing score-bearing from the request body', () => {
  // The remaining integrity claim now that the gate is gone: the client names a
  // mode, a note and a placement. The score lives in the shared `game:final`
  // blob the server fetched itself, and the per-user record has no room for one
  // — so a hostile body cannot forge a 20-0 keepsake.
  const entry = stampEntry(
    {
      mode: 'followed',
      note: 'Dad’s first game',
      away: { runs: 20 },
      home: { runs: 0 },
      winnerId: 999,
      date: '1999-01-01',
      state: 'off',
      stampedAt: 1,
    },
    FINAL_GAME,
    null,
    5000,
  )
  assert.deepEqual(Object.keys(entry).sort(), [
    'date',
    'mode',
    'note',
    'placement',
    'stampedAt',
    'state',
    'updatedAt',
  ])
  assert.equal(entry.date, FINAL_GAME.date, 'the date comes from the game, never the body')
  assert.equal(entry.state, 'on')
  assert.equal(entry.stampedAt, 5000)
  assert.equal(entry.mode, 'followed')
})

test('re-stamping keeps the keepsake’s original date and its page', () => {
  const existing = {
    state: 'on',
    mode: 'watched',
    stampedAt: 1000,
    updatedAt: 1000,
    note: '',
    date: '2026-04-20',
    placement: { page: 2, x: 0.25, y: 0.25, tilt: 3 },
  }
  const edited = stampEntry({ note: 'better note' }, FINAL_GAME, existing, 9000)
  assert.equal(edited.stampedAt, 1000, 'stampedAt is the keepsake’s date, not the sync clock')
  assert.equal(edited.updatedAt, 9000)
  assert.deepEqual(edited.placement, existing.placement, 'editing a note must not clear the page')

  // Reviving a tombstone is a NEW keepsake, and starts unplaced.
  const revived = stampEntry({}, FINAL_GAME, { ...existing, state: 'off' }, 9000)
  assert.equal(revived.stampedAt, 9000)
  assert.equal(revived.placement, null)
})

// --------------------------------------------------------------------------
// Which env vars count as "a store is configured" (api/_lib/redis.js)
// --------------------------------------------------------------------------
// The bug this pins: connecting an Upstash database through Vercel's KV
// integration injects the REST credentials as KV_REST_API_URL/KV_REST_API_TOKEN.
// Every one of these endpoints read only the UPSTASH_* names, so a project with
// a live, correctly-linked store 501'd on every request — indistinguishable from
// a deploy that has no backend on purpose, which is why it went unnoticed.
test('the Upstash-native name pair configures a store', () => {
  assert.deepEqual(
    redisConfigFromEnv({
      UPSTASH_REDIS_REST_URL: 'https://native.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'native-token',
    }),
    { url: 'https://native.upstash.io', token: 'native-token' },
  )
})

test('Vercel’s KV names configure the same store', () => {
  assert.deepEqual(
    redisConfigFromEnv({
      KV_REST_API_URL: 'https://kv.upstash.io',
      KV_REST_API_TOKEN: 'kv-token',
    }),
    { url: 'https://kv.upstash.io', token: 'kv-token' },
  )
})

test('a pair is atomic — half of one never combines with half of another', () => {
  // A URL from the KV integration and a token from a hand-set Upstash var is
  // not a credential for anything. Answering null (a clean 501) beats handing
  // the client a mismatched pair that fails at request time.
  assert.equal(
    redisConfigFromEnv({
      KV_REST_API_URL: 'https://kv.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'native-token',
    }),
    null,
  )
})

test('the connection-string and read-only vars are not credentials', () => {
  // KV_URL/REDIS_URL are rediss:// strings for a TCP client, and the read-only
  // token cannot write. None of them may satisfy the check.
  assert.equal(
    redisConfigFromEnv({
      KV_URL: 'rediss://default:pw@kv.upstash.io:6379',
      REDIS_URL: 'rediss://default:pw@kv.upstash.io:6379',
      KV_REST_API_READ_ONLY_TOKEN: 'read-only',
    }),
    null,
  )
})

test('the Upstash-native pair wins when a project carries both', () => {
  assert.deepEqual(
    redisConfigFromEnv({
      UPSTASH_REDIS_REST_URL: 'https://native.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'native-token',
      KV_REST_API_URL: 'https://kv.upstash.io',
      KV_REST_API_TOKEN: 'kv-token',
    }),
    { url: 'https://native.upstash.io', token: 'native-token' },
  )
})

test('a blank or whitespace value is not set', () => {
  assert.equal(
    redisConfigFromEnv({ KV_REST_API_URL: '  ', KV_REST_API_TOKEN: 'kv-token' }),
    null,
  )
  // …and a real value that picked up whitespace in a dashboard field still works.
  assert.deepEqual(
    redisConfigFromEnv({ KV_REST_API_URL: ' https://kv.upstash.io\n', KV_REST_API_TOKEN: 'kv-token ' }),
    { url: 'https://kv.upstash.io', token: 'kv-token' },
  )
})

test('no store configured stays null, which is the 501 every caller renders', () => {
  assert.equal(redisConfigFromEnv({}), null)
  assert.equal(redisConfigFromEnv(null), null)
})

// --------------------------------------------------------------------------
// Telling the four auth failures apart (api/_lib/auth.js)
// --------------------------------------------------------------------------
// Every endpoint used to answer a bare `401 unauthorized` whether the deploy had
// no CLERK_SECRET_KEY, the caller sent no token, or a real token failed to
// verify. A production deploy therefore rejected every genuine signed-in
// request while looking exactly like a working one being polled by strangers —
// found only by reading Vercel's logs. These pin the distinction.
const withToken = (t) => nodeReq('/api/stamps', { headers: { authorization: `Bearer ${t}` } })

test('no secret key is 501 — the deploy cannot verify anything', () => {
  const out = authPreflight(withToken('abc'), {})
  assert.equal(out.ok, false)
  assert.equal(out.status, 501)
  assert.equal(out.error, AUTH_NOT_CONFIGURED)
})

test('a blank secret key is not a secret key', () => {
  assert.equal(authPreflight(withToken('abc'), { CLERK_SECRET_KEY: '   ' }).status, 501)
})

test('configured but anonymous is 401 no-token, not a misconfiguration', () => {
  const out = authPreflight(nodeReq('/api/stamps'), { CLERK_SECRET_KEY: 'sk_test_x' })
  assert.equal(out.ok, false)
  assert.equal(out.status, 401)
  assert.equal(out.error, NO_TOKEN)
})

test('the not-configured check comes FIRST', () => {
  // An anonymous request against a deploy with no secret key must report the
  // deploy's problem, not the caller's — that ordering is the whole diagnostic.
  assert.equal(authPreflight(nodeReq('/api/stamps'), {}).error, AUTH_NOT_CONFIGURED)
})

test('a token and a secret key pass preflight', () => {
  const out = authPreflight(withToken('a-real-token'), { CLERK_SECRET_KEY: 'sk_test_x' })
  assert.equal(out.ok, true)
  assert.equal(out.token, 'a-real-token')
  assert.equal(out.secretKey, 'sk_test_x')
})

test('bearerToken reads only a Bearer header', () => {
  assert.equal(bearerToken(withToken('  spaced  ')), 'spaced')
  assert.equal(bearerToken(nodeReq('/api/stamps', { headers: { authorization: 'Basic xyz' } })), '')
  assert.equal(bearerToken(nodeReq('/api/stamps')), '')
})

test('a token that cannot be verified is 401 invalid, never a 500', () => {
  // @clerk/backend throws on some malformed tokens rather than returning
  // `errors`, and the old per-file copies didn't catch — a junk Authorization
  // header was a stack trace.
  return authenticateUser(withToken('not.a.jwt'), {
    env: { CLERK_SECRET_KEY: 'sk_test_x' },
    log: () => {},
  }).then((out) => {
    assert.equal(out.ok, false)
    assert.equal(out.status, 401)
    assert.equal(out.error, INVALID_TOKEN)
  })
})

// --------------------------------------------------------------------------
// What the SERVER learns from a rejection (api/_lib/auth.js)
// --------------------------------------------------------------------------
// The response stays a bare `invalid token` — a caller is told nothing. But the
// reason was being discarded server-side too, which left a production deploy
// rejecting every genuine token with no way to find out why: signature, expiry,
// and "couldn't reach Clerk's JWKS" are three different faults wearing one
// string. These pin the log line that closes that gap, and the two redactions
// that keep it safe to write.
const capture = () => {
  const lines = []
  return { lines, log: (line) => lines.push(line) }
}

// --------------------------------------------------------------------------
// The @clerk/backend return-shape contract (api/_lib/auth.js)
// --------------------------------------------------------------------------
// verifyToken RESOLVES TO THE PAYLOAD and THROWS on failure. It does not
// resolve to `{ data, errors }`. Destructuring that shape read `undefined` off
// a perfectly valid payload, so `!data?.sub` was always true and EVERY
// authenticated request in production got `401 invalid token` — for as long as
// Clerk had been wired up. `verify` is injected here because the contract is
// the thing under test; a live Clerk instance is not reachable from CI.
test('a token that verifies authenticates the user it names', async () => {
  const { lines, log } = capture()
  const out = await authenticateUser(withToken('good.session.token'), {
    env: { CLERK_SECRET_KEY: 'sk_live_x' },
    log,
    verify: async () => ({ sub: 'user_2abcXYZ', iss: 'https://clerk.example.com' }),
  })
  assert.equal(out.ok, true)
  assert.equal(out.userId, 'user_2abcXYZ')
  assert.equal(lines.length, 0, 'a success writes no log line')
})

test('the secret key and options reach verifyToken unchanged', async () => {
  let seen = null
  await authenticateUser(withToken('tok'), {
    env: { CLERK_SECRET_KEY: 'sk_live_x' },
    log: () => {},
    authorizedParties: ['https://tallybb.com'],
    verify: async (token, options) => {
      seen = { token, options }
      return { sub: 'user_1' }
    },
  })
  assert.equal(seen.token, 'tok')
  assert.equal(seen.options.secretKey, 'sk_live_x')
  // api/copy.js passes authorizedParties through; it must survive the spread.
  assert.deepEqual(seen.options.authorizedParties, ['https://tallybb.com'])
  // The injection seam must not leak into what Clerk is handed.
  assert.equal('verify' in seen.options, false)
  assert.equal('log' in seen.options, false)
  assert.equal('env' in seen.options, false)
})

test('a payload with no sub is rejected, and says so distinctly', async () => {
  const { lines, log } = capture()
  const out = await authenticateUser(withToken('tok'), {
    env: { CLERK_SECRET_KEY: 'sk_live_x' },
    log,
    verify: async () => ({ iss: 'https://clerk.example.com' }),
  })
  assert.equal(out.ok, false)
  assert.equal(out.status, 401)
  assert.equal(out.error, INVALID_TOKEN)
  // Distinguishable from a verification failure — that distinction is what
  // identified the bug this test exists to prevent.
  assert.match(lines[0], /no `sub` claim/)
})

test('a throw from verifyToken is a 401 carrying the thrown reason', async () => {
  const { lines, log } = capture()
  const out = await authenticateUser(withToken('tok'), {
    env: { CLERK_SECRET_KEY: 'sk_live_x' },
    log,
    verify: async () => {
      throw Object.assign(new Error('token-invalid-signature'), { name: 'TokenVerificationError' })
    },
  })
  assert.equal(out.status, 401)
  assert.match(lines[0], /TokenVerificationError: token-invalid-signature/)
})

test('a rejection reports Clerk’s reason to the server log', async () => {
  const { lines, log } = capture()
  await authenticateUser(withToken('not.a.jwt'), { env: { CLERK_SECRET_KEY: 'sk_test_x' }, log })
  assert.equal(lines.length, 1)
  assert.match(lines[0], /\[auth\] verifyToken rejected/)
  // Something specific about the failure, not just that there was one.
  assert.match(lines[0], /reason=\S/)
})

test('the log carries the key SHAPE and never the token or the key', async () => {
  const { lines, log } = capture()
  await authenticateUser(withToken('a-live-credential'), {
    env: { CLERK_SECRET_KEY: 'sk_test_supersecrettail' },
    log,
  })
  // The prefix is diagnostic; the tail is a credential and must not appear.
  assert.match(lines[0], /secretKey=sk_test_/)
  assert.equal(lines[0].includes('supersecrettail'), false)
  // The bearer token is a live credential too — a log line is not the place.
  assert.equal(lines[0].includes('a-live-credential'), false)
})

test('a publishable key in the secret slot is called out by name', async () => {
  // The mix-up that motivated this: the two keys sit side by side in Clerk's
  // dashboard, and once Vercel marks the variable Sensitive nothing echoes it
  // back. Every genuine token then fails as `invalid token` with no clue why.
  const { lines, log } = capture()
  await authenticateUser(withToken('not.a.jwt'), {
    env: { CLERK_SECRET_KEY: 'pk_live_Y2xlcmsuZXhhbXBsZS5jb20k' },
    log,
  })
  assert.match(lines[0], /PUBLISHABLE KEY/)
  assert.match(lines[0], /VITE_CLERK_PUBLISHABLE_KEY/)
})

test('a rejection logs exactly once, not once per internal retry', async () => {
  // A per-request log line is only tolerable if it stays one line. (The success
  // path writes nothing, but asserting that needs a real Clerk instance to
  // verify against, so it is left to the deploy rather than faked here.)
  const { lines, log } = capture()
  await authenticateUser(withToken('not.a.jwt'), { env: { CLERK_SECRET_KEY: 'sk_test_x' }, log })
  assert.equal(lines.length, 1)
})

test('preflight failures never reach the log — they are not token failures', async () => {
  // An anonymous poll of a public URL is not an incident, and a deploy with no
  // secret key has a problem the response already names. Neither should write a
  // line every time a stranger hits the endpoint.
  const { lines, log } = capture()
  await authenticateUser(nodeReq('/api/stamps'), { env: { CLERK_SECRET_KEY: 'sk_test_x' }, log })
  await authenticateUser(withToken('abc'), { env: {}, log })
  assert.equal(lines.length, 0)
})
