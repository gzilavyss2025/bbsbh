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
// Run: node .scratch/team-success/build-roster-age.mjs
// Writes: .scratch/team-success/roster-age.json
// Caches raw pulls in: .scratch/team-success/roster-age-cache.json (so a
// rerun after an interruption re-fetches nothing already on disk) — this
// cache is itself a real, committed data source for analyze-usage-mismatch.mjs
// (per-player regular-season PA/IP), not just a rerun optimization.
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
const SEASONS = Array.from({ length: 2025 - 2000 + 1 }, (_, i) => 2000 + i)

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
    weight: group === 'hitting' ? split.stat?.plateAppearances : parseInnings(split.stat?.inningsPitched),
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
  const seasons = []
  let done = 0
  const total = SEASONS.length * ALL_MLB_TEAM_IDS.length

  for (const season of SEASONS) {
    const teams = {}
    for (const teamId of ALL_MLB_TEAM_IDS) {
      const [hitting, pitching] = await Promise.all([
        fetchTeamSeasonGroup(cache, teamId, season, 'hitting'),
        fetchTeamSeasonGroup(cache, teamId, season, 'pitching'),
      ])
      const batting = weightedAge(hitting)
      const pitching_ = weightedAge(pitching)
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
