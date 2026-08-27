// Builds team-season roster age: a PA-weighted batting age and an
// IP-weighted pitching age, for every team, every season 2000-2025 — the
// first factor spike in docs/team-success-research.md's planned order,
// chosen for having the cleanest data path.
//
// SOURCE: GET /api/v1/stats?stats=season&group={hitting,pitching}&season=YYYY
// &sportId=1&teamId={teamId}&limit=3000&playerPool=all — one call per
// team/season/group (30 teams x 26 seasons x 2 groups = 1560 calls, cached to
// disk so a rerun is free).
//
// THE TRAP THIS ALMOST FELL INTO. The SAME endpoint with NO teamId filter
// collapses a player traded mid-season to a SINGLE row under his LAST team,
// carrying his WHOLE-SEASON total — verified live against Lucas Giolito's
// 2023 (White Sox -> Angels -> Guardians): the unfiltered league-wide pull
// shows him only as a Guardian, IP 184.1 (his combined season total). Passing
// `teamId` as a query filter is what makes the SAME endpoint return the
// correct, team-specific STINT instead (verified: teamId=145 returns him as
// a White Sox pitcher, IP 121.0 — exactly matching the per-player
// yearByYear breakdown). Never drop the teamId filter here, and never trust
// a bulk sweep of this endpoint for anything roster-attribution-related
// without one.
//
// `playerPool=all` is required too — without it the endpoint defaults to
// batting-title/ERA-title QUALIFIERS ONLY (roughly 500+ PA), which would
// silently drop every bench player and reliever and bias the weighted age
// toward whoever played every day.
//
// statsapi's own `stat.age` is used as-is (whatever internal reference date
// it computes from) rather than re-derived from a birthdate — good enough
// for a relative, same-season comparison across 30 teams, which is all this
// spike needs.
//
// THE SECOND TRAP, FOUND LATER, IN THE OPPOSITE DIRECTION. Passing `teamId`
// stops the endpoint from COLLAPSING a traded player, but for the two most
// recent seasons it makes the endpoint DROP him from the club he left. Measured
// 2026-08-27: `teamId=142&season=2025` returns 22 hitters / 4,657 PA, while
// Minnesota's own club aggregate for 2025 is 6,059 PA. Carlos Correa (621043)
// is absent from that pull even though `people/621043/stats?stats=yearByYear`
// lists a 2025 Minnesota row of 364 PA. Only the SELLING club's stint goes
// missing; the acquiring club's stint is correct (Correa's Houston row is 220
// PA, which matches yearByYear exactly). Seasons 2000-2023 are complete — every
// one of their 120 club-season-groups for 2022 and 2023 reconciles to the club
// aggregate exactly — so this is recency behavior in statsapi, not a bug in
// how this file calls it.
//
// THE GATE THAT CATCHES IT. `/api/v1/teams/{teamId}/stats?stats=season` returns
// the club's OWN season total. The sum of the per-player stints must equal it,
// to the last plate appearance. `repairSeasonStints` runs that check for every
// club, every season it builds, and closes any gap from a stint-correct source
// (`people/{id}/stats?stats=yearByYear`, which does carry the selling club's
// row) before the season is written. A season that will not reconcile throws
// rather than saving a short club.
//
// Run: node .scratch/team-success/build-roster-age.mjs
//      node .scratch/team-success/build-roster-age.mjs --refetch=2024,2025
// Writes: .scratch/team-success/roster-age.json
// Caches raw pulls in: .scratch/team-success/roster-age-cache.json (so a
// rerun after an interruption re-fetches nothing already on disk) — this
// cache is itself a real, committed data source for analyze-usage-mismatch.mjs
// (per-player regular-season PA/IP), not just a rerun optimization.
//
// BECAUSE THE CACHE IS FREE TO REREAD, A PLAIN RERUN CANNOT REPAIR IT. Every
// key already on disk is kept untouched, so re-running this file over a cache
// built from a bad pull reports success and changes nothing. `--refetch=YYYY`
// evicts those seasons' keys first, which is the only way to make the fetch
// happen again. A season is saved only after it is fetched, repaired and
// reconciled, so an interrupted run leaves that season absent rather than short.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE_PATH = join(__dirname, 'roster-age-cache.json')
const OUT_PATH = join(__dirname, 'roster-age.json')

const ALL_MLB_TEAM_IDS = [
  108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 133,
  134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 158,
]
const MLB_TEAM_ID_SET = new Set(ALL_MLB_TEAM_IDS)
const SEASONS = Array.from({ length: 2025 - 2000 + 1 }, (_, i) => 2000 + i)

// Seasons named by `--refetch=2024,2025` have their cached keys dropped before
// anything is fetched. Without this the cache's own re-read shortcut makes a
// rerun a no-op (see the header).
const REFETCH_SEASONS = new Set(
  (process.argv.find((a) => a.startsWith('--refetch='))?.slice('--refetch='.length) ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter(Number.isFinite),
)

function loadCache() {
  if (!existsSync(CACHE_PATH)) return {}
  return JSON.parse(readFileSync(CACHE_PATH, 'utf8'))
}
function saveCache(cache) {
  writeFileSync(CACHE_PATH, JSON.stringify(cache))
}

async function fetchWithRetry(url, attempts = 4) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`statsapi ${res.status} ${url}`)
      return await res.json()
    } catch (err) {
      lastErr = err
      await new Promise((r) => setTimeout(r, 300 * (i + 1)))
    }
  }
  throw lastErr
}

// "180.1" -> 180 + 1/3, "180.2" -> 180 + 2/3 (baseball's fractional-inning
// notation, not decimal tenths).
function parseInnings(ip) {
  const [whole, frac] = String(ip ?? '0').split('.')
  const wholeNum = Number(whole) || 0
  const fracNum = frac === '1' ? 1 / 3 : frac === '2' ? 2 / 3 : 0
  return wholeNum + fracNum
}

// The cache stores only what this spike ever reads (age, the one playing-
// time field per group, and the player identity) rather than statsapi's full
// ~40-field stat block — the full splits for all 1,560 calls run to 62 MB,
// most of it stat columns nothing here looks at, against ~1 MB slimmed.
// personId/name are kept (not just the team-level aggregate) so a later
// spike can join this same per-player regular-season role against a
// different playing-time measure — e.g. postseason usage,
// analyze-usage-mismatch.mjs — without re-pulling statsapi.
function slimSplit(split, group) {
  return {
    personId: split.player?.id ?? null,
    name: split.player?.fullName ?? null,
    age: split.stat?.age ?? null,
    weight: statWeight(split.stat, group),
  }
}

async function fetchTeamSeasonGroup(cache, teamId, season, group) {
  const key = `${group}-${teamId}-${season}`
  if (cache[key]) return cache[key]
  const url =
    `https://statsapi.mlb.com/api/v1/stats?stats=season&group=${group}` +
    `&season=${season}&sportId=1&teamId=${teamId}&limit=3000&playerPool=all`
  const json = await fetchWithRetry(url)
  const splits = (json.stats?.[0]?.splits ?? []).map((s) => slimSplit(s, group))
  cache[key] = splits
  return splits
}

// The one playing-time number this file weights by, read the same way from
// every endpoint that reports it.
function statWeight(stat, group) {
  return group === 'hitting' ? stat?.plateAppearances : parseInnings(stat?.inningsPitched)
}

function sumWeight(rows) {
  let sum = 0
  for (const row of rows ?? []) if (Number.isFinite(row.weight)) sum += row.weight
  return sum
}

// The club's OWN season total, which the per-player stints must add up to.
async function clubAggregateWeight(teamId, season, group) {
  const json = await fetchWithRetry(
    `https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=season&group=${group}&season=${season}`,
  )
  return statWeight(json.stats?.[0]?.splits?.[0]?.stat, group) ?? 0
}

// The league-wide pull WITHOUT teamId — the collapsing one the header warns
// about. Its totals are unusable here, but its `numTeams` field names every
// player who wore more than one uniform that season, which is exactly the set
// whose stints can be missing.
async function multiClubPlayers(season, group) {
  const players = []
  for (let offset = 0; ; offset += 1000) {
    const json = await fetchWithRetry(
      `https://statsapi.mlb.com/api/v1/stats?stats=season&group=${group}&season=${season}` +
        `&sportId=1&limit=1000&offset=${offset}&playerPool=all`,
    )
    const splits = json.stats?.[0]?.splits ?? []
    for (const split of splits) {
      if ((split.numTeams ?? 1) > 1 && split.player?.id != null) {
        players.push({ personId: split.player.id, name: split.player.fullName ?? null })
      }
    }
    if (splits.length < 1000) break
  }
  return players
}

// One row per season PER CLUB, including the club a player was traded away
// from. Cached in-process because a club-by-club sweep asks for the same
// player many times over.
const stintMemo = new Map()
async function playerStints(personId, season, group) {
  const memoKey = `${group}-${personId}`
  let bySeason = stintMemo.get(memoKey)
  if (!bySeason) {
    const json = await fetchWithRetry(
      `https://statsapi.mlb.com/api/v1/people/${personId}/stats` +
        `?stats=yearByYear&group=${group}&gameType=R`,
    )
    bySeason = {}
    for (const split of json.stats?.[0]?.splits ?? []) {
      // Skip the combined row a multi-club season carries (it has no team) and
      // every minor-league affiliate.
      const teamId = split.team?.id
      if (teamId == null || !MLB_TEAM_ID_SET.has(teamId)) continue
      ;(bySeason[split.season] ??= []).push({
        teamId,
        age: split.stat?.age ?? null,
        weight: statWeight(split.stat, group),
      })
    }
    stintMemo.set(memoKey, bySeason)
  }
  return bySeason[String(season)] ?? []
}

// Every player who wore the uniform at any point in the season, which is the
// backstop set for a club the multi-club pass could not close.
async function fullSeasonRoster(teamId, season) {
  const json = await fetchWithRetry(
    `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=fullSeason&season=${season}`,
  )
  return (json.roster ?? [])
    .filter((entry) => entry.person?.id != null)
    .map((entry) => ({ personId: entry.person.id, name: entry.person.fullName ?? null }))
}

function addStint(cache, key, personId, name, stint, added) {
  const rows = cache[key]
  if (!rows) return
  const existing = rows.find((row) => row.personId === personId)
  if (existing) return
  rows.push({ personId, name, age: stint.age, weight: stint.weight })
  added.push({ key, personId, name, weight: stint.weight })
}

// Restores the stints the club-filtered pull dropped, then proves every club
// whole against its own aggregate. Throws rather than saving a short club.
async function repairSeasonStints(cache, season) {
  const added = []
  for (const group of ['hitting', 'pitching']) {
    for (const { personId, name } of await multiClubPlayers(season, group)) {
      for (const stint of await playerStints(personId, season, group)) {
        addStint(cache, `${group}-${stint.teamId}-${season}`, personId, name, stint, added)
      }
    }

    const short = []
    for (const teamId of ALL_MLB_TEAM_IDS) {
      const key = `${group}-${teamId}-${season}`
      const aggregate = await clubAggregateWeight(teamId, season, group)
      if (sumWeight(cache[key]) >= aggregate - 0.01) continue
      // A club still short did not lose the stint to a trade — a released or
      // waived player leaves no second club to flag him. Sweep its whole roster.
      for (const { personId, name } of await fullSeasonRoster(teamId, season)) {
        const stint = (await playerStints(personId, season, group)).find((s) => s.teamId === teamId)
        if (stint) addStint(cache, key, personId, name, stint, added)
      }
      const total = sumWeight(cache[key])
      if (Math.abs(total - aggregate) > 0.01) short.push({ key, aggregate, total })
    }
    if (short.length > 0) {
      throw new Error(
        `${season} ${group}: ${short.length} club(s) do not reconcile to their own aggregate — ` +
          short.map((s) => `${s.key} has ${s.total} of ${s.aggregate}`).join('; '),
      )
    }
  }
  if (added.length > 0) {
    console.log(`${season}: restored ${added.length} missing club stint(s)`)
  }
}

function weightedAge(slimSplits) {
  let weightSum = 0
  let ageWeightSum = 0
  for (const { age, weight } of slimSplits) {
    if (typeof age !== 'number' || !Number.isFinite(weight) || weight <= 0) continue
    weightSum += weight
    ageWeightSum += age * weight
  }
  if (weightSum === 0) return null
  return { age: ageWeightSum / weightSum, weight: weightSum, n: slimSplits.length }
}

async function main() {
  const cache = loadCache()
  for (const key of Object.keys(cache)) {
    if (REFETCH_SEASONS.has(Number(key.slice(-4)))) delete cache[key]
  }
  const seasons = []
  let done = 0
  const total = SEASONS.length * ALL_MLB_TEAM_IDS.length

  for (const season of SEASONS) {
    // A season is built as a unit: pulled, repaired, reconciled, and only then
    // written. Half a season never reaches disk, so a key on disk is always a
    // whole one — an interrupted run re-fetches the season rather than reading
    // a short club back and calling it cached.
    const isNew = ALL_MLB_TEAM_IDS.some(
      (teamId) => !cache[`hitting-${teamId}-${season}`] || !cache[`pitching-${teamId}-${season}`],
    )
    for (const teamId of ALL_MLB_TEAM_IDS) {
      await Promise.all([
        fetchTeamSeasonGroup(cache, teamId, season, 'hitting'),
        fetchTeamSeasonGroup(cache, teamId, season, 'pitching'),
      ])
      done += 1
      if (done % 60 === 0) console.log(`${done}/${total} team-seasons pulled`)
    }
    if (isNew) {
      await repairSeasonStints(cache, season)
      saveCache(cache)
    }

    const teams = {}
    for (const teamId of ALL_MLB_TEAM_IDS) {
      const batting = weightedAge(cache[`hitting-${teamId}-${season}`])
      const pitching_ = weightedAge(cache[`pitching-${teamId}-${season}`])
      teams[teamId] = {
        battingAge: batting?.age ?? null,
        battingPA: batting?.weight ?? 0,
        battingN: batting?.n ?? 0,
        pitchingAge: pitching_?.age ?? null,
        pitchingIP: pitching_?.weight ?? 0,
        pitchingN: pitching_?.n ?? 0,
      }
    }

    // League-average age THAT SEASON, weighted the same way, so each team can
    // be read relative to its own year rather than to 2000 or 2025 alike.
    const battingRows = Object.values(teams).filter((t) => t.battingAge != null)
    const pitchingRows = Object.values(teams).filter((t) => t.pitchingAge != null)
    const leagueBattingAge =
      battingRows.reduce((sum, t) => sum + t.battingAge * t.battingPA, 0) /
      battingRows.reduce((sum, t) => sum + t.battingPA, 0)
    const leaguePitchingAge =
      pitchingRows.reduce((sum, t) => sum + t.pitchingAge * t.pitchingIP, 0) /
      pitchingRows.reduce((sum, t) => sum + t.pitchingIP, 0)

    for (const t of Object.values(teams)) {
      t.battingAgeRelative = t.battingAge != null ? t.battingAge - leagueBattingAge : null
      t.pitchingAgeRelative = t.pitchingAge != null ? t.pitchingAge - leaguePitchingAge : null
    }

    seasons.push({ year: season, leagueBattingAge, leaguePitchingAge, teams })
  }

  saveCache(cache)
  writeFileSync(
    OUT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source:
          'statsapi /api/v1/stats?stats=season&group={hitting,pitching}&teamId=...&playerPool=all, per team per season',
        method:
          'battingAge = PA-weighted mean of statsapi\'s per-player-per-team-stint age; pitchingAge = IP-weighted (fractional innings converted from baseball notation). *Relative fields are each team\'s age minus that SEASON\'s own league-wide weighted average.',
        seasons,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`Wrote ${seasons.length} seasons x ${ALL_MLB_TEAM_IDS.length} teams to ${OUT_PATH}`)
}

main()
