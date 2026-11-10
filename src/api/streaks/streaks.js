// The Streak Finder (/streaks): every run of N games in a row in which a club
// reached (or stayed under) a total in one counting stat. Read live from the Stats
// API's per-season team game logs, one request per season and group. Not a scoring
// surface, so nothing is sealed (ADR-0034).

import { getJson } from '../statsapi.js'

// Counting stats only (Gary, 2026-11-10); rate stats wait for a later pass.
// Two groups, batting and pitching, as the picker shows them. Each stat reads one
// game log per side: `by` is the club's own line, `against` is its opponents' line
// in the same games, so a streak "against" a club can run across any mix of
// opponents (Gary). The club's pitching log holds its opponents' batting and the
// other way round. [log, field]; null where that log does not carry the stat.
const H = 'hitting'
const P = 'pitching'
export const STATS = [
  { key: 'r', group: 'batting', unit: 'R', label: 'Runs', by: [H, 'runs'], against: [P, 'runs'] },
  { key: 'h', group: 'batting', unit: 'H', label: 'Hits', by: [H, 'hits'], against: [P, 'hits'] },
  { key: '2b', group: 'batting', unit: '2B', label: 'Doubles', by: [H, 'doubles'], against: [P, 'doubles'] },
  { key: '3b', group: 'batting', unit: '3B', label: 'Triples', by: [H, 'triples'], against: [P, 'triples'] },
  { key: 'hr', group: 'batting', unit: 'HR', label: 'Home runs', by: [H, 'homeRuns'], against: [P, 'homeRuns'] },
  { key: 'rbi', group: 'batting', unit: 'RBI', label: 'RBI', by: [H, 'rbi'], against: null },
  { key: 'bb', group: 'batting', unit: 'BB', label: 'Walks', by: [H, 'baseOnBalls'], against: [P, 'baseOnBalls'] },
  { key: 'so', group: 'batting', unit: 'SO', label: 'Strikeouts', by: [H, 'strikeOuts'], against: [P, 'strikeOuts'] },
  { key: 'sb', group: 'batting', unit: 'SB', label: 'Stolen bases', by: [H, 'stolenBases'], against: [P, 'stolenBases'] },
  { key: 'cs', group: 'batting', unit: 'CS', label: 'Caught stealing', by: [H, 'caughtStealing'], against: [P, 'caughtStealing'] },
  { key: 'hbp', group: 'batting', unit: 'HBP', label: 'Hit by pitch', by: [H, 'hitByPitch'], against: [P, 'hitBatsmen'] },
  { key: 'tb', group: 'batting', unit: 'TB', label: 'Total bases', by: [H, 'totalBases'], against: [P, 'totalBases'] },
  { key: 'lob', group: 'batting', unit: 'LOB', label: 'Left on base', by: [H, 'leftOnBase'], against: null },
  { key: 'p-so', group: 'pitching', unit: 'K', label: 'Strikeouts', by: [P, 'strikeOuts'], against: [H, 'strikeOuts'] },
  { key: 'p-bb', group: 'pitching', unit: 'BB', label: 'Walks allowed', by: [P, 'baseOnBalls'], against: [H, 'baseOnBalls'] },
  { key: 'p-h', group: 'pitching', unit: 'H', label: 'Hits allowed', by: [P, 'hits'], against: [H, 'hits'] },
  { key: 'p-r', group: 'pitching', unit: 'R', label: 'Runs allowed', by: [P, 'runs'], against: [H, 'runs'] },
  { key: 'p-er', group: 'pitching', unit: 'ER', label: 'Earned runs allowed', by: [P, 'earnedRuns'], against: null },
  { key: 'p-hr', group: 'pitching', unit: 'HR', label: 'Home runs allowed', by: [P, 'homeRuns'], against: [H, 'homeRuns'] },
  { key: 'p-hbp', group: 'pitching', unit: 'HBP', label: 'Hit batters', by: [P, 'hitBatsmen'], against: [H, 'hitByPitch'] },
  { key: 'p-wp', group: 'pitching', unit: 'WP', label: 'Wild pitches', by: [P, 'wildPitches'], against: null },
]

export const statsFor = (side) => STATS.filter((s) => s[side] != null)

export const statByKey = (key, side = 'by') => statsFor(side).find((s) => s.key === key) ?? STATS.find((s) => s.key === 'sb')

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

// Every n-game window, in order: regular season and postseason are separate
// sequences per season, and a window never crosses either line. `firstOnly` keeps
// only each sequence's opening window. A window holding a game with no record of
// the stat is skipped. `k` names the sequence and `start` the window's place in it.
function windows(games, n, firstOnly) {
  const buckets = new Map()
  for (const g of [...games].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.gameNumber - b.gameNumber))) {
    const k = `${g.season}:${g.post ? 'P' : 'R'}`
    if (!buckets.has(k)) buckets.set(k, [])
    buckets.get(k).push(g)
  }
  const out = []
  for (const [k, seq] of buckets) {
    const last = firstOnly ? Math.min(1, seq.length - n + 1) : seq.length - n + 1
    for (let i = 0; i < last; i++) {
      const slice = seq.slice(i, i + n)
      if (slice.some((g) => g.value == null)) continue
      out.push({ k, start: i, total: slice.reduce((t, g) => t + g.value, 0), games: slice, season: seq[0].season, post: seq[0].post })
    }
  }
  return out
}

const strip = ({ k: _k, start: _start, ...w }) => w

// Qualifying windows of n games in a row. Overlapping qualifying windows collapse
// to the best of their run (ties: the earliest).
export function findStretches(games, { n, op = 'min', threshold, firstOnly = false }) {
  const meets = (t) => (op === 'max' ? t <= threshold : t >= threshold)
  const better = (a, b) => (op === 'max' ? a.total < b.total : a.total > b.total)
  const out = []
  let run = null
  for (const w of windows(games, n, firstOnly)) {
    if (!meets(w.total)) continue
    if (run && run.best.k === w.k && w.start - run.lastStart < n) {
      if (better(w, run.best)) run.best = w
      run.lastStart = w.start
    } else {
      if (run) out.push(run.best)
      run = { best: w, lastStart: w.start }
    }
  }
  if (run) out.push(run.best)
  return out.map(strip)
}

// The `limit` best (top) or worst (bottom) windows of n games, none sharing a game:
// every window is ranked, then taken best first, skipping any that overlaps one
// already taken (ties: the earliest). Windows that tie the last one taken are kept
// too, so a tie at the cutoff is never cut. The "Top 10" / "Bottom 10" picks (Gary).
export function rankStretches(games, { n, dir = 'top', limit = 10, firstOnly = false }) {
  const all = windows(games, n, firstOnly)
  all.sort((a, b) => (dir === 'bottom' ? a.total - b.total : b.total - a.total) || (a.games[0].date < b.games[0].date ? -1 : 1))
  const taken = []
  for (const w of all) {
    if (taken.length >= limit && w.total !== taken[limit - 1].total) break
    if (!taken.some((t) => t.k === w.k && Math.abs(t.start - w.start) < n)) taken.push(w)
  }
  return taken.map(strip)
}

// Rank labels by total, whatever the table's sort: 1 is the most, or the fewest
// when `lowFirst` ("at most", "bottom 10"). Tied totals share a rank, shown "T13"
// (Gary). Returns new windows with a `rank` string.
export function labelRanks(found, lowFirst) {
  const totals = found.map((w) => w.total).sort((a, b) => (lowFirst ? a - b : b - a))
  return found.map((w) => {
    const rank = totals.indexOf(w.total) + 1
    return { ...w, rank: totals.lastIndexOf(w.total) + 1 > rank ? `T${rank}` : String(rank) }
  })
}

async function seasonLog(teamId, group, season, gameType, signal) {
  const d = await getJson(`/api/v1/teams/${teamId}/stats?stats=gameLog&group=${group}&season=${season}&gameType=${gameType}`, { signal })
  return d?.stats?.[0]?.splits ?? []
}

export async function firstSeason(teamId, signal) {
  const d = await getJson(`/api/v1/teams/${teamId}?fields=teams,firstYearOfPlay`, { signal })
  return Number(d?.teams?.[0]?.firstYearOfPlay) || 1901
}

// Raw splits per (team, log, season, game type) for the session: every stat on one
// side reads the same log, so a stat switch needs no new request.
const logCache = new Map()

// Every game log in the season range for one group, six requests at a time. A
// season that fails is retried once, then reported in `failed` (e.g. "1987" or
// "1987 postseason") rather than dropped silently. Returns `{ logs, failed }`,
// `logs` as `{ splits, post }`; turn them into rows with `toGames`.
export async function loadLogs(teamId, group, from, to, withPost, signal) {
  const jobs = []
  for (let y = from; y <= to; y++) {
    jobs.push([y, 'R'])
    if (withPost) jobs.push([y, 'P'])
  }
  const logs = []
  const failed = []
  let next = 0
  const worker = async () => {
    while (next < jobs.length) {
      const [y, type] = jobs[next++]
      const key = `${teamId}:${group}:${y}:${type}`
      let splits = logCache.get(key)
      if (!splits) {
        for (let attempt = 0; attempt < 2 && !splits; attempt++) {
          try {
            splits = await seasonLog(teamId, group, y, type, signal)
          } catch (e) {
            if (signal?.aborted) throw e
            // A 404 is a season the club has no log for (the Brewers' 1968, a
            // franchise year before play), not a failure.
            if (/MLB API 404/.test(e?.message)) splits = []
          }
        }
        if (splits) logCache.set(key, splits)
        else failed.push(type === 'P' ? `${y} postseason` : String(y))
      }
      if (splits) logs.push({ splits, post: type === 'P' })
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  return { logs, failed: failed.sort() }
}

export const toGames = (logs, field) => logs.flatMap(({ splits, post }) => splits.map((s) => gameRow(s, field, post)))
