// Backtest for src/api/rotation/projectedStarters.js. For every start in the last 28 days
// that public/data/workload.json still holds, project that team's starter from
// data strictly before the date, then count how often the real starter was the
// first name (top1) or either of the two names (top2).
//
// Run from the repo root:  node .scratch/projected-starters/backtest.mjs
// Caveats: workload.json keeps 12 appearances per ACTIVE pitcher, so a pitcher
// since sent down or hurt is missing from both the projection and the answer
// key. September is a noisy month. Rerun after each nightly build and the
// window moves. Result recorded 2026-10-01: 592 games, top1 0.51, top2 0.82.
// REGULAR SEASON ONLY: workload.json holds no postseason games, so this says
// nothing about October (see ADR-0089).
import fs from 'node:fs'
import { projectStarters } from '../../src/api/rotation/projectedStarters.js'
import { dayIndex } from '../../src/api/workload.js'

const data = JSON.parse(fs.readFileSync('public/data/workload.json', 'utf8'))
const startsByTeam = {}
for (const [id, p] of Object.entries(data.pitchers)) {
  for (const a of p.apps) if (a.gs) (startsByTeam[p.teamId] ??= []).push({ d: a.d, id })
}
const cutoff = dayIndex(data.asOf) - 28
let games = 0, empty = 0, top1 = 0, top2 = 0
for (const [teamId, starts] of Object.entries(startsByTeam)) {
  for (const d of new Set(starts.map((s) => s.d))) {
    if (dayIndex(d) <= cutoff) continue
    const actual = starts.filter((s) => s.d === d).map((s) => s.id)
    const names = projectStarters(data, teamId, d)
    games++
    if (!names.length) empty++
    else if (actual.includes(names[0].id)) top1++
    if (names.some((n) => actual.includes(n.id))) top2++
  }
}
console.log({ asOf: data.asOf, games, empty, top1: (top1 / games).toFixed(2), top2: (top2 / games).toFixed(2) })
