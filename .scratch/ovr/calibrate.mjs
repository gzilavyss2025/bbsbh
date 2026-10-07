// Q2: draft OVR (spec constants, rating.mjs) vs war.json. Prints tables for findings-numbers.md.
// Inputs: public/data/savant-percentiles.json, public/data/war.json (bat, pit, wrc, fld),
//         $OVR_CACHE/mlb-lines.json (pull-mlb-lines.mjs: names, PA, IP, position).
// Run: node .scratch/ovr/calibrate.mjs [--minPA=200] [--minIP=50] [--list]
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { hitterOvr, pitcherOvr } from './rating.mjs'
import { pearson, spearman, rCI, ols, ranks, mean } from './stats.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const cache = process.env.OVR_CACHE || join(tmpdir(), 'ovr-cache')
const sav = JSON.parse(readFileSync(join(root, 'public/data/savant-percentiles.json'), 'utf8'))
const war = JSON.parse(readFileSync(join(root, 'public/data/war.json'), 'utf8'))
const lines = JSON.parse(readFileSync(join(cache, 'mlb-lines.json'), 'utf8'))
const arg = (k, d) => Number((process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] ?? d) || d
const MIN_PA = arg('minPA', 200), MIN_IP = arg('minIP', 50)
const f2 = (x) => (x == null ? '-' : x.toFixed(2)), f1 = (x) => (x == null ? '-' : x.toFixed(1))

// ---- build rows
const H = [], P = []
let hSkippedFew = 0, pSkippedFew = 0
for (const [id, pc] of Object.entries(sav.bat)) {
  const { buckets, ovr } = hitterOvr(pc)
  // Spec says a missing bucket shares its weight. Taken literally that rates a player on sprint speed alone
  // (366 of 612 hitters have nothing else). Require Contact and Power; count what that drops.
  if (buckets.contact == null || buckets.power == null) { hSkippedFew++; continue }
  const l = lines.hitting[id]
  H.push({ id, ...buckets, ovr, name: l?.name, pos: l?.pos, pa: l?.pa ?? 0, ops: l?.ops, xwoba: sav.rawBat?.[id]?.xwoba, war: war.bat[id], wrc: war.wrc[id], fld: war.fld[id] })
}
for (const [id, pc] of Object.entries(sav.pit)) {
  const { buckets, ovr } = pitcherOvr(pc)
  if (buckets.stuff == null || buckets.results == null || buckets.control == null) { pSkippedFew++; continue }
  const l = lines.pitching[id]
  // Stuff from fbVelo alone is still "Stuff"; require xera + bb, which come together with whiff/k.
  P.push({ id, ...buckets, ovr, name: l?.name, pos: l?.pos, ip: l?.ip ?? 0, era: l?.era, hr: l?.hr, xera: sav.rawPit?.[id]?.xera, gs: l?.gs ?? 0, g: l?.g ?? 0, war: war.pit[id] })
}
console.log(`hitters with Contact+Power: ${H.length} (dropped ${hSkippedFew} of ${Object.keys(sav.bat).length}); pitchers with all 3 buckets: ${P.length} (dropped ${pSkippedFew} of ${Object.keys(sav.pit).length})`)

// ---- derived rates
for (const h of H) h.fld600 = h.pa > 0 && h.fld != null ? (h.fld / h.pa) * 600 : null
for (const h of H) h.warRate = h.pa > 0 && h.war != null ? (h.war / h.pa) * 600 : null
for (const p of P) p.warRate = p.ip > 0 && p.war != null ? (p.war / p.ip) * 200 : null

function block(label, rows, specs) {
  console.log(`\n### ${label} (n=${rows.length})`)
  console.log('| vs | n | Pearson r [95% CI] | Spearman |')
  console.log('| --- | --- | --- | --- |')
  for (const [name, get] of specs) {
    const pairs = rows.map((r) => [r.ovr, get(r)]).filter((p) => p[1] != null && Number.isFinite(p[1]))
    const x = pairs.map((p) => p[0]), y = pairs.map((p) => p[1])
    const r = pearson(x, y), [lo, hi] = rCI(r, x.length)
    console.log(`| ${name} | ${x.length} | ${f2(r)} [${f2(lo)}, ${f2(hi)}] | ${f2(spearman(x, y))} |`)
  }
}

const Hq = H.filter((h) => h.pa >= MIN_PA), Pq = P.filter((p) => p.ip >= MIN_IP)
block(`Hitters, PA >= ${MIN_PA}`, Hq, [['WAR (season total)', (r) => r.war], ['WAR per 600 PA', (r) => r.warRate], ['wRC+', (r) => r.wrc]])
block(`Hitters, all with Contact+Power`, H, [['WAR (season total)', (r) => r.war], ['WAR per 600 PA', (r) => r.warRate], ['wRC+', (r) => r.wrc]])
block(`Pitchers, IP >= ${MIN_IP}`, Pq, [['WAR (season total)', (r) => r.war], ['WAR per 200 IP', (r) => r.warRate]])
block(`Pitchers, all with 3 buckets`, P, [['WAR (season total)', (r) => r.war], ['WAR per 200 IP', (r) => r.warRate]])
// Starters only (relievers' WAR per IP is leverage-free and tiny)
block(`Pitchers, IP >= ${MIN_IP}, starters (GS >= 10)`, Pq.filter((p) => p.gs >= 10), [['WAR (season total)', (r) => r.war], ['WAR per 200 IP', (r) => r.warRate]])
block(`Pitchers, IP >= ${MIN_IP}, relievers (GS < 5)`, Pq.filter((p) => p.gs < 5), [['WAR (season total)', (r) => r.war], ['WAR per 200 IP', (r) => r.warRate]])

// ---- how much of the hitter gap is fielding? (war.json fld is season fielding runs; ~10 runs = 1 win)
{
  const R = Hq.filter((h) => h.fld != null && h.war != null && h.pa > 0)
  const noFld = R.map((h) => ((h.war - h.fld / 10) / h.pa) * 600)
  const withFld = R.map((h) => h.warRate)
  const ovr = R.map((h) => h.ovr)
  console.log(`\nHitters PA>=${MIN_PA}: r(OVR, WAR/600) = ${f2(pearson(ovr, withFld))}; r(OVR, (WAR - fld/10)/PA*600) = ${f2(pearson(ovr, noFld))}  [WAR with MLB-calc fielding runs taken out, an approximation]`)
  console.log(`r(OVR, fld) = ${f2(pearson(ovr, R.map((h) => h.fld)))}; r(wRC+, fld) = ${f2(pearson(R.map((h) => h.wrc), R.map((h) => h.fld)))}`)
}

// ---- OVR distribution sanity
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))] }
console.log('\nOVR quantiles (min/p10/p50/p90/max): hitters(PA>=200)', [0, .1, .5, .9, 1].map((p) => f1(q(Hq.map((h) => h.ovr), p))).join(' / '), '| pitchers(IP>=50)', [0, .1, .5, .9, 1].map((p) => f1(q(Pq.map((h) => h.ovr), p))).join(' / '))
{
  const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))) }
  for (const [label, rows] of [['hitters', Hq], ['pitchers', Pq]]) {
    const o = rows.map((r) => r.ovr)
    console.log(`${label}: mean ${f1(mean(o))}, SD ${f1(sd(o))} (a single metric rating has SD 12); count >=70: ${o.filter((v) => v >= 70).length}, >=80: ${o.filter((v) => v >= 80).length}, >=90: ${o.filter((v) => v >= 90).length}; stretch to restore SD 12 = x${(12 / sd(o)).toFixed(2)}`)
  }
  for (const [label, rows, bs] of [['hitter', Hq, ['contact', 'power', 'discipline', 'speed']], ['pitcher', Pq, ['stuff', 'results', 'control']]]) {
    console.log(`${label} bucket SDs: ` + bs.map((b) => `${b} ${f1(sd(rows.map((r) => r[b])))}`).join(', '))
  }
}
// Replacement-level anchor for Q1: OVR of regulars by WAR band
const band = (rows, lo, hi, get) => rows.filter((r) => get(r) >= lo && get(r) < hi)
console.log('\nMedian OVR by season-WAR band (hitters PA>=200):')
for (const [lo, hi] of [[-9, 0], [0, 1], [1, 2], [2, 3], [3, 5], [5, 20]]) { const s = band(Hq, lo, hi, (r) => r.war); console.log(`  WAR [${lo},${hi}) n=${s.length} median OVR ${s.length ? f1(q(s.map((r) => r.ovr), .5)) : '-'}`) }
console.log('Median OVR by season-WAR band (pitchers IP>=50):')
for (const [lo, hi] of [[-9, 0], [0, 1], [1, 2], [2, 3], [3, 5], [5, 20]]) { const s = band(Pq, lo, hi, (r) => r.war); console.log(`  WAR [${lo},${hi}) n=${s.length} median OVR ${s.length ? f1(q(s.map((r) => r.ovr), .5)) : '-'}`) }

// ---- weights: which bucket predicts the outcome?
function weightTable(label, rows, bucketNames, ycol, specW) {
  const R = rows.filter((r) => bucketNames.every((b) => r[b] != null) && r[ycol] != null)
  const X = R.map((r) => bucketNames.map((b) => r[b])), y = R.map((r) => r[ycol])
  const fit = ols(X, y)
  const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))) }
  const sx = bucketNames.map((_, j) => sd(X.map((r) => r[j])))
  const raw = bucketNames.map((b, j) => Math.max(0, fit.beta[j + 1] * sx[j]))
  const tot = raw.reduce((s, v) => s + v, 0)
  const total = Object.entries(specW).filter(([k]) => bucketNames.includes(k)).reduce((s, [, w]) => s + w, 0)
  console.log(`\n#### ${label}: ${ycol} ~ buckets (n=${R.length}, R2=${f2(fit.r2)})`)
  console.log('| bucket | corr w/ ' + ycol + ' | OLS beta (per pt) | share of explained spread (standardised beta, floored at 0) | spec weight (renormalised) | drop-one R2 loss |')
  console.log('| --- | --- | --- | --- | --- | --- |')
  bucketNames.forEach((b, j) => {
    const rest = bucketNames.filter((_, i) => i !== j)
    const f = ols(R.map((r) => rest.map((bb) => r[bb])), y)
    console.log(`| ${b} | ${f2(pearson(X.map((r) => r[j]), y))} | ${f2(fit.beta[j + 1])} | ${f1((100 * raw[j]) / tot)}% | ${f1((100 * (specW[b] ?? 0)) / total)}% | ${f2(fit.r2 - f.r2)} |`)
  })
  return fit
}
console.log('\n## Weight diagnostics')
weightTable('Hitters, offense only', Hq, ['contact', 'power', 'discipline', 'speed'], 'wrc', { contact: 25, power: 25, discipline: 15, speed: 15 })
weightTable('Hitters, all-in WAR rate', Hq, ['contact', 'power', 'discipline', 'speed'], 'warRate', { contact: 25, power: 25, discipline: 15, speed: 15 })
// fld600 = war.json season fielding runs per 600 PA, the only fielding number on file. It stands in for the missing bucket.
weightTable('Hitters, all-in WAR rate, with war.json fielding added as a fifth bucket', Hq, ['contact', 'power', 'discipline', 'speed', 'fld600'], 'warRate', { contact: 25, power: 25, discipline: 15, speed: 15, fld600: 20 })
weightTable('Pitchers, WAR per 200 IP', Pq, ['stuff', 'results', 'control'], 'warRate', { stuff: 40, results: 35, control: 25 })
weightTable('Starters only, WAR per 200 IP', Pq.filter((p) => p.gs >= 10), ['stuff', 'results', 'control'], 'warRate', { stuff: 40, results: 35, control: 25 })

// ---- disagreements: rank gap between OVR and WAR rate, inside the qualified pool
function disagreements(label, rows, rateKey, cols) {
  const R = rows.filter((r) => r[rateKey] != null)
  const ro = ranks(R.map((r) => r.ovr)), rw = ranks(R.map((r) => r[rateKey]))
  R.forEach((r, i) => { r.pO = (100 * (ro[i] - 0.5)) / R.length; r.pW = (100 * (rw[i] - 0.5)) / R.length; r.gap = r.pO - r.pW })
  const top = [...R].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, 10)
  console.log(`\n#### ${label}: 10 largest percentile-rank gaps, OVR rank minus ${rateKey} rank (n=${R.length})`)
  console.log('| player | ' + cols.map((c) => c[0]).join(' | ') + ' | OVR pct | WAR-rate pct | gap |')
  console.log('| --- | ' + cols.map(() => '---').join(' | ') + ' | --- | --- | --- |')
  for (const r of top) console.log(`| ${r.name} (${r.id}) | ` + cols.map((c) => c[1](r)).join(' | ') + ` | ${f1(r.pO)} | ${f1(r.pW)} | ${r.gap > 0 ? '+' : ''}${f1(r.gap)} |`)
  return top
}
disagreements('Hitters', Hq, 'warRate', [
  ['pos', (r) => r.pos], ['PA', (r) => r.pa], ['OVR', (r) => f1(r.ovr)],
  ['contact/power/disc/speed', (r) => [r.contact, r.power, r.discipline, r.speed].map(f1).join('/')],
  ['WAR', (r) => f1(r.war)], ['WAR/600', (r) => f2(r.warRate)], ['wRC+', (r) => f1(r.wrc)], ['fld', (r) => f1(r.fld)],
  ['xwOBA / OPS', (r) => `${r.xwoba ?? '-'} / ${r.ops ?? '-'}`],
])
disagreements('Pitchers', Pq, 'warRate', [
  ['role', (r) => (r.gs >= 10 ? 'SP' : r.gs < 5 ? 'RP' : 'swing')], ['IP', (r) => r.ip], ['OVR', (r) => f1(r.ovr)],
  ['stuff/results/control', (r) => [r.stuff, r.results, r.control].map(f1).join('/')],
  ['WAR', (r) => f1(r.war)], ['WAR/200', (r) => f2(r.warRate)],
  ['xERA / ERA / HR', (r) => `${r.xera ?? '-'} / ${r.era ?? '-'} / ${r.hr ?? '-'}`],
])
