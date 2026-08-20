// The pure route/slug helpers the crawler-facing edge layer shares — the address
// spelling, the date wording, and the small string tidy-ups. No fetch, no
// runtime, no state; three modules import it (cards.js resolves a route with it,
// crawl.js writes links with it, preview.js reaches it through both) and it
// imports nothing.
//
// These are deliberate small copies of their src/lib counterparts (route.js
// `matchupSlug`/`urlDateToApi`/`slugify`/`idFromSlug`/`entitySegment`, teams.js
// `teamAbbr`) — the edge runtime can't import the app's ESM module graph, and
// these are near-immutable. Keep them byte-for-byte in sync; `test/cards.test.js`
// asserts these copies against the app's own rather than trusting this comment.
//
// They lived in cards.js until the crawlable body (ADR-0059) gave them a second
// caller. A club's roster page names 26 players as links, so the '{slug}-{id}'
// spelling is no longer something one file uses once per request to write a
// canonical — it is what every link in every body is built from, and the two
// sides have to agree.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Collapse runs of whitespace so a name the API hands back with a stray double
// space (e.g. "Milwaukee  Brewers") renders clean on the card.
export const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()

export function urlDateToApi(d) {
  if (!/^\d{8}$/.test(d || '')) return null
  return `${d.slice(4, 8)}-${d.slice(0, 2)}-${d.slice(2, 4)}`
}

export function niceDate(apiDate) {
  const [y, m, d] = (apiDate || '').split('-').map(Number)
  if (!y || !m || !d) return ''
  return `${MONTHS[m - 1]} ${d}, ${y}`
}

export function teamAbbr(team) {
  return (
    team?.abbreviation ||
    (team?.teamName || team?.name || '').replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase()
  )
}

export function matchupSlug(awayAbbr, homeAbbr, gameNumber = 1) {
  const base = `${(awayAbbr || '').toLowerCase()}${(homeAbbr || '').toLowerCase()}`
  return gameNumber > 1 ? `${base}-${gameNumber}` : base
}

// A '/player/{slug}-{id}' address arrives here with the whole segment in `id`,
// because vercel.json's rewrite captures one segment and cannot know which part
// of it is the number. Everything below fetches by the number, and the CANONICAL
// this page emits is rebuilt from the resolved name — so the slug that came in
// is only ever a hint, and a stale or wrong one (a traded player, a hand-typed
// link) still resolves and still self-corrects. route.js is the twin. ADR-0057.
export function idFromSlug(segment) {
  const s = String(segment ?? '')
  if (/^\d+$/.test(s)) return s
  const m = s.match(/-(\d+)$/)
  return m ? m[1] : s
}

export function slugify(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '')
}

// The '{slug}-{id}' address itself. Mirrored byte-for-byte from route.js's
// entitySegment (see this file's header on the copies), and the reason it is a
// named helper on both sides rather than an expression: the crawlable body links
// to OTHER pages now — a club's roster names 26 players, a player names his club
// — so this spelling is no longer used once per request to write a canonical. It
// is used everywhere a body points somewhere, and the two sides must agree.
export function entitySegment(id, name) {
  const slug = /^\d+$/.test(String(id ?? '')) ? slugify(name) : ''
  return slug ? `${slug}-${id}` : String(id ?? '')
}
