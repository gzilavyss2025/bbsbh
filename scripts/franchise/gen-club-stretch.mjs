// Writes public/data/club-stretch/{teamId}.json: each of the 30 MLB clubs' best runs of 162
// and 154 games in a row by one player, in six stats (HR, H, RBI, SB, AVG, OPS), top ten, one
// row per player. Keyed by the CURRENT team id, which follows the franchise across moves. Reader:
// src/api/streaks/clubStretch.js. The pure half (stints, rate floor, ranking):
// scripts/lib/franchise/club-stretch.mjs.
//
// Two passes. (1) Season lines: one stats call per club per season, 1901 on (about 3,800 small
// calls), names every player with 154+ games for a club and the seasons he spent there.
// (2) Game logs for every one of them, ONE SEASON PER CALL, from his first club season to his
// last (gap years too, so a game for another club still ends a run). A per-season log answers in
// about 0.1 s; the same player's career log in one call took the feed 40 s to build (measured
// 2026-11-16: Russ Nixon, 12 seasons, 1.5 s against 48 s, same 906 games). So fetching everyone
// is cheap, and the boards are exact by construction. The feed's per-game logs start in 1901.
//
// HAND-RUN, after the regular season:
//   node scripts/franchise/gen-club-stretch.mjs [--through 2026] [--cache /tmp/club-stretch.jsonl]
// --cache (outside the repo) keeps each fetched player's rows, so a stopped run resumes. Any
// failed call aborts the run (strict). The files carry no clock.
import { appendFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ALL_MLB_TEAM_IDS } from '../../src/lib/teams.js'
import { toGame } from '../../src/api/streaks/bestStretch.js'
import { writeShards } from '../lib/io.js'
import { getJson } from '../lib/statsapi.mjs'
import { mapConcurrent } from '../lib/concurrency.mjs'
import { playerRows, rankBoards } from '../lib/franchise/club-stretch.mjs'

const outDir = join(import.meta.dirname, '..', '..', 'public', 'data', 'club-stretch')
const now = new Date()
const flag = process.argv.indexOf('--through')
const through = flag > 0 ? Number(process.argv[flag + 1]) : now.getUTCFullYear() - (now.getUTCMonth() >= 9 ? 0 : 1)
if (!Number.isInteger(through) || through < 1901) throw new Error(`bad --through: ${through}`)
const MIN = 154
// A pooled connection can stall with no answer: each log gets a 45 s timeout, and a timeout
// retries. These fields alone (what toGame reads) cut a career log from about 2.8 MB to 0.75 MB.
const FIELDS = 'stats,splits,date,team,id,name,game,gameNumber,stat,atBats,plateAppearances,hits,doubles,triples,homeRuns,runs,rbi,baseOnBalls,hitByPitch,sacFlies,stolenBases,totalBases,strikeOuts'
const SEASON_FIELDS = 'stats,splits,season,player,id,fullName,stat,gamesPlayed,homeRuns,hits,rbi,stolenBases,atBats,baseOnBalls,hitByPitch,sacFlies,sacBunts,totalBases'
const LINE = ['gamesPlayed', 'homeRuns', 'hits', 'rbi', 'stolenBases', 'atBats', 'baseOnBalls', 'hitByPitch', 'sacFlies', 'sacBunts', 'totalBases']

// Pass 1: club -> player id -> { name, seasons }, for players with at least MIN club games.
const jobs = ALL_MLB_TEAM_IDS.flatMap((teamId) => Array.from({ length: through - 1900 }, (_, i) => ({ teamId, season: 1901 + i })))
const lines = await mapConcurrent(jobs, 4, async ({ teamId, season }) => {
  const d = await getJson(`/api/v1/stats?stats=season&group=hitting&sportId=1&playerPool=ALL&limit=1000&teamId=${teamId}&season=${season}&fields=${SEASON_FIELDS}`, { timeoutMs: 45000, tries: 5 })
  return { teamId, season, splits: d.stats?.[0]?.splits ?? [] }
}, { strict: true })
const clubs = new Map(ALL_MLB_TEAM_IDS.map((id) => [id, new Map()]))
// Each club's first season with any batting line: the board's start (1969 for 158, not 1901).
const firstOf = new Map()
for (const { teamId, season, splits } of lines) {
  if (splits.length && !(firstOf.get(teamId) <= season)) firstOf.set(teamId, season)
  for (const sp of splits) {
    const id = sp.player?.id
    if (!id) continue
    const club = clubs.get(teamId)
    if (!club.has(id)) club.set(id, { name: sp.player.fullName ?? '', seasons: [] })
    club.get(id).seasons.push({ season, ...Object.fromEntries(LINE.map((k) => [k, Number(sp.stat?.[k]) || 0])) })
  }
}
for (const club of clubs.values()) for (const [id, p] of club) if (p.seasons.reduce((n, s) => n + s.gamesPlayed, 0) < MIN) club.delete(id)
// The clubs each player qualifies for, so one log serves all of them.
const clubsOf = new Map()
for (const [teamId, club] of clubs) for (const [id, p] of club) {
  if (!clubsOf.has(id)) clubsOf.set(id, { id, name: p.name, clubs: [], from: Infinity, to: -Infinity })
  const e = clubsOf.get(id)
  e.clubs.push(teamId)
  for (const s of p.seasons) { e.from = Math.min(e.from, s.season); e.to = Math.max(e.to, s.season) }
}
console.log(`pass 1: ${jobs.length} club seasons, ${clubsOf.size} players with ${MIN}+ games for a club`)

// Pass 2: a player's rows for every club he qualifies for, fetched once (and kept in --cache).
const cacheAt = process.argv.indexOf('--cache')
const cachePath = cacheAt > 0 ? process.argv[cacheAt + 1] : null
const rowsOf = new Map()
if (cachePath) {
  const text = await readFile(cachePath, 'utf8').catch(() => '')
  for (const line of text.split('\n')) if (line) { const e = JSON.parse(line); rowsOf.set(e.id, e.rows) }
}
let fetched = 0
async function fetchRows(id) {
  const p = clubsOf.get(id)
  // A cached entry from an older run may lack a club this run needs: fetch it again then.
  if (rowsOf.has(id) && p.clubs.every((t) => t in rowsOf.get(id))) return rowsOf.get(id)
  const games = []
  for (let y = p.from; y <= p.to; y++) {
    const d = await getJson(`/api/v1/people/${id}/stats?stats=gameLog&group=hitting&sportId=1&gameType=R&season=${y}&fields=${FIELDS}`, { timeoutMs: 45000, tries: 5 })
    games.push(...(d.stats?.[0]?.splits ?? []).map((sp) => toGame(sp, 'hitting')))
  }
  const rows = Object.fromEntries(p.clubs.map((teamId) => [teamId, playerRows({ id, name: p.name, games }, teamId)]))
  rowsOf.set(id, rows)
  if (cachePath) await appendFile(cachePath, `${JSON.stringify({ id, rows })}\n`)
  if (++fetched % 250 === 0) console.log(`${fetched} players fetched ${new Date().toISOString().slice(11, 19)}`)
  return rows
}

console.log(`pass 2: ${[...clubsOf.keys()].filter((id) => !rowsOf.has(id)).length} players to fetch`)
await mapConcurrent([...clubsOf.keys()], 4, fetchRows, { strict: true })
console.log(`pass 2: ${fetched} players fetched`)

const files = [...clubs].map(([teamId, club]) => [
  String(teamId),
  { through, firstSeason: firstOf.get(teamId) ?? null, boards: rankBoards([...club.keys()].map((id) => rowsOf.get(id)[teamId])) },
])
const { written } = await writeShards(outDir, files)
console.log(`wrote ${written} club files to ${outDir}`)
