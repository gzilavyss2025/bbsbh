// Shared upstream-fetch guard for the crawler-only link-preview edge layer
// (api/og.js + api/_lib/cards.js). Every function here runs on an
// UNAUTHENTICATED path where a novel query is a cache miss that fans out to
// third-party hosts (statsapi, Google Fonts, mlbstatic CDNs) — bound each call
// so a slow/hostile host can't pin an edge invocation open past a crawler's
// own patience (or, short of that, the platform's function limit).

export const FETCH_TIMEOUT_MS = 4000

export async function fetchWithTimeout(url, init) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}
