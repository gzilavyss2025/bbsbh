// The Streak Finder (/streaks): every run of N games in a row in which a club
// reached (or stayed under) a total in one counting stat. Read live from the Stats
// API's team game logs, in 40-season date-range blocks. Not a scoring
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

export async function firstSeason(teamId, signal) {
  const d = await getJson(`/api/v1/teams/${teamId}?fields=teams,firstYearOfPlay`, { signal })
  return Number(d?.teams?.[0]?.firstYearOfPlay) || 1901
}

// The game log comes in fixed 40-season blocks (1870–1909, 1910–1949, …): one
// date-range request each, so the oldest clubs' ~126 seasons (the Cubs' pitching log
// is ~23 MB whole) arrive as four responses of a few MB, not one. Fixed edges let
// any From/To reuse what is cached.
const BLOCK = 40
const BLOCK_ZERO = 1870
const blockOf = (y) => BLOCK_ZERO + Math.floor((y - BLOCK_ZERO) / BLOCK) * BLOCK

// Raw splits per (team, log, block, game type), most recently used last. Every stat
// on one side reads the same log, so a stat switch needs no request. Capped: one
// block is several MB, and a phone keeps the PWA open for days. The block holding
// this season goes stale after ten minutes, so new games show up.
const logCache = new Map()
const CACHE_MAX = 8
const LIVE_TTL_MS = 10 * 60_000

async function blockLog(teamId, group, start, gameType, signal) {
  const key = `${teamId}:${group}:${start}:${gameType}`
  const hit = logCache.get(key)
  const live = start === blockOf(new Date().getFullYear())
  if (hit && !(live && Date.now() - hit.at > LIVE_TTL_MS)) {
    logCache.delete(key)
    logCache.set(key, hit)
    return hit.splits
  }
  let splits
  try {
    // No retry here: a stalled multi-MB body would only stall again, and the page
    // has a Retry button.
    const d = await getJson(`/api/v1/teams/${teamId}/stats?stats=gameLog&group=${group}&startDate=${start}-01-01&endDate=${start + BLOCK - 1}-12-31&gameType=${gameType}`, { signal, timeoutMs: 30_000, retries: 0 })
    splits = d?.stats?.[0]?.splits ?? []
  } catch (e) {
    // A 404 is a block with no games, not a failure.
    if (!/MLB API 404/.test(e?.message)) throw e
    splits = []
  }
  logCache.delete(key)
  logCache.set(key, { splits, at: Date.now() })
  while (logCache.size > CACHE_MAX) logCache.delete(logCache.keys().next().value)
  return splits
}

// Every game in [from, to] for one group, as `{ splits, post }` logs: one request
// per block, regular season and (with `withPost`) postseason, all at once. Turn
// them into rows with `toGames`.
export async function loadLogs(teamId, group, from, to, withPost, signal) {
  const jobs = []
  for (const type of withPost ? ['R', 'P'] : ['R']) {
    for (let b = blockOf(from); b <= to; b += BLOCK) jobs.push([b, type])
  }
  const logs = await Promise.all(jobs.map(([b, type]) => blockLog(teamId, group, b, type, signal)))
  return logs.map((splits, i) => ({
    splits: splits.filter((s) => Number(s.season) >= from && Number(s.season) <= to),
    post: jobs[i][1] === 'P',
  }))
}

export const toGames = (logs, field) => logs.flatMap(({ splits, post }) => splits.map((s) => gameRow(s, field, post)))

// The finals of a stretch's games, by gamePk: { [pk]: { home, away } } runs.
// Read when a row is opened, never with the table (one schedule call per row).
export async function fetchStretchScores(gamePks, signal) {
  const pks = gamePks.filter(Boolean)
  if (!pks.length) return {}
  const data = await getJson(`/api/v1/schedule?gamePks=${pks.join(',')}`, { signal })
  const out = {}
  for (const d of data?.dates ?? []) {
    for (const g of d.games ?? []) {
      out[g.gamePk] = { home: g.teams?.home?.score ?? null, away: g.teams?.away?.score ?? null }
    }
  }
  return out
}
