// Crawler-facing HTML for a deep link: serves the app's own index.html with the
// Open Graph / Twitter tags swapped for the route's dynamic card (see
// api/_lib/cards.js). Real users get the same HTML and the SPA boots normally —
// the only difference a human sees is a per-page <title>. Only the initial hard
// load of a shared link hits this; client-side (pushState) navigation never
// does. See docs/adr/0012-dynamic-link-previews.md.
//
// vercel.json rewrites the deep-link paths here, encoding the route in the query
// (?route=player&id=…). We fetch the built index.html over the same origin (so
// the hashed asset references stay correct on every deploy/preview URL) and
// replace the marker block. Any failure — statsapi down, card unresolved — falls
// through to the static default card, so a shared link can never break.

import { buildCard } from './_lib/cards.js'

export const config = { runtime: 'edge' }

// The default OG block in index.html is wrapped in these markers; we swap
// everything between them.
const MARKER = /<!-- OG:BEGIN[\s\S]*?OG:END -->/

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// The public URL the user actually shared, rebuilt from the rewrite params —
// clean of the ?route=… internals (and of any spoiler-cutoff ?d/?s hints).
function canonicalUrl(params, origin) {
  const route = params.get('route')
  let path = '/'
  switch (route) {
    case 'player':
      path = `/player/${params.get('id')}`
      break
    case 'team':
      path = `/team/${params.get('id')}`
      break
    case 'team-leaders':
      path = `/team/${params.get('id')}/leaders`
      break
    case 'game':
      path = `/${params.get('date')}/${params.get('matchup')}/${params.get('section')}`
      break
    case 'leaders':
      path = params.get('scope') ? `/leaders/${params.get('scope')}` : '/leaders'
      break
    case 'leaders-org':
      path = `/leaders/org/${params.get('orgId')}`
      break
    case 'standings':
    case 'prospects':
    case 'rehab':
    case 'about':
    case 'logos':
      path = `/${route}`
      break
    default:
      path = '/'
  }
  return `${origin}${path}`
}

function renderHead(card, url) {
  const t = esc(card.title)
  const d = esc(card.description)
  const img = esc(card.image)
  const alt = esc(card.alt || card.title)
  const u = esc(url)
  return `<!-- OG:BEGIN (dynamic, injected per route by /api/preview) -->
    <meta name="description" content="${d}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Tally Baseball" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:url" content="${u}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${alt}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${img}" />
    <title>${t}</title>
    <!-- OG:END -->`
}

export default async function handler(req) {
  const url = new URL(req.url)
  const origin = url.origin

  let card = null
  try {
    card = await buildCard(url.searchParams, origin)
  } catch {
    card = null
  }

  // Fetch our own static shell (a filesystem file — served directly, never
  // rewritten back here, so no loop) to keep the hashed asset refs correct.
  let html
  try {
    const res = await fetch(`${origin}/index.html`, { headers: { Accept: 'text/html' } })
    if (!res.ok) throw new Error(`index ${res.status}`)
    html = await res.text()
  } catch {
    // Own origin unreachable (the whole deploy is down) — last resort that
    // can't loop back into this function: bounce the browser to the home route.
    return new Response(
      `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/"><title>Tally Baseball</title>`,
      { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
    )
  }

  if (card && MARKER.test(html)) {
    html = html.replace(MARKER, renderHead(card, canonicalUrl(url.searchParams, origin)))
  }

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Humans and crawlers share this; keep it briefly edge-cached but always
      // revalidatable (a traded player's card should refresh within the hour).
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
