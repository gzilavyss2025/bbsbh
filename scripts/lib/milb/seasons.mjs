// Pure parse for gen-milb-seasons.mjs: one person's yearByYear lines at ONE level
// (statsapi `/people?hydrate=stats(type=[yearByYear],sportId=N)`) become season rows,
// ranked against that level-season's pool with the existing prospectPercentile math.
// No I/O (scripts/CLAUDE.md's "testable helper" rule). Row shape: src/api/milbSeasons.js.

import { meetsPlayingTimeFloor, percentileRank, populationKey } from '../prospectPercentile.mjs'

export const SPORT_IDS = [11, 12, 13, 14] // AAA, AA, A+, A. Rk (16) needs a league filter: later.
export const SEASONS = [2021, 2022, 2023, 2024, 2025] // no 2020; the current season is read live

export const populationKeyOf = (sportId, season, group) => `${season}:${populationKey(sportId, group)}`

// war.json keys are strings and top-prospects ids are numbers: a Set on the raw values keeps both.
export const uniqueIds = (...lists) => [...new Set(lists.flat().map(String))]

// "-.--", ".---", absent and "" are all null (the MiLB rule). Rates print with a leading dot.
export function parseRate(v) {
  const n = Number(v)
  return v == null || v === '' || !Number.isFinite(n) ? null : n
}

// One split per season in `seasons`. A player with two clubs at one level has one split
// per club plus a total split with no `team`: keep the total. A season such as "2018.2"
// is skipped.
export function totalSplits(splits, seasons = SEASONS) {
  const kept = splits.filter((sp) => /^\d{4}$/.test(sp.season) && seasons.includes(Number(sp.season)))
  return [...Map.groupBy(kept, (sp) => sp.season).values()].flatMap((rows) =>
    rows.length === 1 ? rows : rows.filter((r) => !r.team),
  )
}

// `pools`: Map of populationKeyOf -> qualified OPS or ERA values for that level-season.
export function rowsFor(person, sportId, pools) {
  return (person.stats ?? []).flatMap(({ group: g, splits }) => {
    const group = g?.displayName
    if (group !== 'hitting' && group !== 'pitching') return []
    const hitting = group === 'hitting'
    return totalSplits(splits ?? []).flatMap(({ season, stat }) => {
      const n = Number(hitting ? stat.plateAppearances : stat.outs)
      if (!(n > 0)) return []
      const v = parseRate(hitting ? stat.ops : stat.era)
      const pool = pools.get(populationKeyOf(sportId, Number(season), group)) ?? []
      const pct = v != null && meetsPlayingTimeFloor(group, stat) ? percentileRank(v, pool, hitting) : null
      return [{ season: Number(season), sport: sportId, group, n, v, pct }]
    })
  })
}
