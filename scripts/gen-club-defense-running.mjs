// Regenerates public/data/club-defense-running.json — six regular-season
// measures per club for the World Series scouting report's "Glove and legs"
// card: outs above average, catcher framing runs, sprint speed, stolen bases,
// stolen-base success and extra bases taken. Sources and the live check:
// docs/glove-and-legs-data.md.
//
// A measure whose source fails is null for every club, never 0 and never a
// guess; one source down does not stop the others. All six down throws, so
// last night's committed file stands.
//
// REGULAR SEASON ONLY. statsapi gets gameType=R. Savant's baserunning board
// takes game_type=Regular (game_type=All adds the postseason: checked live) and
// the framing board gameType=Regular. The OAA and sprint boards have no
// game-type control.
//
// TRADED PLAYERS. OAA has a team-level board. Framing and baserunning take a
// `team=` filter that gives each club its own share of a traded player, so
// those two are fetched once per club. Sprint speed lists a player once.
//
// Run nightly by .github/workflows/update-nightly-data.yml.
// Run by hand: node scripts/gen-club-defense-running.mjs
import { setTimeout as sleep } from 'node:timers/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeJsonAtomic } from './lib/io.js'
import { buildClubs } from './lib/club/defense-running.mjs'
import { fetchSavantCsv } from './lib/savant.mjs'
import { getJson } from './lib/statsapi.mjs'
import { fetchSeasonInPlay } from './lib/time/season-in-play.mjs'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'club-defense-running.json')
const season = await fetchSeasonInPlay()
const SAVANT = 'https://baseballsavant.mlb.com/leaderboard'
const THROTTLE_MS = 400 // between Savant calls: one per club on two boards

// A failed source reads as no rows, and says so in the job log.
const soft = async (label, fn) => {
  try {
    return await fn()
  } catch (err) {
    console.error(`${label}: ${err.message} — measure left null`)
    return []
  }
}

const stats = await soft('statsapi team stats', async () => {
  const body = await getJson(
    `/api/v1/teams/stats?stats=season&group=hitting&season=${season}&gameType=R&sportIds=1`,
  )
  return (body.stats?.[0]?.splits ?? []).map((s) => ({
    teamId: s.team.id,
    stolenBases: s.stat.stolenBases,
    caughtStealing: s.stat.caughtStealing,
  }))
})

const oaa = await soft('Savant OAA', () =>
  fetchSavantCsv(
    'Savant OAA',
    `${SAVANT}/outs_above_average?type=Fielding_Team&startYear=${season}&endYear=${season}` +
      `&split=no&team=&range=year&min=0&pos=&roles=&viz=hide&csv=true`,
  ),
)

const sprint = await soft('Savant sprint speed', () =>
  fetchSavantCsv('Savant sprint speed', `${SAVANT}/sprint_speed?year=${season}&position=&team=&min=0&csv=true`),
)

const teamIds = stats.length ? stats.map((s) => s.teamId) : oaa.map((r) => Number(r.team_id))

// One request per club, rows tagged with the club asked for. Both boards need a
// floor of 1 or they hide small samples (`min` on framing, `n` on baserunning).
async function perClub(label, url, columns) {
  const rows = []
  for (const teamId of teamIds) {
    // A failed club throws: a partial board would undercount, so the measure goes null.
    // A club with no rows (header only) adds none and reads null.
    const body = await fetchSavantCsv(`${label} ${teamId}`, `${url}&team=${teamId}&csv=true`, { attempts: 3, columns, allowEmpty: true })
    for (const r of body) rows.push({ ...r, teamId, playerId: r.id ?? r.entity_id })
    await sleep(THROTTLE_MS)
  }
  if (!rows.length) throw new Error('no rows for any club')
  return rows
}

const framing = await soft('Savant catcher framing', () =>
  perClub('Savant framing', `${SAVANT}/catcher-framing?type=catcher&seasonStart=${season}&seasonEnd=${season}&min=1&gameType=Regular`, ['id', 'rv_tot']),
)
const baserunning = await soft('Savant baserunning', () =>
  perClub('Savant baserunning', `${SAVANT}/baserunning?year=${season}&type=batter&n=1&game_type=Regular`, ['entity_id', 'n_safe', 'n_opp_xb']),
)

if (!teamIds.length) throw new Error('no club list: statsapi and Savant OAA both failed')
const clubs = buildClubs({ teamIds, oaa, framing, sprint, stats, baserunning })
if (!Object.values(clubs).some((c) => Object.values(c).some((v) => v != null))) {
  throw new Error('every source failed — keeping the previous file')
}

const now = new Date()
await writeJsonAtomic(out, {
  generatedAt: now.toISOString(),
  season,
  asOf: now.toISOString().slice(0, 10),
  clubs,
})
console.log(`club-defense-running: ${teamIds.length} clubs, season ${season}`)
