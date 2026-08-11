// Throwaway recon for the home-page transaction feed exploration: pulls the
// last 21 days league-wide and reports raw field shapes + volumes, so the real
// report is built against verified structure rather than a guess.
// Run: node .scratch/home-transactions/recon.mjs
import { getJson } from '../../src/api/statsapi.js'

const DAYS = 21
const end = new Date()
const start = new Date(end.getTime() - DAYS * 86400000)
const iso = (d) => d.toISOString().slice(0, 10)

const startDate = iso(start)
const endDate = iso(end)
console.log(`window ${startDate} .. ${endDate}`)

const raw = (await getJson(`/api/v1/transactions?startDate=${startDate}&endDate=${endDate}`)).transactions ?? []
console.log(`raw rows: ${raw.length}`)

// Union of top-level keys, with presence counts.
const keys = new Map()
for (const t of raw) for (const k of Object.keys(t)) keys.set(k, (keys.get(k) ?? 0) + 1)
console.log('\n--- top-level keys (count present / total) ---')
for (const [k, n] of [...keys].sort((a, b) => b[1] - a[1])) console.log(`${k.padEnd(20)} ${n}/${raw.length}`)

// Nested object shapes.
const nested = ['person', 'team', 'fromTeam', 'toTeam']
for (const n of nested) {
  const sub = new Map()
  let seen = 0
  for (const t of raw) {
    if (!t[n]) continue
    seen += 1
    for (const k of Object.keys(t[n])) sub.set(k, (sub.get(k) ?? 0) + 1)
  }
  console.log(`\n--- ${n} (present on ${seen} rows) ---`)
  for (const [k, c] of [...sub].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(18)} ${c}`)
}

// typeCode distribution.
const codes = new Map()
for (const t of raw) {
  const k = `${t.typeCode} — ${t.typeDesc}`
  codes.set(k, (codes.get(k) ?? 0) + 1)
}
console.log('\n--- typeCode distribution ---')
for (const [k, n] of [...codes].sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(4)}  ${k}`)

// Date fields: how often do date / effectiveDate / resolutionDate disagree?
let differ = 0
let noEffective = 0
let hasResolution = 0
for (const t of raw) {
  if (!t.effectiveDate) noEffective += 1
  else if (t.effectiveDate !== t.date) differ += 1
  if (t.resolutionDate) hasResolution += 1
}
console.log(`\ndate vs effectiveDate: ${differ} differ, ${noEffective} have no effectiveDate, ${hasResolution} carry resolutionDate`)

// id uniqueness.
const ids = new Set(raw.map((t) => t.id))
console.log(`distinct ids: ${ids.size} of ${raw.length} rows`)

// A couple of verbatim samples.
console.log('\n--- 3 verbatim samples ---')
for (const t of [raw[0], raw[Math.floor(raw.length / 2)], raw[raw.length - 1]]) {
  console.log(JSON.stringify(t, null, 2))
}
