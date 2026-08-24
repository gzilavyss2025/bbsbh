// Robustness check: how much do the headline percentiles move if every
// player with a disputed (ordering-ambiguous) pre-debut season is dropped
// entirely, versus kept under the ascending-rank assumption?
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ipToOuts } from '../../src/api/rehab-policy.js'

const here = dirname(fileURLToPath(import.meta.url))
const raw = JSON.parse(await readFile(join(here, 'raw.json'), 'utf8'))
const f = JSON.parse(await readFile(join(here, 'findings.json'), 'utf8'))

const disputedIds = new Set(f.validation.disagree.map((d) => d.playerId))
const LEVEL_RANK = { 14: 1, 13: 2, 12: 3, 11: 4 }
const LEVEL_NAME = { 14: 'A', 13: 'High-A', 12: 'AA', 11: 'AAA' }

function num(x) {
  const n = Number(x)
  return Number.isFinite(n) ? n : 0
}
function statValue(group, stat) {
  if (group === 'pitching') return { pa: null, outs: ipToOuts(stat.inningsPitched), bf: num(stat.battersFaced) }
  return { pa: num(stat.plateAppearances) || num(stat.atBats) + num(stat.baseOnBalls) + num(stat.hitByPitch) + num(stat.sacFlies) + num(stat.sacBunts), outs: null, bf: null }
}
function reconstruct(player) {
  const debutYear = Number(player.debutDate.slice(0, 4))
  const bySegment = new Map()
  for (const row of player.milb) {
    if (row.season > debutYear) continue
    const key = `${row.season}:${row.sportId}`
    const v = statValue(player.group, row.stat)
    const cur = bySegment.get(key)
    if (cur) { cur.pa += v.pa || 0; cur.outs += v.outs || 0; cur.bf += v.bf || 0 }
    else bySegment.set(key, { season: row.season, sportId: row.sportId, pa: v.pa || 0, outs: v.outs || 0, bf: v.bf || 0 })
  }
  const segments = [...bySegment.values()].sort((a, b) => a.season !== b.season ? a.season - b.season : LEVEL_RANK[a.sportId] - LEVEL_RANK[b.sportId])
  const results = []
  let currentRank = 0, acc = null
  for (const seg of segments) {
    const rank = LEVEL_RANK[seg.sportId]
    if (rank < currentRank) continue
    if (rank === currentRank) { acc.pa += seg.pa; acc.outs += seg.outs; acc.bf += seg.bf; continue }
    if (acc) results.push(acc)
    acc = { sportId: seg.sportId, level: LEVEL_NAME[seg.sportId], pa: seg.pa, outs: seg.outs, bf: seg.bf }
    currentRank = rank
  }
  if (acc) results.push(acc)
  return results
}
function percentile(sorted, p) {
  if (!sorted.length) return null
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx), hi = Math.ceil(idx)
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}
function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return { n: sorted.length, p25: percentile(sorted, 0.25), median: percentile(sorted, 0.5), p75: percentile(sorted, 0.75) }
}

const playersArr = Object.entries(raw.players).map(([id, p]) => ({ id: Number(id), ...p })).filter((p) => p.group === 'hitting' || p.group === 'pitching')
const clean = playersArr.filter((p) => !disputedIds.has(p.id))
console.log(`clean subset (no disputed season): ${clean.length} / ${playersArr.length}`)

for (const [label, pool] of [['FULL cohort', playersArr], ['EXCLUDING disputed players', clean]]) {
  const segs = pool.flatMap((p) => reconstruct(p).map((s) => ({ ...s, group: p.group })))
  console.log(`\n--- ${label} ---`)
  for (const level of ['A', 'High-A', 'AA', 'AAA']) {
    const hitPA = segs.filter((s) => s.level === level && s.group === 'hitting').map((s) => s.pa)
    const pitIP = segs.filter((s) => s.level === level && s.group === 'pitching').map((s) => s.outs / 3)
    const h = summarize(hitPA), pit = summarize(pitIP)
    console.log(`${level}: hitPA n=${h.n} median=${h.median?.toFixed(0)} [${h.p25?.toFixed(0)}-${h.p75?.toFixed(0)}]  |  pitIP n=${pit.n} median=${pit.median?.toFixed(1)} [${pit.p25?.toFixed(1)}-${pit.p75?.toFixed(1)}]`)
  }
}
