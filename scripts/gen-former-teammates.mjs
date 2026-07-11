// Regenerates public/data/former-teammates.json — for every upcoming matchup
// (MLB or MiLB), the pairs of players on the two OPPOSING clubs who were once
// teammates (majors or minors), already shaped for the lineup page's FORMER
// TEAMMATES card (src/api/formerTeammates.js just reads this file).
//
// This runs on a cron via .github/workflows/update-nightly-data.yml, NOT at
// request time. Building it is expensive: two opposing players are "former
// teammates" iff their careers share a (teamId, season) pair, and reducing a
// career to that set means year-by-year stats across MLB *and* each MiLB level
// — one request per level, since the API silently returns nothing for a
// comma-list of sportIds (see src/api/person-fetch.js). That's ~5 requests per
// player × ~26 players × 2 clubs ≈ hundreds of calls per matchup, far too heavy
// for a page load. Past-season career history is immutable, so a nightly job
// that writes a small static file keeps the live page to a single same-origin
// read. Mirrors scripts/gen-rehab.mjs's build-time-fetch pattern (see
// docs/data-enrichment.md §5).
//
// Covers every scheduled matchup — MLB and MiLB (AAA/AA/A+/A) alike — for the
// rosters of clubs actually scheduled to play each other in a short window, not
// the whole league. Extending past MLB-only widens the player pool a lot (every
// MiLB game each night, not just the majors' slate), so this is the costliest
// part of the run; the per-player career fetch is still deduped across every
// matchup a club appears in.
//
// Two accuracy guards, both mirroring src/api/person.js:
//   - Rookie/complex ball (sportId 16) is skipped: its huge, churny short-season
//     rosters would match half a level as "teammates".
//   - A veteran's brief rehab stint would false-match him to a level's prospects,
//     so a POST-DEBUT minor-league season below REHAB_CAP is dropped (the same
//     absolute cap person.js uses to tell a demotion from rehab noise).
//
// Each row also carries a `score` — how INTERESTING the connection is, not just
// whether one exists. A well-traveled veteran can share a (team, season) with
// dozens of tonight's players; without a score every one of those is an equally
// weighted card, and the fun ones (an MLB reunion, two current stars) drown in
// a pile of ships-in-the-night MiLB cameos. Scored on the single BEST shared
// stint (level × recency × games-overlap confidence), with a heavily discounted
// bonus for corroborating stints and a bonus for each player's own peak
// single-season WAR (recognizability, not the shared season's WAR — the point
// is "these two players", not "this stint was good"). See stintScore/starBonus
// below; src/api/formerTeammates.js reads `score` to rank and to gate the
// hub-and-spokes grouping (groupTeammateCards).
//
// ORG TIES fallback: most matchups have zero literal shared-teammate pairs, but
// still have a story — "Tellez came up through the Brewers, and Nashville is a
// Brewers affiliate" — even though he never played WITH anyone on tonight's
// Nashville roster. When a matchup's `rows` comes up empty, the generator falls
// back to a one-sided check: does any player's own career pass through the
// OPPOSING club's current parent org? A stint's org is resolved as of the
// season it happened in via public/data/milb-history.json's researched eras
// (mirroring src/api/milbHistory.js's historicalParentOrg — the 2021 MiLB
// reorg means a naive "current org" lookup misattributes older stints), falling
// back to a live current-team lookup when that file doesn't cover the
// (team, season). See computeOrgTies/resolveCurrentOrg/historicalParentOrgAt
// below; the client (src/api/formerTeammates.js) just reads whichever of
// `rows`/`orgTies` the matchup's `kind` says is populated — never both, so the
// UI never has to choose between two card types for the same matchup.
// Run by hand: node scripts/gen-former-teammates.mjs
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'former-teammates.json')
const BASE = 'https://statsapi.mlb.com'

// How many days of the slate to precompute (today + the next two), so late-night
// and next-day browsing both find their game. Rosters are as-of-build; a club's
// former-teammate ties barely shift day to day.
const WINDOW_DAYS = 2
// MiLB levels to fan out over, high to low — AAA/AA/A+/A. Rookie/complex (16) is
// deliberately excluded (see header). A copy of src/lib/teams.js's list; this
// script is self-contained, like gen-rehab.mjs / gen-war.mjs.
const MILB_SPORT_IDS = [11, 12, 13, 14]
// Sport ids whose schedules get swept for matchups — MLB plus every MiLB full-
// season level (see header: this is what extends the card past MLB-only).
const MATCHUP_SPORT_IDS = [1, ...MILB_SPORT_IDS]
const SPORT_LABEL = { 1: 'MLB', 11: 'AAA', 12: 'AA', 13: 'A+', 14: 'A', 16: 'ROK' }

const isoDay = (offset = 0) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

async function getJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`statsapi ${res.status} ${path}`)
  return res.json()
}

// --- REHAB_CAP filter (replicated from src/api/person.js) ---------------------
// A post-debut minor-league season below this is rehab/shuttle noise, not a real
// demotion — dropping it stops a rehabbing veteran from matching a level's
// prospects. Absolute cap, in the group's natural unit (games / outs).
const REHAB_CAP = { games: 20, outs: 90 }
const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0)
const ipToOuts = (ip) => {
  const [whole, frac = '0'] = String(ip ?? '0').split('.')
  return num(whole) * 3 + num(frac[0])
}
const stintWork = (stat, group) =>
  group === 'pitching' ? ipToOuts(stat?.inningsPitched) : num(stat?.gamesPlayed)
const meetsStintCap = (stat, group) =>
  stintWork(stat, group) >= (group === 'pitching' ? REHAB_CAP.outs : REHAB_CAP.games)

// Run an async mapper across items with a small concurrency cap, keeping results
// in order (be polite to statsapi rather than firing hundreds at once). Mirrors
// gen-rehab.mjs's keepConcurrent, but returns each item's mapped value.
async function mapConcurrent(items, limit, mapper) {
  const out = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      try {
        out[i] = await mapper(items[i], i)
      } catch {
        out[i] = null
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

// --- schedule: the matchups to precompute --------------------------------------
// Every scheduled game across the window, MLB and MiLB alike (see
// MATCHUP_SPORT_IDS), as unique (away, home) team-id pairs plus the union of
// clubs involved. Regular season isn't forced — spring and postseason games get
// the card too.
async function fetchMatchups() {
  const pairs = new Map() // "awayId-homeId" -> { awayId, homeId, awayName, homeName }
  const teams = new Map() // teamId -> teamName
  for (let d = 0; d <= WINDOW_DAYS; d++) {
    for (const sportId of MATCHUP_SPORT_IDS) {
      let data
      try {
        data = await getJson(`/api/v1/schedule?sportId=${sportId}&date=${isoDay(d)}&hydrate=team`)
      } catch {
        continue
      }
      for (const date of data.dates ?? []) {
        for (const g of date.games ?? []) {
          const a = g.teams?.away?.team
          const h = g.teams?.home?.team
          if (!a?.id || !h?.id) continue
          pairs.set(`${a.id}-${h.id}`, {
            awayId: a.id,
            homeId: h.id,
            awayName: a.name ?? '',
            homeName: h.name ?? '',
          })
          teams.set(a.id, a.name ?? '')
          teams.set(h.id, h.name ?? '')
        }
      }
    }
  }
  return { pairs: [...pairs.values()], teamIds: [...teams.keys()] }
}

// --- rosters ------------------------------------------------------------------
// A club's active-roster entries — who's actually available to appear in a
// game (a former teammate not on the active roster can't show up in the card)
// — plus each player's roster position (for the card's position badge; the
// active-roster endpoint already returns it, so this is free). Every pitcher
// comes back as the plain "P" abbreviation at this endpoint (no SP/RP split),
// which is exactly the "P." the card wants.
async function fetchActiveRoster(teamId) {
  try {
    const data = await getJson(`/api/v1/teams/${teamId}/roster?rosterType=active`)
    return (data.roster ?? [])
      .filter((r) => r.person?.id)
      .map((r) => ({ id: r.person.id, pos: r.position?.abbreviation ?? '' }))
  } catch {
    return []
  }
}

// --- per-player career (teamId, season) pair-set ------------------------------
// The player's MLB debut year (rehab-cap filtering only applies to post-debut
// minor-league seasons). '' / null for a never-debuted prospect → no cap.
async function fetchDebutYear(personId) {
  try {
    const data = await getJson(`/api/v1/people/${personId}`)
    const debut = data.people?.[0]?.mlbDebutDate
    return debut ? Number(debut.slice(0, 4)) : null
  } catch {
    return null
  }
}

async function fetchYearByYear(personId, group, sportId) {
  const q = [`stats=yearByYear`, `group=${group}`]
  if (sportId && sportId !== 1) q.push(`sportId=${sportId}`)
  const data = await getJson(`/api/v1/people/${personId}/stats?${q.join('&')}`)
  return data.stats?.[0]?.splits ?? []
}

// A player's career reduced to a Set of "teamId|season" strings, plus a
// club-label lookup (teamId -> { name, level }) for the shared-team caption
// and a games-played lookup ("teamId|season" -> gamesPlayed) for the
// overlap-confidence term in stintScore (see below). Union of hitting +
// pitching, MLB + AAA/AA/A+/A. The synthetic team-less aggregate split a
// mid-season trade produces has no team.id and is skipped, so BOTH real clubs
// of a trade are kept. Post-debut minor-league seasons below REHAB_CAP are
// dropped (rehab/shuttle noise).
async function buildPairSet(personId) {
  const debutYear = await fetchDebutYear(personId)
  const groups = ['hitting', 'pitching']
  const requests = []
  for (const group of groups) {
    requests.push({ group, sportId: 1 })
    for (const sid of MILB_SPORT_IDS) requests.push({ group, sportId: sid })
  }
  const results = await Promise.allSettled(
    requests.map((r) => fetchYearByYear(personId, r.group, r.sportId)),
  )

  const pairs = new Set()
  const clubs = new Map() // teamId -> { name, level }
  const games = new Map() // "teamId|season" -> gamesPlayed (max across hit/pitch groups)
  results.forEach((res, i) => {
    if (res.status !== 'fulfilled') return
    const { group, sportId } = requests[i]
    for (const s of res.value) {
      const teamId = s.team?.id
      const season = Number(s.season)
      if (!teamId || !season) continue
      // Drop a rehabbing veteran's token minor-league cameo.
      if (sportId !== 1 && debutYear && season > debutYear && !meetsStintCap(s.stat, group)) {
        continue
      }
      const key = `${teamId}|${season}`
      pairs.add(key)
      const gp = num(s.stat?.gamesPlayed)
      if (!games.has(key) || gp > games.get(key)) games.set(key, gp)
      if (!clubs.has(teamId)) {
        clubs.set(teamId, {
          name: s.team?.name ?? '',
          level: SPORT_LABEL[s.sport?.id ?? sportId] ?? '',
          sportId: s.sport?.id ?? sportId,
        })
      }
    }
  })
  return { pairs, clubs, games }
}

// --- peak WAR (star power) -----------------------------------------------------
// Each player's best single MLB season WAR, read straight from the two static
// files the war.js build-time pipeline already produces (public/data/war.json
// for the live season, war-history.json for completed ones back to 2010) — no
// extra fetch, since both are already committed by the time this runs. Peak,
// not career total or shared-season WAR: the point is "how recognizable is
// this player", which a peak captures better than a stint's own (often zero,
// if they crossed paths in the low minors) WAR. MiLB-only careers get 0 — no
// signal, not a penalty (see starBonus, which only adds).
async function loadPeakWar() {
  const peak = new Map()
  const bump = (id, val) => {
    const n = Number(val)
    if (!Number.isFinite(n)) return
    const cur = peak.get(id)
    if (cur === undefined || n > cur) peak.set(id, n)
  }
  try {
    const w = JSON.parse(await readFile(join(here, '..', 'public', 'data', 'war.json'), 'utf8'))
    for (const [id, val] of Object.entries(w.bat ?? {})) bump(id, val)
    for (const [id, val] of Object.entries(w.pit ?? {})) bump(id, val)
  } catch {
    /* war.json not built yet — peak WAR degrades to 0, starBonus just adds nothing */
  }
  try {
    const wh = JSON.parse(
      await readFile(join(here, '..', 'public', 'data', 'war-history.json'), 'utf8'),
    )
    for (const season of wh.seasons ?? []) {
      for (const [id, val] of Object.entries(wh.bat?.[season] ?? {})) bump(id, val)
      for (const [id, val] of Object.entries(wh.pit?.[season] ?? {})) bump(id, val)
    }
  } catch {
    /* ditto */
  }
  return peak
}

// --- org ties (fallback when a matchup has zero literal teammate pairs) --------
// Season-accurate parent-org history, read straight from the static file
// src/api/milbHistory.js also reads (public/data/milb-history.json) — loaded
// once, synchronously reused here instead of that module's fetch()-based
// reader, since this script runs in Node against the file on disk. Mirrors
// eraForYear/historicalParentOrg there; keep the two in sync if that shape
// ever changes.
async function loadMilbHistory() {
  try {
    return JSON.parse(
      await readFile(join(here, '..', 'public', 'data', 'milb-history.json'), 'utf8'),
    )
  } catch {
    return { clubs: {} }
  }
}

function historicalParentOrgAt(milbHistory, teamId, season) {
  const club = milbHistory.clubs?.[String(teamId)]
  const era = (club?.parentHistory ?? []).find((e) => season >= e.years[0] && season <= e.years[1])
  return era ? { id: era.parentOrgId, name: era.parentOrgName } : null
}

// A club's CURRENT parent org — itself for an MLB club, its affiliate parent
// for a MiLB one — via the live team endpoint, cached per teamId since the
// same club recurs across many matchups/stints in one run.
async function resolveCurrentOrg(teamId, cache) {
  if (cache.has(teamId)) return cache.get(teamId)
  let org = { id: teamId, name: '' }
  try {
    const data = await getJson(`/api/v1/teams/${teamId}`)
    const t = data.teams?.[0]
    org =
      t?.sport?.id === 1
        ? { id: t.id, name: t.name ?? '' }
        : t?.parentOrgId
          ? { id: t.parentOrgId, name: t.parentOrgName ?? '' }
          : { id: teamId, name: t?.name ?? '' }
  } catch {
    /* leave the teamId-as-its-own-org fallback */
  }
  cache.set(teamId, org)
  return org
}

// The org a career stint belonged to AS OF that stint's own season — the
// season-accurate history file first (handles a since-reassigned MiLB
// affiliate, e.g. the 2021 reorg), falling back to the live current-team
// lookup for a (team, season) the file doesn't cover. An MLB stint's "org" is
// simply the MLB club itself.
async function resolveStintOrg(teamId, season, sportId, milbHistory, orgCache) {
  if (sportId === 1) return { id: teamId }
  return historicalParentOrgAt(milbHistory, teamId, season) ?? resolveCurrentOrg(teamId, orgCache)
}

// How interesting a single-player org tie is — same level/recency shape as
// stintScore, minus the games-overlap term (there's no second player's
// availability to hedge against here), plus the same star-power bonus.
function orgTieScore(level, season, peakWar, currentYear) {
  const weight = LEVEL_WEIGHT[level] ?? 0
  const yearsAgo = Math.max(0, currentYear - season)
  const recency = 0.4 + 0.6 * 0.9 ** yearsAgo
  return weight * recency + 7 * Math.sqrt(Math.max(0, Math.min(10, peakWar)))
}

// Cap on how many org-tie cards one roster contributes to a matchup — this is
// a fallback note, not the main event, so it stays to a handful of the most
// notable ties rather than paging through a whole roster.
const ORG_TIES_PER_SIDE = 4

// For each player on `rosterIds`, the single BEST career stint (if any) whose
// season-accurate org matches `oppOrg` — i.e. "this player has a history in
// the org tonight's opponent belongs to," even though he never shared a roster
// with anyone playing tonight. Skips a stint on the player's own roster team
// (that'd be the trivial "he plays for himself" case, not a tie to the
// OPPONENT). Returns rows sorted by score, capped to ORG_TIES_PER_SIDE.
async function orgTiesForRoster(rosterIds, rosterTeamId, oppOrg, careers, names, positions, peakWar, milbHistory, orgCache, currentYear) {
  const rows = []
  for (const playerId of rosterIds) {
    const career = careers.get(playerId)
    if (!career || career.pairs.size === 0) continue
    let best = null
    for (const key of career.pairs) {
      const [teamIdStr, seasonStr] = key.split('|')
      const teamId = Number(teamIdStr)
      if (teamId === rosterTeamId) continue
      const season = Number(seasonStr)
      const club = career.clubs.get(teamId)
      if (!club) continue
      const org = await resolveStintOrg(teamId, season, club.sportId, milbHistory, orgCache)
      if (!org || org.id !== oppOrg.id) continue
      const score = orgTieScore(club.level, season, peakWar.get(String(playerId)) ?? 0, currentYear)
      if (!best || score > best.score) {
        best = { teamId, teamName: club.name, level: club.level, season, score }
      }
    }
    if (best) {
      rows.push({
        player: { id: playerId, name: names.get(playerId) ?? '', pos: positions.get(playerId) ?? '' },
        rosterTeamId,
        orgId: oppOrg.id,
        orgName: oppOrg.name,
        teamName: best.teamName,
        level: best.level,
        seasons: [best.season],
        score: Math.round(best.score * 10) / 10,
      })
    }
  }
  return rows.sort((x, y) => y.score - x.score).slice(0, ORG_TIES_PER_SIDE)
}

// Both rosters' org ties for a matchup, one-sided each way (away players
// checked against the home club's org, home players against the away club's)
// — only called once a matchup's literal `rows` comes up empty (see main
// loop). Returns [] (no fallback card either) when the two clubs share the
// same current org (e.g. two affiliates of the same system in an exhibition)
// since every farmhand would trivially "tie" to his own system.
async function computeOrgTies(awayIds, homeIds, awayTeamId, homeTeamId, careers, names, positions, peakWar, milbHistory, orgCache) {
  const currentYear = new Date().getUTCFullYear()
  const [awayOrg, homeOrg] = await Promise.all([
    resolveCurrentOrg(awayTeamId, orgCache),
    resolveCurrentOrg(homeTeamId, orgCache),
  ])
  if (!awayOrg || !homeOrg || awayOrg.id === homeOrg.id) return []
  const [awayTies, homeTies] = await Promise.all([
    orgTiesForRoster(awayIds, awayTeamId, homeOrg, careers, names, positions, peakWar, milbHistory, orgCache, currentYear),
    orgTiesForRoster(homeIds, homeTeamId, awayOrg, careers, names, positions, peakWar, milbHistory, orgCache, currentYear),
  ])
  return [...awayTies, ...homeTies].sort((x, y) => y.score - x.score)
}

// --- connection scoring ---------------------------------------------------------
// How interesting is ONE shared (team, season) stint. Level is the dominant
// term (an MLB shared season should outrank any pile of shared minor-league
// stints) — recency and games-overlap are multiplicative tie-breakers, not
// separate additive credit, so a 15-year-old MLB stint can still edge out a
// last-year A-ball cameo. `overlap` is the cheap hedge against a July call-up
// meeting an August trade: with only "same team same season" to go on, the
// smaller of the two games-played counts for that stint is a fair proxy for
// whether they were actually around at the same time.
const LEVEL_WEIGHT = { MLB: 100, AAA: 40, AA: 25, 'A+': 15, A: 8 }
function stintScore(level, season, gamesA, gamesB, currentYear) {
  const weight = LEVEL_WEIGHT[level] ?? 0
  const yearsAgo = Math.max(0, currentYear - season)
  const recency = 0.4 + 0.6 * 0.9 ** yearsAgo
  const seasonLength = level === 'MLB' ? 162 : 130
  const overlap = Math.min(1, Math.max(0.2, Math.min(gamesA, gamesB) / seasonLength))
  return weight * recency * overlap
}

// Star power lifts a pair even when the shared stint itself was quiet (two
// future regulars crossing paths in A-ball) — sqrt dampens so one MVP-caliber
// peak doesn't swamp the level term, and the 10-WAR clamp keeps an outlier
// season from distorting the curve further.
function starBonus(peakA, peakB) {
  const term = (w) => 7 * Math.sqrt(Math.max(0, Math.min(10, w)))
  return term(peakA) + term(peakB)
}

// The "he used to be one of ours" bonus: their most recent/best shared stint
// was on one of TONIGHT's two clubs, within the last two seasons — a real
// reunion, not just any old shared history.
const REUNION_BONUS = 40

// --- connections --------------------------------------------------------------
// Every (away player, home player) pair whose careers share ≥1 (team, season),
// with the shared clubs collapsed to { teamId, teamName, level, seasons[] } for
// display, plus a `score` (see stintScore/starBonus/REUNION_BONUS above) —
// computed per RAW (team, season) stint, not the display-collapsed club, since
// two stints on the same club in different years shouldn't average together.
function connectionsFor(awayIds, homeIds, careers, names, positions, peakWar, awayId, homeId) {
  const currentYear = new Date().getUTCFullYear()
  const rows = []
  for (const aId of awayIds) {
    const a = careers.get(aId)
    if (!a || a.pairs.size === 0) continue
    for (const hId of homeIds) {
      const h = careers.get(hId)
      if (!h || h.pairs.size === 0) continue
      const shared = new Map() // teamId -> { teamName, level, seasons:Set } (display)
      const stints = [] // { teamId, season, level, score } (scoring)
      for (const key of a.pairs) {
        if (!h.pairs.has(key)) continue
        const [teamIdStr, seasonStr] = key.split('|')
        const teamId = Number(teamIdStr)
        const season = Number(seasonStr)
        const club = a.clubs.get(teamId) ?? h.clubs.get(teamId) ?? { name: '', level: '' }
        if (!shared.has(teamId)) {
          shared.set(teamId, { teamName: club.name, level: club.level, seasons: new Set() })
        }
        shared.get(teamId).seasons.add(season)
        stints.push({
          teamId,
          season,
          score: stintScore(club.level, season, a.games.get(key) ?? 0, h.games.get(key) ?? 0, currentYear),
        })
      }
      if (shared.size === 0) continue

      stints.sort((x, y) => y.score - x.score)
      const best = stints[0]
      const corroboration = stints.slice(1).reduce((sum, s) => sum + s.score, 0)
      const star = starBonus(peakWar.get(String(aId)) ?? 0, peakWar.get(String(hId)) ?? 0)
      const reunion =
        best.season >= currentYear - 1 && (best.teamId === awayId || best.teamId === homeId)
          ? REUNION_BONUS
          : 0
      const score = Math.round((best.score + 0.25 * corroboration + star + reunion) * 10) / 10

      rows.push({
        a: { id: aId, name: names.get(aId) ?? '', pos: positions.get(aId) ?? '' },
        b: { id: hId, name: names.get(hId) ?? '', pos: positions.get(hId) ?? '' },
        score,
        shared: [...shared.entries()]
          .map(([teamId, v]) => ({
            teamId,
            teamName: v.teamName,
            level: v.level,
            seasons: [...v.seasons].sort((x, y) => x - y),
          }))
          // Highest level (MLB) first, then most recent.
          .sort(
            (x, y) =>
              LEVEL_RANK(y.level) - LEVEL_RANK(x.level) ||
              Math.max(...y.seasons) - Math.max(...x.seasons),
          ),
      })
    }
  }
  return rows.sort((x, y) => y.score - x.score)
}

const LEVEL_ORDER = { MLB: 5, AAA: 4, AA: 3, 'A+': 2, A: 1 }
const LEVEL_RANK = (label) => LEVEL_ORDER[label] ?? 0

// --- names --------------------------------------------------------------------
// personId -> "First Last" for the card, batched (the /people endpoint takes a
// comma-list of ids).
async function fetchNames(personIds) {
  const names = new Map()
  const CHUNK = 100
  for (let i = 0; i < personIds.length; i += CHUNK) {
    const chunk = personIds.slice(i, i + CHUNK)
    try {
      const data = await getJson(`/api/v1/people?personIds=${chunk.join(',')}`)
      for (const p of data.people ?? []) {
        if (p.id) names.set(p.id, p.fullName ?? '')
      }
    } catch {
      /* leave those names blank; the card degrades to an empty string */
    }
  }
  return names
}

// --- main ---------------------------------------------------------------------
const { pairs, teamIds } = await fetchMatchups()

// Both rosters for every scheduled club (deduped — a team appears in several
// matchups over a series but its roster is fetched once).
const rosterEntries = await mapConcurrent(teamIds, 8, (id) => fetchActiveRoster(id))
const rosterByTeam = new Map()
const positionByPlayer = new Map()
teamIds.forEach((id, i) => {
  const entries = rosterEntries[i] ?? []
  rosterByTeam.set(id, entries.map((e) => e.id))
  for (const e of entries) positionByPlayer.set(e.id, e.pos)
})

// Every player who could appear, computed once (a player on a club that plays
// multiple series is not recomputed).
const allPlayerIds = [...new Set([...rosterByTeam.values()].flat())]
const careerList = await mapConcurrent(allPlayerIds, 8, (id) => buildPairSet(id))
const careers = new Map()
allPlayerIds.forEach((id, i) => {
  if (careerList[i]) careers.set(id, careerList[i])
})

const names = await fetchNames(allPlayerIds)
const peakWar = await loadPeakWar()
const milbHistory = await loadMilbHistory()
const orgCache = new Map() // teamId -> {id, name} — shared across every matchup/stint this run

const matchups = {}
let orgTieMatchups = 0
for (const { awayId, homeId } of pairs) {
  const awayRoster = rosterByTeam.get(awayId) ?? []
  const homeRoster = rosterByTeam.get(homeId) ?? []
  const rows = connectionsFor(
    awayRoster,
    homeRoster,
    careers,
    names,
    positionByPlayer,
    peakWar,
    awayId,
    homeId,
  )
  // Sorted "low-high" key so either lineup page finds the same entry; teamA/teamB
  // record which club each row's `a`/`b` player is on (or, for an org-ties
  // fallback, which roster each tie's player is on) so the reader can orient
  // the card to whichever side it's rendering. (`a` is the away player, `b` the
  // home player — see connectionsFor.)
  const key = awayId < homeId ? `${awayId}-${homeId}` : `${homeId}-${awayId}`
  if (rows.length > 0) {
    matchups[key] = { teamA: awayId, teamB: homeId, kind: 'teammates', rows }
    continue
  }
  // No literal shared-teammate pairs — fall back to org ties (see header).
  const orgTies = await computeOrgTies(
    awayRoster,
    homeRoster,
    awayId,
    homeId,
    careers,
    names,
    positionByPlayer,
    peakWar,
    milbHistory,
    orgCache,
  )
  if (orgTies.length === 0) continue
  orgTieMatchups++
  matchups[key] = { teamA: awayId, teamB: homeId, kind: 'orgties', orgTies }
}

await mkdir(dirname(out), { recursive: true })
await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), matchups }))
const teammateMatchups = Object.keys(matchups).length - orgTieMatchups
const total = Object.values(matchups).reduce((n, m) => n + (m.rows?.length ?? 0), 0)
console.log(
  `wrote ${out} (${teammateMatchups} teammate matchups / ${total} connections, ` +
    `${orgTieMatchups} org-tie matchups, ${allPlayerIds.length} players)`,
)
