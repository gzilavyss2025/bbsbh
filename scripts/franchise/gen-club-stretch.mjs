// Writes public/data/club-stretch/{teamId}.json: each of the 30 MLB clubs' best runs of 162
// and 154 games in a row by one player, in six stats (HR, H, RBI, SB, AVG, OPS), top twenty, one
// row per player, plus mlb.json, the same boards across MLB. With --group pitching it writes public/data/club-stretch-pitching/{teamId}.json
// instead: 32 starts or 65 relief outings in a row, in ERA, WHIP, K and K-BB. Keyed by the CURRENT team id, which follows the franchise across moves. Reader:
// src/api/streaks/clubStretch.js. The pure half (stints, rate floor, ranking):
// scripts/lib/franchise/club-stretch.mjs.
//
// Two passes. (1) Season lines: one stats call per club per season, 1901 on (about 3,800 small
// calls), plus one league-wide call per season for the MLB board (issue 3133: a run there
// crosses trades). They name every player long enough for a run and his seasons.
// (2) Game logs, ONE SEASON PER CALL over his whole career, but only for players who could
// still make a board: scripts/lib/franchise/club-stretch-ceiling.mjs bounds each player's best
// run from his season lines, and the loop fetches best ceiling first until every board's last
// exact row (TOP) beats every unfetched ceiling. So the boards stay exact. A per-season log answers
// in about 0.1 s; one career log in a single call took the feed 40 s (measured 2026-11-16:
// Russ Nixon, 1.5 s against 48 s, same 906 games). The feed's per-game logs start in 1901.
//
// HAND-RUN, after the regular season:
//   node scripts/franchise/gen-club-stretch.mjs [--group pitching] [--through 2026] [--cache /tmp/club-stretch.jsonl]
// (a cache line records its group, so a line from the other group is not read)
// --cache (outside the repo) keeps each fetched player's rows, so a stopped run resumes; a line
// from a run with another --through is ignored. Any
// failed call aborts the run (strict). The files carry no clock.
import { appendFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ALL_MLB_TEAM_IDS } from '../../src/lib/teams.js'
import { measuresFor, toGame } from '../../src/api/streaks/bestStretch.js'
import { writeShards } from '../lib/io.js'
import { getJson } from '../lib/statsapi.mjs'
import { mapConcurrent } from '../lib/concurrency.mjs'
import { LENGTHS, MLB, TOP, cacheLine, playerRows, rankBoards, readCache } from '../lib/franchise/club-stretch.mjs'
import { ceilings, nextFetches } from '../lib/franchise/club-stretch-ceiling.mjs'

const groupAt = process.argv.indexOf('--group')
const group = groupAt > 0 ? process.argv[groupAt + 1] : 'hitting'
if (group !== 'hitting' && group !== 'pitching') throw new Error(`bad --group: ${group}`)
const pitching = group === 'pitching'
const outDir = join(import.meta.dirname, '..', '..', 'public', 'data', pitching ? 'club-stretch-pitching' : 'club-stretch')
const now = new Date()
const flag = process.argv.indexOf('--through')
const through = flag > 0 ? Number(process.argv[flag + 1]) : now.getUTCFullYear() - (now.getUTCMonth() >= 9 ? 0 : 1)
if (!Number.isInteger(through) || through < 1901) throw new Error(`bad --through: ${through}`)
const MIN = 154
// A pooled connection can stall with no answer: each log gets a 45 s timeout, and a timeout
// retries. These fields alone (what toGame reads) cut a career log from about 2.8 MB to 0.75 MB.
const BAT_FIELDS = 'stats,splits,date,team,id,name,game,gameNumber,stat,atBats,plateAppearances,hits,doubles,triples,homeRuns,runs,rbi,baseOnBalls,hitByPitch,sacFlies,stolenBases,totalBases,strikeOuts'
const PITCH_FIELDS = 'stats,splits,date,team,id,name,game,gameNumber,stat,outs,earnedRuns,hits,baseOnBalls,hitByPitch,strikeOuts,homeRuns,gamesStarted,battersFaced'
const FIELDS = pitching ? PITCH_FIELDS : BAT_FIELDS
const BAT_SEASON_FIELDS = 'stats,splits,season,player,id,fullName,stat,gamesPlayed,homeRuns,hits,rbi,stolenBases,plateAppearances,atBats,baseOnBalls,hitByPitch,sacFlies,sacBunts,totalBases'
const SEASON_FIELDS = pitching ? 'stats,splits,season,player,id,fullName,stat,gamesPlayed,gamesStarted,outs,earnedRuns,hits,baseOnBalls,strikeOuts' : BAT_SEASON_FIELDS
const LINE = pitching
  ? ['gamesPlayed', 'gamesStarted', 'outs', 'earnedRuns', 'hits', 'baseOnBalls', 'strikeOuts']
  : ['gamesPlayed', 'homeRuns', 'hits', 'rbi', 'stolenBases', 'plateAppearances', 'atBats', 'baseOnBalls', 'hitByPitch', 'sacFlies', 'sacBunts', 'totalBases']
// Enough games for a run: 154 games, or 32 starts or 65 relief outings.
const qualifies = (seasons) => {
  const sum = (k) => seasons.reduce((n, s) => n + s[k], 0)
  return pitching ? sum('gamesStarted') >= 32 || sum('gamesPlayed') - sum('gamesStarted') >= 65 : sum('gamesPlayed') >= MIN
}

// Pass 1: scope (a club id, or MLB) -> player id -> { name, seasons }. The league-wide call
// (no teamId) gives one line per player, his clubs combined.
const LIMIT = 3000
const seasons = Array.from({ length: through - 1900 }, (_, i) => 1901 + i)
const jobs = [...ALL_MLB_TEAM_IDS, MLB].flatMap((scope) => seasons.map((season) => ({ scope, season })))
const lines = await mapConcurrent(jobs, 4, async ({ scope, season }) => {
  const team = scope === MLB ? '' : `&teamId=${scope}`
  const d = await getJson(`/api/v1/stats?stats=season&group=${group}&sportId=1&playerPool=ALL&limit=${LIMIT}${team}&season=${season}&fields=${SEASON_FIELDS}`, { timeoutMs: 45000, tries: 5 })
  const splits = d.stats?.[0]?.splits ?? []
  if (splits.length >= LIMIT) throw new Error(`${scope} ${season}: ${splits.length} lines, raise LIMIT`)
  return { scope, season, splits }
}, { strict: true })
const scopes = new Map([...ALL_MLB_TEAM_IDS, MLB].map((id) => [id, new Map()]))
// Each club's first season with any line: the board's start (1969 for 158, not 1901).
const firstOf = new Map()
for (const { scope, season, splits } of lines) {
  if (splits.length && !(firstOf.get(scope) <= season)) firstOf.set(scope, season)
  for (const sp of splits) {
    const id = sp.player?.id
    if (!id) continue
    const m = scopes.get(scope)
    if (!m.has(id)) m.set(id, { name: sp.player.fullName ?? '', seasons: [] })
    m.get(id).seasons.push({ season, ...Object.fromEntries(LINE.map((k) => [k, Number(sp.stat?.[k]) || 0])) })
  }
}
// His career span (game logs cover all of it, so a game for another club ends a club run).
const span = new Map([...scopes.get(MLB)].map(([id, p]) => [id, [Math.min(...p.seasons.map((s) => s.season)), Math.max(...p.seasons.map((s) => s.season))]]))
for (const m of scopes.values()) for (const [id, p] of m) if (!qualifies(p.seasons)) m.delete(id)
// The scopes each player qualifies for, so one log serves all of them.
const playerOf = new Map()
for (const [scope, m] of scopes) for (const [id, p] of m) {
  if (!playerOf.has(id)) playerOf.set(id, { id, name: p.name, scopes: [] })
  playerOf.get(id).scopes.push(scope)
}
// One board per scope, length and stat, its players best ceiling first.
const boards = []
for (const [scope, m] of scopes) {
  const ceil = new Map([...m].map(([id, p]) => [id, ceilings(p.seasons, LENGTHS[group], group)]))
  for (const n of LENGTHS[group]) for (const measure of measuresFor(group)) {
    const key = `${n}:${measure.key}`
    const cands = [...ceil].filter(([, c]) => key in c).map(([id, c]) => ({ id, ceiling: c[key] }))
    cands.sort((a, b) => (measure.lower ? a.ceiling - b.ceiling : b.ceiling - a.ceiling) || a.id - b.id)
    boards.push({ scope, n, measure, cands })
  }
}
console.log(`pass 1: ${jobs.length} season calls, ${playerOf.size} players long enough for a run (${group})`)

// Pass 2: a player's rows for every scope he qualifies for, fetched once (and kept in --cache).
const cacheAt = process.argv.indexOf('--cache')
const cachePath = cacheAt > 0 ? process.argv[cacheAt + 1] : null
const rowsOf = cachePath ? readCache(await readFile(cachePath, 'utf8').catch(() => ''), through, group) : new Map()
// A cached entry from an older run may lack a scope this run needs: it is fetched again then.
const done = (id) => rowsOf.has(id) && playerOf.get(id).scopes.every((t) => t in rowsOf.get(id))
let fetched = 0
async function fetchRows(id) {
  const p = playerOf.get(id)
  const [from, to] = span.get(id)
  const games = []
  for (let y = from; y <= to; y++) {
    const d = await getJson(`/api/v1/people/${id}/stats?stats=gameLog&group=${group}&sportId=1&gameType=R&season=${y}&fields=${FIELDS}`, { timeoutMs: 45000, tries: 5 })
    games.push(...(d.stats?.[0]?.splits ?? []).map((sp) => toGame(sp, group)))
  }
  const rows = Object.fromEntries(p.scopes.map((scope) => [scope, playerRows({ id, name: p.name, games }, scope, group)]))
  rowsOf.set(id, rows)
  if (cachePath) await appendFile(cachePath, cacheLine(through, id, rows, group))
  if (++fetched % 250 === 0) console.log(`${fetched} players fetched ${new Date().toISOString().slice(11, 19)}`)
}

const rowOf = (id, scope, key) => rowsOf.get(id)?.[scope]?.[key]
for (let need; (need = nextFetches(boards, done, rowOf, { top: TOP })).size;) await mapConcurrent([...need], 4, fetchRows, { strict: true })
console.log(`pass 2: ${fetched} players fetched, of ${playerOf.size}`)

const files = [...scopes].map(([scope, m]) => [
  String(scope),
  { through, firstSeason: firstOf.get(scope) ?? null, boards: rankBoards([...m.keys()].filter(done).map((id) => rowsOf.get(id)[scope]), group) },
])
const { written } = await writeShards(outDir, files)
console.log(`wrote ${written} files to ${outDir}`)
