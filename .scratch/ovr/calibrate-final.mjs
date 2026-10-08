// Step 6 (#1720): part B's calibration, re-run with the FINAL OVR (weights 22/33/17/28 and
// 30/45/25, stretch 2.0/1.5, Fielding, career blend). Same targets as calibrate.mjs.
// Two rows per group: "final" (the career blend that gen-ovr.mjs writes) and "2026 only"
// (the same code with the prior seasons stripped), so a change from part B's table can be
// split into weights-and-Fielding vs. the blend.
// Needs $OVR_CACHE/mlb-lines.json (node .scratch/ovr/pull-mlb-lines.mjs; network).
// Run: OVR_CACHE=/tmp/ovr-cache node .scratch/ovr/calibrate-final.mjs
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildRatings, loadInputs } from '../../scripts/lib/ovr/build.mjs'
import { mean, pearson, spearman } from './stats.mjs'

const data = join(import.meta.dirname, '..', '..', 'public', 'data')
const lines = JSON.parse(readFileSync(join(process.env.OVR_CACHE || join(tmpdir(), 'ovr-cache'), 'mlb-lines.json'), 'utf8'))
const war = JSON.parse(readFileSync(join(data, 'war.json'), 'utf8'))
const inp = loadInputs(data)
const only = (m) => Object.fromEntries(Object.entries(m).map(([id, by]) => [id, Object.fromEntries(Object.entries(by).filter(([y]) => y == inp.season))]))
const final = buildRatings(inp)
const solo = buildRatings({ ...inp, bat: only(inp.bat), pit: only(inp.pit), fld: only(inp.fld) })

const f2 = (x) => x.toFixed(2)
const sd = (a) => Math.sqrt(mean(a.map((v) => (v - mean(a)) ** 2)))
function row(label, rated, group, targets, keep) {
  const ids = Object.keys(rated).filter((id) => keep(id))
  const parts = targets.map(([name, get]) => {
    const p = ids.map((id) => [rated[id].ovr, get(id)]).filter(([, y]) => Number.isFinite(y))
    return `${name}: n ${p.length}, r ${f2(pearson(p.map((q) => q[0]), p.map((q) => q[1])))}, rho ${f2(spearman(p.map((q) => q[0]), p.map((q) => q[1])))}`
  })
  const o = ids.map((id) => rated[id].ovr)
  const name = (id) => `${lines[group][id]?.name ?? id} (${rated[id].ovr.toFixed(1)})`
  const top = ids.reduce((a, b) => (rated[b].ovr > rated[a].ovr ? b : a))
  const low = ids.reduce((a, b) => (rated[b].ovr < rated[a].ovr ? b : a))
  console.log(`| ${label} | ${parts.join(' | ')} | SD ${f2(sd(o))} | ${name(top)} | ${name(low)} |`)
}
const H = [['WAR', (id) => war.bat[id]], ['wRC+', (id) => war.wrc[id]]]
const P = [['WAR/200 IP', (id) => (lines.pitching[id]?.ip >= 1 && war.pit[id] != null ? (war.pit[id] / lines.pitching[id].ip) * 200 : NaN)]]
const has2026 = (g) => (id) => g[id].seasons[0] === inp.season
console.log('hitters (WAR, wRC+ of 2026; rated and with a 2026 row)')
row('final', final.bat, 'hitting', H, has2026(final.bat))
row('2026 only', solo.bat, 'hitting', H, () => true)
console.log('pitchers (WAR per 200 IP, 2026, IP >= 50)')
row('final', final.pit, 'pitching', P, (id) => final.pit[id].seasons[0] === inp.season && lines.pitching[id]?.ip >= 50)
row('2026 only', solo.pit, 'pitching', P, (id) => lines.pitching[id]?.ip >= 50)
