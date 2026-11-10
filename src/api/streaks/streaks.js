// The Streak Finder (/streaks): every run of N games in a row in which a club
// reached (or stayed under) a total in one counting stat. Read live from the Stats
// API's per-season team game logs, one request per season and group. Not a scoring
// surface, so nothing is sealed (ADR-0034).

import { getJson } from '../statsapi.js'

// Counting stats only (Gary, 2026-11-10); rate stats wait for a later pass.
export const STATS = [
  { key: 'r', group: 'hitting', field: 'runs', label: 'Runs' },
  { key: 'h', group: 'hitting', field: 'hits', label: 'Hits' },
  { key: '2b', group: 'hitting', field: 'doubles', label: 'Doubles' },
  { key: '3b', group: 'hitting', field: 'triples', label: 'Triples' },
  { key: 'hr', group: 'hitting', field: 'homeRuns', label: 'Home runs' },
  { key: 'rbi', group: 'hitting', field: 'rbi', label: 'RBI' },
  { key: 'bb', group: 'hitting', field: 'baseOnBalls', label: 'Walks' },
  { key: 'so', group: 'hitting', field: 'strikeOuts', label: 'Strikeouts' },
  { key: 'sb', group: 'hitting', field: 'stolenBases', label: 'Stolen bases' },
  { key: 'cs', group: 'hitting', field: 'caughtStealing', label: 'Caught stealing' },
  { key: 'hbp', group: 'hitting', field: 'hitByPitch', label: 'Hit by pitch' },
  { key: 'tb', group: 'hitting', field: 'totalBases', label: 'Total bases' },
  { key: 'lob', group: 'hitting', field: 'leftOnBase', label: 'Left on base' },
  { key: 'p-so', group: 'pitching', field: 'strikeOuts', label: 'Strikeouts' },
  { key: 'p-bb', group: 'pitching', field: 'baseOnBalls', label: 'Walks allowed' },
  { key: 'p-h', group: 'pitching', field: 'hits', label: 'Hits allowed' },
  { key: 'p-r', group: 'pitching', field: 'runs', label: 'Runs allowed' },
  { key: 'p-er', group: 'pitching', field: 'earnedRuns', label: 'Earned runs allowed' },
  { key: 'p-hr', group: 'pitching', field: 'homeRuns', label: 'Home runs allowed' },
  { key: 'p-hbp', group: 'pitching', field: 'hitBatsmen', label: 'Hit batters' },
  { key: 'p-wp', group: 'pitching', field: 'wildPitches', label: 'Wild pitches' },
]

export const statByKey = (key) => STATS.find((s) => s.key === key) ?? STATS.find((s) => s.key === 'sb')

// One game log split -> the flat row the finder reads. A missing stat is null, not 0,
// so an old season with no record of it cannot qualify an "at most" search.
export function gameRow(split, field, post) {
  const v = split.stat?.[field]
  return {
    date: split.date,
    season: Number(split.season),
    post,
    value: typeof v === 'number' ? v : null,
    gamePk: split.game?.gamePk ?? null,
    gameNumber: split.game?.gameNumber ?? 1,
    isHome: !!split.isHome,
    oppId: split.opponent?.id ?? null,
  }
}

// Qualifying windows of n games in a row. Regular season and postseason are separate
// sequences per season, and a window never crosses either line. Overlapping
// qualifying windows collapse to the best of their run (ties: the earliest).
// `firstOnly` keeps only each sequence's opening window.
export function findStretches(games, { n, op = 'min', threshold, firstOnly = false }) {
  const buckets = new Map()
  for (const g of [...games].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.gameNumber - b.gameNumber))) {
    const k = `${g.season}:${g.post ? 'P' : 'R'}`
    if (!buckets.has(k)) buckets.set(k, [])
    buckets.get(k).push(g)
  }
  const meets = (t) => (op === 'max' ? t <= threshold : t >= threshold)
  const better = (a, b) => (op === 'max' ? a.total < b.total : a.total > b.total)
  const out = []
  for (const seq of buckets.values()) {
    let run = null
    const last = firstOnly ? Math.min(1, seq.length - n + 1) : seq.length - n + 1
    for (let i = 0; i < last; i++) {
      const slice = seq.slice(i, i + n)
      const ok = slice.every((g) => g.value != null)
      const total = ok ? slice.reduce((t, g) => t + g.value, 0) : null
      if (ok && meets(total)) {
        const w = { start: i, total, games: slice, season: seq[0].season, post: seq[0].post }
        if (run && i - run.lastStart < n) {
          if (better(w, run.best)) run.best = w
          run.lastStart = i
        } else {
          if (run) out.push(run.best)
          run = { best: w, lastStart: i }
        }
      }
    }
    if (run) out.push(run.best)
  }
  return out.map(({ start: _start, ...w }) => w)
}

async function seasonLog(teamId, group, season, gameType, signal) {
  const d = await getJson(`/api/v1/teams/${teamId}/stats?stats=gameLog&group=${group}&season=${season}&gameType=${gameType}`, { signal })
  return d?.stats?.[0]?.splits ?? []
}

export async function firstSeason(teamId, signal) {
  const d = await getJson(`/api/v1/teams/${teamId}?fields=teams,firstYearOfPlay`, { signal })
  return Number(d?.teams?.[0]?.firstYearOfPlay) || 1901
}

// Every game in the season range, as rows for one stat. Six requests at a time.
export async function loadGames(teamId, stat, from, to, withPost, signal) {
  const jobs = []
  for (let y = from; y <= to; y++) {
    jobs.push([y, 'R'])
    if (withPost) jobs.push([y, 'P'])
  }
  const rows = []
  let next = 0
  const worker = async () => {
    while (next < jobs.length) {
      const [y, type] = jobs[next++]
      const splits = await seasonLog(teamId, stat.group, y, type, signal).catch((e) => {
        if (signal?.aborted) throw e
        return []
      })
      for (const s of splits) rows.push(gameRow(s, stat.field, type === 'P'))
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  return rows
}
