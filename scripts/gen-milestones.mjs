// Regenerates public/data/milestones.json — the league-wide Milestone Watch
// list: every MLB active-roster player within reach of a round career-total
// milestone (MILESTONE_DEFS in src/api/person.js), each with a projected
// timeframe (see projectMilestoneETA there). Feeds both the standalone
// Milestone Watch page (src/screens/MilestoneWatchPage.jsx) and the player
// page's Milestone Watch card (src/api/milestones.js reads this file for
// both).
//
// This runs on a cron via .github/workflows/update-nightly-data.yml, NOT at
// request time. Building it needs, per active-roster player, his full MLB
// year-by-year line (career total + this season's pace in one call) plus his
// current team's season schedule (games played so far + remaining dates, for
// the appearance-rate scaling and in-season ETA — fetched once per team, not
// per player). ~800 players + 30 team schedules is far too heavy for a page
// load; a nightly job that writes a small static file keeps the live pages to
// a single same-origin read, same as gen-vs-team-splits.mjs.
//
// Run by hand: node scripts/gen-milestones.mjs
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALL_MLB_TEAM_IDS, teamFullName } from '../src/lib/teams.js'
import {
  aggregateSplits,
  MILESTONE_DEFS,
  nearestMilestone,
  projectMilestoneETA,
  careerPerSeasonRate,
  milestoneRarityRank,
} from '../src/api/person.js'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'milestones.json')
const BASE = 'https://statsapi.mlb.com'
const SEASON = new Date().getUTCFullYear()

async function getJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`statsapi ${res.status} ${path}`)
  return res.json()
}

// Run an async mapper across items with a small concurrency cap, results in
// order (be polite to statsapi). Mirrors gen-vs-team-splits.mjs's helper.
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

// --- team schedules: games played so far + remaining dates, once per team ---
async function fetchTeamSeasonSchedule(teamId) {
  const data = await getJson(
    `/api/v1/schedule?teamId=${teamId}&season=${SEASON}&gameType=R`,
  )
  let played = 0
  const remainingDates = []
  for (const d of data.dates ?? []) {
    for (const g of d.games ?? []) {
      const final = g.status?.abstractGameState === 'Final' || g.status?.codedGameState === 'F'
      const date = g.officialDate ?? (g.gameDate ?? '').slice(0, 10)
      if (final) played += 1
      else if (date) remainingDates.push(date)
    }
  }
  remainingDates.sort()
  return { played, remainingDates }
}

// --- roster: who to check, and which stat group each player belongs to -----
async function fetchActiveRoster(teamId) {
  const data = await getJson(`/api/v1/teams/${teamId}/roster?rosterType=active`)
  return data.roster ?? []
}

// A two-way player (Ohtani) is checked in both groups; everyone else in the
// one group his primary position implies.
function groupsFor(position) {
  const abbr = position?.abbreviation
  if (abbr === 'TWP') return ['hitting', 'pitching']
  return [abbr === 'P' ? 'pitching' : 'hitting']
}

// One player's milestone-watch rows for one stat group. `farWindow` (wider
// than the player-page's tight `window`) is the inclusion cutoff here — this
// is a dedicated page, so a player a couple of seasons out still belongs.
async function playerMilestones(person, teamId, teamName, group, teamSchedule) {
  const splits = await getJson(
    `/api/v1/people/${person.id}/stats?stats=yearByYear&group=${group}`,
  )
  const yearSplits = splits.stats?.[0]?.splits ?? []
  if (!yearSplits.length) return []

  const bySeason = new Map()
  for (const s of yearSplits) {
    const yr = Number(s.season)
    if (!Number.isFinite(yr)) continue
    if (!bySeason.has(yr)) bySeason.set(yr, [])
    bySeason.get(yr).push(s)
  }
  const seasonTotals = [...bySeason.entries()].map(([season, rows]) => ({
    season,
    stat: aggregateSplits(rows, group),
  }))
  const career = aggregateSplits(yearSplits, group)
  const currentSeasonStat = aggregateSplits(bySeason.get(SEASON) ?? [], group)
  if (!career) return []

  const rows = []
  for (const def of MILESTONE_DEFS.filter((d) => d.group === group)) {
    const m = nearestMilestone(career[def.stat], def.thresholds, def.farWindow)
    if (!m) continue
    const rate = careerPerSeasonRate(seasonTotals, def.stat, SEASON)
    const projection = projectMilestoneETA({
      remaining: m.remaining,
      seasonStat: currentSeasonStat?.[def.stat] ?? 0,
      seasonGamesPlayed: currentSeasonStat?.gamesPlayed ?? 0,
      teamGamesPlayedSoFar: teamSchedule.played,
      teamGamesRemaining: teamSchedule.remainingDates.length,
      remainingScheduleDates: teamSchedule.remainingDates,
      careerPerSeasonRate: rate,
      currentSeason: SEASON,
    })
    rows.push({
      playerId: person.id,
      playerName: person.fullName || '',
      teamId,
      teamName,
      position: person.primaryPosition?.abbreviation || '',
      group,
      stat: def.stat,
      label: def.label,
      value: m.value,
      threshold: m.threshold,
      remaining: m.remaining,
      rarity: milestoneRarityRank(def.stat, m.threshold),
      projection,
    })
  }
  return rows
}

// --- main --------------------------------------------------------------------
const teamNames = Object.fromEntries(ALL_MLB_TEAM_IDS.map((id) => [id, teamFullName(id)]))

const schedules = {}
await mapConcurrent(ALL_MLB_TEAM_IDS, 8, async (teamId) => {
  schedules[teamId] = await fetchTeamSeasonSchedule(teamId)
})

const rosterEntries = (
  await mapConcurrent(ALL_MLB_TEAM_IDS, 8, (teamId) => fetchActiveRoster(teamId))
).flatMap((roster, i) => (roster ?? []).map((r) => ({ ...r, teamId: ALL_MLB_TEAM_IDS[i] })))

const perPlayerRows = await mapConcurrent(rosterEntries, 10, async (entry) => {
  const teamId = entry.teamId
  const schedule = schedules[teamId] ?? { played: 0, remainingDates: [] }
  const teamName = teamNames[teamId] || ''
  // The roster endpoint's position lives on the ROW, not person.primaryPosition
  // (that field isn't hydrated on this endpoint at all).
  const groups = groupsFor(entry.position)
  const perGroup = await Promise.all(
    groups.map((group) =>
      playerMilestones(
        { id: entry.person?.id, fullName: entry.person?.fullName, primaryPosition: entry.position },
        teamId,
        teamName,
        group,
        schedule,
      ),
    ),
  )
  return perGroup.flat()
})

const players = perPlayerRows.filter(Boolean).flat()
players.sort((a, b) => a.rarity - b.rarity || a.remaining - b.remaining)

await mkdir(dirname(out), { recursive: true })
await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), season: SEASON, players }))
console.log(`wrote ${out} (${players.length} milestone-watch rows across ${rosterEntries.length} players)`)
