import { COUNT_METRICS, teamRecordsFor } from '../../../../../api/teamRecords.js'
import { rankOf } from '../../../../../api/teamrecords/ranks.js'
import { situationalRecordsPath } from '../../../../../lib/route.js'

// The Records card's whole payload (#1107, row 7b): teamRecordsFor's groups with a rank and a door
// on every row. Pure, so node can test it; the card only draws what this returns.
//
// A rank is shown only when it can be trusted:
//   - the page is live. rankOf is CUTOFF-GATED, so every call passes the page cutoff and a dated
//     page reads null on every row (a dash), never a rank from the future;
//   - the split has MIN_RANKED games for this club. The shard ranks are not min-played filtered, so
//     a club with one game in a split can rank 1st, and "3 of 30" can mean 3 of 3 ranked.
export const MIN_RANKED = 10
export const INNING_GROUP = 'Scoring by inning'
export const COUNTS_GROUP = 'Season counts'

// Every door carries the half, the month, the level (s) AND the page's date (d), so the ranking page
// opens on the same stretch of the same day.
export const doorPath = (metric, { half, month, sportId, asOf }) =>
  situationalRecordsPath({ metric, half, month, s: sportId, d: asOf })

export function recordsModel(data, { cutoff = null, asOf = null, half = 'all', month = null } = {}) {
  const rec = teamRecordsFor(data, { cutoff, half, month })
  if (!rec) return null
  const scope = { half, month, sportId: data.sportId, asOf }
  const rank = (id, played) => (played >= MIN_RANKED ? rankOf(data, id, { half, month, cutoff }) : null)
  const build = (title, rows) => ({
    title,
    rows,
    ticks: rows.flatMap((r) => (r.rank ? [r.rank.rank] : [])),
  })
  const groups = rec.groups.map((g) =>
    build(g.title, g.rows.map((r) => ({ ...r, rank: rank(r.id, r.played), to: doorPath(r.id, scope) }))),
  )
  // Days-at-place rows drop out when the club has never been there.
  const counts = COUNT_METRICS.map((m) => ({ id: m.id, k: m.k, value: m.get(rec.counts) }))
    .filter((m) => !m.id.startsWith('count-days-') || m.value > 0)
    .map((m) => ({ ...m, rank: rank(m.id, rec.gamesCounted), to: doorPath(m.id, scope) }))
  groups.push(build(COUNTS_GROUP, counts))
  return {
    gamesCounted: rec.gamesCounted,
    // The level's club count, the "30" in "4 of 30". Null when no rank can show.
    of: cutoff ? null : data.ranks?.n ?? null,
    groups,
  }
}

// The group count for the card's tag ("12 groups"), live or dated: it does not depend on ranks, so
// it skips the model's ranking pass. The model always adds one Season counts group after these.
export const groupCount = (data, cutoff = null) => {
  const rec = teamRecordsFor(data, { cutoff })
  return rec ? rec.groups.length + 1 : 0
}

// The inning grid: one row per inning with the top and bottom halves on one win-pct axis.
const AXIS_LO = 0.4
const AXIS_HI = 0.9
export const axisPos = (rate) => Math.min(1, Math.max(0, (rate - AXIS_LO) / (AXIS_HI - AXIS_LO)))

export function inningRows(group) {
  const byId = new Map(group.rows.map((r) => [r.id, r]))
  const innings = []
  for (let n = 1; n <= 9; n++) {
    const top = byId.get(`scored-top-${n}`) ?? null
    const bottom = byId.get(`scored-bottom-${n}`) ?? null
    if (!top && !bottom) continue
    const better = top?.rate != null && bottom?.rate != null && top.rate !== bottom.rate
      ? (top.rate > bottom.rate ? 'top' : 'bottom')
      : null
    innings.push({ n, top, bottom, better })
  }
  return { innings, extras: byId.get('scored-extras') ?? null }
}
