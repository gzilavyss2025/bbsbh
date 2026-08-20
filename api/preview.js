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
//
// It also writes a READABLE BODY for the spoiler-free routes (ADR-0059). The
// head has carried a real card since ADR-0012, but the body underneath it was
// `<div id="root"></div>`, and the crawlers behind AI assistants run no
// JavaScript — so a player page was a blank div with a good meta description.
// The markup is built by api/_lib/crawl.js from the payload buildCard already
// fetched, goes in as a SIBLING of #root (see that file on why not inside it),
// and src/main.jsx removes it when the app boots.
//
// GAME ROUTES GET NO BODY, by construction rather than by care: gameCard returns
// no `crawl` object, so there is nothing here to render and no branch to get
// wrong. A game route is inside the spoiler scope, and the schedule payload that
// would answer one carries `teams.away.score` and `isWinner` in the same object
// as the matchup. ADR-0059 argues it.

import { SITE_URL } from '../src/copy/landing/site.js'
import { buildCard, buildRoster } from './_lib/cards.js'
import { CRAWL_STYLE, renderCrawlBody } from './_lib/crawl.js'

export const config = { runtime: 'edge' }

// The default OG block in index.html is wrapped in these markers; we swap
// everything between them.
const MARKER = /<!-- OG:BEGIN[\s\S]*?OG:END -->/

// Where the crawlable body and its stylesheet go in the shell. Both are exact
// strings from index.html rather than loose patterns, and a miss on either one
// means the body is simply not written — the same fail-safe discipline MARKER
// has. If a future index.html spells the mount point differently, a shared link
// still serves the card it serves today.
const ROOT_DIV = '<div id="root"></div>'
const HEAD_END = '</head>'

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// The public URL the user actually shared, rebuilt from the rewrite params —
// clean of the ?route=… internals (and of any spoiler-cutoff ?d/?s hints).
//
// ALWAYS ON SITE_URL, never on the request's own origin. Three hostnames serve
// this same function — tallybb.com, www.tallybb.com and bbsbh.vercel.app — plus
// a deployment URL per build, and a page that names whichever one the reader
// arrived on is a page telling a crawler that four URLs of identical content are
// four different pages. This value is BOTH og:url and rel=canonical below, so it
// has to be the one origin the site advertises everywhere else (the sitemap,
// robots.txt, /learn). See src/copy/landing/site.js.
//
// This is the only surface that can emit a correct canonical for these routes:
// the static shell has no idea which route it is about to boot, and vercel.json
// rewrites ~30 real paths through here WITH the route in hand.
//
// A person/club page has TWO working addresses — '/player/545361' and
// '/player/mike-trout-545361' — because the slugged form had to arrive without
// breaking any link shared before it existed (route.js, ADR-0057). Two addresses
// for one page is precisely what rel=canonical is for, and this picks the
// slugged one: `card.segment`, spelled from the name statsapi just returned
// rather than from whatever segment the visitor arrived on. So a link carrying
// a player's OLD club, a truncated slug, or no slug at all still names the same
// one canonical page. With no card (statsapi down), it falls back to the
// incoming segment — the address still resolves, and the next crawl fixes it.
export function canonicalUrl(params, card = null) {
  const route = params.get('route')
  const entity = card?.segment || params.get('id')
  let path
  switch (route) {
    case 'player':
      path = `/player/${entity}`
      break
    case 'team':
      path = `/team/${entity}`
      break
    case 'team-leaders':
      path = `/team/${entity}/leaders`
      break
    case 'team-roster':
      path = `/team/${entity}/roster`
      break
    case 'team-games':
      path = `/team/${entity}/games`
      break
    case 'team-numbers':
      path = `/team/${entity}/numbers`
      break
    case 'team-minors':
      path = `/team/${entity}/minors`
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
    case 'fouls':
    case 'milestones':
    case 'umpires':
    case 'awards':
    case 'postseason-history':
    case 'postseason-leaders':
    case 'trade-deadline':
    case 'all-star-rosters':
    case 'all-star-legacy':
    case 'logbook':
    case 'first-scorebook':
    case 'photos':
    case 'situational-records':
    case 'salaries':
    case 'doubleheaders':
    case 'postseason-race':
    case 'attendance':
      path = `/${route}`
      break
    // Three whose route name is not their path. They cannot join the
    // fallthrough above, and that is precisely why they were missed.
    case 'pace':
      path = '/pace-of-play'
      break
    case 'farm-system':
      path = '/farm-system-rankings'
      break
    case 'bullpens':
      path = '/bullpen-availability'
      break
    default:
      path = '/'
  }
  return `${SITE_URL}${path}`
}

export function renderHead(card, url) {
  const t = esc(card.title)
  const d = esc(card.description)
  const img = esc(card.image)
  const alt = esc(card.alt || card.title)
  const u = esc(url)
  return `<!-- OG:BEGIN (dynamic, injected per route by /api/preview) -->
    <link rel="canonical" href="${u}" />
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

// Put the body in the shell, or hand the shell back untouched.
//
// Replacements go through a function rather than a string, because a
// replacement STRING treats `$&` and friends as references — and the text
// flowing through here is a person's name, which this app does not get to
// assume the shape of.
export function withCrawlBody(html, card, roster) {
  if (!card?.crawl) return html
  const body = renderCrawlBody(roster ? { ...card.crawl, list: roster } : card.crawl)
  if (!body || !html.includes(ROOT_DIV)) return html
  const withBody = html.replace(ROOT_DIV, () => `${body}\n    ${ROOT_DIV}`)
  return withBody.includes(HEAD_END)
    ? withBody.replace(HEAD_END, () => `${CRAWL_STYLE}${HEAD_END}`)
    : withBody
}

export default async function handler(req) {
  const url = new URL(req.url)
  const origin = url.origin

  // Two requests at most, and never in series. buildRoster answers null for
  // every route but /team/{id}/roster, so this is one upstream call on ~29 of
  // the ~30 rewritten routes and two — concurrent, so the same wall-clock — on
  // the one whose body is a list of names.
  let card = null
  let roster = null
  try {
    ;[card, roster] = await Promise.all([buildCard(url.searchParams, origin), buildRoster(url.searchParams)])
  } catch {
    card = null
    roster = null
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
    // The card's IMAGE stays on the request origin (buildCard, above) so a
    // preview deploy renders its own /api/og; the PAGE URL does not, so a
    // preview deploy never advertises itself as canonical.
    html = html.replace(MARKER, renderHead(card, canonicalUrl(url.searchParams, card)))
  }

  html = withCrawlBody(html, card, roster)

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Humans and crawlers share this. A resolved card is briefly edge-cached
      // but always revalidatable (a traded player's card should refresh within
      // the hour). An UNRESOLVED card (statsapi hiccup, or a share that landed
      // mid-transient-failure) gets a much shorter lifetime instead of the same
      // hour-plus window — otherwise the one bad crawl that matters most (a
      // link's first, one-time fetch by iMessage/a chat client) bakes the
      // static fallback in for anyone opening that URL for the rest of the
      // hour, long after the underlying hiccup has passed.
      //
      // A CONSTANT route sits in a third band. The ~25 report routes are built
      // by genericCard with no statsapi call, so neither their card nor their
      // body can change between two requests — only a deploy changes them, and a
      // deploy is a new edge cache anyway. Revalidating those hourly bought
      // nothing; a day, stale-servable for a week, is the honest number. The
      // entity routes keep the hour, because the body they now carry is built
      // from the same payload as the card and goes stale on the same event: a
      // trade.
      'cache-control': !card
        ? 'public, max-age=0, s-maxage=30'
        : card.constant
          ? 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800'
          : 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
