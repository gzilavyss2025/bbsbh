// Q1: from arrival shares to level ceilings. Prints the tables in findings-numbers.md.
// Inference rule (NOT data): ceiling(L) = 20 + (ANCHOR - 20) * share(L) / share(AAA), i.e. headroom above the
// floor scales with the share of the level's players who reach the majors, with AAA held at the spec's 58.
// A second, unanchored rule, ceiling(L) = 20 + 79 * share(L), is printed for contrast.
// Run: node .scratch/ovr/ceilings.mjs   (needs the same $OVR_CACHE as conversion.mjs)
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rows, byBucket } from './conversion.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const ANCHOR = 58
const SPEC = { AAA: 58, AA: 50, 'High-A': 40, A: 35, Rk: 30, 'Rk-complex': 30 }
const ORDER = ['AAA', 'AA', 'High-A', 'A', 'Rk', 'Rk-complex']
const SPORT = { AAA: 11, AA: 12, 'High-A': 13, A: 14, Rk: 16, 'Rk-complex': '16us' }
const f1 = (x) => x.toFixed(1)
function wilson(k, n) { const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), w = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [(100 * (c - w)) / d, (100 * (c + w)) / d] }

// share(level) for one variant: unit 'player' | 'row'; reach 'b' (rookie threshold) | 'a' (any MLB game); floors
function shares({ unit, reach, floors }) {
  const out = {}
  for (const L of ORDER) {
    let k = 0, n = 0
    for (const [g, fl] of [['hitting', floors[0]], ['pitching', floors[1]]]) {
      const R = rows(SPORT[L], g, fl)
      if (unit === 'row') { n += R.length; k += R.filter((r) => r[reach]).length } else {
        const m = new Map()
        for (const r of R) m.set(r.id, (m.get(r.id) || false) || r[reach])
        n += m.size; k += [...m.values()].filter(Boolean).length
      }
    }
    out[L] = { k, n, p: k / n }
  }
  return out
}
const ceil = (sh) => Object.fromEntries(ORDER.map((L) => [L, 20 + (ANCHOR - 20) * sh[L].p / sh.AAA.p]))
const ceilFree = (sh) => Object.fromEntries(ORDER.map((L) => [L, 20 + 79 * sh[L].p]))

const primary = { unit: 'player', reach: 'b', floors: [100, 30] }
const sh = shares(primary)
console.log('## Primary: distinct players seen at the level (hitters >=100 PA or pitchers >=30 IP in a season 2009-2019, no MLB game before that season) who later cross the rookie threshold')
console.log('| level | players (H+P) | reach, rookie threshold | 95% CI | ratio to AAA | derived ceiling (AAA=58) | spec guess | move |')
console.log('| --- | --- | --- | --- | --- | --- | --- | --- |')
const c0 = ceil(sh)
for (const L of ORDER) { const [lo, hi] = wilson(sh[L].k, sh[L].n); console.log(`| ${L} | ${sh[L].n} | ${f1(100 * sh[L].p)}% | ${f1(lo)}-${f1(hi)}% | ${(sh[L].p / sh.AAA.p).toFixed(2)} | ${f1(c0[L])} | ${SPEC[L]} | ${(c0[L] - SPEC[L] >= 0 ? '+' : '') + f1(c0[L] - SPEC[L])} |`) }

console.log('\n## Sensitivity: every variant, ceilings under the anchored rule')
console.log('| unit | reach | floors (PA/IP) | AAA share | AA | High-A | A | Rk | (derived ceilings; AAA=58) |')
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- |')
const variants = []
for (const unit of ['player', 'row']) for (const reach of ['b', 'a']) for (const floors of [[50, 15], [100, 30], [200, 50]]) variants.push({ unit, reach, floors })
const all = []
for (const v of variants) {
  const s = shares(v), c = ceil(s); all.push(c)
  console.log(`| ${v.unit} | ${v.reach === 'b' ? 'rookie threshold' : 'any MLB game'} | ${v.floors.join('/')} | ${f1(100 * s.AAA.p)}% | ${f1(c.AA)} | ${f1(c['High-A'])} | ${f1(c.A)} | ${f1(c.Rk)} | |`)
}
console.log('\nrange across the', variants.length, 'variants (min-max):')
for (const L of ORDER) { const v = all.map((c) => c[L]); console.log(`  ${L.padEnd(7)} ${f1(Math.min(...v))} - ${f1(Math.max(...v))}   (spec ${SPEC[L]})`) }

console.log('\n## Unanchored contrast: ceiling = 20 + 79 * share (share 100% -> 99), primary variant and the any-game variant')
for (const v of [primary, { ...primary, reach: 'a' }, { unit: 'row', reach: 'b', floors: [100, 30] }]) {
  const c = ceilFree(shares(v)); console.log(`  ${v.unit}/${v.reach === 'b' ? 'rookie' : 'any'}: ` + ORDER.map((L) => `${L} ${f1(c[L])}`).join(', '))
}

// What the 881 alone shows: pass-through, no conversion
const bench = JSON.parse(readFileSync(join(root, 'public/data/level-tenure-benchmark.json'), 'utf8'))
const N = bench.cohort.playerCount
console.log(`\n## The ${N}-player cohort alone (public/data/level-tenure-benchmark.json): players with a reconstructed stint at each level`)
for (const L of ['A', 'High-A', 'AA', 'AAA']) { const h = bench.levels[L].hitting.n, p = bench.levels[L].pitching.n; console.log(`  ${L.padEnd(7)} hit n=${h} + pit n=${p} = ${h + p}  (${f1((100 * (h + p)) / N)}% of ${N})`) }

// Does in-level performance change the answer? Reach (rookie threshold) by within-level-season percentile of OPS (hitters) / ERA (pitchers), H+P pooled.
console.log('\n## Reach (rookie threshold) by within-level performance, hitters + pitchers pooled, player-seasons')
console.log('| level | bottom half | 50-90th | top decile | top 5% | n top decile |')
console.log('| --- | --- | --- | --- | --- | --- |')
for (const L of ORDER) {
  const agg = { low: [0, 0], mid: [0, 0], top: [0, 0], t5: [0, 0] }
  for (const [g, fl] of [['hitting', 100], ['pitching', 30]]) {
    for (const b of byBucket(SPORT[L], g, fl, [0, 50, 90, 95, 100])) {
      const k = Math.round((b.rookie / 100) * b.n)
      const t = b.band === '0-50' ? 'low' : b.band === '50-90' ? 'mid' : 'top'
      agg[t][0] += k; agg[t][1] += b.n
      if (b.band === '95-100') { agg.t5[0] += k; agg.t5[1] += b.n }
    }
  }
  const p = (a) => (a[1] ? f1((100 * a[0]) / a[1]) + '%' : '-')
  console.log(`| ${L} | ${p(agg.low)} | ${p(agg.mid)} | ${p([agg.top[0], agg.top[1]])} | ${p(agg.t5)} | ${agg.top[1]} |`)
}
