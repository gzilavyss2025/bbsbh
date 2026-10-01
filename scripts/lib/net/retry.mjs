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

import { setTimeout as defaultSleep } from 'node:timers/promises'

export async function withRetry(
  fn,
  { tries = 3, delayMs = 2000, sleep = defaultSleep, shouldRetry = () => true } = {},
) {
  let lastErr
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      return await fn(attempt)
    } catch (err) {
      lastErr = err
      if (attempt >= tries || !shouldRetry(err)) break
      await sleep(delayMs * attempt)
    }
  }
  throw lastErr
}
