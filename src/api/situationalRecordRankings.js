// The situational records from teamRecords.js, turned ninety degrees: one
// split at a time, every club at one level, in rank order. "The Brewers are
// 64-10 when they score four or more — where does that sit among the thirty?"
// is the question this module answers and the per-club card cannot.
//
// It computes nothing new. It calls teamRecordsFor once per club and PIVOTS the
// result: the card reads one club down its fifty rows, this reads one row
// across thirty clubs. Both therefore honour the `?d=` cutoff and the
// pre/post-All-Star lever identically, and a split whose definition changes in
// RECORD_GROUPS changes in both places at once.
//
// THE COST, STATED PLAINLY. A level's thirty per-game ledgers are ~700 KB raw,
// ~99 KB over the wire (they gzip hard — every row is the same twenty short
// keys). That is a real download, and it is why this lives on a page a reader
// opts into rather than on a card that loads with a club. The alternative was a
// precomputed rankings file per level, and it was rejected for the reason
// gen-team-records.mjs stores facts instead of flags: a precomputed total
// cannot answer a dated URL or either half of the season without a snapshot per
// level per day per lever. Every shard is memoized by staticJsonBy, so paging
// between splits, halves and levels re-downloads nothing.
//
// SPOILER-FREE, for exactly the reasons teamRecords.js gives — same files, same
// season-aggregate-over-Final-games footing, and no live game can be in them.

import { fetchStaticTeams } from './teams-static.js'
import { fetchTeamRecords, teamRecordsFor, COUNT_METRICS } from './teamRecords.js'

const DASH = '—'
const COUNTS_GROUP = 'Season counts'

// Every club at one level, each with its season ledger. A club whose file is
// missing (a brand-new affiliate, a level the generator has not swept yet) is
// dropped rather than carried as an empty row — a ranking of thirty clubs where
// four are blank misreports the field size.
export async function fetchLevelTeamRecords(sportId, season) {
  const teams = (await fetchStaticTeams()).bySportId?.[String(sportId)] ?? []
  const shards = await Promise.all(teams.map((t) => fetchTeamRecords(t.id, season)))
  return teams
    .map((team, i) => ({ team, data: shards[i] }))
    .filter((e) => e.data?.games?.length)
}

// ---------------------------------------------------------------------------
// The pivot
// ---------------------------------------------------------------------------

// Where a metric sorts within its group when clubs disagree about the set.
// Record groups keep RECORD_GROUPS' order (every club walks the same list, so
// first-seen IS that order). Months have to sort numerically — a club whose
// season opened in April would otherwise put April ahead of a March-opening
// club's March. Opponent groups sort by label, which is what teamRecordsFor
// already does per club.
function orderWithinGroup(group, metrics) {
  if (group === 'By month') {
    return [...metrics].sort((a, b) => Number(a.id.slice(6)) - Number(b.id.slice(6)))
  }
  if (group === 'By division' || group === 'By league') {
    return [...metrics].sort((a, b) => a.k.localeCompare(b.k))
  }
  return metrics
}

// Pivot a level's ledgers into one table per metric. `cutoff` and `half` are
// applied by teamRecordsFor exactly as the card applies them, so this index is
// the card's own numbers for thirty clubs at once.
//
// Returns:
//   groups   — [{ title, metrics: [{ id, k, group, kind, better }] }], the
//              picker's whole menu, in print order
//   byMetric — Map(metricId -> [{ teamId, team, ...values }]), one entry per
//              club that HAS the split; a club that has never been in it is
//              absent here and surfaces as a dash row at rank-less bottom
//   teams    — every club in the level, so a missing row can still be printed
export function buildRankingIndex(entries, { cutoff = null, half = 'all' } = {}) {
  const groups = []
  const groupIndex = new Map() // title -> { title, metrics: [] }
  const seen = new Map() // metricId -> metric
  const byMetric = new Map()

  const addMetric = (metric) => {
    if (seen.has(metric.id)) return
    seen.set(metric.id, metric)
    if (!groupIndex.has(metric.group)) {
      const g = { title: metric.group, metrics: [] }
      groupIndex.set(metric.group, g)
      groups.push(g)
    }
    groupIndex.get(metric.group).metrics.push(metric)
    byMetric.set(metric.id, [])
  }

  const teams = []
  for (const { team, data } of entries) {
    const records = teamRecordsFor(data, { cutoff, half })
    teams.push(team)
    if (!records) continue

    for (const group of records.groups) {
      for (const row of group.rows) {
        addMetric({ id: row.id, k: row.k, group: group.title, kind: 'record' })
        byMetric.get(row.id).push({
          teamId: team.id,
          team,
          played: row.played,
          wins: row.wins,
          losses: row.losses,
          ties: row.ties,
          rate: row.rate,
          v: row.v,
          pct: row.pct,
        })
      }
    }
    for (const metric of COUNT_METRICS) {
      addMetric({ id: metric.id, k: metric.k, group: COUNTS_GROUP, kind: 'count', better: metric.better })
      byMetric.get(metric.id).push({
        teamId: team.id,
        team,
        value: metric.get(records.counts) ?? 0,
      })
    }
  }

  for (const group of groups) group.metrics = orderWithinGroup(group.title, group.metrics)
  return { groups, metrics: seen, byMetric, teams }
}

// ---------------------------------------------------------------------------
// Ranking one metric
// ---------------------------------------------------------------------------

// The board always opens biggest-number-first, whatever the metric — most
// days in 5th place, most times swept, the longest losing streak. That is a
// browsing default, not a judgment; a "low is better" count reads odd sorted
// big-first, but leading with a small, mostly-zero column reads as an empty
// board. `bestOrder` below is the separate, quality-aware direction the flip
// label compares against.
export function defaultOrder() {
  return 'desc'
}

// Which direction is the GOOD end, for the metrics where that question has an
// answer. Fewest losses after leading is an achievement and most is not, so
// this reads ASCENDING for a "low is better" count while `defaultOrder` still
// opens it descending. A W-L split always reads best-first as the highest win
// percentage.
export function bestOrder(metric) {
  if (metric?.kind === 'count' && metric.better === 'low') return 'asc'
  return 'desc'
}

// Does the ordering make a claim about quality? A count with a good end does; a
// neutral count and a "how often" sort do not, and the page prints no
// best/worst framing for those.
export function ordersByQuality(metric, sortBy) {
  if (!metric) return false
  if (metric.kind === 'count') return metric.better !== 'neutral'
  return sortBy !== 'played'
}

// The sort key, or null when the club cannot be ranked on this metric at all
// (a split it has never been in; a W-L split where every game ended in a tie,
// so there is no percentage). Null always sinks, whichever way the list runs.
function sortKey(row, metric, sortBy) {
  if (metric.kind === 'count') return row.value
  if (sortBy === 'played') return row.played
  return row.rate
}

// One metric, every club at the level, ranked. Ties SHARE a rank (standard
// competition ranking: 1, 2, 2, 4), and the shared rows are flagged so the page
// can print "T2" the way a leaderboard does.
//
// Clubs with no answer are appended after the ranked ones with `rank: null`, so
// the table still shows all thirty and the reader can see WHO has never been in
// the split — which is often the interesting part of a rare one.
export function rankMetric(index, metricId, { sortBy = 'pct', order } = {}) {
  const metric = index.metrics.get(metricId)
  if (!metric) return null
  const dir = order ?? defaultOrder()
  const present = index.byMetric.get(metricId) ?? []
  const have = new Set(present.map((r) => r.teamId))

  const ranked = []
  const unranked = []
  for (const row of present) {
    const key = sortKey(row, metric, sortBy)
    ;(key == null ? unranked : ranked).push({ ...row, key })
  }
  // Tie-breaks after the key itself: more wins, then fewer losses, then the
  // club name — deterministic, so the same list never reshuffles between
  // renders.
  ranked.sort((a, b) => {
    if (a.key !== b.key) return dir === 'asc' ? a.key - b.key : b.key - a.key
    if ((b.wins ?? 0) !== (a.wins ?? 0)) return (b.wins ?? 0) - (a.wins ?? 0)
    if ((a.losses ?? 0) !== (b.losses ?? 0)) return (a.losses ?? 0) - (b.losses ?? 0)
    return (a.team.name || '').localeCompare(b.team.name || '')
  })

  let rank = 0
  let lastKey = null
  ranked.forEach((row, i) => {
    if (i === 0 || row.key !== lastKey) rank = i + 1
    lastKey = row.key
    row.rank = rank
  })
  const counts = new Map()
  for (const row of ranked) counts.set(row.rank, (counts.get(row.rank) ?? 0) + 1)
  for (const row of ranked) row.tied = counts.get(row.rank) > 1

  const missing = index.teams
    .filter((t) => !have.has(t.id))
    .map((team) => ({
      teamId: team.id,
      team,
      rank: null,
      tied: false,
      played: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      rate: null,
      value: null,
      v: DASH,
      pct: DASH,
    }))

  return {
    metric,
    order: dir,
    sortBy: metric.kind === 'count' ? 'value' : sortBy,
    byQuality: ordersByQuality(metric, sortBy),
    ranked: [...ranked, ...unranked.map((r) => ({ ...r, rank: null, tied: false })), ...missing],
    of: ranked.length,
  }
}
