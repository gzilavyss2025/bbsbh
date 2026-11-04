// Retry an async call a few times with a growing pause: the ONE retry
// mechanism for Node callers of statsapi.mlb.com.
//
// scripts/lib/statsapi.mjs's getJson calls this, so a generator or a research
// script gets the retry without writing a loop. The 2026-09-29 run lost
// gen-doubleheaders.mjs to a single `SocketError: other side closed` on one of
// its 23 season requests, and the freshness guard then failed the whole job.
//
// By default every error is retried. A caller narrows that with `shouldRetry`
// (statsapi's client does: network errors, 429 and 5xx only, never another
// 4xx). The pause is `delayMs * attempt`, and there is none after the last try.
//
// With a `label`, each retry is logged ("label: msg — retry 1/2") and the final error is
// rethrown as "label: msg after N attempts", so a nightly log says which call died.

import { setTimeout as defaultSleep } from 'node:timers/promises'

export async function withRetry(
  fn,
  { tries = 3, delayMs = 2000, sleep = defaultSleep, shouldRetry = () => true, label } = {},
) {
  let lastErr
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      return await fn(attempt)
    } catch (err) {
      lastErr = err
      if (attempt >= tries || !shouldRetry(err)) break
      if (label) console.error(`${label}: ${err.message} — retry ${attempt}/${tries - 1}`)
      await sleep(delayMs * attempt)
    }
  }
  if (label) throw new Error(`${label}: ${lastErr?.message ?? 'failed'} after ${tries} attempts`)
  throw lastErr
}
