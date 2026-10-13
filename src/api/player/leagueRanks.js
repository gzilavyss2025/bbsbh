import { getJson } from '../statsapi.js'
import { RANK_STATS, rankedSplits, topRank } from '../person/stats.js'

// League rank "N of M" for the player page (#1856). Season rankings, not scores:
// spoiler-free, open data, no SealBox (ADR-0034).
//
//   N  the player's own rank, from stats=rankings (fetchPersonStats type 'rankings',
//      one split per league; the feed lists ranks up to about 25).
//   M  the pool that rank is taken from (Gary's decision, #1856, 2026-10-13). A rate stat
//      (AVG, OBP, SLG, OPS, ERA, WHIP) ranks the qualified players of his league; a counting stat (HR, RBI, SB, K,
//      W, SV, IP) ranks every player of it. rankings carries no pool size, so the size is
//      `totalSplits` of /stats with playerPool=qualified, and with playerPool=all: TWO
//      requests per season and league, limit=1, shared by both groups. Checked live
//      2026-10-13, leagueId 104, 2026: qualified hitting 68, pitching 20; all hitting 412,
//      pitching 473. A player with no rate rank in the feed (Gasser 688107, not qualified)
//      simply has no AVG/ERA mark.
//
// The stats and their tile keys are person/stats.js's RANK_STATS. Gary's list keeps OBP,
// SLG, OPS, SB and WHIP: no hero tile shows them, a later module does. Top 10 only. WAR
// has no rankings key, so it has no mark.

// { hitting, pitching } sizes of the pool in one response; 0 for a group it lacks.
export function poolsOf(data) {
  const size = (group) => data?.stats?.find((s) => s.group?.displayName === group)?.totalSplits ?? 0
  return { hitting: size('hitting'), pitching: size('pitching') }
}

// The marks for one group. `pools` maps a leagueId to { qualified, all } sizes. A split
// with no league, a league with no pool, or an empty pool adds nothing. Each mark's
// `label` is the hero tile it ranks, or the stat's own name when it has none.
export function rankMarks(rankSplits, group, pools) {
  const marks = []
  // A traded player has one split per league, each ranking one club's games while the
  // tiles total both clubs: a rank there would overclaim, so he gets none.
  const list = rankedSplits(rankSplits)
  if (list.length !== 1) return marks
  const [s] = list
  const pool = pools.get(s.league?.id)
  if (!pool) return marks
  for (const { key, label, tile = label, rate, chipOnly } of RANK_STATS[group]) {
    const rank = !chipOnly && topRank(s.stat, key)
    const of = pool[rate ? 'qualified' : 'all'][group]
    if (rank && of) marks.push({ key, label: tile, rank, of, text: `${rank} of ${of}` })
  }
  return marks
}

const byLeague = new Map()

function poolsFor(season, leagueId) {
  const k = `${season}:${leagueId}`
  if (!byLeague.has(k)) {
    const ask = (pool) =>
      getJson(
        `/api/v1/stats?stats=season&group=hitting,pitching&playerPool=${pool}&sportId=1&season=${season}` +
          `&leagueId=${leagueId}&limit=1&fields=stats,group,displayName,totalSplits`,
      ).then(poolsOf)
    const request = Promise.all([ask('qualified'), ask('all')])
      .then(([qualified, all]) => {
        // An empty answer (a preseason, a hiccup) is not kept: the next ask tries again.
        if (!(qualified.hitting && qualified.pitching && all.hitting && all.pitching)) byLeague.delete(k)
        return { qualified, all }
      })
      .catch(() => (byLeague.delete(k), null))
    byLeague.set(k, request)
  }
  return byLeague.get(k)
}

// The marks for a player, from the rankings splits the page already holds. Two requests
// for the pools, shared by both groups and cached per season and league; none for a
// player with no rankings (MiLB, or a spoiler cutoff, where the caller passes none).
// `playerId` stays in the call shape the page uses; the pool no longer needs it.
export async function fetchRankMarks(playerId, group, rankSplits, season) {
  const leagueIds = [...new Set(rankedSplits(rankSplits).map((s) => s.league?.id).filter(Boolean))]
  const pools = new Map()
  await Promise.all(
    leagueIds.map(async (id) => {
      const p = await poolsFor(season, id)
      if (p) pools.set(id, p)
    }),
  )
  return rankMarks(rankSplits, group, pools)
}
