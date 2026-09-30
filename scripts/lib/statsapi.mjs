// THE statsapi.mlb.com client for Node callers: every generator in scripts/ and
// every research script in .scratch/ reaches statsapi through getJson(path), and
// nothing else in those two folders builds a statsapi URL. scripts/check-
// statsapi-client.mjs (run by `npm run lint`) fails if one does (#1116).
// src/, api/, test/ and e2e/ are out of scope: src/api/statsapi.js is the
// browser's own client (a service worker rule, ADR-0004), api/ is the Vercel
// functions, and test/ and e2e/ replay captured feeds.
//
//   import { getJson } from './lib/statsapi.mjs'
//   const teams = await getJson('/api/v1/teams?sportId=1')
//
// The argument is a PATH that starts with "/", never a full URL. GET
// https://statsapi.mlb.com + path, throw on a non-2xx, return the parsed body.
// An optional second argument, { timeoutMs, tries }, aborts a try that has not
// answered in that time (the abort is a network error, so it is retried like
// one). No caller gets a timeout unless it asks: warm-previews.mjs asks for 8 s.
// `tries` overrides the count below for ONE call. Use it only where a caller is
// best-effort and a retry would blow its time budget: warm-previews.mjs asks
// for 1, so an 8 s timeout stays 8 s and not 30.
//
// RETRY POLICY, decided once, here. The same for every caller:
//   - 3 tries, with a pause of 2000 ms x attempt between them (2 s, then 4 s,
//     none after the last). These are the numbers gen-doubleheaders.mjs got
//     after one dropped socket killed the 2026-09-29 nightly run.
//   - Retried: a network error (a dropped socket, a truncated body, a DNS blip),
//     HTTP 429, and HTTP 5xx.
//   - Never retried: any other 4xx, a 200 body that is not JSON, or a TypeError
//     with no network cause (a bad URL). Each answers the same way again, so it
//     throws at once.
// The mechanism is scripts/lib/net/retry.mjs's withRetry. Do not write a second
// loop in a script: change RETRY_TRIES / RETRY_DELAY_MS here, with a reason.
//
// A DNS failure (ENOTFOUND, EAI_AGAIN) that outlasts the retries throws a clear
// error: the Claude Code Bash sandbox blocks statsapi, and the fix is to rerun
// with the sandbox off. It is the most common way a statsapi script fails here.
//
// CONSIDERED AND LEFT OUT: a concurrency limit. scripts/lib/concurrency.mjs sits
// BESIDE the client, not inside it. Its pool swallows a failed item to null, a
// contract a client must not impose, and a global cap would silently re-pace
// thirty generators that each size their own pool.
//
// RESEARCH CACHE (opt-in, off by default). cachedGetJson(path) is the same call
// with an on-disk answer kept for an hour, so a re-run of a spike does not pull
// again what it pulled a minute ago. It is a SEPARATE export on purpose: getJson
// never touches a cache, no switch or env var turns one on, and the guard fails
// a file in scripts/ that names cachedGetJson, because the nightly data must be
// fresh. Only a .scratch script may reach for it. The files go under
// node_modules/.cache/statsapi/, which git already ignores.

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { withRetry } from './net/retry.mjs'

export const STATSAPI_BASE = 'https://statsapi.mlb.com'

// The full URL for a path, for a script that RECORDS the address it read (a
// fixture's source note) rather than fetching it. Fetching goes through getJson.
export const statsapiUrl = (path) => STATSAPI_BASE + path

export const RETRY_TRIES = 3
export const RETRY_DELAY_MS = 2000

export const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'node_modules', '.cache', 'statsapi')
export const CACHE_MAX_AGE_MS = 60 * 60 * 1000

const DNS_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN'])

export class StatsapiError extends Error {
  constructor(status, path) {
    super(`statsapi HTTP ${status} ${path}`)
    this.name = 'StatsapiError'
    this.status = status
    this.path = path
  }
}

// One retryable set: a failure that is not an HTTP answer and is not a caller
// or body bug (a network error, a body cut short) plus HTTP 429 and 5xx. Every
// other 4xx is final. A dropped socket is a TypeError WITH a `cause`; a bad URL
// is a TypeError without one, and an HTML body from a 200 is a SyntaxError.
export function isRetryable(err) {
  if (err instanceof StatsapiError) return err.status === 429 || err.status >= 500
  if (err instanceof SyntaxError) return false
  if (err instanceof TypeError && !err.cause) return false
  return true
}

const dnsCode = (err) => [err?.code, err?.cause?.code].find((c) => DNS_CODES.has(c))

function explain(err, path) {
  const code = dnsCode(err)
  if (!code) return err
  return new Error(
    `statsapi ${path}: DNS lookup failed (${code}). The Claude Code Bash sandbox blocks ` +
      'statsapi.mlb.com: rerun this command with the sandbox off.',
    { cause: err },
  )
}

// A client is built from its parts so a test can inject `fetch` and `sleep`.
// `cacheDir` unset means no cache: that is the default and the shared getJson.
export function createStatsapiClient({
  fetch: fetchFn = (...args) => globalThis.fetch(...args),
  sleep,
  tries = RETRY_TRIES,
  delayMs = RETRY_DELAY_MS,
  cacheDir = null,
  cacheMaxAgeMs = CACHE_MAX_AGE_MS,
  now = Date.now,
} = {}) {
  async function fetchOnce(path, timeoutMs) {
    const res = await fetchFn(STATSAPI_BASE + path, timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : undefined)
    if (!res.ok) throw new StatsapiError(res.status, path)
    return res.json()
  }

  async function pull(path, timeoutMs, callTries = tries) {
    try {
      return await withRetry(() => fetchOnce(path, timeoutMs), { tries: callTries, delayMs, sleep, shouldRetry: isRetryable })
    } catch (err) {
      throw explain(err, path)
    }
  }

  const cacheFile = (path) => join(cacheDir, `${createHash('sha1').update(path).digest('hex')}.json`)

  async function readCache(path) {
    try {
      const hit = JSON.parse(await readFile(cacheFile(path), 'utf8'))
      if (now() - hit.fetchedAt <= cacheMaxAgeMs) return { body: hit.body }
    } catch {
      // no file, or an unreadable one: fetch fresh
    }
    return null
  }

  async function getJson(path, { timeoutMs, tries: callTries } = {}) {
    if (typeof path !== 'string' || !path.startsWith('/')) {
      throw new Error(`statsapi getJson: the argument is a path and must start with "/", got ${JSON.stringify(path)}`)
    }
    if (!cacheDir) return pull(path, timeoutMs, callTries)
    const hit = await readCache(path)
    if (hit) return hit.body
    const body = await pull(path, timeoutMs, callTries)
    await mkdir(cacheDir, { recursive: true })
    await writeFile(cacheFile(path), JSON.stringify({ fetchedAt: now(), path, body }))
    return body
  }

  return { getJson }
}

// The shared client. No cache, ever.
const shared = createStatsapiClient()
export const getJson = shared.getJson

// The opt-in research client. See the header: .scratch only, never scripts/.
const researchClient = createStatsapiClient({ cacheDir: CACHE_DIR })
export const cachedGetJson = researchClient.getJson
