// Follow-up to spike #1 (docs/team-success-roster-age.md): recompute
// PA/IP-weighted roster age using ONLY performance accrued through July 31
// each season — before the trade deadline — so a club's measured age no
// longer includes the very rentals it went out and bought BECAUSE it was
// already winning. Answers the roster-age doc's own top open follow-up.
//
// SOURCE: GET /api/v1/stats?stats=byDateRange&group={hitting,pitching}
// &season=YYYY&sportId=1&teamId={teamId}&startDate=YYYY-01-01
// &endDate=YYYY-07-31&limit=3000&playerPool=all — one call per
// team/season/group (30 teams x 26 seasons x 2 groups = 1,560 calls, cached).
//
// Verified live before writing this sweep: byDateRange's `stat` block does
// NOT carry an `age` field (unlike the `stats=season` block build-roster-age.mjs
// reads) — confirmed by inspecting the split shape for a real team/season.
// Age is looked up instead from build-roster-age.mjs's own
// roster-age-cache.json (`${group}-${teamId}-${season}` -> per-player-stint
// splits with personId+age), keyed by personId+season+group — a player's
// reported age is a season-level constant in statsapi's data (not derived
// per date range), so reusing the existing cache is exact, not an
// approximation, and this sweep needs no second age source. A Jan 1 start
// date was verified live to pull zero rows before Opening Day (no
// spring-training leakage under sportId=1 without an explicit gameTypes
// param), so every season can share the same startDate safely.
//
// A player who left a team before July 31 has his whole stint already
// inside the July-31 window (he can't accrue innings/PA with that team
// after leaving), so his byDateRange total equals his season(teamId=X)
// total from the original cache — this sweep changes nothing for him. A
// deadline pickup who arrived AFTER July 31 contributes zero rows here for
// his new team, which is exactly the exclusion this spike exists to make.
//
// Run: node .scratch/team-success/build-roster-age-deadline.mjs
// Writes: .scratch/team-success/roster-age-deadline.json
// Caches raw pulls in: .scratch/team-success/roster-age-deadline-cache.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE_PATH = join(__dirname, 'roster-age-deadline-cache.json')
const OUT_PATH = join(__dirname, 'roster-age-deadline.json')
const AGE_SOURCE_PATH = join(__dirname, 'roster-age-cache.json')

const ALL_MLB_TEAM_IDS = [
  108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 133,
  134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 158,
]
const SEASONS = Array.from({ length: 2025 - 2000 + 1 }, (_, i) => 2000 + i)

function loadCache() {
  if (!existsSync(CACHE_PATH)) return {}
  return JSON.parse(readFileSync(CACHE_PATH, 'utf8'))
}
function saveCache(cache) {
  writeFileSync(CACHE_PATH, JSON.stringify(cache))
}

// personId+season+group -> age, built once from the original full-season
// sweep's cache (which does carry `age`). Falls back across groups for a
// two-way player (rare) since age doesn't depend on which stat group asked.
function loadAgeLookup() {
  const raw = JSON.parse(readFileSync(AGE_SOURCE_PATH, 'utf8'))
  const bySeasonGroup = new Map() // `${season}-${group}` -> Map(personId -> age)
  const bySeasonAny = new Map() // `${season}` -> Map(personId -> age), any group, fallback
  for (const key of Object.keys(raw)) {
    const [group, , season] = key.split('-') // "group-teamId-season"
    const splits = raw[key]
    const sgKey = `${season}-${group}`
    if (!bySeasonGroup.has(sgKey)) bySeasonGroup.set(sgKey, new Map())
    if (!bySeasonAny.has(season)) bySeasonAny.set(season, new Map())
    for (const s of splits) {
      if (s.personId == null || typeof s.age !== 'number') continue
      bySeasonGroup.get(sgKey).set(s.personId, s.age)
      bySeasonAny.get(season).set(s.personId, s.age)
    }
  }
  return { bySeasonGroup, bySeasonAny }
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
// notation, not decimal tenths) — same as build-roster-age.mjs.
function parseInnings(ip) {
  const [whole, frac] = String(ip ?? '0').split('.')
  const wholeNum = Number(whole) || 0
  const fracNum = frac === '1' ? 1 / 3 : frac === '2' ? 2 / 3 : 0
  return wholeNum + fracNum
}

// byDateRange splits carry no `age` field (verified live) — only identity
// and the one playing-time field this spike weights by.
function slimSplit(split, group) {
  return {
    personId: split.player?.id ?? null,
    name: split.player?.fullName ?? null,
    weight: group === 'hitting' ? split.stat?.plateAppearances : parseInnings(split.stat?.inningsPitched),
  }
}

async function fetchTeamSeasonGroup(cache, teamId, season, group) {
  const key = `${group}-${teamId}-${season}`
  if (cache[key]) return cache[key]
  const url =
    `https://statsapi.mlb.com/api/v1/stats?stats=byDateRange&group=${group}` +
    `&season=${season}&sportId=1&teamId=${teamId}&startDate=${season}-01-01` +
    `&endDate=${season}-07-31&limit=3000&playerPool=all`
  const json = await fetchWithRetry(url)
  const splits = (json.stats?.[0]?.splits ?? []).map((s) => slimSplit(s, group))
  cache[key] = splits
  return splits
}

function weightedAge(slimSplits, ageMap, fallbackAgeMap) {
  let weightSum = 0
  let ageWeightSum = 0
  let matched = 0
  let unmatched = 0
  for (const { personId, weight } of slimSplits) {
    if (!Number.isFinite(weight) || weight <= 0) continue
    const age = ageMap.get(personId) ?? fallbackAgeMap.get(personId) ?? null
    if (typeof age !== 'number') {
      unmatched += 1
      continue
    }
    matched += 1
    weightSum += weight
    ageWeightSum += age * weight
  }
  if (weightSum === 0) return null
  return { age: ageWeightSum / weightSum, weight: weightSum, n: slimSplits.length, matched, unmatched }
}

async function main() {
  const cache = loadCache()
  const { bySeasonGroup, bySeasonAny } = loadAgeLookup()
  const seasons = []
  let done = 0
  let totalUnmatched = 0
  let totalMatched = 0
  const total = SEASONS.length * ALL_MLB_TEAM_IDS.length

  for (const season of SEASONS) {
    const teams = {}
    const hittingAgeMap = bySeasonGroup.get(`${season}-hitting`) ?? new Map()
    const pitchingAgeMap = bySeasonGroup.get(`${season}-pitching`) ?? new Map()
    const anyAgeMap = bySeasonAny.get(String(season)) ?? new Map()

    for (const teamId of ALL_MLB_TEAM_IDS) {
      const [hitting, pitching] = await Promise.all([
        fetchTeamSeasonGroup(cache, teamId, season, 'hitting'),
        fetchTeamSeasonGroup(cache, teamId, season, 'pitching'),
      ])
      const batting = weightedAge(hitting, hittingAgeMap, anyAgeMap)
      const pitching_ = weightedAge(pitching, pitchingAgeMap, anyAgeMap)
      totalUnmatched += (batting?.unmatched ?? 0) + (pitching_?.unmatched ?? 0)
      totalMatched += (batting?.matched ?? 0) + (pitching_?.matched ?? 0)
      teams[teamId] = {
        battingAge: batting?.age ?? null,
        battingPA: batting?.weight ?? 0,
        battingN: batting?.n ?? 0,
        pitchingAge: pitching_?.age ?? null,
        pitchingIP: pitching_?.weight ?? 0,
        pitchingN: pitching_?.n ?? 0,
      }
      done += 1
      if (done % 60 === 0) {
        console.log(`${done}/${total} team-seasons pulled`)
        saveCache(cache) // periodic checkpoint — a long sweep can be interrupted
      }
    }

    // League-average age THAT SEASON (through July 31 only), weighted the
    // same way, so each team reads relative to its own year's pre-deadline
    // league average, not the full-season one from spike #1.
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
  console.log(
    `Age lookup: ${totalMatched} player-stints matched to an age, ${totalUnmatched} unmatched ` +
      `(${((100 * totalUnmatched) / (totalMatched + totalUnmatched || 1)).toFixed(2)}%)`,
  )
  writeFileSync(
    OUT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source:
          'statsapi /api/v1/stats?stats=byDateRange&group={hitting,pitching}&teamId=...&startDate=YYYY-01-01&endDate=YYYY-07-31&playerPool=all, per team per season',
        method:
          "battingAge = PA-weighted mean of each player-stint's age (looked up from build-roster-age.mjs's cache by personId+season+group) using ONLY plate appearances/innings accrued through July 31 that season, i.e. before the trade deadline; pitchingAge = IP-weighted, same window. *Relative fields are each team's pre-deadline age minus that SEASON's own pre-deadline league-wide weighted average — NOT the full-season league average from roster-age.json.",
        ageLookupUnmatchedRate: totalUnmatched / (totalMatched + totalUnmatched || 1),
        seasons,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`Wrote ${seasons.length} seasons x ${ALL_MLB_TEAM_IDS.length} teams to ${OUT_PATH}`)
}

main()
