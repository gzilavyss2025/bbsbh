// Retry an async call a few times with a growing pause, for the nightly
// generators whose whole run dies on one dropped socket.
//
// scripts/lib/statsapi.mjs deliberately keeps getJson retry-free (see its
// header), so a generator that wants tolerance opts in here. The 2026-09-29
// run lost gen-doubleheaders.mjs to a single `SocketError: other side closed`
// on one of its 23 season requests, and the freshness guard then failed the
// whole job.

export async function withRetry(fn, { tries = 3, delayMs = 2000, sleep = defaultSleep } = {}) {
  let lastErr
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      return await fn(attempt)
    } catch (err) {
      lastErr = err
      if (attempt < tries) await sleep(delayMs * attempt)
    }
  }
  throw lastErr
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
