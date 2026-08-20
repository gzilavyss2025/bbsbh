// Probe for issue #772 segment 3, part three — the retroactive injured-list
// placement, and which date a 48-hour window should select on.
//
// The wire's negative effectiveDate skew turns out to be one thing: an IL
// placement filed on one day and backdated to another ("placed RHP Drey
// Jameson on the 15-day injured list retroactive to July 20"). `txnDate`
// reads `effectiveDate || date`, so the grouper files that story under the
// backdated day — which is right for a season-long team page and possibly
// wrong for a card claiming "the last 48 hours", where a move announced this
// morning can land outside the window it was announced in.
//
//   Q9   How many storyworthy MLB stories does a txnDate window miss that a
//        filed-date window would catch? Per 48 hours, over a month.
//   Q10  What are they — is the miss all retroactive IL, or something else?
//   Q11  What would a filed-date window cost in return: how many stories
//        would carry a dateline older than the window it appears in?
//
// Runs off the caches probe-card-fetch.mjs and probe-card-shape.mjs write.
// Run: node .scratch/home-transactions/probe-retro-il.mjs
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { groupLeagueWide } from '../../src/api/transactions/league.js'
import MLB_COLORS from '../../src/lib/data/mlb-team-colors.json' with { type: 'json' }
import AFFILIATES from '../../public/data/affiliates.json' with { type: 'json' }

const here = dirname(fileURLToPath(import.meta.url))
const { today, wide } = JSON.parse(readFileSync(join(here, 'card-fetch-window.json'), 'utf8'))
const people = JSON.parse(readFileSync(join(here, 'card-people.json'), 'utf8')).twoPass

const mlbTeamIds = Object.keys(MLB_COLORS).map(Number)
const affilToOrg = new Map()
for (const [orgId, clubs] of Object.entries(AFFILIATES.byOrgId ?? {})) {
  for (const c of clubs) if (c.id != null) affilToOrg.set(c.id, Number(orgId))
}
const ctx = {
  mlbTeamIds,
  affilToOrg,
  positions: people.positions,
  debutedIds: new Set(people.debuted),
}

const dayShift = (s, n) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}
const text = (s) => (s.cutline ?? []).map((x) => x.text).join('')

// Everything the wire had filed by `end`, which is all a live card can see.
const filedBy = (end) => wide.filter((t) => (t.date ?? '') <= end)

// Measured on ROWS, not stories. A story carries only its effective date, so
// asking "when was this story filed" needs plumbing that does not exist; a row
// carries both dates, and a row is what would have to enter the window in the
// first place. The rows counted here are the ones that survive the real
// ownership + dedupe + storyworthy pass, so nothing minor-league or filtered
// is being counted as a loss.
function keptRows(end) {
  // groupLeagueWide only returns shaped stories, so re-run the filter the same
  // way it does, and keep the rows.
  const rows = filedBy(end)
  const kept = []
  const days = groupLeagueWide(rows, ctx)
  const dayHasStories = new Set(days.filter((d) => d.stories.length).map((d) => d.date))
  for (const t of rows) {
    const eff = t.effectiveDate || t.date || ''
    if (dayHasStories.has(eff)) kept.push(t)
  }
  return kept
}

// A row that is IN a filed-date window but OUT of the effective-date one is a
// move the wire announced inside the last 48 hours whose effect is dated
// earlier — the retroactive case.
const ilPlacement = (t) => t.typeCode === 'SC' && /injured list/i.test(t.description || '')

console.log('== Q9  rows the txnDate window drops that a filed-date window keeps ==')
console.log('end          kept-rows  in-by-filed  in-by-effective  dropped  of those, IL')
let totalDropped = 0
let windowCount = 0
const dropped = []
for (let k = 0; k < 22; k += 1) {
  const end = dayShift(today, -k)
  const start = dayShift(end, -1)
  if (start < dayShift(today, -29)) break
  const rows = keptRows(end)
  const inFiled = rows.filter((t) => (t.date ?? '') >= start && (t.date ?? '') <= end)
  const inEff = rows.filter((t) => {
    const e = t.effectiveDate || t.date || ''
    return e >= start && e <= end
  })
  const miss = inFiled.filter((t) => {
    const e = t.effectiveDate || t.date || ''
    return e < start || e > end
  })
  totalDropped += miss.length
  windowCount += 1
  for (const t of miss) dropped.push({ end, t })
  console.log(
    `${end}   ${String(rows.length).padStart(9)}  ${String(inFiled.length).padStart(11)}  ` +
    `${String(inEff.length).padStart(15)}  ${String(miss.length).padStart(7)}  ` +
    `${String(miss.filter(ilPlacement).length).padStart(12)}`,
  )
}
console.log(
  `\nover ${windowCount} windows: ${totalDropped} rows dropped ` +
  `(${(totalDropped / windowCount).toFixed(1)} per 48h)`,
)

console.log('\n== Q10  what they are ==')
const byCode = new Map()
for (const { t } of dropped) byCode.set(t.typeCode, (byCode.get(t.typeCode) ?? 0) + 1)
console.log([...byCode.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '))
const retro = dropped.filter(({ t }) => /retroactive/i.test(t.description || '')).length
console.log(`of ${dropped.length} dropped rows, ${retro} say "retroactive"`)
console.log('\nfirst 10, with how far the effect predates the filing:')
for (const { end, t } of dropped.slice(0, 10)) {
  console.log(`  card ${end}  filed ${t.date} -> effective ${t.effectiveDate}  ${(t.description || '').slice(0, 82)}`)
}
void text
