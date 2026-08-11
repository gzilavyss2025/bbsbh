// What is resolutionDate for? Measured across a full season of the wire.
// Run: node .scratch/home-transactions/probe-resolution-date.mjs
import { getJson } from '../../src/api/statsapi.js'

const today = new Date()
const season = today.getUTCFullYear()
const meta = (await getJson(`/api/v1/seasons/${season}?sportId=1`)).seasons?.[0] ?? {}
const startDate = meta.regularSeasonStartDate
const endDate = today.toISOString().slice(0, 10)
const raw = (await getJson(`/api/v1/transactions?startDate=${startDate}&endDate=${endDate}`)).transactions ?? []
console.log(`${raw.length} rows, ${startDate} .. ${endDate}\n`)

const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)

// 1. Presence by type code.
const byCode = new Map()
for (const t of raw) {
  if (!byCode.has(t.typeCode)) byCode.set(t.typeCode, { code: t.typeCode, desc: t.typeDesc, total: 0, withRes: 0 })
  const e = byCode.get(t.typeCode)
  e.total += 1
  if (t.resolutionDate) e.withRes += 1
}
console.log('--- presence by type code ---')
console.log('code   desc                          total   with resolutionDate')
for (const e of [...byCode.values()].sort((a, b) => b.total - a.total)) {
  const share = ((e.withRes / e.total) * 100).toFixed(0)
  console.log(`${e.code.padEnd(6)} ${String(e.desc).padEnd(28)} ${String(e.total).padStart(6)}   ${String(e.withRes).padStart(6)}  (${share}%)`)
}

// 2. How it relates to date / effectiveDate.
let eqDate = 0, eqEff = 0, after = 0, before = 0, noEff = 0
const lagHist = new Map()
const lagByCode = new Map()
for (const t of raw) {
  if (!t.resolutionDate) continue
  if (t.resolutionDate === t.date) eqDate += 1
  if (t.effectiveDate) {
    if (t.resolutionDate === t.effectiveDate) eqEff += 1
    const d = days(t.effectiveDate, t.resolutionDate)
    lagHist.set(d, (lagHist.get(d) ?? 0) + 1)
    if (d > 0) after += 1
    if (d < 0) before += 1
    if (!lagByCode.has(t.typeCode)) lagByCode.set(t.typeCode, [])
    if (d !== 0) lagByCode.get(t.typeCode).push({ d, t })
  } else noEff += 1
}
const withRes = raw.filter((t) => t.resolutionDate).length
console.log(`\n--- ${withRes} rows carry a resolutionDate ---`)
console.log(`same as date:          ${eqDate}`)
console.log(`same as effectiveDate: ${eqEff}`)
console.log(`after effectiveDate:   ${after}`)
console.log(`before effectiveDate:  ${before}`)
console.log(`no effectiveDate:      ${noEff}`)
console.log('\nlag from effectiveDate (days -> rows):')
for (const [d, ct] of [...lagHist].sort((a, b) => a[0] - b[0])) console.log(`  ${String(d).padStart(5)}  ${ct}`)

console.log('\n--- rows where it differs, by code, with examples ---')
for (const [code, list] of [...lagByCode].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n${code}  (${list.length} rows differ)`)
  for (const { d, t } of list.slice(0, 4)) {
    console.log(`   ${d >= 0 ? '+' : ''}${d}d  eff ${t.effectiveDate} res ${t.resolutionDate}  |  ${t.description}`)
  }
}

// 3. Does its ABSENCE mean anything? Compare the two populations inside one code.
console.log('\n--- inside one code: rows with vs without a resolutionDate ---')
for (const code of ['SC', 'ASG', 'TR', 'DES', 'OPT', 'CU', 'REL']) {
  const rows = raw.filter((t) => t.typeCode === code)
  const withR = rows.filter((t) => t.resolutionDate)
  const without = rows.filter((t) => !t.resolutionDate)
  console.log(`\n${code}: ${withR.length} with, ${without.length} without`)
  const verb = (t) => (t.description || '').replace(/^.*?\b(activated|placed|transferred|assigned|sent|optioned|recalled|selected|designated|released|outrighted|claimed|traded|signed|returned|reassigned|elected|suspended|retired)\b.*$/i, '$1').toLowerCase()
  const tally = (list) => {
    const m = new Map()
    for (const t of list) m.set(verb(t), (m.get(verb(t)) ?? 0) + 1)
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([v, c2]) => `${v} ${c2}`).join(', ')
  }
  console.log(`   with:    ${tally(withR) || '(none)'}`)
  console.log(`   without: ${tally(without) || '(none)'}`)
  if (without.length) console.log(`   ex without: ${without[without.length - 1].description}`)
  if (withR.length) console.log(`   ex with:    ${withR[withR.length - 1].description}`)
}
