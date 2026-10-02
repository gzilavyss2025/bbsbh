// Merge, aggregate and store logic for gen-umpire-accuracy.mjs, pulled out because a generator is
// a top-level script — importing one RUNS it — so a helper worth
// unit-testing can't stay inline (see pitcher-starts.mjs for the same split).
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { leanInputFromRows } from '../../src/api/umpires.js'
import { readJsonOr, readSeasons, writeJsonIfChanged, writeSeasons, writeShards } from './io.js'
import { mergeReassignableRows } from './reassignable-merge.mjs'

// Merge freshly-swept rows into the carried-forward `prevUmpires` map. MLB
// occasionally corrects a past crew assignment (e.g. a similarly-named
// official swapped in after the fact) — the fresh sweep then reports the
// same gamePk under a DIFFERENT umpire id than the one it was merged under
// on a previous run. mergeReassignableRows handles the general case: it
// strips any stale copy of a gamePk from every OTHER umpire before
// upserting it under its current official, then drops any umpire a purge
// left with zero games — a pure ghost, not a real official, that would
// otherwise write an empty umpire-with-no-shard row and fail the
// shard/accuracy invariant (test/umpire-shards.test.js).
export function mergeAccuracyRows(prevUmpires, rows) {
  const prevByKey = {}
  for (const [id, u] of Object.entries(prevUmpires ?? {})) {
    prevByKey[id] = { id: u.id ?? Number(id), name: u.name, rows: u.games ?? [] }
  }
  const merged = mergeReassignableRows(prevByKey, rows, {
    getKey: (r) => r.umpId,
    getRowId: (r) => r.gamePk,
    getName: (r) => r.umpName,
    toRow: (r) => ({ gamePk: r.gamePk, date: r.date, level: r.level, gameType: r.gameType, ...r.acc }),
  })
  const umpires = {}
  for (const [id, entry] of Object.entries(merged)) {
    umpires[id] = {
      id: entry.id,
      name: entry.name,
      games: [...entry.rows].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    }
  }
  return umpires
}

// --- season aggregate from a umpire's game rows -------------------------------
function aggregate(games) {
  const sum = { games: games.length, called: 0, correct: 0, expanded: 0, squeezed: 0, high: 0, low: 0, inside: 0, outside: 0 }
  const cellCalled = Array(9).fill(0)
  const cellStrikeCall = Array(9).fill(0)
  const cellMiss = Array(9).fill(0)
  // Consistency/favor sum over only the games that carry them — an older row
  // (swept before these schemas shipped) or a thin-sample game (consistent
  // null, favorMagnitude null) simply contributes nothing, same degrade as
  // the cell-grid arrays above.
  let consistentSum = 0
  let consistentCalledSum = 0
  let favorMagnitudeSum = 0
  let favorGames = 0
  // Same degrade for the two Umpire Tendencies schemas. `challengeGames` is
  // what keeps "swept before challenges were counted" distinct from "played a
  // game nobody challenged" — a zero would collapse the two and quietly drag
  // every challenges-per-game figure toward zero mid-migration.
  const regionL = { high: 0, low: 0, inside: 0, outside: 0 }
  const regionR = { high: 0, low: 0, inside: 0, outside: 0 }
  let handedGames = 0
  let challengeSum = 0
  let challengeOverturnedSum = 0
  let challengeGames = 0
  for (const g of games) {
    sum.called += g.called
    sum.correct += g.correct
    sum.expanded += g.expanded
    sum.squeezed += g.squeezed
    sum.high += g.high
    sum.low += g.low
    sum.inside += g.inside
    sum.outside += g.outside
    // Cell arrays only exist on rows swept after the zone-map schema shipped; an
    // older row simply contributes nothing to the grid (its totals still count).
    for (let i = 0; i < 9; i++) {
      cellCalled[i] += g.cellCalled?.[i] ?? 0
      cellStrikeCall[i] += g.cellStrikeCall?.[i] ?? 0
      cellMiss[i] += g.cellMiss?.[i] ?? 0
    }
    if (g.consistent != null && g.consistentCalled != null) {
      consistentSum += g.consistent
      consistentCalledSum += g.consistentCalled
    }
    if (g.favorMagnitude != null) {
      favorMagnitudeSum += g.favorMagnitude
      favorGames++
    }
    if (g.missL && g.missR) {
      for (const k of ['high', 'low', 'inside', 'outside']) {
        regionL[k] += g.missL[k] ?? 0
        regionR[k] += g.missR[k] ?? 0
      }
      handedGames++
    }
    if (g.challenges != null) {
      challengeSum += g.challenges
      challengeOverturnedSum += g.challengesOverturned ?? 0
      challengeGames++
    }
  }
  sum.accuracy = sum.called ? sum.correct / sum.called : null
  sum.cellCalled = cellCalled
  sum.cellStrikeCall = cellStrikeCall
  sum.cellMiss = cellMiss
  sum.consistency = consistentCalledSum ? consistentSum / consistentCalledSum : null
  sum.favorMagnitude = favorGames ? favorMagnitudeSum : null
  sum.favorPerGame = favorGames ? favorMagnitudeSum / favorGames : null
  // The SIGNED companion — the pitcher/hitter lean's ingredient, summed here so
  // the app can rank an umpire on it without downloading the league's game rows.
  // leanInputFromRows is imported from the reader (src/api/umpires.js) rather
  // than re-implemented, so build time and read time cannot drift; umpireLeanFor
  // beside it does the division. `level` is passed even though `games` is
  // already one level's rows — the filter is the guarantee, not the caller.
  Object.assign(sum, leanInputFromRows(games, games[0]?.level ?? 'MLB'))
  sum.missL = handedGames ? regionL : null
  sum.missR = handedGames ? regionR : null
  // `challengeGames` is carried, not just used: it is the denominator behind
  // challengesPerGame, and it is NOT sum.games until every row has been
  // re-swept. A reader that divides by sum.games instead understates the rate.
  sum.challenges = challengeGames ? challengeSum : null
  sum.challengesOverturned = challengeGames ? challengeOverturnedSum : null
  sum.challengeGames = challengeGames || null
  sum.challengesPerGame = challengeGames ? challengeSum / challengeGames : null
  sum.overturnRate = challengeSum ? challengeOverturnedSum / challengeSum : null
  return sum
}

// Each umpire's aggregates from his rows, split two ways. The summary file
// carries these and no rows.
//   • By LEVEL (MLB vs AAA) — the two run different regimes and rank against
//     different pools, so they never blend. A row predating the `level` tag is
//     treated as MLB (the file was MLB-only before AAA was added).
//   • By game CONTEXT — only REGULAR-SEASON (gameType R) rows feed the ranked
//     `season`/`seasonAAA` aggregates. Postseason (F/D/L/W) rolls up into a
//     separate, unranked `seasonPost`; the All-Star Game (A) is a low-stakes
//     exhibition and counts toward no aggregate at all (it still appears in
//     `games` for its per-game figure). A row predating the `gameType` tag is
//     treated as regular season. See docs/adr for the exclude-from-rank rationale.
const gameLevel = (g) => g.level ?? 'MLB'
const gameCtx = (g) => g.gameType ?? 'R'
const POSTSEASON = new Set(['F', 'D', 'L', 'W'])
function aggregatesOf(umpires) {
  const out = {}
  for (const [id, u] of Object.entries(umpires)) {
    const mlbReg = u.games.filter((g) => gameLevel(g) === 'MLB' && gameCtx(g) === 'R')
    const aaaReg = u.games.filter((g) => gameLevel(g) === 'AAA' && gameCtx(g) === 'R')
    const postGames = u.games.filter((g) => POSTSEASON.has(gameCtx(g)))
    out[id] = {
      id: u.id,
      name: u.name,
      season: aggregate(mlbReg),
      seasonAAA: aaaReg.length ? aggregate(aaaReg) : null,
      seasonPost: postGames.length ? aggregate(postGames) : null,
    }
  }
  return out
}

// --- the season store (ADR-0086, #1200) ---------------------------------------
// One folder per season: `<season>/{personId}.json` (his rows, and the merge
// base for that season) beside `<season>/umpire-accuracy-summary.json` (the
// aggregates). A row's season is its game's, so the first 2027 game opens a
// 2027 folder and never touches 2026. A run with no scored game writes
// nothing, not even the index.
export const SUMMARY = 'umpire-accuracy-summary.json'

// One season folder's row shards. ENOENT is a first run; a corrupt shard
// aborts (readJsonOr) instead of rebuilding the season from a few days of rows.
async function readRows(dir) {
  const umpires = {}
  for (const f of await readdir(dir).catch(() => [])) {
    if (!f.endsWith('.json') || f === SUMMARY) continue
    const shard = await readJsonOr(join(dir, f), null)
    // `name` rides on the shard so an umpire who worked in April and not in
    // this run's window does not come back nameless.
    if (shard?.id != null) umpires[shard.id] = { id: shard.id, name: shard.name, games: shard.games ?? [] }
  }
  return umpires
}

export async function writeAccuracyStore(storeDir, rows) {
  const written = []
  for (const [season, seasonRows] of Map.groupBy(rows, (r) => r.season)) {
    const dir = join(storeDir, String(season))
    const prev = await readRows(dir)
    const prior = new Set(Object.values(prev).flatMap((u) => u.games.map((g) => g.gamePk)))
    const umpires = mergeAccuracyRows(prev, seasonRows)
    // writeShards sweeps any shard this merge purged (a game reassigned away).
    // Left on disk it would reseed the ghost umpire next run, once the game
    // ages out of the trailing window and can no longer trigger a purge.
    const { swept } = await writeShards(dir, [
      [SUMMARY.slice(0, -5), { generatedAt: new Date().toISOString(), season, umpires: aggregatesOf(umpires) }],
      ...Object.values(umpires).map((u) => [u.id, { id: u.id, name: u.name, games: u.games }]),
    ])
    await writeSeasons(storeDir, season)
    written.push({
      season,
      umpires: Object.keys(umpires).length,
      games: Object.values(umpires).reduce((n, u) => n + u.games.length, 0),
      added: seasonRows.filter((r) => !prior.has(r.gamePk)).length,
      swept,
    })
  }
  if (written.length) await writeAll(storeDir)
  return written
}

// all/: every season's rows run through the same aggregates, so a combined
// rate is a sum over games, never a mean of two seasons' rates. League file
// only (the per-umpire rows have no all/ copy). Rewritten only when it changes.
async function writeAll(storeDir) {
  const { seasons } = await readSeasons(storeDir)
  const umpires = {}
  for (const season of seasons) {
    for (const u of Object.values(await readRows(join(storeDir, String(season))))) {
      umpires[u.id] = { id: u.id, name: u.name, games: [...(umpires[u.id]?.games ?? []), ...u.games] }
    }
  }
  await writeJsonIfChanged(join(storeDir, 'all', SUMMARY), { seasons, umpires: aggregatesOf(umpires) })
}
