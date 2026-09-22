// THE REAL LEAGUE RANK of every split, computed offline from the shards on
// disk with the app's OWN pivot — buildRankingIndex + rankMetric + bestOrder,
// the same three functions /situational-records ranks with. So a mark drawn on
// the canvas is the mark the ranking page would agree with, not one invented
// for the drawing.
//
// It is also a prototype of the generator this feature needs: the team page
// cannot rank a split live, because ranking one needs EVERY club's shard
// (31KB x 30 = ~940KB and 30 requests) and ADR-0082 gives each band only its
// own data. So the marks are precomputed. This script is what that generator
// would do.
//
//   node .scratch/team-one-scroll/canvas/records/rank-probe.mjs 158 1
//   node .scratch/team-one-scroll/canvas/records/rank-probe.mjs 249 14
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildRankingIndex, rankMetric, bestOrder, ordersByQuality } from '../../../../src/api/situationalRecordRankings.js'


const SEASON = 2026
const TOP = 5
const DIR = join(process.cwd(), 'public', 'data', 'team-records', String(SEASON))

const wantTeam = Number(process.argv[2] ?? 158)
const wantSport = Number(process.argv[3] ?? 1)

// The shard carries the club's sportId, so the level cohort is read off the
// files themselves rather than off a second source that could disagree.
const entries = []
for (const f of readdirSync(DIR)) {
  if (!f.endsWith('.json')) continue
  const id = Number(f.replace('.json', ''))
  let data
  try { data = JSON.parse(readFileSync(join(DIR, f), 'utf8')) } catch { continue }
  if (!data?.games?.length) continue
  const sportId = data.sportId ?? null
  if (sportId !== wantSport) continue
  entries.push({ team: { id, name: data.names?.short ?? data.names?.full ?? String(id), sportId }, data })
}

if (!entries.length) {
  console.log(`no shards for sportId ${wantSport} — shard keys seen:`,
    Object.keys(JSON.parse(readFileSync(join(DIR, '158.json'), 'utf8'))).join(', '))
  process.exit(0)
}

const index = buildRankingIndex(entries, { half: 'all', month: null })
console.log(`level sportId ${wantSport}: ${entries.length} clubs, ${index.metrics.size} metrics`)

const out = { top: [], bottom: [], thin: [] }
for (const [id, metric] of index.metrics) {
  const r = rankMetric(index, id, { sortBy: 'pct', order: bestOrder(metric) })
  if (!r) continue
  const mine = r.ranked.find((x) => x.teamId === wantTeam)
  if (!mine) continue
  const field = r.ranked.length
  const rec = { id, k: metric.k, group: metric.group, rank: mine.rank, field,
    played: mine.played ?? null, pct: mine.pct ?? null, tied: mine.tied }
  // A top-5 built on four games is a sample-size artifact, not a strength.
  if ((mine.played ?? 0) < 10) { out.thin.push(rec); continue }
  if (mine.rank <= TOP) out.top.push(rec)
  else if (mine.rank > field - TOP) out.bottom.push(rec)
}

const line = (r) => `  ${String(r.rank).padStart(2)} of ${r.field}  ${r.group} / ${r.k}` +
  `  (${r.played} g, pct ${r.pct ?? '—'})${r.tied ? ' [tied]' : ''}`
console.log(`\nTOP ${TOP} (${out.top.length})`); out.top.forEach((r) => console.log(line(r)))
console.log(`\nBOTTOM ${TOP} (${out.bottom.length})`); out.bottom.forEach((r) => console.log(line(r)))
console.log(`\nSUPPRESSED, under 10 games (${out.thin.length})`)
out.thin.filter((r) => r.rank <= TOP || r.rank > r.field - TOP).forEach((r) => console.log(line(r)))


// ---- threshold sweep: what each cutoff actually paints on this club ----
const MIN_G = 10
const rows = []
for (const [id, metric] of index.metrics) {
  const r = rankMetric(index, id, { sortBy: 'pct', order: bestOrder(metric) })
  if (!r) continue
  const mine = r.ranked.find((x) => x.teamId === wantTeam)
  if (!mine || mine.rank == null) continue
  if (metric.group === 'Season counts') continue
  if ((mine.played ?? 0) < MIN_G) continue
  rows.push({ rank: mine.rank, field: r.ranked.length, pct: mine.pct, played: mine.played })
}
const clubPct = (() => {
  const e = entries.find((x) => x.team.id === wantTeam)
  const g = e.data.games
  const w = g.filter((x) => x.rs > x.ra).length
  return w / g.length
})()
console.log(`
---- THRESHOLD SWEEP (${rows.length} splits with >=${MIN_G} games; club pct ${clubPct.toFixed(3)}) ----`)
for (const n of [5, 3, 2, 1]) {
  const t = rows.filter((r) => r.rank <= n).length
  const b = rows.filter((r) => r.rank > r.field - n).length
  console.log(`  top/bottom ${n}:  green ${String(t).padStart(2)}  red ${String(b).padStart(2)}  (${((t + b) / rows.length * 100).toFixed(0)}% of the card marked)`)
}

// ---- B: against the CLUB'S OWN season, not the league table ----
for (const d of [0.15, 0.20, 0.25]) {
  const up = rows.filter((r) => r.pct != null && r.pct - clubPct >= d).length
  const dn = rows.filter((r) => r.pct != null && clubPct - r.pct >= d).length
  console.log(`  own-record +/-${d.toFixed(2)}:  green ${String(up).padStart(2)}  red ${String(dn).padStart(2)}  (${((up + dn) / rows.length * 100).toFixed(0)}% marked)`)
}
// ---- C: league top/bottom 5 AND a real swing from the club's own season ----
for (const d of [0.10, 0.15]) {
  const up = rows.filter((r) => r.rank <= 5 && r.pct != null && r.pct - clubPct >= d).length
  const dn = rows.filter((r) => r.rank > r.field - 5 && r.pct != null && clubPct - r.pct >= d).length
  const dn2 = rows.filter((r) => r.pct != null && clubPct - r.pct >= d && r.rank > r.field / 2).length
  console.log(`  BOTH, swing ${d.toFixed(2)}:  green ${String(up).padStart(2)}  red ${String(dn).padStart(2)}  (red if also below-median: ${dn2})`)
}

// Per group, what the index line would have to say.
const byGroup = new Map()
for (const r of out.top) byGroup.set(r.group, { ...(byGroup.get(r.group) ?? { t: 0, b: 0 }), t: (byGroup.get(r.group)?.t ?? 0) + 1, b: byGroup.get(r.group)?.b ?? 0 })
for (const r of out.bottom) byGroup.set(r.group, { t: byGroup.get(r.group)?.t ?? 0, b: (byGroup.get(r.group)?.b ?? 0) + 1 })
console.log('\nPER GROUP — what an index line would carry')
for (const [g, v] of byGroup) console.log(`  ${g.padEnd(24)} top ${v.t}  bottom ${v.b}`)

// ---- EMIT the marks the canvas draws, and the generator would write ----
// Gary chose league top-5 / bottom-5 (2026-09-21), having been shown that it
// paints 54% of Milwaukee green and nothing red. His call, recorded.
//
// Two exclusions, both from what this probe found:
//   - under 10 games. "Started a game with an opener, 1 of 30" is four games,
//     and "Scoring in extra innings, 1 of 30" is eight. Sample artifacts.
//   - a split the club never faced ranks null (Vs. California League North on
//     a Carolina club) and is not a rank at all.
// Season counts have no `played`, so they are ranked on their own terms and
// only where COUNT_METRICS says an end of the column is the good one — its
// `neutral` rows (days in 2nd, days in 3rd) get no tint, because the catalog
// says in as many words that neither end is praise.
const marks = {}
for (const [id, metric] of index.metrics) {
  const r = rankMetric(index, id, { sortBy: 'pct', order: bestOrder(metric) })
  if (!r) continue
  const mine = r.ranked.find((x) => x.teamId === wantTeam)
  if (!mine || mine.rank == null) continue
  const field = r.ranked.length
  const isCount = metric.group === 'Season counts'
  if (!isCount && (mine.played ?? 0) < MIN_G) continue
  // The app's own test for "does this ordering make a claim about quality".
  // A neutral count (days in 2nd, days in 3rd) orders honestly but praises
  // neither end, so a green or red edge on it would be a lie. Gated on the
  // shipped function rather than on a list of ids kept here.
  if (!ordersByQuality(metric, 'pct')) continue
  let tone = null
  if (mine.rank <= TOP) tone = 'top'
  else if (mine.rank > field - TOP) tone = 'bottom'
  if (!tone) continue
  marks[id] = { k: metric.k, group: metric.group, rank: mine.rank, field, tone }
}
const outPath = new URL(`./ranks-${wantTeam}.json`, import.meta.url)
writeFileSync(outPath, JSON.stringify(marks, null, 1), 'utf8')
console.log(`
wrote ${Object.keys(marks).length} marks to ranks-${wantTeam}.json`)
