// Crash signal sink (#2514). A browser beacon posts { kind, route, status, build } when the app
// breaks on a phone (src/lib/crash/report.js); this writes one log line that Gary reads in Vercel
// runtime logs (Project, Logs, search "bbsbh-crash"). The payload is rebuilt again here through the
// same allowlist, so whatever else a request carries is never logged. No score, id or URL, ever.
// Inert by nature: no store, no secret. Always answers 204.
import { buildCrashPayload } from '../src/lib/crash/report.js'

export const config = { runtime: 'edge' }

const MAX_BODY = 512

export default async function handler(request) {
  if (request.method === 'POST') {
    try {
      const text = (await request.text()).slice(0, MAX_BODY)
      const payload = buildCrashPayload(JSON.parse(text))
      if (payload) console.log(`bbsbh-crash ${JSON.stringify(payload)}`)
    } catch { /* a malformed report is dropped */ }
  }
  return new Response(null, { status: 204 })
}
