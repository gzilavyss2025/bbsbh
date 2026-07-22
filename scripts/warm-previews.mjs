// Proactively warms the crawler-facing preview edge cache (api/preview.js +
// api/og.js) for today's MLB slate — every game, both clubs, and each club's
// active roster — so the first REAL crawl of a shared link (iMessage/Slack/
// Discord/etc., which happens once per message and is never retried) doesn't
// race a cold, statsapi-contested resolution. See
// docs/adr/0012-dynamic-link-previews.md.
//
// NOT a gen-*.mjs data generator (see scripts/CLAUDE.md's naming convention):
// it writes no public/data/* file, so it's out of the nightly job's commit
// step. It's also the one script here that talks to bbsbh.vercel.app itself
// rather than only statsapi — pure best-effort cache warming, never a hard
// dependency for anything downstream. MLB only (sportId 1): the vast
// majority of shared links, and where the bug this warms against was found.
//
// Self-contained (own small copies of the date/slug helpers), same
// convention as gen-rehab.mjs mirroring person.js's transaction-scan logic
// for anything that lives under src/ — but api/_lib/http.js has no such
// boundary (plain fetch/AbortController, no edge-runtime-only API), so its
// fetchWithTimeout is imported directly rather than re-copied a third time.
//
// Rather than reconstructing /api/og's query params by hand (which would
// duplicate — and could drift from — api/_lib/cards.js's own card-building
// logic), each pretty page is fetched first and its own <meta property=
// "og:image"> is read back out and warmed verbatim. That guarantees the
// exact URL a real crawler will request, with no risk of warming a
// differently-parameterized (and therefore differently-cached) image URL.
// If api/preview.js's renderHead() ever reorders/requotes that tag, OG_IMAGE_RE
// stops matching silently — warmPage logs a warning in that case rather than
// letting image-warm coverage quietly drop to zero with no signal.

import { fetchWithTimeout } from '../api/_lib/http.js'

const STATSAPI = 'https://statsapi.mlb.com'
const APP_ORIGIN = 'https://bbsbh.vercel.app'
const REQUEST_TIMEOUT_MS = 8000
const CONCURRENCY = 8
// The finite, predictable game sections worth pre-warming — NOT the
// open-ended top{n}/bottom{n} innings-viewer set, which isn't
// precomputable (unbounded, and which half is "live" when someone shares
// isn't knowable ahead of time). See the plan this script came out of.
const GAME_SECTIONS = ['lineup1', 'lineup2', 'boxscore']
const OG_IMAGE_RE = /property="og:image" content="([^"]*)"/

function easternDateParts(date) {
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
  const [y, m, d] = s.split('-').map(Number)
  return { y, m, d }
}

function todayEasternDateStr() {
  const { y, m, d } = easternDateParts(new Date())
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function apiDateToUrl(apiDate) {
  const [y, m, d] = (apiDate || '').split('-')
  return `${m}${d}${y}`
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

// Run an async mapper across items with a small concurrency cap (be polite
// to both statsapi and our own edge functions). Mirrors gen-milestones.mjs /
// gen-vs-team-splits.mjs's helper of the same name.
async function mapConcurrent(items, limit, mapper) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      try {
        results[i] = await mapper(items[i], i)
      } catch {
        results[i] = null
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function getJson(url) {
  const res = await fetchWithTimeout(url, undefined, REQUEST_TIMEOUT_MS)
  if (!res.ok) throw new Error(`${res.status} for ${url}`)
  return res.json()
}

// Fetches a pretty preview page (warming its own cache entry as a side
// effect) and, if it carries an og:image tag not already warmed this run,
// warms that image URL too. Returns nothing meaningful — callers only care
// about the counters below.
async function warmPage(url, seenImages) {
  const res = await fetchWithTimeout(url, undefined, REQUEST_TIMEOUT_MS)
  const outcome = { url, ok: res.ok, status: res.status }
  if (!res.ok) return [outcome]
  const text = await res.text()
  const m = OG_IMAGE_RE.exec(text)
  if (!m) {
    console.warn(
      `warm-previews: no og:image tag found on ${url} — OG_IMAGE_RE may no ` +
        `longer match api/preview.js's renderHead() output`,
    )
    return [outcome]
  }
  const imageUrl = m[1].replace(/&amp;/g, '&')
  if (seenImages.has(imageUrl)) return [outcome]
  seenImages.add(imageUrl)
  try {
    const imgRes = await fetchWithTimeout(imageUrl, undefined, REQUEST_TIMEOUT_MS)
    return [outcome, { url: imageUrl, ok: imgRes.ok, status: imgRes.status }]
  } catch (err) {
    return [outcome, { url: imageUrl, ok: false, status: null, error: String(err) }]
  }
}

async function main() {
  const apiDate = todayEasternDateStr()
  const urlDate = apiDateToUrl(apiDate)
  const schedule = await getJson(
    `${STATSAPI}/api/v1/schedule?sportId=1&date=${apiDate}&hydrate=team`,
  )
  const games = (schedule.dates ?? []).flatMap((d) => d.games ?? [])
  if (games.length === 0) {
    console.log(`${apiDate}: no MLB games scheduled — nothing to warm`)
    return
  }

  const teamIds = new Set()
  const pageUrls = []
  for (const g of games) {
    const away = g.teams?.away?.team
    const home = g.teams?.home?.team
    if (!away?.id || !home?.id) continue
    teamIds.add(away.id)
    teamIds.add(home.id)
    const slug = matchupSlug(teamAbbr(away), teamAbbr(home), g.gameNumber ?? 1)
    for (const section of GAME_SECTIONS) {
      pageUrls.push(`${APP_ORIGIN}/${urlDate}/${slug}/${section}`)
    }
  }
  for (const id of teamIds) pageUrls.push(`${APP_ORIGIN}/team/${id}`)

  const rosterResults = await mapConcurrent([...teamIds], CONCURRENCY, async (id) => {
    const data = await getJson(`${STATSAPI}/api/v1/teams/${id}/roster?rosterType=active`)
    return (data.roster ?? []).map((r) => r.person?.id).filter(Boolean)
  })
  for (const ids of rosterResults) {
    if (!ids) continue
    for (const personId of ids) pageUrls.push(`${APP_ORIGIN}/player/${personId}`)
  }

  const seenImages = new Set()
  const results = (await mapConcurrent(pageUrls, CONCURRENCY, (url) => warmPage(url, seenImages))).flat()

  let ok = 0
  let failed = 0
  for (const r of results) {
    if (!r) failed += 1
    else if (r.ok) ok += 1
    else failed += 1
  }
  console.log(
    `${apiDate}: warmed ${ok}/${results.length} URL(s) across ${games.length} game(s), ` +
      `${teamIds.size} team(s) — ${failed} failed (non-fatal, best-effort warming only)`,
  )
}

main().catch((err) => {
  console.error(err.stack ?? String(err))
  process.exit(1)
})
