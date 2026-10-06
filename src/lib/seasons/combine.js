// ALL SEASONS, FOR ONE MAN (#1201). A season store keeps one folder per season
// (ADR-0086). Its league-wide files have an `all/` copy that the nightly run
// builds from the rows. A per-player shard has none: the client reads that
// man's slice from each season and adds them here.
//
// Every function takes the slices OLDEST FIRST, with null for a season he
// has no row in (a 2027 rookie has no 2026 row), and returns null when every
// slice is null. The rules are the generator's own (gen-fouls.mjs `combine`,
// gen-pitch-arsenal.mjs's sums):
//
//   • a count adds;
//   • a high (`max*`) keeps the higher season, with its context, and the
//     earlier season on a tie;
//   • a ratio is rebuilt from its weights, never an average of two averages;
//   • a name, a club, a hand come from the latest season he appears in.
//
// Pure, no fetch: src/api/staticJson.js's readSeasonShard does the reads.

const present = (slices) => (slices ?? []).filter((s) => s != null)
const latest = (rows) => rows[rows.length - 1]

// Element-wise sum of equal-shaped count arrays. A missing array adds zeros.
function addCounts(arrays) {
  const len = Math.max(0, ...arrays.map((a) => a?.length ?? 0))
  const out = new Array(len).fill(0)
  for (const a of arrays) for (let i = 0; i < len; i++) out[i] += a?.[i] ?? 0
  return out
}

// The row whose `key` is highest; the earlier one on a tie.
function highest(rows, key) {
  let best = null
  for (const r of rows) if (r?.[key] != null && (best == null || r[key] > best[key])) best = r
  return best
}

// --- spray (src/api/spray.js) ----------------------------------------------
// `{ n, t, b, p, o: { R, L } }`. The balls join; the per-hand counts add. A
// hand no season has stays absent, as in the file (splitTotals reads zeros).
export function combineSprayEntries(slices) {
  const rows = present(slices)
  if (!rows.length) return null
  const last = latest(rows)
  return {
    n: last.n,
    t: last.t,
    b: last.b,
    p: rows.flatMap((r) => r.p ?? []),
    o: Object.fromEntries(
      ['R', 'L']
        .filter((hand) => rows.some((r) => r.o?.[hand]))
        .map((hand) => [hand, addCounts(rows.map((r) => r.o?.[hand]))]),
    ),
  }
}

// --- fouls (src/api/fouls.js) ----------------------------------------------
const BATTER_COUNTS = ['g', 'pa', 'pitchesSeen', 'fouls', 'twoStrikeFouls']
const MAX_GAME = [
  'maxGameFouls',
  'maxGamePk',
  'maxGamePa',
  'maxGamePitches',
  'maxGameOpponentId',
  'maxGameHisScore',
  'maxGameOppScore',
  'maxGameDate',
]
const PITCHER_COUNTS = ['g', 'pitches', 'fouls', 'whiffs']

const sumOf = (rows, key) => rows.reduce((n, r) => n + (r[key] ?? 0), 0)

export function combineFoulBatter(slices) {
  const rows = present(slices)
  if (!rows.length) return null
  const last = latest(rows)
  const out = { name: last.name, teamId: last.teamId }
  for (const k of BATTER_COUNTS) out[k] = sumOf(rows, k)
  const high = highest(rows, 'maxGameFouls') ?? rows[0]
  for (const k of MAX_GAME) out[k] = high[k] ?? null
  out.bestPa = highest(rows.map((r) => r.bestPa), 'fouls')
  return out
}

// `isStarter` is a majority of appearances: summed starts against summed games,
// the all/ file's own rule, when every season's row carries `gs`. A row written
// before `gs` existed (gen-fouls.mjs, #1201) has only the flag, so then the
// seasons vote with their games: a starter in a 30-game season and a reliever
// in a 10-game one is a starter.
export function combineFoulPitcher(slices) {
  const rows = present(slices)
  if (!rows.length) return null
  const last = latest(rows)
  const out = { name: last.name, teamId: last.teamId }
  for (const k of PITCHER_COUNTS) out[k] = sumOf(rows, k)
  if (rows.every((r) => r.gs != null)) {
    out.gs = sumOf(rows, 'gs')
    out.isStarter = out.gs * 2 > out.g
  } else {
    const starterGames = rows.reduce((n, r) => n + (r.isStarter ? (r.g ?? 0) : 0), 0)
    out.isStarter = starterGames * 2 > out.g
  }
  return out
}

// One player's `{ batters, pitchers }` shard slice over several seasons, in the
// shape fouls.js's batterFoulLine/pitcherFoulLine read.
export function combineFoulShards(shards, personId) {
  const id = String(personId)
  const pick = (group) => (shards ?? []).map((s) => s?.[group]?.[id] ?? null)
  const one = (rows, combine) => {
    const row = combine(rows)
    return row ? { [id]: row } : {}
  }
  // The postseason rides beside, never summed in (ADR-0101): a `post` shard
  // slice per season, combined on its own, and kept only when he has a line.
  const postOf = (group) => (shards ?? []).map((s) => s?.post?.[group]?.[id] ?? null)
  const post = {
    batters: one(postOf('batters'), combineFoulBatter),
    pitchers: one(postOf('pitchers'), combineFoulPitcher),
  }
  const hasPost = Object.keys(post.batters).length + Object.keys(post.pitchers).length > 0
  return {
    batters: one(pick('batters'), combineFoulBatter),
    pitchers: one(pick('pitchers'), combineFoulPitcher),
    ...(hasPost ? { post } : {}),
  }
}

// --- pitch arsenal (src/api/pitchArsenal.js) --------------------------------
// The shard keeps a mean beside its count (`avgVelo` beside `pitches`, and
// `[pitches, avgVelo]` pairs in `tto` and `vs`), not the velocity sums. So the
// combined mean is weighted by the pitches. It is the exact mean to within the
// file's 0.1 mph rounding; the pool's own `all/` file is built from the sums.
const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10)

const countOf = (pairs) => pairs.reduce((n, [count]) => n + (count ?? 0), 0)

function weightedMean(pairs) {
  let n = 0
  let sum = 0
  for (const [count, mean] of pairs) {
    if (mean == null || !count) continue
    n += count
    sum += count * mean
  }
  return n ? round1(sum / n) : null
}

// `[[pitches, avgVelo], …]` lists, one per season, added slot by slot.
function combinePairs(lists) {
  const seasons = lists.filter(Array.isArray)
  if (!seasons.length) return null
  const len = Math.max(...seasons.map((l) => l.length))
  return Array.from({ length: len }, (_, i) => {
    const slot = seasons.map((l) => l[i]).filter(Array.isArray)
    return [countOf(slot), weightedMean(slot)]
  })
}

function combinePitchType(rows) {
  const last = latest(rows)
  const out = {
    code: last.code,
    description: last.description,
    pitches: sumOf(rows, 'pitches'),
    avgVelo: weightedMean(rows.map((r) => [r.pitches, r.avgVelo])),
    century: sumOf(rows, 'century'),
    maxVelo: highest(rows, 'maxVelo')?.maxVelo ?? null,
  }
  const tto = combinePairs(rows.map((r) => r.tto))
  if (tto) out.tto = tto
  const vs = {}
  for (const side of ['L', 'R']) {
    const parts = rows.map((r) => r.vs?.[side]).filter(Array.isArray)
    if (!parts.length) continue
    const row = [countOf(parts), weightedMean(parts)]
    const sideTto = combinePairs(parts.map((p) => p[2]))
    if (sideTto) row.push(sideTto)
    vs[side] = row
  }
  if (Object.keys(vs).length) out.vs = vs
  return out
}

function combineLevel(lists) {
  const byCode = new Map()
  for (const list of lists) {
    for (const t of list ?? []) {
      if (!byCode.has(t.code)) byCode.set(t.code, [])
      byCode.get(t.code).push(t)
    }
  }
  return [...byCode.values()].map(combinePitchType).sort((a, b) => b.pitches - a.pitches)
}

// `{ name, teamId, throws, mlb: [type…], aaa: [type…] }`. `centuryRank` is a
// place in ONE season's league, so the combined entry has none (heatView then
// prints the two facts it does have).
export function combineArsenalEntries(slices) {
  const rows = present(slices)
  if (!rows.length) return null
  const last = latest(rows)
  return {
    name: last.name,
    teamId: last.teamId,
    throws: last.throws,
    mlb: combineLevel(rows.map((r) => r.mlb)),
    aaa: combineLevel(rows.map((r) => r.aaa)),
  }
}

// --- umpires (src/api/umpires.js) -------------------------------------------
// Game rows join, newest first. A game is in one season only, so nothing
// can count twice.
export function joinGameRows(lists) {
  return (lists ?? [])
    .flatMap((l) => l ?? [])
    .map((g, i) => [g, i])
    .sort(([a, i], [b, j]) => (b.date ?? '').localeCompare(a.date ?? '') || i - j)
    .map(([g]) => g)
}
