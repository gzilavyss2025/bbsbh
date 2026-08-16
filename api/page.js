// Server-rendered landing pages — the ninth narrow backend exception, and the
// first that exists for readers who are not people.
//
// WHY IT EXISTS. Tally is a client-rendered SPA. `api/preview.js` swaps the OG
// block for a shared deep link, but the body it serves is `<div id="root">
// </div>`, and the crawlers behind AI assistants do not execute JavaScript —
// GPTBot and ClaudeBot fetch script files and run none of them, and Anthropic's
// own fetch tool documents that it does not render JS-built pages. So every word
// of this app is, to them, a blank div. These guides are written for the person
// searching "how to score a baseball game" and for the assistant answering them,
// and neither can be reached from inside the bundle. This function is the whole
// mechanism for that.
//
// IT NEVER TOUCHES A GAME. No statsapi call, no gamePk, no feed, no date. Its
// only I/O is a Redis read of admin-authored copy. That is not incidental: this
// HTML is sent COMPLETE, with no SealBox in front of it and no reveal mark
// consulted, so a score placed here would be a score with no seal at all. The
// import list is the enforcement — nothing reachable from here can reach the
// feed — and `test/landing-pages.test.js` pins it.
//
// ONE FUNCTION, ALL PAGES. `vercel.json` rewrites `/learn` and `/learn/:slug`
// here. A function per page would read more simply and would also put this
// project against Vercel's Hobby function ceiling for the sake of eight files.

import { LANDING_PAGES, pageBySlug } from '../src/copy/landing/pages/index.js'
import { renderIndex, renderPage } from '../src/copy/landing/render.js'
import { resolvePage } from '../src/copy/landing/schema.js'
import { sanitizeOverrides } from '../src/copy/registry.js'
import { getRedis } from './_lib/redis.js'

// Node, not edge: it shares api/copy.js's Redis client and its deliberate
// `automaticDeserialization: false` handling.
export const config = { runtime: 'nodejs' }

const COPY_KEY = 'copy:overrides'

// Read the stored overrides, or {} for any reason at all.
//
// UNCONFIGURED AND BROKEN DEGRADE THE SAME WAY, and that is correct here even
// though it is the shape of bug ADR-0044 warns about. On the admin panel, "no
// overrides" looking like "store is down" hides data loss. On a public guide it
// means the page renders the shipped copy — which is complete, authored, and
// correct prose — rather than failing. A landing page that 500s because Redis
// blinked is strictly worse than one showing last week's wording.
async function readOverrides() {
  try {
    const redis = getRedis({ automaticDeserialization: false })
    if (!redis) return {}
    const reply = await redis.hgetall(COPY_KEY)
    return sanitizeOverrides(hashFromReply(reply))
  } catch {
    return {}
  }
}

// Pair Upstash's HGETALL reply into an object. See the long note on
// `hashFromReply` in api/copy.js — with `automaticDeserialization: false` the
// client's deserializer is replaced wholesale, and for HGETALL that deserializer
// is also what pairs the flat [field, value, …] reply. Without this, every
// override reads back as {} and every page silently shows shipped defaults.
function hashFromReply(reply) {
  if (!reply) return {}
  if (!Array.isArray(reply)) return reply
  const out = {}
  for (let i = 0; i < reply.length - 1; i += 2) out[String(reply[i])] = reply[i + 1]
  return out
}

// The `?edit` fork: hand back the SPA shell so the React editor route takes over
// at the same URL. This is what makes the gear "edit where it is rendered"
// (ADR-0044) without teaching a static document how to run React — the public
// URL stays a plain document, and the editor is one query parameter away.
async function spaShell(origin) {
  const res = await fetch(`${origin}/index.html`, { headers: { Accept: 'text/html' } })
  if (!res.ok) throw new Error(`index ${res.status}`)
  return res.text()
}

export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`)
  const slug = url.searchParams.get('slug')

  const send = (body, status, cache) => {
    res.statusCode = status
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.setHeader('cache-control', cache)
    res.end(body)
  }

  if (url.searchParams.has('edit')) {
    try {
      // never cached: it is a signed-in, one-person surface
      return send(await spaShell(url.origin), 200, 'private, no-store')
    } catch {
      return send('<!doctype html><meta http-equiv="refresh" content="0;url=/">', 200, 'no-store')
    }
  }

  const overrides = await readOverrides()

  if (!slug) {
    const pages = LANDING_PAGES.map((page) => resolvePage(page, overrides))
    return send(renderIndex(pages), 200, 'public, max-age=0, s-maxage=60, stale-while-revalidate=86400')
  }

  const page = pageBySlug(slug)
  if (!page) {
    // A real 404, not a soft one. A 200 on a missing guide teaches a crawler
    // that every /learn/anything URL is a page, which is how a site acquires
    // thousands of indexable nonexistent URLs.
    return send(
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Not found | Tally Baseball</title><link rel="stylesheet" href="/learn.css"></head><body><main><article><h1>No such guide</h1><p><a href="/learn">See every guide</a>, or <a href="/">open tonight&#39;s games</a>.</p></article></main></body></html>',
      404,
      'public, max-age=0, s-maxage=300',
    )
  }

  const resolved = resolvePage(page, overrides)
  // s-maxage 60 matches api/copy.js's own cache window, so a wording change the
  // owner saves is live within about a minute rather than an hour.
  return send(renderPage(resolved), 200, 'public, max-age=0, s-maxage=60, stale-while-revalidate=86400')
}
