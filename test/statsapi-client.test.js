import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  CACHE_DIR,
  RETRY_DELAY_MS,
  RETRY_TRIES,
  STATSAPI_BASE,
  StatsapiError,
  cachedGetJson,
  createStatsapiClient,
  getJson,
  isRetryable,
  statsapiUrl,
} from '../scripts/lib/statsapi.mjs'

// The Node client for scripts/ and .scratch/ (#1116). Every case runs offline:
// `fetch` and `sleep` are injected, so no test touches the network or waits.

const noSleep = async () => {}

// A fetch stand-in that plays one scripted answer per call. An answer is a
// number (an HTTP status with an empty body), an object (a 200 with that body),
// or an Error (thrown, like a dropped socket).
function scriptedFetch(answers) {
  const calls = []
  const fn = async (url) => {
    calls.push(url)
    const answer = answers[Math.min(calls.length - 1, answers.length - 1)]
    if (answer instanceof Error) throw answer
    if (typeof answer === 'number') {
      return { ok: false, status: answer, json: async () => ({}) }
    }
    return { ok: true, status: 200, json: async () => answer }
  }
  fn.calls = calls
  return fn
}

const client = (answers, extra = {}) => {
  const fetch = scriptedFetch(answers)
  const { getJson } = createStatsapiClient({ fetch, sleep: noSleep, ...extra })
  return { fetch, getJson }
}

const dropped = () => Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } })

test('a 200 returns the parsed body, fetched from the statsapi base', async () => {
  const { fetch, getJson } = client([{ teams: [1, 2] }])
  assert.deepEqual(await getJson('/api/v1/teams?sportId=1'), { teams: [1, 2] })
  assert.deepEqual(fetch.calls, [`${STATSAPI_BASE}/api/v1/teams?sportId=1`])
})

test('statsapiUrl joins the base and a path, for a script that records an address', () => {
  assert.equal(statsapiUrl('/api/v1/teams'), 'https://statsapi.mlb.com/api/v1/teams')
})

test('a 503 then a 200 retries and succeeds', async () => {
  const { fetch, getJson } = client([503, { ok: true }])
  assert.deepEqual(await getJson('/api/v1/x'), { ok: true })
  assert.equal(fetch.calls.length, 2)
})

test('a 429 and a 500 are retried too', async () => {
  const { fetch, getJson } = client([429, 500, { ok: true }])
  assert.deepEqual(await getJson('/api/v1/x'), { ok: true })
  assert.equal(fetch.calls.length, 3)
})

test('a dropped socket is retried', async () => {
  const { fetch, getJson } = client([dropped(), { ok: true }])
  assert.deepEqual(await getJson('/api/v1/x'), { ok: true })
  assert.equal(fetch.calls.length, 2)
})

test('a 404 throws at once, with no second call', async () => {
  const { fetch, getJson } = client([404, { ok: true }])
  await assert.rejects(getJson('/api/v1/gone'), (err) => {
    assert.ok(err instanceof StatsapiError)
    assert.equal(err.status, 404)
    assert.match(err.message, /statsapi HTTP 404 \/api\/v1\/gone/)
    return true
  })
  assert.equal(fetch.calls.length, 1)
})

test('no other 4xx is retried', async () => {
  for (const status of [400, 401, 403, 408, 410, 422]) {
    const { fetch, getJson } = client([status, { ok: true }])
    await assert.rejects(getJson('/api/v1/x'), StatsapiError)
    assert.equal(fetch.calls.length, 1, `status ${status}`)
  }
})

test('the last error is thrown after the last try', async () => {
  const { fetch, getJson } = client([500, 502, 503])
  await assert.rejects(getJson('/api/v1/x'), (err) => {
    assert.equal(err.status, 503)
    return true
  })
  assert.equal(fetch.calls.length, RETRY_TRIES)
})

test('the pause grows after each failure, and there is none after the last', async () => {
  const pauses = []
  const { getJson } = createStatsapiClient({
    fetch: scriptedFetch([500]),
    sleep: async (ms) => { pauses.push(ms) },
  })
  await assert.rejects(getJson('/api/v1/x'))
  assert.deepEqual(pauses, [RETRY_DELAY_MS, RETRY_DELAY_MS * 2])
})

test('the default policy is the one the nightly fix chose: 3 tries, 2000 ms x attempt', () => {
  assert.equal(RETRY_TRIES, 3)
  assert.equal(RETRY_DELAY_MS, 2000)
})

test('isRetryable: network errors, 429 and 5xx yes; other 4xx no', () => {
  assert.equal(isRetryable(dropped()), true)
  assert.equal(isRetryable(new StatsapiError(429, '/x')), true)
  assert.equal(isRetryable(new StatsapiError(500, '/x')), true)
  assert.equal(isRetryable(new StatsapiError(599, '/x')), true)
  assert.equal(isRetryable(new StatsapiError(404, '/x')), false)
  assert.equal(isRetryable(new StatsapiError(400, '/x')), false)
})

test('a path that is not a path fails at once, before any call', async () => {
  const { fetch, getJson } = client([{ ok: true }])
  await assert.rejects(getJson('https://statsapi.mlb.com/api/v1/teams'), /start with "\/"/)
  await assert.rejects(getJson('api/v1/teams'), /start with "\/"/)
  assert.equal(fetch.calls.length, 0)
})

test('timeoutMs aborts a call that never answers, and the timeout is retried', async () => {
  const calls = []
  const hang = (url, init) => {
    calls.push(url)
    return new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason))
    })
  }
  const { getJson } = createStatsapiClient({ fetch: hang, sleep: noSleep })
  // A real hung socket keeps the event loop alive; this stand-in does not, and
  // AbortSignal.timeout's own timer is unref'd, so hold the loop open here.
  const keepAlive = setInterval(() => {}, 1000)
  try {
    await assert.rejects(getJson('/api/v1/x', { timeoutMs: 15 }), (err) => err.name === 'TimeoutError')
  } finally {
    clearInterval(keepAlive)
  }
  assert.equal(calls.length, RETRY_TRIES)
})

test('without timeoutMs no signal is passed: a call waits as long as it takes', async () => {
  let init = 'unset'
  const fetch = async (_url, second) => {
    init = second
    return { ok: true, status: 200, json: async () => ({ ok: true }) }
  }
  const { getJson } = createStatsapiClient({ fetch, sleep: noSleep })
  await getJson('/api/v1/x')
  assert.equal(init, undefined)
})

// (c) The sandbox error.
test('a DNS failure names the Claude Code sandbox and how to rerun', async () => {
  for (const code of ['ENOTFOUND', 'EAI_AGAIN']) {
    const err = Object.assign(new TypeError('fetch failed'), { cause: { code } })
    const { getJson } = client([err])
    await assert.rejects(getJson('/api/v1/x'), (out) => {
      assert.match(out.message, /Claude Code Bash sandbox/)
      assert.match(out.message, /sandbox off/)
      assert.equal(out.cause, err)
      return true
    })
  }
})

test('a DNS failure is still retried before the clear error is thrown', async () => {
  const err = Object.assign(new TypeError('fetch failed'), { cause: { code: 'EAI_AGAIN' } })
  const { fetch, getJson } = client([err, { ok: true }])
  assert.deepEqual(await getJson('/api/v1/x'), { ok: true })
  assert.equal(fetch.calls.length, 2)
})

test('another network error keeps its own message', async () => {
  const { getJson } = client([dropped()])
  await assert.rejects(getJson('/api/v1/x'), (out) => {
    assert.doesNotMatch(out.message, /sandbox/)
    return true
  })
})

// (b) The opt-in research cache.
test('a client made with no cacheDir is cache-off: two calls, two fetches', async () => {
  const { fetch, getJson } = client([{ n: 1 }])
  await getJson('/api/v1/x')
  await getJson('/api/v1/x')
  assert.equal(fetch.calls.length, 2)
})

test('the shared getJson never caches: two calls, two fetches, nothing written', async () => {
  const realFetch = globalThis.fetch
  const fetch = scriptedFetch([{ n: 1 }])
  globalThis.fetch = fetch
  try {
    assert.deepEqual(await getJson('/api/v1/x'), { n: 1 })
    assert.deepEqual(await getJson('/api/v1/x'), { n: 1 })
    assert.equal(fetch.calls.length, 2)
  } finally {
    globalThis.fetch = realFetch
  }
})

test('the cache directory is git-ignored, and only cachedGetJson uses it', () => {
  assert.match(CACHE_DIR, /node_modules[\\/]\.cache[\\/]statsapi$/)
  assert.equal(typeof cachedGetJson, 'function')
  assert.notEqual(cachedGetJson, getJson)
})

test('with a cache directory given, a second call reads the file instead of the API', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'statsapi-cache-'))
  try {
    const { fetch, getJson } = client([{ n: 1 }, { n: 2 }], { cacheDir: dir })
    assert.deepEqual(await getJson('/api/v1/x'), { n: 1 })
    assert.deepEqual(await getJson('/api/v1/x'), { n: 1 })
    assert.equal(fetch.calls.length, 1)
    assert.deepEqual(await getJson('/api/v1/y'), { n: 2 })
    assert.equal(fetch.calls.length, 2)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a cached answer older than the max age is fetched again', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'statsapi-cache-'))
  try {
    let clock = 1_000_000
    const { fetch, getJson } = client([{ n: 1 }, { n: 2 }], {
      cacheDir: dir,
      cacheMaxAgeMs: 60_000,
      now: () => clock,
    })
    assert.deepEqual(await getJson('/api/v1/x'), { n: 1 })
    clock += 59_000
    assert.deepEqual(await getJson('/api/v1/x'), { n: 1 })
    clock += 2_000
    assert.deepEqual(await getJson('/api/v1/x'), { n: 2 })
    assert.equal(fetch.calls.length, 2)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a failed call is never cached', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'statsapi-cache-'))
  try {
    const { fetch, getJson } = client([404, { n: 1 }], { cacheDir: dir })
    await assert.rejects(getJson('/api/v1/x'), StatsapiError)
    assert.deepEqual(await getJson('/api/v1/x'), { n: 1 })
    assert.equal(fetch.calls.length, 2)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
