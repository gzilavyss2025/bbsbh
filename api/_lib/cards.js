// Shared card-data builder for the link-preview edge layer. Both functions —
// api/preview.js (injects <meta> tags the crawler reads) and api/og.js
// (renders the 1200×630 image) — resolve a deep-link route to the same handful
// of display strings here, so the words on the card and the picture behind it
// can't drift.
//
// This is the ONE place the app talks to statsapi from the server side; it
// exists only to feed crawler link-previews (iMessage/Slack/Discord/Twitter),
// never the app itself — the SPA still fetches every byte of game data directly
// from the client (see docs/adr/0012-dynamic-link-previews.md). Everything here
// degrades to `null` on any failure, and the caller falls back to the app's
// static home-page card, so a statsapi hiccup can never break a shared link.
//
// The pure route/slug helpers below are deliberate small copies of their
// src/lib counterparts (route.js `matchupSlug`/`urlDateToApi`, teams.js
// `teamAbbr`) — the edge runtime can't import the app's ESM module graph, and
// these three are near-immutable. Keep them byte-for-byte in sync.

const MLB = 'https://statsapi.mlb.com'
const SEARCHABLE_SPORT_IDS = [1, 11, 12, 13, 14]
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// sportId → level abbreviation, mirrored from src/lib/teams.js SPORT_LABEL. Used
// to build the team card's "LEVEL | LEAGUE" line (e.g. "MLB | NATIONAL LEAGUE",
// "AAA | INTERNATIONAL LEAGUE").
const SPORT_LEVEL = { 1: 'MLB', 11: 'AAA', 12: 'AA', 13: 'A+', 14: 'A', 16: 'ROK' }

// Collapse runs of whitespace so a name the API hands back with a stray double
// space (e.g. "Milwaukee  Brewers") renders clean on the card.
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()

// --- pure helpers, mirrored from src/lib (see header) ----------------------

export function urlDateToApi(d) {
  if (!/^\d{8}$/.test(d || '')) return null
  return `${d.slice(4, 8)}-${d.slice(0, 2)}-${d.slice(2, 4)}`
}

function niceDate(apiDate) {
  const [y, m, d] = (apiDate || '').split('-').map(Number)
  if (!y || !m || !d) return ''
  return `${MONTHS[m - 1]} ${d}, ${y}`
}

function teamAbbr(team) {
  return (
    team?.abbreviation ||
    (team?.teamName || team?.name || '').replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase()
  )
}

function matchupSlug(awayAbbr, homeAbbr, gameNumber = 1) {
  const base = `${(awayAbbr || '').toLowerCase()}${(homeAbbr || '').toLowerCase()}`
  return gameNumber > 1 ? `${base}-${gameNumber}` : base
}

// --- statsapi fetch (server side, crawler-only) ----------------------------

async function getJson(path) {
  const res = await fetch(`${MLB}${path}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`MLB ${res.status} for ${path}`)
  return res.json()
}

// Scan a date's slate across every level and match the away+home slug back to a
// game — the edge-side twin of src/api/schedule.js's resolveGame. `hydrate=team`
// only: resolution needs abbreviations, nothing else.
async function resolveGame(apiDate, matchup) {
  const results = await Promise.allSettled(
    SEARCHABLE_SPORT_IDS.map((sid) =>
      getJson(`/api/v1/schedule?sportId=${sid}&date=${apiDate}&hydrate=team`),
    ),
  )
  const games = []
  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    for (const day of r.value.dates ?? []) games.push(...(day.games ?? []))
  }
  const want = (matchup || '').toLowerCase()
  return (
    games.find(
      (g) =>
        matchupSlug(
          teamAbbr(g.teams?.away?.team),
          teamAbbr(g.teams?.home?.team),
          g.gameNumber ?? 1,
        ) === want,
    ) ?? null
  )
}

// --- per-route card builders -----------------------------------------------
//
// Each returns { title, description, image, alt } or null. `image` is an
// absolute /api/og URL; `origin` is the live host (so previews work on any
// deploy/preview URL, not just the pinned production domain).

function ogUrl(origin, params) {
  const q = new URLSearchParams(params)
  return `${origin}/api/og?${q}`
}

async function playerCard(id, origin) {
  const data = await getJson(`/api/v1/people/${id}?hydrate=currentTeam`)
  const p = data.people?.[0]
  if (!p) return null
  const name = clean(p.fullName || p.firstLastName || p.lastFirstName || `Player ${id}`)
  const posAbbr = p.primaryPosition?.abbreviation
  const pos = posAbbr && posAbbr !== 'Unknown' ? posAbbr : ''
  const team = clean(p.currentTeam?.name || '')
  const sub = [team, pos].filter(Boolean).join(' · ')
  // The club whose brand color paints the card's photo box — the MLB parent for
  // a farmhand (so he gets his org's color), else his own club id.
  const colorTeam = p.currentTeam?.parentOrgId ?? p.currentTeam?.id ?? ''
  return {
    title: `${name} — Tally Baseball`,
    description: sub
      ? `${sub}. Bio, career register, and season stats — a spoiler-safe scorecard companion.`
      : `Bio, career register, and season stats — a spoiler-safe scorecard companion.`,
    image: ogUrl(origin, { type: 'player', id: String(id), name, sub, team: String(colorTeam) }),
    alt: sub ? `${name} — ${sub}` : name,
  }
}

async function teamCard(id, origin, { leaders = false } = {}) {
  const data = await getJson(`/api/v1/teams/${id}`)
  const t = data.teams?.[0]
  if (!t) return null
  const name = clean(t.name || `Team ${id}`)
  // "LEVEL | LEAGUE" — the level abbreviation (MLB/AAA/AA/A+/A) then the league,
  // so a MiLB club reads e.g. "AAA | INTERNATIONAL LEAGUE" instead of the old
  // redundant "<league> · <division>".
  const level = SPORT_LEVEL[t.sport?.id] || ''
  const league = clean(t.league?.name || '')
  const sub = [level, league].filter(Boolean).join(' | ')
  // Cosmetic descriptions still read the old league · division wording.
  const descBits = clean([t.league?.name, t.division?.name].filter(Boolean).join(' · '))
  const eyebrow = leaders ? 'TEAM LEADERS' : ''
  return {
    title: `${name}${leaders ? ' — Team Leaders' : ''} — Tally Baseball`,
    description: leaders
      ? `${name} statistical leaders — spoiler-safe. Every level, every category.`
      : descBits
        ? `${descBits}. Roster, leaders, and schedule — a spoiler-safe scorecard companion.`
        : `Roster, leaders, and schedule — a spoiler-safe scorecard companion.`,
    image: ogUrl(origin, { type: 'team', id: String(id), name, sub, eyebrow }),
    alt: `${name}${sub ? ` — ${sub}` : ''}`,
  }
}

async function gameCard(date, matchup, origin) {
  const apiDate = urlDateToApi(date)
  if (!apiDate) return null
  const g = await resolveGame(apiDate, matchup)
  if (!g) return null
  const away = g.teams?.away?.team
  const home = g.teams?.home?.team
  if (!away?.id || !home?.id) return null
  const awayAbbr = teamAbbr(away)
  const homeAbbr = teamAbbr(home)
  // Full nicknames for the card's text line ("BREWERS @ PIRATES"); abbreviations
  // ride along only as the logo fallback if a mark fails to load.
  const awayName = clean(away.teamName || away.name || awayAbbr)
  const homeName = clean(home.teamName || home.name || homeAbbr)
  const gm = (g.gameNumber ?? 1) > 1 ? ` · Game ${g.gameNumber}` : ''
  const when = `${niceDate(apiDate)}${gm}`
  return {
    title: `${away.name} @ ${home.name} — ${niceDate(apiDate)}`,
    description: `Score this game by hand, spoiler-free: live lineups, umpires, and rosters — every run stays sealed until you tap to reveal it.`,
    image: ogUrl(origin, {
      type: 'game',
      away: String(away.id),
      home: String(home.id),
      awayName,
      homeName,
      awayAbbr,
      homeAbbr,
      date: when,
    }),
    alt: `${awayAbbr} @ ${homeAbbr} — ${when}`,
  }
}

// Static-but-labeled cards for the app's non-entity screens. No statsapi call —
// the words are fixed, so the image is generated from the query alone.
const GENERIC = {
  leaders: { eyebrow: 'LEADERBOARDS', title: 'League Leaders', sub: 'Every level, every category — spoiler-safe.' },
  standings: { eyebrow: 'STANDINGS', title: 'Standings', sub: 'MLB divisions and the wild-card race.' },
  prospects: { eyebrow: 'PROSPECTS', title: 'Top Prospects', sub: 'The pipeline, ranked — a spoiler-safe scouting board.' },
  rehab: { eyebrow: 'REHAB', title: 'Rehab Assignments', sub: 'Who is on a rehab stint, league-wide.' },
  about: { eyebrow: 'ABOUT', title: 'Tally Baseball', sub: 'Keep score. Keep the surprise.' },
  logos: { eyebrow: 'LOGO SHEET', title: 'Logo Sheet', sub: 'Printable grayscale marks for pencil-sketching.' },
}

function genericCard(route, origin) {
  const g = GENERIC[route]
  if (!g) return null
  return {
    title: `${g.title} — Tally Baseball`,
    description: g.sub,
    image: ogUrl(origin, { type: 'generic', eyebrow: g.eyebrow, title: g.title, sub: g.sub }),
    alt: `${g.title} — ${g.sub}`,
  }
}

// Dispatch a preview-function query (built by the vercel.json rewrites) to the
// right builder. Returns null on any miss/failure so the caller keeps the
// static default card.
export async function buildCard(params, origin) {
  const route = params.get('route')
  try {
    switch (route) {
      case 'player':
        return await playerCard(params.get('id'), origin)
      case 'team':
        return await teamCard(params.get('id'), origin)
      case 'team-leaders':
        return await teamCard(params.get('id'), origin, { leaders: true })
      case 'game':
        return await gameCard(params.get('date'), params.get('matchup'), origin)
      case 'leaders-org':
        return genericCard('leaders', origin)
      case 'leaders':
      case 'standings':
      case 'prospects':
      case 'rehab':
      case 'about':
      case 'logos':
        return genericCard(route, origin)
      default:
        return null
    }
  } catch {
    return null
  }
}
