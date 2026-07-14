// Shared low-level fetch wrapper for the public MLB Stats API — every topic
// file in api/ (schedule.js, uniforms.js, game.js, person-fetch.js, team.js,
// search.js) calls this for its own endpoints. Field paths across those files
// were verified against the live July 5 2026 Brewers @ D-backs game (gamePk
// 825061).

const BASE = 'https://statsapi.mlb.com'
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])
const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_RETRIES = 1

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function getJson(
  path,
  { signal: parentSignal, timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES } = {},
) {
  for (let attempt = 0; ; attempt += 1) {
    const controller = new AbortController()
    let timedOut = false
    const onAbort = () => controller.abort()
    parentSignal?.addEventListener('abort', onAbort, { once: true })
    if (parentSignal?.aborted) controller.abort()
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)

    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })
      if (res.ok) return res.json()

      if (attempt < retries && RETRYABLE_STATUS.has(res.status)) {
        await delay(250 * 2 ** attempt)
        continue
      }
      throw new Error(`MLB API ${res.status} for ${path}`)
    } catch (error) {
      if (parentSignal?.aborted) throw error
      const failure = timedOut
        ? Object.assign(new Error(`MLB API timeout for ${path}`), { name: 'TimeoutError' })
        : error
      const retryableError = timedOut || error?.name === 'TypeError'
      if (attempt < retries && retryableError) {
        await delay(250 * 2 ** attempt)
        continue
      }
      throw failure
    } finally {
      clearTimeout(timeout)
      parentSignal?.removeEventListener('abort', onAbort)
    }
  }
}
