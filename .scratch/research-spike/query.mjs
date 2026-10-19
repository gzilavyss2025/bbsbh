import { readdirSync, readFileSync } from 'node:fs'
import { DuckDBInstance } from '@duckdb/node-api'
const ORIGIN_X = 125.42, ORIGIN_Y = 198.27, CENTER = 15 // degrees either side of straight-away CF
const HALF = 17 / 12 / 2, THIRD = 17 / 12 / 6            // plate half-width 0.708 ft; a third is 0.236 ft
const ang = (x, y) => (Math.atan2(x - ORIGIN_X, ORIGIN_Y - y) * 180) / Math.PI // + = right field
// Opp Field: LHH hits to LF (angle < -15), RHH to RF (angle > 15).
const oppo = (stand, a) => (stand === 'L' ? a < -CENTER : a > CENTER)
// Inner Third: catcher's view, + = first-base side. LHH stands on that side, so inside = +x for L, -x for R.
const inner = (stand, px) => (stand === 'L' ? px > THIRD && px <= HALF : px < -THIRD && px >= -HALF)
const time = (f, n = 5) => { const t = []; let r; for (let i = 0; i < n; i++) { const s = performance.now(); r = f(); t.push(performance.now() - s) } t.sort((a, b) => a - b); return { ms: +t[Math.floor(n / 2)].toFixed(2), r } }
const load = dir => { const s = performance.now(); const sh = readdirSync(dir).map(f => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'))); return { sh, ms: performance.now() - s } }
const colIdx = cols => Object.fromEntries(cols.map((c, i) => [c, i]))
const variants = {
  full: (r, i) => r[i.event] === 'home_run' && r[i.stand] === 'L' && r[i.throws] === 'L' && r[i.pt] === 'SI' && r[i.hcx] != null && oppo('L', ang(r[i.hcx], r[i.hcy])) && r[i.px] != null && inner('L', r[i.px]),
  noInner: (r, i) => r[i.event] === 'home_run' && r[i.stand] === 'L' && r[i.throws] === 'L' && r[i.pt] === 'SI' && r[i.hcx] != null && oppo('L', ang(r[i.hcx], r[i.hcy])),
  noSinker: (r, i) => r[i.event] === 'home_run' && r[i.stand] === 'L' && r[i.throws] === 'L' && r[i.hcx] != null && oppo('L', ang(r[i.hcx], r[i.hcy])) && r[i.px] != null && inner('L', r[i.px]),
  oppoHR: (r, i) => r[i.event] === 'home_run' && r[i.stand] === 'L' && r[i.throws] === 'L' && r[i.hcx] != null && oppo('L', ang(r[i.hcx], r[i.hcy])),
}
for (const [name, dir, paEndOnly] of [['PA only', 'out/pa-row', false], ['PA+pitch (PA half answers it)', 'out/pa-row', false], ['pitch only', 'out/pitchonly-row', true]]) {
  const { sh, ms } = load(dir)
  const idx = colIdx(sh[0].cols)
  const all = sh.flatMap(s => s.r)
  console.log(`\n${name}: parse ${sh.length} shards, ${all.length} rows in ${ms.toFixed(0)} ms`)
  for (const [v, f] of Object.entries(variants)) {
    const t = time(() => { let best = null; for (const r of all) { if (paEndOnly && !r[idx.paEnd]) continue; if (f(r, idx) && (!best || r[idx.d] > best[idx.d] || (r[idx.d] === best[idx.d] && r[idx.gamePk] > best[idx.gamePk]))) best = r } return { n: 0, best } })
    let n = 0; for (const r of all) { if (paEndOnly && !r[idx.paEnd]) continue; if (f(r, idx)) n++ }
    console.log(`  ${v.padEnd(9)} median ${t.ms} ms  matches ${n}  newest ${t.r.best ? JSON.stringify([t.r.best[idx.gamePk], t.r.best[idx.d]]) : '-'}`)
  }
}
// DuckDB over the JSON (the ADR-0065 route): same query, SQL.
const inst = await DuckDBInstance.create(':memory:'); const c = await inst.connect()
for (const [name, dir] of [['pa', 'out/pa-col'], ['pitchonly', 'out/pitchonly-col']]) {
  // columnar shards -> unnest the arrays
  const sh = readdirSync(dir)
  const t0 = performance.now()
  await c.run(`CREATE TABLE ${name} AS SELECT * FROM (SELECT unnest(c[1]) gamePk, unnest(c[4]) batter FROM read_json('${dir}/*.json')) LIMIT 0`)
}
console.log('\n(DuckDB timing: see duck.mjs)')
