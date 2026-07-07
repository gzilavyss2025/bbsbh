#!/usr/bin/env node
// fetch-top-prospects: snapshot MLB Pipeline's Top 100 Prospects list AND
// every org's full farm-system prospect leaderboard into
// public/data/top-prospects.json, which the PWA reads at runtime.
//
// Runs OFF-DEVICE — a scheduled GitHub Actions workflow (see
// .github/workflows/update-top-prospects.yml), not app code — because the
// source page can't be fetched from the browser: www.mlb.com sends no CORS
// headers (verified live with curl + an Origin header + an OPTIONS
// preflight), unlike statsapi.mlb.com's Access-Control-Allow-Origin: *,
// which is what lets the rest of this app be a no-backend PWA. A plain
// server-side fetch() has no such restriction. See docs/top-prospects.md
// for the full rationale and gotchas.
//
// Usage: node scripts/fetch-top-prospects.mjs

// The BARE url (no query string) is the actual MLB Top 100 — sequential
// unique ranks 1-100, batters and pitchers interleaved. Verified stable
// across repeated requests (3/3 identical responses).
//
// Adding `?type=all&minPA=1` switches the SAME page to a WHOLLY DIFFERENT
// dataset — every org's own "Top 30-ish" farm-system leaderboard, ~862
// entries across ~30 teams, where `rank` means each prospect's rank WITHIN
// HIS OWN ORG's system (so it only ever spans ~1-30, repeating once per
// team) rather than an overall ranking. Both datasets are needed here: the
// bare URL for the standalone Top 100 page + player-page badge, the
// query-string URL for each team page's own prospect table.
const TOP100_URL = 'https://www.mlb.com/prospects/stats/top-prospects'
const ORG_URL = 'https://www.mlb.com/prospects/stats/top-prospects?type=all&minPA=1'
const OUT_PATH = new URL('../public/data/top-prospects.json', import.meta.url)
const UA = 'bbsbh-top-prospects/0.1 (baseball scorebook prospect rankings snapshot)'

// The page embeds the ranked list as a plain `var data = [...]` JS array in
// an inline <script> tag — not a JSON API, no auth. This is undocumented
// editorial page structure, not the documented statsapi the rest of the app
// relies on — expected to eventually break silently, hence the validation
// gates below.
function extractRawEntries(html) {
  const m = /var data = (\[.*?\]);/s.exec(html)
  if (!m) throw new Error('Could not find "var data = [...]" in the page — page structure may have changed.')
  const parsed = JSON.parse(m[1])
  if (!Array.isArray(parsed) || parsed.length < 50) {
    throw new Error(`Parsed data looks wrong (expected an array of entries, got ${Array.isArray(parsed) ? parsed.length : typeof parsed}).`)
  }
  for (const entry of parsed) {
    if (typeof entry.rank !== 'number' || typeof entry.playerId !== 'number') {
      throw new Error('An entry is missing a numeric rank/playerId — page structure may have changed.')
    }
  }
  return parsed
}

// Guard against the Top 100 fetch silently getting the wrong embedded
// dataset (observed live: the same bare URL has, at least once, served the
// per-org "All 900" shape instead — reason not fully pinned down, possibly
// an A/B test cookie or edge-cache variant). Real Top 100 data has
// near-unique ranks 1-100; the per-org dataset does not.
function assertTop100Shape(parsed) {
  const uniqueRanks = new Set(parsed.map((e) => e.rank)).size
  if (uniqueRanks < parsed.length * 0.9) {
    throw new Error(`Ranks aren't unique enough (${uniqueRanks} unique of ${parsed.length}) — this looks like the per-org "All 900" leaderboard, not the actual Top 100. Aborting rather than writing wrong data.`)
  }
}

// Mirror-image guard for the org-prospects fetch: expect ~30 distinct teams
// with ~20-30 entries apiece, not ~100 entries spread thin across up to 30
// teams (which is what the Top 100 shape looks like grouped by team).
function assertOrgShape(parsed) {
  const byTeam = new Map()
  for (const e of parsed) {
    if (!byTeam.has(e.teamId)) byTeam.set(e.teamId, [])
    byTeam.get(e.teamId).push(e)
  }
  const avgPerTeam = parsed.length / byTeam.size
  if (byTeam.size < 20 || avgPerTeam < 10) {
    throw new Error(`Doesn't look like a per-org leaderboard (${byTeam.size} teams, ${avgPerTeam.toFixed(1)} avg entries/team) — expected ~30 teams with ~20-30 entries each. This might be the Top 100 list instead. Aborting.`)
  }
}

// A handful of players show up as TWO raw entries at the same rank — one
// carrying their real stat line, the other a degenerate placeholder (e.g. a
// pitcher's stray ".000 AVG" batting line, presumably from a token
// plate appearance). Dedupe by playerId, preferring whichever entry's stat
// category actually matches the player's position — a pitcher-coded
// position (RHP/LHP/P) prefers the pitchingStats entry, everyone else
// prefers battingStats.
function dedupeByPlayer(raw) {
  const byId = new Map()
  for (const entry of raw) {
    const existing = byId.get(entry.playerId)
    if (!existing) {
      byId.set(entry.playerId, entry)
      continue
    }
    const isPitcher = /P$/.test(entry.position || '')
    const entryMatches = isPitcher ? entry.pitchingStats : entry.battingStats
    const existingMatches = isPitcher ? existing.pitchingStats : existing.battingStats
    if (entryMatches && !existingMatches) byId.set(entry.playerId, entry)
  }
  return [...byId.values()]
}

// A richer, three-figure headline line ("​.258, 20 HR, 98 RBI" / "85 IP, 3.31
// ERA, 89 SO"), computed here so the app never needs to know the raw
// battingStats/pitchingStats shape.
function statLineFor(entry) {
  if (entry.pitchingStats) {
    const ip = entry.pitchingStats.inningsPitched
    const era = entry.era ?? entry.pitchingStats.era
    const so = entry.pitchingStats.strikeOuts
    return [
      ip != null ? `${ip} IP` : null,
      era ? `${era} ERA` : null,
      Number.isFinite(so) ? `${so} SO` : null,
    ].filter(Boolean).join(', ')
  }
  if (entry.battingStats) {
    const avg = entry.avg ?? entry.battingStats.avg
    const hr = entry.battingStats.homeRuns
    const rbi = entry.battingStats.rbi
    return [
      avg || null,
      Number.isFinite(hr) ? `${hr} HR` : null,
      Number.isFinite(rbi) ? `${rbi} RBI` : null,
    ].filter(Boolean).join(', ')
  }
  return ''
}

// Slim each raw entry down to what the app actually needs — the full stat
// blob is dropped; the app already has live stats for any player it renders
// via statsapi. `levelRaw` is named deliberately (not `level`) so it's never
// mistaken for this app's own SPORT_LABEL scheme (src/lib/teams.js) — it's
// the scraped sportAbbrev string, display-only (the app resolves a player's
// actual current affiliate by cross-referencing live rosters, not this
// string — see prospectAffiliateMap in src/api/prospects.js).
function slim(entry, rankKey, jerseyNumbers = null) {
  return {
    [rankKey]: entry.rank,
    playerId: entry.playerId,
    name: entry.name ?? '',
    teamId: entry.teamId ?? null,
    team: entry.team ?? '',
    position: entry.position ?? '',
    levelRaw: entry.sportAbbrev ?? '',
    statLine: statLineFor(entry),
    age: entry.age ?? null,
    ...(jerseyNumbers ? { number: jerseyNumbers.get(entry.playerId) ?? null } : {}),
  }
}

async function fetchList(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) {
    throw new Error(`Fetch failed: HTTP ${res.status} for ${url}`)
  }
  const html = await res.text()
  return extractRawEntries(html)
}

// Jersey numbers aren't part of the scraped Pipeline data at all — pulled
// separately from the documented statsapi.mlb.com (the same public API the
// rest of the app uses), one batched request for every Top 100 playerId.
// Many MiLB prospects simply have no assigned number yet — degrades to no
// entry for that id, same as every other MiLB gap in this app.
async function fetchJerseyNumbers(playerIds) {
  if (!playerIds.length) return new Map()
  try {
    const res = await fetch(`https://statsapi.mlb.com/api/v1/people?personIds=${playerIds.join(',')}`)
    if (!res.ok) return new Map()
    const data = await res.json()
    return new Map((data.people ?? []).map((p) => [p.id, p.primaryNumber ?? null]))
  } catch {
    return new Map()
  }
}

async function main() {
  const [top100Raw, orgRaw] = await Promise.all([
    fetchList(TOP100_URL),
    fetchList(ORG_URL),
  ])
  assertTop100Shape(top100Raw)
  assertOrgShape(orgRaw)

  const top100Deduped = dedupeByPlayer(top100Raw)
  const jerseyNumbers = await fetchJerseyNumbers(top100Deduped.map((e) => e.playerId))
  const players = top100Deduped
    .map((e) => slim(e, 'rank', jerseyNumbers))
    .sort((a, b) => a.rank - b.rank)
  const top100Ids = new Map(players.map((p) => [p.playerId, p.rank]))

  // Dedupe is scoped globally by playerId here too — a person shouldn't
  // appear twice even across different orgs (a real trade mid-scrape would
  // be a genuine edge case; picking one row is fine either way).
  const orgProspects = dedupeByPlayer(orgRaw)
    .map((e) => ({ ...slim(e, 'orgRank'), topRank: top100Ids.get(e.playerId) ?? null }))
    .sort((a, b) => (a.teamId - b.teamId) || (a.orgRank - b.orgRank))

  const snapshot = {
    generatedAt: new Date().toISOString(),
    source: TOP100_URL,
    orgSource: ORG_URL,
    count: players.length,
    players,
    orgProspects,
  }

  const fs = await import('node:fs/promises')
  await fs.mkdir(new URL('.', OUT_PATH), { recursive: true })
  await fs.writeFile(OUT_PATH, JSON.stringify(snapshot, null, 2) + '\n')
  console.log(`Wrote ${players.length} Top 100 prospects + ${orgProspects.length} org prospects to ${OUT_PATH.pathname}`)
}

// Never touch OUT_PATH on failure — the last-known-good snapshot must stay
// in place. A broken scrape fails this process (and the GitHub Actions run
// that invokes it) rather than regressing what's already live.
main().catch((err) => {
  console.error('fetch-top-prospects failed:', err.message)
  process.exit(1)
})
