// The background "?" report (issue #1446). TEMPORARY, with log.js. A report
// holds ids, image URLs and flags only, never a score or game text, and the
// endpoint (api/headshot-report.js) logs it to Vercel's runtime logs.
export const REPORT_CAP = 20
const KINDS = new Set(['monogram-shown', 'logo-shown', 'load-error'])
const COMPONENTS = new Set(['Headshot', 'PitcherPhoto'])
const IMAGE_HOSTS = ['https://img.mlbstatic.com/', 'https://www.mlbstatic.com/']
const URL_MAX = 300
const RECENT_MAX = 5

// A report is sent for a drawn "?" only, once per component and person, and at
// most REPORT_CAP times a session. `sent` is the caller's session Set.
export function shouldReportHeadshot(event, sent) {
  if (event?.kind !== 'monogram-shown' || event.shown !== '?') return false
  const key = `${event.component}|${event.personId}`
  if (sent.has(key) || sent.size >= REPORT_CAP) return false
  sent.add(key)
  return true
}

// The event plus the recent failed loads for the same person, the trail that
// led to the "?".
export function buildHeadshotReport(event, log) {
  const recent = (Array.isArray(log) ? log : [])
    .filter((e) => e?.kind === 'load-error' && e.personId === event.personId)
    .slice(-RECENT_MAX)
  return { ...event, recent }
}

const num = (v) => (Number.isFinite(v) ? v : undefined)
const imageUrl = (u) =>
  typeof u === 'string' && u.length <= URL_MAX && IMAGE_HOSTS.some((h) => u.startsWith(h)) ? u : undefined

function pick(e) {
  const out = {}
  if (KINDS.has(e.kind)) out.kind = e.kind
  if (COMPONENTS.has(e.component)) out.component = e.component
  if (num(e.personId) !== undefined) out.personId = e.personId
  if (num(e.teamId) !== undefined) out.teamId = e.teamId
  if (num(e.step) !== undefined) out.step = e.step
  if (num(e.at) !== undefined) out.at = e.at
  if (typeof e.hasName === 'boolean') out.hasName = e.hasName
  if (typeof e.online === 'boolean') out.online = e.online
  if (typeof e.shown === 'string') out.shown = e.shown.slice(0, 3)
  const url = imageUrl(e.url)
  if (url) out.url = url
  return out
}

// Whatever the network sends, only these fields survive. null when it is not a
// report at all.
export function sanitizeHeadshotReport(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  if (!KINDS.has(body.kind)) return null
  const out = pick(body)
  if (Array.isArray(body.recent)) {
    out.recent = body.recent.slice(-RECENT_MAX).filter((e) => e && typeof e === 'object').map(pick)
  }
  return out
}
