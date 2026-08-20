// Probe for issue #772 segment 3 — the home card's LIVE fetch, measured
// before any of it is written into src/.
//
// Segment 2 settled what the pass returns. This one settles what a browser
// has to fetch on page load to feed it, and how long that costs. Five
// questions:
//
//   Q1  effectiveDate skew — the wire has no clock and `txnDate` reads
//       `effectiveDate || date`, but the endpoint's own startDate/endDate
//       filter on something. Which, how far do the two drift apart, and in
//       which direction? That decides how much wider than 48 hours to fetch.
//   Q2  The /people call — it is the one fetch that cannot start until the
//       transactions call lands, so it sets the chain's depth. How many ids
//       does a naive prefilter ask for, and how many does a two-pass one
//       (filter with no debut set first, fetch only the survivors) ask for?
//   Q3  Wall time of the whole chain at several window widths.
//   Q4  The affiliate parent map: the app already ships a static
//       public/data/affiliates.json (120 clubs, the four full-season levels).
//       The generator fetches a live one (291, incl. complex/DSL). What does
//       the difference cost in stories?
//   Q5  How many stories a real 48 hours actually holds, day by day, over the
//       last month — the number the card's layout has to survive.
//
// Run: node .scratch/home-transactions/probe-card-fetch.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getJson } from '../../src/api/statsapi.js'
import { txnDate } from '../../src/api/rehab-policy.js'
import { dedupeTransactions, filterStoryworthy } from '../../src/api/teamTransactions.js'
import { assignRowOwners, groupLeagueWide } from '../../src/api/transactions/league.js'
import MLB_COLORS from '../../src/lib/data/mlb-team-colors.json' with { type: 'json' }
import AFFILIATES from '../../public/data/affiliates.json' with { type: 'json' }

const here = dirname(fileURLToPath(import.meta.url))
const iso = (d) => d.toISOString().slice(0, 10)
const dayShift = (isoStr, n) => {
  const [y, m, d] = isoStr.split('-').map(Number)
  return iso(new Date(Date.UTC(y, m - 1, d + n)))
}
const today = iso(new Date())
const season = Number(today.slice(0, 4))

// The 30 club ids the app already ships, no fetch at all.
const mlbTeamIds = Object.keys(MLB_COLORS).map(Number)

// The static affiliate map the app already ships (four full-season levels).
const staticAffilToOrg = new Map()
for (const [orgId, clubs] of Object.entries(AFFILIATES.byOrgId ?? {})) {
  for (const c of clubs) if (c.id != null) staticAffilToOrg.set(c.id, Number(orgId))
}

console.log(`today ${today} - ${mlbTeamIds.length} clubs, static affiliate map ${staticAffilToOrg.size}\n`)

// ---------------------------------------------------------------------------
// Q1 - effectiveDate skew: which date does the endpoint filter on?
// ---------------------------------------------------------------------------
console.log('== Q1  effectiveDate skew ==')
const skewStart = dayShift(today, -30)
const t0 = Date.now()
const wide = (await getJson(`/api/v1/transactions?startDate=${skewStart}&endDate=${today}`)).transactions ?? []
console.log(`30-day pull ${skewStart}..${today}: ${wide.length} rows in ${Date.now() - t0}ms`)

let differ = 0
const skewHist = new Map()
let outsideByDate = 0
let outsideByEff = 0
for (const t of wide) {
  const d = t.date ?? ''
  const e = t.effectiveDate ?? ''
  if (e && e !== d) {
    differ += 1
    const [ay, am, ad] = d.split('-').map(Number)
    const [by, bm, bd] = e.split('-').map(Number)
    const days = Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
    skewHist.set(days, (skewHist.get(days) ?? 0) + 1)
  }
  if (d && (d < skewStart || d > today)) outsideByDate += 1
  const td = txnDate(t)
  if (td && (td < skewStart || td > today)) outsideByEff += 1
}
console.log(`rows whose effectiveDate differs from date: ${differ} of ${wide.length}`)
console.log('skew (effectiveDate - date, in days) -> rows:')
for (const [k, v] of [...skewHist.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`  ${k > 0 ? '+' : ''}${k}: ${v}`)
}
console.log(`rows with .date outside the requested window:   ${outsideByDate}  <- what the endpoint filters on`)
console.log(`rows with txnDate outside the requested window: ${outsideByEff}  <- what the grouper buckets by`)

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
async function fetchPeople(ids) {
  const list = [...new Set(ids.filter(Boolean))]
  const positions = {}
  const debutedIds = new Set()
  let calls = 0
  for (let i = 0; i < list.length; i += 100) {
    const batch = list.slice(i, i + 100)
    if (!batch.length) continue
    const data = await getJson(`/api/v1/people?personIds=${batch.join(',')}`)
    calls += 1
    for (const p of data.people ?? []) {
      positions[p.id] = p.primaryPosition?.abbreviation || ''
      if (p.mlbDebutDate) debutedIds.add(p.id)
    }
  }
  return { positions, debutedIds, calls, asked: list.length }
}

// The two candidate prefilters for WHICH person ids the page has to resolve.
function naiveIds(rows, affilToOrg) {
  const orgSet = new Set(mlbTeamIds)
  const touches = (t) => [t.fromTeam?.id, t.toTeam?.id]
    .filter((id) => id != null)
    .some((id) => orgSet.has(id) || affilToOrg.has(id))
  return [...new Set(rows.filter(touches).map((t) => t.person?.id).filter(Boolean))]
}
// Two-pass: run the real ownership + dedupe + storyworthy filter with NO
// debut set (which only ever SUPPRESSES, so this is a superset), and ask
// only about the survivors.
function twoPassIds(rows, affilToOrg) {
  const byOrg = new Map()
  for (const [row, orgId] of assignRowOwners(rows, { mlbTeamIds, affilToOrg })) {
    if (!byOrg.has(orgId)) byOrg.set(orgId, [])
    byOrg.get(orgId).push(row)
  }
  const ids = new Set()
  for (const [orgId, orgRows] of byOrg) {
    for (const t of filterStoryworthy(dedupeTransactions(orgRows), { orgId })) {
      if (t.person?.id != null) ids.add(t.person.id)
    }
  }
  return [...ids]
}

console.log('\n== Q2  the /people call - how many ids ==')
const naive30 = naiveIds(wide, staticAffilToOrg)
const two30 = twoPassIds(wide, staticAffilToOrg)
console.log(`30-day window: naive ${naive30.length} ids (${Math.ceil(naive30.length / 100)} calls), two-pass ${two30.length} ids (${Math.ceil(two30.length / 100)} calls)`)

const people30 = await fetchPeople(naive30)
console.log(`resolved ${Object.keys(people30.positions).length} people in ${people30.calls} calls; ${people30.debutedIds.size} have an mlbDebutDate`)

const ctx30 = {
  mlbTeamIds,
  affilToOrg: staticAffilToOrg,
  positions: people30.positions,
  debutedIds: people30.debutedIds,
}

console.log('\n== Q5  stories per day, league-wide ==')
const days30 = groupLeagueWide(wide, ctx30)
for (const day of days30.slice(0, 20)) {
  console.log(`  ${day.date}  ${String(day.stories.length).padStart(3)} stories`)
}
console.log('\nrolling 48h (a day and the one before it):')
for (let i = 0; i + 1 < Math.min(days30.length, 16); i += 1) {
  const a = days30[i]
  const b = days30[i + 1]
  const contiguous = dayShift(a.date, -1) === b.date
  const n = a.stories.length + (contiguous ? b.stories.length : 0)
  console.log(`  ${a.date} + ${contiguous ? b.date : '(gap)'} = ${n}`)
}

// ---------------------------------------------------------------------------
// Q4 - static affiliate map vs the generator's live one
// ---------------------------------------------------------------------------
console.log('\n== Q4  affiliate map: static (shipped) vs live vs none ==')
const liveAffil = await getJson(`/api/v1/teams/affiliates?teamIds=${mlbTeamIds.join(',')}&season=${season}`)
const liveAffilToOrg = new Map()
for (const t of liveAffil.teams ?? []) {
  if (t.id != null && t.parentOrgId != null) liveAffilToOrg.set(t.id, t.parentOrgId)
}
const count = (m) => groupLeagueWide(wide, { ...ctx30, affilToOrg: m }).reduce((n, d) => n + d.stories.length, 0)
console.log(`live map   (${liveAffilToOrg.size} clubs): ${count(liveAffilToOrg)} stories`)
console.log(`static map (${staticAffilToOrg.size} clubs): ${count(staticAffilToOrg)} stories`)
console.log(`no map:                    ${count(new Map())} stories`)
console.log(`no debut set (static map): ${groupLeagueWide(wide, { ...ctx30, debutedIds: null }).reduce((n, d) => n + d.stories.length, 0)} stories`)

// ---------------------------------------------------------------------------
// Q3 - the real chain, at several window widths
// ---------------------------------------------------------------------------
console.log('\n== Q3  the page-load chain, timed ==')
console.log('width  rows  ids  peopleCalls  txnMs  peopleMs  totalMs  stories(48h)')
for (const width of [2, 3, 4, 5, 7]) {
  const start = dayShift(today, -(width - 1))
  const a = Date.now()
  const rows = (await getJson(`/api/v1/transactions?startDate=${start}&endDate=${today}`)).transactions ?? []
  const txnMs = Date.now() - a
  const ids = twoPassIds(rows, staticAffilToOrg)
  const b = Date.now()
  const people = await fetchPeople(ids)
  const peopleMs = Date.now() - b
  const days = groupLeagueWide(rows, {
    mlbTeamIds,
    affilToOrg: staticAffilToOrg,
    positions: people.positions,
    debutedIds: people.debutedIds,
  })
  const cut = dayShift(today, -1)
  const n48 = days.filter((d) => d.date >= cut).reduce((n, d) => n + d.stories.length, 0)
  console.log(
    `${String(width).padStart(5)}  ${String(rows.length).padStart(4)}  ${String(ids.length).padStart(3)}  ` +
    `${String(people.calls).padStart(11)}  ${String(txnMs).padStart(5)}  ${String(peopleMs).padStart(8)}  ` +
    `${String(txnMs + peopleMs).padStart(7)}  ${String(n48).padStart(12)}`,
  )
}

writeFileSync(join(here, 'card-fetch-window.json'), JSON.stringify({ today, skewStart, wide }))
console.log('\ncached the 30-day pull in card-fetch-window.json')
