// TEMPORARY (issue #1446): receives a report that a headshot drew a "?" and
// writes it to Vercel's runtime logs, where it can be read. It stores
// nothing, reads no game, and never touches a score: a report is ids, image
// URLs and flags, filtered to a closed field list (src/lib/headshot/report.js).
// Delete this file, that module and src/lib/headshot/log.js once the cause is
// found, which also gives the function slot back.
import { sanitizeHeadshotReport } from '../src/lib/headshot/report.js'

export const config = { runtime: 'edge' }

const MAX_BODY = 2048

export default async function handler(req) {
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } })
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return new Response(null, { status: 413 })
  const text = await req.text()
  if (text.length > MAX_BODY) return new Response(null, { status: 413 })
  let report = null
  try {
    report = sanitizeHeadshotReport(JSON.parse(text))
  } catch {
    report = null
  }
  if (!report) return new Response(null, { status: 400 })
  report.ua = (req.headers.get('user-agent') ?? '').slice(0, 120)
  console.log(`[headshot-report] ${JSON.stringify(report)}`)
  return new Response(null, { status: 204 })
}
