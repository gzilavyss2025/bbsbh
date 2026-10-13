import { getJson } from '../statsapi.js'
import { RANK_FLOOR } from '../person/stats.js'

// League rank "N of M" for the player page (#1856). Season rankings, not scores:
// spoiler-free, open data, no SealBox (ADR-0034).
//
//   N  the player's own rank, from stats=rankings (fetchPersonStats type 'rankings',
//      one split per league; the feed lists ranks up to about 25).
//   M  the size of the qualified pool of that league. rankings carries no pool size, so
//      ONE request per season and league gives it for every stat and both groups, and the
//      same answer says who is qualified. Checked live 2026-10-13, leagueId 104, 2026:
//      hitting 68 (Turang 668930 in it), pitching 20 (Gasser 688107 not in it).
//
// Gary's rule (#1856): the pool is the player's own league, qualified players only; a
// player outside it gets no rank. Top 10 only. WAR has no rankings key, so it has no mark.
const HITTING = [['avg', 'AVG'], ['obp', 'OBP'], ['slg', 'SLG'], ['ops', 'OPS'], ['homeRuns', 'HR'], ['rbi', 'RBI'], ['stolenBases', 'SB']]
const PITCHING = [['era', 'ERA'], ['whip', 'WHIP'], ['strikeOuts', 'K'], ['wins', 'W'], ['saves', 'SV'], ['inningsPitched', 'IP']]

// { hitting: { ids }, pitching: { ids } } from the qualified-pool response.
export function poolsOf(data) {
  const out = {}
  for (const group of ['hitting', 'pitching']) {
    const splits = data?.stats?.find((s) => s.group?.displayName === group)?.splits ?? []
    out[group] = { ids: new Set(splits.map((s) => s.player?.id)) }
  }
  return out
}

// The marks for one group. `pools` maps a leagueId to that group's pool. A split with no
// league, a league with no pool, or a player outside the pool adds nothing.
export function rankMarks(rankSplits, group, pools, playerId) {
  const marks = []
  // A traded player has one split per league, each ranking one club's games while the
  // tiles total both clubs: a rank there would overclaim, so he gets none.
  if (rankSplits?.length !== 1) return marks
  for (const s of rankSplits) {
    const pool = pools.get(s.league?.id)
    if (!pool?.ids.has(playerId)) continue
    for (const [key, label] of group === 'pitching' ? PITCHING : HITTING) {
      const rank = Number(s.stat?.[key])
      if (rank >= 1 && rank <= RANK_FLOOR) marks.push({ key, label, rank, of: pool.ids.size, text: `${rank} of ${pool.ids.size}` })
    }
  }
  return marks
}

const byLeague = new Map()

function poolsFor(season, leagueId) {
  const k = `${season}:${leagueId}`
  if (!byLeague.has(k)) {
    const request = getJson(
      `/api/v1/stats?stats=season&group=hitting,pitching&playerPool=qualified&sportId=1&season=${season}` +
        `&leagueId=${leagueId}&limit=1000&fields=stats,group,displayName,splits,player,id`,
    )
      .then(poolsOf)
      // A failed request is not kept: the next ask tries again.
      .catch(() => (byLeague.delete(k), null))
    byLeague.set(k, request)
  }
  return byLeague.get(k)
}

// The marks for a player, from the rankings splits the page already holds. One request
// for the pool, shared by both groups and cached per season and league; none for a
// player with no rankings (MiLB, or a spoiler cutoff, where the caller passes none).
export async function fetchRankMarks(playerId, group, rankSplits, season) {
  const leagueIds = [...new Set((rankSplits ?? []).map((s) => s.league?.id).filter(Boolean))]
  const pools = new Map()
  await Promise.all(
    leagueIds.map(async (id) => {
      const p = (await poolsFor(season, id))?.[group]
      if (p) pools.set(id, p)
    }),
  )
  return rankMarks(rankSplits, group, pools, playerId)
}
