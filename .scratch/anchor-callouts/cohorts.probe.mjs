// Probe for .scratch/anchor-callouts/spec.md. Counts how many MLB players clear a
// named milestone in one season, and which ids they are. Prints JSON to stdout.
//
//   node .scratch/anchor-callouts/cohorts.probe.mjs 2026
//
// This is the shape scripts/gen-cohorts.mjs would write nightly (slice 2 of the spec).
// It does not write a file. Source of every count: statsapi.mlb.com
// /api/v1/stats?stats=season&playerPool=all (checked 2026-11-03).
import { getJson } from '../../scripts/lib/statsapi.mjs'

const season = process.argv[2] || String(new Date().getFullYear())
const base = `/api/v1/stats?stats=season&season=${season}&sportIds=1&playerPool=all&limit=2000`

const num = (x) => {
  const n = parseFloat(x)
  return Number.isFinite(n) ? n : 0
}
const outsOf = (ip) => {
  const [w, f = '0'] = String(ip || '0').split('.')
  return Number(w) * 3 + Number(f)
}

// A player traded in-season has one split per club. Sum the counting stats so one
// person is counted once. Rate stats are only read for single-club players.
function byPlayer(splits) {
  const map = new Map()
  for (const s of splits) {
    const id = s.player.id
    const p = map.get(id) || { id, name: s.player.fullName, rows: [] }
    p.rows.push(s.stat)
    map.set(id, p)
  }
  return [...map.values()].map((p) => ({
    ...p,
    sum: (k) => p.rows.reduce((t, r) => t + num(r[k]), 0),
    single: p.rows.length === 1 ? p.rows[0] : null,
  }))
}

const [hit, pit] = await Promise.all([getJson(`${base}&group=hitting`), getJson(`${base}&group=pitching`)])
const hitters = byPlayer(hit.stats[0].splits)
const pitchers = byPlayer(pit.stats[0].splits)

// Each rung: a milestone a fan already knows by name. `pool` says who is counted.
const rungs = [
  ['hit', 'rbi100', '100 RBI', (p) => p.sum('rbi') >= 100],
  ['hit', 'rbi100-r100', '100 runs and 100 RBI', (p) => p.sum('runs') >= 100 && p.sum('rbi') >= 100],
  ['hit', 'hr20-sb20', '20 HR and 20 SB', (p) => p.sum('homeRuns') >= 20 && p.sum('stolenBases') >= 20],
  ['hit', 'sb30', '30 steals', (p) => p.sum('stolenBases') >= 30],
  ['hit', 'hr40', '40 home runs', (p) => p.sum('homeRuns') >= 40],
  ['hit', 'bb90', '90 walks', (p) => p.sum('baseOnBalls') >= 90],
  ['pit', 'k200', '200 strikeouts', (p) => p.sum('strikeOuts') >= 200],
  ['pit', 'k250', '250 strikeouts', (p) => p.sum('strikeOuts') >= 250],
  ['pit', 'sv30', '30 saves', (p) => p.sum('saves') >= 30],
  ['pit', 'w15', '15 wins', (p) => p.sum('wins') >= 15],
  ['pit', 'sho1', 'a shutout', (p) => p.sum('shutouts') >= 1],
  ['pit', 'cg1', 'a complete game', (p) => p.sum('completeGames') >= 1],
  ['pit', 'ip180', '180 innings', (p) => p.rows.reduce((t, r) => t + outsOf(r.inningsPitched), 0) >= 540],
]

const out = rungs.map(([group, id, label, test]) => {
  const members = (group === 'hit' ? hitters : pitchers).filter(test)
  return { id, group, label, count: members.length, members: members.map((m) => m.id) }
})

console.log(JSON.stringify({ season, generatedAt: new Date().toISOString(), cohorts: out }, null, 1))
