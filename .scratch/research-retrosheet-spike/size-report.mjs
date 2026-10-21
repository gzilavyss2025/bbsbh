// #2234 Retrosheet spike, step 5b: per-decade sums of the measured season sizes
// that size.mjs wrote. Usage: node size-report.mjs <dlDir>
import { readFileSync, readdirSync } from 'node:fs'

const dir = process.argv[2]
const rows = readdirSync(dir).filter(f => /^size-years-\d+-\d+\.json$/.test(f))
  .flatMap(f => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'))).sort((a, b) => a.year - b.year)
const names = Object.keys(rows[0].sizes)
const mb = b => (b / 1e6).toFixed(1)
const dec = new Map()
for (const r of rows) {
  const d = Math.floor(r.year / 10) * 10
  const a = dec.get(d) ?? dec.set(d, { y0: r.year, y1: r.year, n: 0, pas: 0, pseq: 0, gz: Object.fromEntries(names.map(k => [k, 0])), raw: 0 }).get(d)
  a.y1 = r.year; a.n++; a.pas += r.pas; a.pseq += r.pseqFilled; a.raw += r.sizes[names[0]].raw
  for (const k of names) a.gz[k] += r.sizes[k].gz
}
console.log(`| Decade | Seasons | PA rows | Pitch sequence filled | ${names.map(k => `${k}, MB gz`).join(' | ')} | ${names[0]}, bytes gz per PA |`)
console.log(`|---|---|---|---|${names.map(() => '---').join('|')}|---|`)
const tot = { pas: 0, gz: Object.fromEntries(names.map(k => [k, 0])) }
for (const [d, a] of [...dec].sort((x, y) => x[0] - y[0])) {
  tot.pas += a.pas; for (const k of names) tot.gz[k] += a.gz[k]
  console.log(`| ${d}s | ${a.y0}-${a.y1} (${a.n}) | ${a.pas} | ${(100 * a.pseq / a.pas).toFixed(1)}% | ${names.map(k => mb(a.gz[k])).join(' | ')} | ${(a.gz[names[0]] / a.pas).toFixed(2)} |`)
}
console.log(`| All | ${rows[0].year}-${rows.at(-1).year} (${rows.length}) | ${tot.pas} | | ${names.map(k => mb(tot.gz[k])).join(' | ')} | ${(tot.gz[names[0]] / tot.pas).toFixed(2)} |`)
const core = rows.filter(r => r.year >= 1961 && r.year <= 2014)
console.log(`\n1961-2014: ${core.length} seasons, ${core.reduce((s, r) => s + r.pas, 0)} PA rows, ` + names.map(k => `${k} ${mb(core.reduce((s, r) => s + r.sizes[k].gz, 0))} MB gz`).join(', '))
for (const y of [1961, 1987, 2014]) { const r = rows.find(r => r.year === y); if (r) console.log(`${y}: ${r.pas} PA rows, ` + names.map(k => `${k} ${(r.sizes[k].gz / 1e6).toFixed(2)} MB gz (${(r.sizes[k].raw / 1e6).toFixed(1)} MB raw)`).join(', ')) }
