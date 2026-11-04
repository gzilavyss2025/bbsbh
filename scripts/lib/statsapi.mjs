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
// `tries` overrides the count below for ONE call. Use it only where a call is
// best-effort and a retry would blow its time budget: warm-previews.mjs asks for
// 1 on its per-club roster calls, so an 8 s timeout stays 8 s and not 30. Its
// schedule call keeps the retries, because the whole script depends on it.
//
// RETRY POLICY, decided once, here. The same for every caller:
//   - 3 tries, with a pause of 2000 ms x attempt between them (2 s, then 4 s,
//     none after the last). These are the numbers gen-doubleheaders.mjs got
//     after one dropped socket killed the 2026-09-29 nightly run.
//   - Retried: a network error (a dropped socket, a DNS blip), a 200 body that
//     does not parse as JSON (a body cut short, an empty body, a transient CDN
//     page), HTTP 429, and HTTP 5xx.
//   - Never retried: any other 4xx, or a TypeError with no network cause (a bad
//     URL). Each answers the same way again, so it throws at once.
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

import { chunk, mapConcurrent } from './concurrency.mjs'
import { withRetry } from './net/retry.mjs'

export const STATSAPI_BASE = 'https://statsapi.mlb.com'

// The full URL for a path, for a script that RECORDS the address it read (a
// fixture's source note) rather than fetching it. Fetching goes through getJson.
export const statsapiUrl = (path) => STATSAPI_BASE + path

export const RETRY_TRIES = 3
export const RETRY_DELAY_MS = 2000

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
// bug (a network error, a body that does not parse) plus HTTP 429 and 5xx.
// Every other 4xx is final. A dropped socket is a TypeError WITH a `cause`; a
// bad URL is a TypeError without one. A body cut short and a transient HTML page
// served with a 200 are both a SyntaxError, and a new try can fix both.
export function isRetryable(err) {
  if (err instanceof StatsapiError) return err.status === 429 || err.status >= 500
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
export function createStatsapiClient({
  fetch: fetchFn = (...args) => globalThis.fetch(...args),
  sleep,
  tries = RETRY_TRIES,
  delayMs = RETRY_DELAY_MS,
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

  async function getJson(path, { timeoutMs, tries: callTries } = {}) {
    if (typeof path !== 'string' || !path.startsWith('/')) {
      throw new Error(`statsapi getJson: the argument is a path and must start with "/", got ${JSON.stringify(path)}`)
    }
    return pull(path, timeoutMs, callTries)
  }

  return { getJson }
}

// The shared client.
export const getJson = createStatsapiClient().getJson

// The /people rows for `ids`, `size` ids to a call, in id order. `hydrate` and `fields` go on the
// query as given (the caller encodes), `timeoutMs` goes to each call. A failed call throws; with `onError(err, i)` (i = the batch number from 0) it is reported
// and its ids are left out, for a generator that wants a partial answer over none.
export async function getPeople(ids, { hydrate, fields, size = 100, concurrency = 1, timeoutMs, onError } = {}) {
  const tail = (hydrate ? `&hydrate=${hydrate}` : '') + (fields ? `&fields=${fields}` : '')
  const batches = await mapConcurrent(
    chunk(ids, size),
    concurrency,
    async (batch, i) => {
      try {
        return (await getJson(`/api/v1/people?personIds=${batch.join(',')}${tail}`, { timeoutMs })).people ?? []
      } catch (err) {
        if (!onError) throw err
        onError(err, i)
        return []
      }
    },
    { strict: true },
  )
  return batches.flat()
}
