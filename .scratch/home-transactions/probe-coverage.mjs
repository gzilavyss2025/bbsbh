// Probe for issue #772 segment 1 — the three coverage/voice decisions, checked
// against the live wire rather than against the 2026-08-11 study's summary:
//
//   1. ACQ-family arrivals (ACQ/OBT/PUR/CP) — do any name TWO MLB clubs? If not,
//      no direction-aware clause is needed for them, only a whitelist entry.
//   2. `WA` — the whitelist carries it; the season census never saw it. Real?
//   3. Plain activations (SC + /activat/i with no injured-list wording) — which
//      sub-kinds does letting them in actually admit, and how many touch an MLB
//      club directly? Which lists get named instead of the IL?
//   4. Same-day double-arrival risk — a signing and its completing activation on
//      one club-day would make one player two stories.
//
// Run: node .scratch/home-transactions/probe-coverage.mjs [days]
import { getJson } from '../../src/api/statsapi.js'
import { txnDate, mentionsInjuredList } from '../../src/api/rehab-policy.js'

const DAYS = Number(process.argv[2] ?? 60)
const end = new Date()
const start = new Date(end.getTime() - DAYS * 86400000)
const iso = (d) => d.toISOString().slice(0, 10)
const startDate = iso(start)
const endDate = iso(end)

const mlbIds = new Set(
  ((await getJson('/api/v1/teams?sportId=1')).teams ?? []).map((t) => t.id),
)
console.log(`MLB clubs: ${mlbIds.size}`)
console.log(`window ${startDate} .. ${endDate} (${DAYS} days)`)

const raw = (await getJson(`/api/v1/transactions?startDate=${startDate}&endDate=${endDate}`)).transactions ?? []
console.log(`raw rows: ${raw.length}\n`)

const touchesMlb = (t) => mlbIds.has(t.fromTeam?.id) || mlbIds.has(t.toTeam?.id)
const twoMlbClubs = (t) =>
  mlbIds.has(t.fromTeam?.id) && mlbIds.has(t.toTeam?.id) && t.fromTeam.id !== t.toTeam.id
const sample = (rows, n = 6) =>
  rows.slice(0, n).map((t) => `      ${txnDate(t)} [${t.typeCode}] ${t.description}`).join('\n')

// -- Q1/Q2: the arrival family, and every code's two-MLB-club count -----------
console.log('=== Q1/Q2: which codes name TWO different MLB clubs? ===')
const byCode = new Map()
for (const t of raw) {
  if (!byCode.has(t.typeCode)) byCode.set(t.typeCode, [])
  byCode.get(t.typeCode).push(t)
}
const codeRows = [...byCode.entries()]
  .map(([code, rows]) => ({
    code,
    typeDesc: rows[0].typeDesc,
    all: rows.length,
    mlb: rows.filter(touchesMlb).length,
    two: rows.filter(twoMlbClubs).length,
    rows,
  }))
  .sort((a, b) => b.all - a.all)
console.log('  code  typeDesc                     all    mlb   2-MLB')
for (const c of codeRows) {
  console.log(
    `  ${c.code.padEnd(5)} ${String(c.typeDesc).padEnd(28)} ${String(c.all).padStart(5)}  ${String(c.mlb).padStart(5)}  ${String(c.two).padStart(5)}`,
  )
}

console.log('\n--- ACQ family (ACQ/OBT/PUR/CP) verbatim ---')
for (const code of ['ACQ', 'OBT', 'PUR', 'CP', 'WA']) {
  const c = codeRows.find((x) => x.code === code)
  if (!c) {
    console.log(`  ${code}: ABSENT from this window`)
    continue
  }
  console.log(`  ${code}: ${c.all} rows, ${c.mlb} MLB-touching, ${c.two} naming two MLB clubs`)
  console.log(sample(c.rows.filter(touchesMlb), 8) || '      (none MLB-touching)')
  const shapes = new Map()
  for (const t of c.rows) {
    const k = `from=${t.fromTeam ? (mlbIds.has(t.fromTeam.id) ? 'MLB' : 'non-MLB') : 'none'} to=${t.toTeam ? (mlbIds.has(t.toTeam.id) ? 'MLB' : 'non-MLB') : 'none'}`
    shapes.set(k, (shapes.get(k) ?? 0) + 1)
  }
  console.log(`      shapes: ${[...shapes].map(([k, n]) => `${k} ×${n}`).join(', ')}`)
}

// -- Q3: plain activations ----------------------------------------------------
console.log('\n=== Q3: plain activations (SC + /activat/i, no IL wording) ===')
const activations = raw.filter(
  (t) => t.typeCode === 'SC' && /activat/i.test(t.description || ''),
)
const plain = activations.filter((t) => !mentionsInjuredList(t))
const plainMlb = plain.filter(touchesMlb)
console.log(`  all SC activations: ${activations.length}`)
console.log(`  ...with IL wording (already kept): ${activations.length - plain.length}`)
console.log(`  ...plain (today dropped): ${plain.length}, of which MLB-touching: ${plainMlb.length}`)

// Which list, if any, does a plain activation name?
const listOf = (t) => {
  const d = t.description || ''
  const m = d.match(/from the ([a-z0-9- ]*?)\s*list\b/i)
  if (m) return m[1].trim().toLowerCase() + ' list'
  if (/all-stars? activated/i.test(d)) return '(all-star sweep)'
  if (/\bfrom\b/i.test(d)) return `(other "from": ${d.match(/\bfrom\b.{0,40}/i)?.[0]})`
  return '(no source named)'
}
const buckets = new Map()
for (const t of plainMlb) {
  const k = listOf(t)
  if (!buckets.has(k)) buckets.set(k, [])
  buckets.get(k).push(t)
}
console.log('\n  MLB-touching plain activations, by what the sentence names:')
for (const [k, rows] of [...buckets].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n    ${String(rows.length).padStart(4)}  ${k}`)
  console.log(sample(rows, 4))
}

// -- Q4: same-day double-arrival ----------------------------------------------
console.log('\n=== Q4: same club-day, same person — a plain activation next to another kept row ===')
const SIGNING = new Set(['SFA', 'SGN', 'IFA'])
const keyOf = (t) => `${txnDate(t)}|${t.person?.id ?? '?'}`
const byPersonDay = new Map()
for (const t of raw.filter(touchesMlb)) {
  const k = keyOf(t)
  if (!byPersonDay.has(k)) byPersonDay.set(k, [])
  byPersonDay.get(k).push(t)
}
let pairs = 0
const shown = []
for (const rows of byPersonDay.values()) {
  const act = rows.find((t) => plainMlb.includes(t))
  if (!act) continue
  const other = rows.find((t) => t !== act && (SIGNING.has(t.typeCode) || t.typeCode === 'CU' || t.typeCode === 'SE'))
  if (!other) continue
  pairs += 1
  if (shown.length < 8) shown.push(`      ${txnDate(act)} ${act.person?.fullName}\n        [${other.typeCode}] ${other.description}\n        [SC]  ${act.description}`)
}
console.log(`  ${pairs} person-days pair a plain activation with a signing/recall/selection`)
console.log(shown.join('\n'))

// -- Q5: the non-IL roster lists ---------------------------------------------
// The IL predicates gate on mentionsInjuredList, so the paternity, bereavement
// and restricted lists are dropped in BOTH directions today. Unlike a bare
// activation they name their list, so they neither echo an arrival nor read
// ambiguously. Census both halves.
console.log('\n=== Q5: the non-IL roster lists (paternity / bereavement / restricted) ===')
const LISTS = ['paternity', 'bereavement', 'restricted', 'family medical']
for (const list of LISTS) {
  const re = new RegExp(`${list}\\s*(emergency\\s*)?list`, 'i')
  const rows = raw.filter((t) => t.typeCode === 'SC' && re.test(t.description || '') && touchesMlb(t))
  const placed = rows.filter((t) => /placed/i.test(t.description || ''))
  const activated = rows.filter((t) => /activat/i.test(t.description || ''))
  const other = rows.filter((t) => !placed.includes(t) && !activated.includes(t))
  console.log(`\n  ${list}: ${rows.length} MLB rows — ${placed.length} placed, ${activated.length} activated, ${other.length} other`)
  console.log(sample([...placed.slice(0, 2), ...activated.slice(0, 2), ...other.slice(0, 2)], 6) || '      (none)')
}
