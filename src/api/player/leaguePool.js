import { getJson } from '../statsapi.js'
import { fetchWarData } from '../war.js'

// Every qualified MLB player's season figure for one stat, for the player page's tile histogram
// (Gary, 2026-10-30). A season stat on an open page: no seal (ADR-0034). One request per season,
// group and stat, cached; a failed one is dropped so the next tap tries again.
const cache = new Map()

export function fetchLeaguePool(season, group, key) {
  const k = `${season}:${group}:${key}`
  if (!cache.has(k)) {
    const request = getJson(
      `/api/v1/stats?stats=season&group=${group}&playerPool=qualified&sportId=1&season=${season}` +
        `&limit=500&fields=stats,splits,stat,${key}`,
    )
      .then((data) => (data?.stats?.[0]?.splits ?? []).map((s) => Number(s.stat?.[key])).filter(Number.isFinite))
      .catch(() => (cache.delete(k), []))
    cache.set(k, request)
  }
  return cache.get(k)
}

// WAR has no league field, so its pool is war.json's batting WAR for every hitter whose primary
// position is `pos` and who has at least POSITION_MIN_PA plate appearances (Gary, 2026-10-30: WAR
// against his own position). 300, not the batting-title line: 8 catchers qualify for that in 2026,
// 26 reach 300. One statsapi read per season for the positions, cached like the stat pools.
const POSITION_MIN_PA = 300

export function fetchPositionWarPool(season, pos) {
  const k = `${season}:war:${pos}`
  if (!cache.has(k)) {
    const request = Promise.all([
      fetchWarData(),
      getJson(
        `/api/v1/stats?stats=season&group=hitting&playerPool=ALL&sportId=1&season=${season}` +
          `&limit=2000&fields=stats,splits,player,id,position,abbreviation,stat,plateAppearances`,
      ),
    ])
      .then(([war, data]) =>
        (data?.stats?.[0]?.splits ?? [])
          .filter((s) => s.position?.abbreviation === pos && s.stat?.plateAppearances >= POSITION_MIN_PA)
          .map((s) => Number(war?.bat?.[s.player?.id]))
          .filter(Number.isFinite),
      )
      .catch(() => (cache.delete(k), []))
    cache.set(k, request)
  }
  return cache.get(k)
}
