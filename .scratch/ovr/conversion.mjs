// Q1: what share of a level's players reach the majors, and how does that share
// change with in-level performance? Writes nothing; prints tables.
// Inputs (all read-only):
//   .scratch/level-benchmarks/perf-pool.json   full population, sportId 11/12/13, 2009-2023
//   $OVR_CACHE/pool-extra.json                 sportId 14/16, 2009-2019 (pull-pools.mjs)
//   public/data/rookies.json                   debut date + rookieUntil for every MLB debutant to 2026
// Reach (A) = any MLB game on or after season s.  Reach (B) = also crossed the real rookie
// threshold (130 AB / 50 IP), the cohort rule in docs/level-tenure-benchmark.md.
// Seasons 2009-2019 only: the file ends 2026-10, so every row has 7+ years to arrive.
// Run: node .scratch/ovr/conversion.mjs [--json]
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const cache = process.env.OVR_CACHE || join(tmpdir(), 'ovr-cache')
const pool = { ...JSON.parse(readFileSync(join(root, '.scratch/level-benchmarks/perf-pool.json'), 'utf8')), ...JSON.parse(readFileSync(join(cache, 'pool-extra.json'), 'utf8')) }
const rookies = JSON.parse(readFileSync(join(root, 'public/data/rookies.json'), 'utf8')).players
export const LEVEL = { 11: 'AAA', 12: 'AA', 13: 'High-A', 14: 'A', 16: 'Rk', '16us': 'Rk-complex' }
// OVR_MAX_SEASON=2015 re-runs with 11+ years of follow-up (default 2019 = 7+ years): a check on right-censoring.
const MAX_SEASON = Number(process.env.OVR_MAX_SEASON) || 2019
const SEASONS = [2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019].filter((s) => s <= MAX_SEASON)
const ip = (v) => { const w = Math.floor(v); return w + Math.round((v - w) * 10) / 3 }

export function rows(sportId, group, floor) {
  const out = []
  for (const s of SEASONS) {
    for (const r of pool[`${sportId}:${s}:${group}`] || []) {
      const vol = group === 'hitting' ? r.plateAppearances : ip(r.inningsPitched)
      if (vol < floor) continue
      const rk = rookies[r.playerId]
      const debutYear = rk ? Number(rk.debutDate.slice(0, 4)) : null
      if (debutYear !== null && debutYear < s) continue // already in the majors before this season
      out.push({ id: r.playerId, s, vol, ops: r.ops, era: r.era,
        a: debutYear !== null, b: !!(rk && rk.rookieUntil) })
    }
  }
  return out
}
const pct = (n, d) => (d ? (100 * n / d) : NaN)
const fmt = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-')

export function summary(floors = { hitting: 100, pitching: 30 }) {
  const res = {}
  for (const sp of [11, 12, 13, 14, 16]) {
    res[LEVEL[sp]] = {}
    for (const g of ['hitting', 'pitching']) {
      const R = rows(sp, g, floors[g])
      const byPlayer = new Map()
      for (const r of R) { const p = byPlayer.get(r.id) || { a: false, b: false, first: r.s }; p.a ||= r.a; p.b ||= r.b; byPlayer.set(r.id, p) }
      res[LEVEL[sp]][g] = {
        rowsN: R.length, anyMLB: pct(R.filter((r) => r.a).length, R.length), rookie: pct(R.filter((r) => r.b).length, R.length),
        playersN: byPlayer.size, playerAny: pct([...byPlayer.values()].filter((p) => p.a).length, byPlayer.size),
        playerRookie: pct([...byPlayer.values()].filter((p) => p.b).length, byPlayer.size),
      }
    }
  }
  return res
}

// Reach share by within-level-season performance bucket (hitters: OPS, pitchers: ERA).
export function byBucket(sp, group, floor, cuts = [0, 50, 75, 90, 95, 99, 100]) {
  const R = rows(sp, group, floor)
  const bySeason = new Map()
  for (const r of R) { (bySeason.get(r.s) || bySeason.set(r.s, []).get(r.s)).push(r) }
  const tagged = []
  for (const list of bySeason.values()) {
    const key = group === 'hitting' ? (r) => r.ops : (r) => -r.era // higher = better
    list.sort((x, y) => key(x) - key(y))
    list.forEach((r, i) => tagged.push({ ...r, p: (100 * (i + 0.5)) / list.length }))
  }
  const out = []
  for (let k = 0; k < cuts.length - 1; k++) {
    const sub = tagged.filter((r) => r.p >= cuts[k] && r.p < (cuts[k + 1] === 100 ? 101 : cuts[k + 1]))
    out.push({ band: `${cuts[k]}-${cuts[k + 1]}`, n: sub.length, any: pct(sub.filter((r) => r.a).length, sub.length), rookie: pct(sub.filter((r) => r.b).length, sub.length) })
  }
  return out
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const json = process.argv.includes('--json')
  const out = { floors: {}, bucket: {} }
  for (const [name, fl] of [['100PA/30IP', { hitting: 100, pitching: 30 }], ['50PA/15IP', { hitting: 50, pitching: 15 }], ['200PA/50IP', { hitting: 200, pitching: 50 }]]) {
    out.floors[name] = summary(fl)
    if (!json) {
      console.log(`\n## floor ${name}: share of level-season rows that reach the majors (any game / rookie threshold)`)
      console.log('level  | hit rows  any%  rookie% | pit rows  any%  rookie% | hit players any% rookie% | pit players any% rookie%')
      for (const [lv, v] of Object.entries(out.floors[name])) {
        const h = v.hitting, p = v.pitching
        console.log(`${lv.padEnd(6)} | ${String(h.rowsN).padStart(7)} ${fmt(h.anyMLB).padStart(5)} ${fmt(h.rookie).padStart(6)} | ${String(p.rowsN).padStart(7)} ${fmt(p.anyMLB).padStart(5)} ${fmt(p.rookie).padStart(6)} | ${String(h.playersN).padStart(6)} ${fmt(h.playerAny).padStart(5)} ${fmt(h.playerRookie).padStart(6)} | ${String(p.playersN).padStart(6)} ${fmt(p.playerAny).padStart(5)} ${fmt(p.playerRookie).padStart(6)}`)
      }
    }
  }
  for (const sp of [11, 12, 13, 14, 16]) for (const [g, fl] of [['hitting', 100], ['pitching', 30]]) {
    const b = byBucket(sp, g, fl)
    out.bucket[`${LEVEL[sp]}:${g}`] = b
    if (!json) { console.log(`\n## ${LEVEL[sp]} ${g}: reach by within-level performance percentile (floor ${fl})`); for (const x of b) console.log(`${x.band.padEnd(7)} n=${String(x.n).padStart(6)}  any ${fmt(x.any).padStart(5)}%  rookie ${fmt(x.rookie).padStart(5)}%`) }
  }
  if (json) console.log(JSON.stringify(out, null, 1))
}
