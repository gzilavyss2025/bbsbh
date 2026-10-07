// A small on-device log of headshot trouble, for tracing the "?" in issue
// #1446. TEMPORARY: remove with the `?headshotlog` panel once the cause is
// fixed. It holds ids, URLs and flags only, never a score.

export const HEADSHOT_LOG_CAP = 50
const KEY = 'bbsbh:headshotlog'

// Pure: the previous log plus one event, newest last, capped.
export function recordHeadshotEvent(log, event, now = Date.now()) {
  const prev = Array.isArray(log) ? log : []
  return [...prev, { at: now, ...event }].slice(-HEADSHOT_LOG_CAP)
}

export function readHeadshotLog(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function clearHeadshotLog(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(KEY)
  } catch {
    /* storage can be blocked; the log is best-effort */
  }
}

export function logHeadshotEvent(event, storage = globalThis.localStorage) {
  try {
    const online = globalThis.navigator?.onLine
    const full = { online, ...event }
    storage?.setItem(KEY, JSON.stringify(recordHeadshotEvent(readHeadshotLog(storage), full)))
  } catch {
    /* storage can be blocked or full; the log is best-effort */
  }
}
