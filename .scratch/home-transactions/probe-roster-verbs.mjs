// Checks the roster-vocabulary claims against a full season, so an explanation
// of what these verbs mean rests on the wire's own behaviour, not memory.
// Run: node .scratch/home-transactions/probe-roster-verbs.mjs
import { fetchContext, fetchWire, buildFeed, iso } from './wire.mjs'

const today = new Date()
const season = today.getUTCFullYear()
const start = `${season}-03-25`
const end = iso(today)

const ctx = await fetchContext(season)
const fetched = await fetchWire(start, end)
const base = buildFeed(fetched, ctx, start, end)
const feed = base.feed
console.log(`${feed.length} MLB-involving lines, ${start} .. ${end}\n`)

const has = (l, re) => re.test(l.description || '')
const byCode = (code) => feed.filter((l) => l.typeCode === code)

// --- 1. Signings: does the wire distinguish a major-league deal? ------------
const sfa = feed.filter((l) => l.typeCode === 'SFA' || l.typeCode === 'SGN')
const minorDeal = sfa.filter((l) => has(l, /minor league contract/i))
const noQualifier = sfa.filter((l) => !has(l, /minor league contract/i))
console.log('--- signings (SFA + SGN) ---')
console.log(`total ${sfa.length}`)
console.log(`  says "to a minor league contract": ${minorDeal.length}`)
console.log(`  no qualifier:                      ${noQualifier.length}`)

// Does a signing get an activation the same day at the same club?
const key = (l) => `${l.date}|${l.club?.id}|${l.personId}`
const activations = new Map()
for (const l of feed) {
  if (l.typeCode === 'SC' && has(l, /activat/i)) activations.set(key(l), l)
}
const withAct = (list) => list.filter((l) => activations.has(key(l))).length
console.log(`  minor-league deals with a same-day activation: ${withAct(minorDeal)} of ${minorDeal.length}`)
console.log(`  unqualified deals with a same-day activation:  ${withAct(noQualifier)} of ${noQualifier.length}`)
console.log('\n  sample unqualified signings that DID activate same day:')
for (const l of noQualifier.filter((x) => activations.has(key(x))).slice(-4)) {
  console.log(`    ${l.date}  ${l.description}`)
  console.log(`              ${activations.get(key(l)).description}`)
}
console.log('\n  sample unqualified signings that did NOT:')
for (const l of noQualifier.filter((x) => !activations.has(key(x))).slice(-4)) {
  console.log(`    ${l.date}  ${l.description}`)
}

// --- 2. Recalled vs selected ----------------------------------------------
console.log('\n--- recalled (CU) vs selected (SE) ---')
console.log(`recalled ${byCode('CU').length}, selected ${byCode('SE').length}`)
const clubDay = new Map()
for (const l of feed) {
  const k = `${l.date}|${l.club?.id}`
  if (!clubDay.has(k)) clubDay.set(k, [])
  clubDay.get(k).push(l)
}
// A 40-man spot has to come from somewhere. Does a selection coincide with one
// being opened, more often than a recall does?
const CLEARS = (l) =>
  l.typeCode === 'DES' || l.typeCode === 'OUT' || l.typeCode === 'REL' ||
  (l.typeCode === 'SC' && /transferred/i.test(l.description || '') && /60-day/i.test(l.description || ''))
const coincidence = (code) => {
  const rows = byCode(code)
  const withClear = rows.filter((l) => (clubDay.get(`${l.date}|${l.club?.id}`) ?? []).some((o) => o !== l && CLEARS(o)))
  return { total: rows.length, withClear: withClear.length, pct: rows.length ? ((withClear.length / rows.length) * 100).toFixed(0) : '0' }
}
for (const code of ['SE', 'CU', 'CLW']) {
  const r = coincidence(code)
  console.log(`  ${code}: ${r.withClear} of ${r.total} (${r.pct}%) share a club-day with a 40-man-clearing move`)
}

// --- 3. Optioned vs designated vs outrighted ------------------------------
console.log('\n--- ways down ---')
for (const code of ['OPT', 'DES', 'OUT', 'REL']) {
  console.log(`  ${code}: ${byCode(code).length}`)
}
// An outright often ends in the player electing free agency.
const dfa = feed.filter((l) => l.typeCode === 'DFA')
const outs = byCode('OUT')
const outsWithElection = outs.filter((l) => dfa.some((e) => e.personId === l.personId && e.date === l.date))
console.log(`  outrights whose player elected free agency the same day: ${outsWithElection.length} of ${outs.length}`)
// Does a DFA resolve into an outright/release/trade later?
const desResolved = byCode('DES').filter((l) =>
  feed.some((o) => o.personId === l.personId && o.date > l.date &&
    ['OUT', 'REL', 'TR', 'CLW'].includes(o.typeCode)))
console.log(`  designations followed later by an outright, release, trade or claim: ${desResolved.length} of ${byCode('DES').length}`)

// --- 4. The injured list as a roster tool ---------------------------------
console.log('\n--- injured list ---')
const il = feed.filter((l) => l.typeCode === 'SC' && /injured list/i.test(l.description || ''))
const placed = il.filter((l) => has(l, /placed/i))
const transferred = il.filter((l) => has(l, /transferred/i))
const activated = il.filter((l) => has(l, /activat/i))
console.log(`  placed on an IL: ${placed.length}`)
for (const days of ['7-day', '10-day', '15-day', '60-day']) {
  console.log(`     ${days}: ${placed.filter((l) => has(l, new RegExp(days, 'i'))).length}`)
}
console.log(`  transferred between ILs: ${transferred.length} (of which name the 60-day: ${transferred.filter((l) => has(l, /60-day/i)).length})`)
console.log(`  activated off an IL: ${activated.length}`)

// --- 5. Every distinct verb the wire uses on an MLB-involving line ---------
console.log('\n--- every verb phrase, by frequency ---')
const verbs = new Map()
for (const l of feed) {
  const d = (l.description || '')
  // Strip the leading club name and the "{POS} {Name}" token to leave the verb.
  const m = d.match(/\b(recalled|optioned|selected the contract of|designated .* for assignment|sent .* outright|released|signed free agent|signed|claimed .* off waivers|traded|acquired|obtain(?:ed)?|purchased|activated|placed .* on the [\w-]+ (?:injured|restricted|paternity|bereavement|family medical emergency) list|transferred .* to the [\w-]+ injured list|reassigned .* to the minor leagues|roster status changed|elected free agency|retired|suspended|changed number|returned|loaned|sent .* on a rehab assignment|assigned)\b/i)
  const v = m ? m[1].toLowerCase().replace(/\s+/g, ' ').replace(/ .*? for assignment/, ' … for assignment').replace(/ .*? outright/, ' … outright').replace(/ .*? off waivers/, ' … off waivers').replace(/ .*? on the/, ' … on the').replace(/ .*? to the/, ' … to the').replace(/ .*? on a rehab/, ' … on a rehab') : '(unmatched)'
  verbs.set(v, (verbs.get(v) ?? 0) + 1)
}
for (const [v, ct] of [...verbs].sort((a, b) => b[1] - a[1])) console.log(`  ${String(ct).padStart(5)}  ${v}`)
