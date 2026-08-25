// Join the transaction wire to every Triple-A stay's end, so "why did this
// stay end" stops being inferred purely from a level change and starts being
// read off the actual roster move - and so the incumbent's own exit (hurt,
// DFA'd, traded, released) can explain why the door opened.
//
// Rows in txn-season-cache.json are NOT ordered deterministically (the wire
// itself returns a day's transactions in arbitrary, run-to-run-different
// order - PR #836). Sort by id before anything else so this join is stable.
import { readFileSync, writeFileSync } from 'node:fs'

const stays = JSON.parse(readFileSync('stays.json', 'utf8'))
const txnCache = JSON.parse(readFileSync('txn-season-cache.json', 'utf8'))

const allTxns = []
for (const rows of Object.values(txnCache)) allTxns.push(...rows)
allTxns.sort((a, b) => a.id - b.id)

const byPerson = new Map()
for (const t of allTxns) {
  if (t.p == null) continue
  if (!byPerson.has(t.p)) byPerson.set(t.p, [])
  byPerson.get(t.p).push(t)
}
for (const list of byPerson.values()) {
  list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id))
}

const dayMs = 86400000
function daysBetween(a, b) {
  return (new Date(b) - new Date(a)) / dayMs
}

const PROMOTE = new Set(['SE', 'CU', 'CP'])
const DEMOTE = new Set(['OPT', 'OUT'])

// The prospect's own event: what actually happened to him within a few days
// of the stay's endDate. Matched on the wire's `date` field, not
// `effectiveDate` - a live check found effectiveDate can point at an
// unrelated later resolution (one Selected transaction's `date` was 3 days
// before the debut it explains; its `effectiveDate` was SEVEN MONTHS later).
// Switching the match key from effectiveDate to date took the match rate
// from 659/962 to 919/962 on this same cohort.
function prospectEvent(playerId, endDate) {
  const list = byPerson.get(playerId) || []
  let best = null
  let bestAbs = Infinity
  // -14..+5 confirmed against the actual data: every non-debut stay-end
  // matches inside this window (median offset 0, p10 -2, p90 +1 days) - a
  // recall transaction can run several days ahead of a first game back.
  for (const t of list) {
    const d = daysBetween(endDate, t.date)
    if (d < -14 || d > 5) continue
    if (!PROMOTE.has(t.code) && !DEMOTE.has(t.code) && t.code !== 'TR' && t.code !== 'REL' && t.code !== 'RET') continue
    const abs = Math.abs(d)
    if (abs < bestAbs) { bestAbs = abs; best = t }
  }
  if (!best) {
    // Every miss in this window turns out to be a player's literal MLB
    // debut (endDate === debutDate) whose 40-man add happened long before -
    // a Rule 5 protection, an earlier callup that was never reversed, a
    // trade with a promotion attached, etc. (median gap in a live check:
    // 113 days, up to 5+ years). That is not "no data" - it means the
    // roster decision was already made and the debut itself is not the
    // event. Distinguish that from a genuine gap in wire coverage.
    let earliest = null
    for (const t of list) {
      if (!PROMOTE.has(t.code)) continue
      const d = daysBetween(endDate, t.date)
      if (d > 5) continue
      if (!earliest || d > daysBetween(endDate, earliest.date)) earliest = t
    }
    if (earliest) return { kind: 'settledEarlier', date: earliest.date, desc: earliest.desc, code: earliest.code }
    return { kind: 'unmatched', date: null, desc: null, code: null }
  }
  const kind = PROMOTE.has(best.code) ? 'promoted'
    : DEMOTE.has(best.code) ? 'demoted'
    : best.code === 'TR' ? 'traded'
    : best.code === 'REL' ? 'released'
    : 'retired'
  return { kind, date: best.date, desc: best.desc, code: best.code }
}

// Did the incumbent's own status change explain the opening? Look in the
// three weeks before the stay ends (an IL placement or DFA typically
// precedes the callup it causes by a few days, sometimes longer over a
// weekend), through two days after (paperwork can lag the roster move).
function incumbentEvent(incId, orgId, endDate) {
  if (!incId) return { kind: 'none', date: null, desc: null, code: null }
  const list = byPerson.get(incId) || []
  let best = null
  let bestAbs = Infinity
  for (const t of list) {
    const d = daysBetween(t.date, endDate) // positive = before endDate
    if (d < -2 || d > 21) continue
    if (t.to !== orgId && t.from !== orgId) continue
    let kind = null
    if (t.code === 'SC') {
      if (/\b(disabled|injured) list\b/i.test(t.desc) && !/activated/i.test(t.desc)) kind = 'IL'
      else continue
    } else if (t.code === 'DES') kind = 'DFA'
    else if (t.code === 'TR') kind = 'traded'
    else if (t.code === 'REL') kind = 'released'
    else if (t.code === 'RET') kind = 'retired'
    else if (t.code === 'CLW') kind = 'waivers'
    else continue
    const abs = Math.abs(d)
    if (abs < bestAbs) { bestAbs = abs; best = { ...t, kind } }
  }
  if (!best) return { kind: 'none', date: null, desc: null, code: null }
  return { kind: best.kind, date: best.date, desc: best.desc, code: best.code }
}

function classify(pe, ie, endDate) {
  if (pe.kind === 'demoted') return 'demoted'
  if (pe.kind === 'traded') return 'traded'
  if (pe.kind === 'released' || pe.kind === 'retired') return 'left'
  if (pe.kind === 'unmatched') return 'unresolved'
  // He was already on the active/40-man roster well before this debut - the
  // roster decision predates the stay's end and the incumbent's fortunes
  // right around the debut are not what explains it either way.
  if (pe.kind === 'settledEarlier') return 'settledEarlier'
  // pe.kind === 'promoted'
  if (ie.kind === 'IL') return 'injury'
  if (ie.kind === 'DFA' || ie.kind === 'traded' || ie.kind === 'released' || ie.kind === 'retired' || ie.kind === 'waivers') return 'rosterRule'
  if (endDate.slice(5) >= '09-01') return 'rosterRule'
  return 'merit'
}

const exits = {}
const counts = {}
for (const s of stays) {
  const pe = prospectEvent(s.playerId, s.endDate)
  const ie = incumbentEvent(s.job && s.job.id, s.orgId, s.endDate)
  const reason = classify(pe, ie, s.endDate)
  counts[reason] = (counts[reason] || 0) + 1
  const key = `${s.playerId}:${s.season}:${s.endDate}`
  exits[key] = {
    prospectEvent: pe.kind, prospectEventCode: pe.code, prospectEventDate: pe.date, prospectEventDesc: pe.desc,
    incumbentEvent: ie.kind, incumbentEventCode: ie.code, incumbentEventDate: ie.date, incumbentEventDesc: ie.desc,
    exitReason: reason,
  }
}

console.log(`joined ${stays.length} stays`)
console.log('exit reason counts:', JSON.stringify(counts, null, 2))

// Sanity: how far off is the matched prospect transaction date from endDate,
// for the stays that DID match? A wide spread would mean the window is
// papering over a bad join, not a good one.
const offsets = []
for (const s of stays) {
  const key = `${s.playerId}:${s.season}:${s.endDate}`
  const e = exits[key]
  if (e.prospectEventDate) offsets.push(daysBetween(s.endDate, e.prospectEventDate))
}
offsets.sort((a, b) => a - b)
console.log(`prospect-event offset from endDate (days): n=${offsets.length}, median=${offsets[Math.floor(offsets.length / 2)]}, min=${offsets[0]}, max=${offsets[offsets.length - 1]}`)

writeFileSync('exits.json', JSON.stringify(exits, null, 2))
console.log('wrote exits.json')
