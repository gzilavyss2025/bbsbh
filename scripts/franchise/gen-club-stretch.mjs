// Writes public/data/club-stretch/{teamId}.json: each of the 30 MLB clubs' best runs of 162
// and 154 games in a row by one player, in six stats (HR, H, RBI, SB, AVG, OPS), top ten, one
// row per player. Keyed by the CURRENT team id, which follows the franchise across moves. Reader:
// src/api/streaks/clubStretch.js. The pure half (stints, rate floor, ranking):
// scripts/lib/franchise/club-stretch.mjs.
//
// Source: the club's career games-played leaders (stats/leaders, paged with offset until the
// list drops under 154) names the players; each one's career game log (people/{id}/stats
// ?stats=gameLog) gives the runs. A player is fetched once for every club he qualifies for.
// The feed's per-game logs start in 1901, so every board starts there.
//
// HAND-RUN: `node scripts/franchise/gen-club-stretch.mjs [--through 2026] [--cache /tmp/club-stretch.jsonl]`, after the regular season.
// About 30 x 4 leader calls plus one log per qualifying player (several thousand), two at a
// time. Any failed call aborts the run (strict). The files carry no clock.
import { appendFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ALL_MLB_TEAM_IDS } from '../../src/lib/teams.js'
import { toGame } from '../../src/api/streaks/bestStretch.js'
import { writeShards } from '../lib/io.js'
import { getJson } from '../lib/statsapi.mjs'
import { mapConcurrent } from '../lib/concurrency.mjs'
import { LENGTHS, playerRows, rankBoards } from '../lib/franchise/club-stretch.mjs'

const outDir = join(import.meta.dirname, '..', '..', 'public', 'data', 'club-stretch')
const now = new Date()
const flag = process.argv.indexOf('--through')
const through = flag > 0 ? Number(process.argv[flag + 1]) : now.getUTCFullYear() - (now.getUTCMonth() >= 9 ? 0 : 1)
if (!Number.isInteger(through) || through < 1901) throw new Error(`bad --through: ${through}`)
const MIN = Math.min(...LENGTHS)
// A pooled connection through the proxy can stall with no answer (a run sat 20 minutes on one):
// each log gets a 45 s timeout, and a timeout retries. A career log is about 2.8 MB; these fields alone (what toGame reads) cut it to about 0.75 MB.
const FIELDS = 'stats,splits,date,team,id,name,game,gameNumber,stat,atBats,plateAppearances,hits,doubles,triples,homeRuns,runs,rbi,baseOnBalls,hitByPitch,sacFlies,stolenBases,totalBases,strikeOuts'

// teamId -> every player with at least MIN career games for the club.
async function candidates(teamId) {
  const out = []
  for (let offset = 0; ; offset += 100) {
    const d = await getJson(`/api/v1/stats/leaders?leaderCategories=gamesPlayed&statType=career&teamId=${teamId}&statGroup=hitting&leaderGameTypes=R&limit=100&offset=${offset}`)
    const page = d.leagueLeaders?.[0]?.leaders ?? []
    const keep = page.filter((l) => Number(l.value) >= MIN)
    out.push(...keep.map((l) => ({ id: l.person.id, name: l.person.fullName })))
    if (keep.length < page.length || page.length === 0) return out
  }
}

const perClub = await mapConcurrent(ALL_MLB_TEAM_IDS, 4, async (teamId) => ({ teamId, players: await candidates(teamId) }), { strict: true })
const clubsOf = new Map()
for (const { teamId, players } of perClub) {
  for (const p of players) {
    if (!clubsOf.has(p.id)) clubsOf.set(p.id, { ...p, clubs: [] })
    clubsOf.get(p.id).clubs.push(teamId)
  }
}
console.log(`${clubsOf.size} players across ${perClub.length} clubs`)

// --cache <file> (outside the repo) keeps each player's rows as he is done, one JSON line, so a
// run the feed throttles can stop and pick up where it left off.
const cacheAt = process.argv.indexOf('--cache')
const cachePath = cacheAt > 0 ? process.argv[cacheAt + 1] : null
const cached = new Map()
if (cachePath) {
  const text = await readFile(cachePath, 'utf8').catch(() => '')
  for (const line of text.split('\n')) if (line) { const e = JSON.parse(line); cached.set(e.id, e.rows) }
}

const rowsByClub = new Map(ALL_MLB_TEAM_IDS.map((id) => [id, []]))
const todo = []
for (const p of clubsOf.values()) {
  if (cached.has(p.id)) for (const [teamId, rows] of Object.entries(cached.get(p.id))) rowsByClub.get(Number(teamId)).push(rows)
  else todo.push(p)
}
console.log(`${cached.size} from the cache, ${todo.length} to fetch`)

// The feed answers a burst with 503s and stalls: two workers, each pausing between calls, keep
// the pace near two a second.
const PAUSE_MS = 1000
let done = 0
await mapConcurrent(
  todo,
  2,
  async (p) => {
    const d = await getJson(`/api/v1/people/${p.id}/stats?stats=gameLog&group=hitting&sportId=1&gameType=R&startDate=1901-01-01&endDate=${through}-12-31&fields=${FIELDS}`, { timeoutMs: 45000, tries: 5 })
    const games = (d.stats?.[0]?.splits ?? []).map((s) => toGame(s, 'hitting'))
    const rows = Object.fromEntries(p.clubs.map((teamId) => [teamId, playerRows({ id: p.id, name: p.name, games }, teamId)]))
    for (const [teamId, r] of Object.entries(rows)) rowsByClub.get(Number(teamId)).push(r)
    if (cachePath) await appendFile(cachePath, `${JSON.stringify({ id: p.id, rows })}\n`)
    if (++done % 100 === 0) console.log(`${done} / ${todo.length} ${new Date().toISOString().slice(11, 19)}`)
    await new Promise((r) => setTimeout(r, PAUSE_MS))
  },
  { strict: true },
)

const { written } = await writeShards(
  outDir,
  ALL_MLB_TEAM_IDS.map((id) => [String(id), { through, firstSeason: 1901, boards: rankBoards(rowsByClub.get(id)) }]),
)
console.log(`wrote ${written} club files to ${outDir}`)
