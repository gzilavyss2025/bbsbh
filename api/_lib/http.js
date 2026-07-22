// Shared upstream-fetch guard for the crawler-only link-preview edge layer
// (api/og.js + api/_lib/cards.js). Every function here runs on an
// UNAUTHENTICATED path where a novel query is a cache miss that fans out to
// third-party hosts (statsapi, Google Fonts, mlbstatic CDNs) — bound each call
// so a slow/hostile host can't pin an edge invocation open past a crawler's
// own patience (or, short of that, the platform's function limit).

export const FETCH_TIMEOUT_MS = 4000

// `timeoutMs` defaults to the crawler-facing budget above but is overridable
// per call — scripts/warm-previews.mjs reuses this same guard for its own,
// more patient batch-job fetches (see its REQUEST_TIMEOUT_MS).
export async function fetchWithTimeout(url, init, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}
