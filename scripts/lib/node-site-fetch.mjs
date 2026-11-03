// Lets src/api code run under Node: a fetch of a site path (`/data/...`)
// reads public/ from disk, and every other URL goes to the real fetch. The
// browser modules then run unchanged (scripts/gen-wire-facts.mjs).
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export function installSiteFetch(publicDir) {
  const real = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (!url.startsWith('/')) return real(input, init)
    try {
      const body = await readFile(join(publicDir, url.split('?')[0]))
      return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } })
    } catch {
      return new Response('', { status: 404 })
    }
  }
}
