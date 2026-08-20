// Probe for issue #772 segment 3, part two — how WIDE the card's fetch has to
// be, and what the 48 hours it produces actually looks like.
//
// Runs entirely off probe-card-fetch.mjs's cached 30-day pull
// (card-fetch-window.json), so it costs one /people pass and nothing else.
//
//   Q6  Fetch width, backtested. For every 48-hour window in the month, does
//       a narrow fetch (N days, trimmed by txnDate) name the same stories a
//       30-day fetch trimmed the same way does? The endpoint filters on
//       `date`; the grouper buckets by `effectiveDate || date`, so a row
//       effective today can have been filed weeks ago.
//   Q7  Two-pass /people equivalence — does asking about only the rows that
//       survive a no-debut-set filter build byte-identical stories?
//   Q8  The shape the card has to lay out: stories per club, per type, rail
//       sizes, cutline lengths, and the worst day of the month.
//
// Run: node .scratch/home-transactions/probe-card-shape.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getJson } from '../../src/api/statsapi.js'
import { txnDate } from '../../src/api/rehab-policy.js'
import { dedupeTransactions, filterStoryworthy } from '../../src/api/teamTransactions.js'
import { assignRowOwners, groupLeagueWide } from '../../src/api/transactions/league.js'
import MLB_COLORS from '../../src/lib/data/mlb-team-colors.json' with { type: 'json' }
import AFFILIATES from '../../public/data/affiliates.json' with { type: 'json' }

const here = dirname(fileURLToPath(import.meta.url))
const cachePath = join(here, 'card-fetch-window.json')
if (!existsSync(cachePath)) {
  console.error('run probe-card-fetch.mjs first — it caches the 30-day pull')
  process.exit(1)
}
const { today, wide } = JSON.parse(readFileSync(cachePath, 'utf8'))

const iso = (d) => d.toISOString().slice(0, 10)
const dayShift = (s, n) => {
  const [y, m, d] = s.split('-').map(Number)
  return iso(new Date(Date.UTC(y, m - 1, d + n)))
}

const mlbTeamIds = Object.keys(MLB_COLORS).map(Number)
const affilToOrg = new Map()
for (const [orgId, clubs] of Object.entries(AFFILIATES.byOrgId ?? {})) {
  for (const c of clubs) if (c.id != null) affilToOrg.set(c.id, Number(orgId))
}

function candidateIds(rows) {
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

async function fetchPeople(ids) {
  const list = [...new Set(ids.filter(Boolean))]
  const positions = {}
  const debutedIds = new Set()
  for (let i = 0; i < list.length; i += 100) {
    const batch = list.slice(i, i + 100)
    if (!batch.length) continue
    const data = await getJson(`/api/v1/people?personIds=${batch.join(',')}`)
    for (const p of data.people ?? []) {
      positions[p.id] = p.primaryPosition?.abbreviation || ''
      if (p.mlbDebutDate) debutedIds.add(p.id)
    }
  }
  return { positions, debutedIds }
}

// One /people pass over every candidate in the whole month, so every
// comparison below shares one people table and differs only in its rows.
// Cached to disk, so a re-run costs no fetches at all.
const peoplePath = join(here, 'card-people.json')
async function peopleCached(ids, key) {
  const cache = existsSync(peoplePath) ? JSON.parse(readFileSync(peoplePath, 'utf8')) : {}
  if (cache[key]?.today === today) {
    return { positions: cache[key].positions, debutedIds: new Set(cache[key].debuted) }
  }
  const got = await fetchPeople(ids)
  cache[key] = { today, positions: got.positions, debuted: [...got.debutedIds] }
  writeFileSync(peoplePath, JSON.stringify(cache))
  return got
}
const { positions, debutedIds } = await peopleCached(candidateIds(wide), 'twoPass')
const ctx = { mlbTeamIds, affilToOrg, positions, debutedIds }
console.log(`cached pull: ${wide.length} rows through ${today}; ${Object.keys(positions).length} people resolved\n`)

// ---------------------------------------------------------------------------
// Q6 - fetch width, backtested over every 48-hour window in the month
// ---------------------------------------------------------------------------
// The card asks for stories whose txnDate is `end` or the day before. A
// narrow fetch asks the endpoint for [end - (width-1), end] by `date`.
//
// The reference has to respect causality: standing on day `end`, a row the
// wire had not filed yet does not exist, whatever its effectiveDate says. So
// the reference is EVERY row filed on or before `end` — an unbounded-back
// fetch — and the only thing a narrower fetch can cost is a row filed well
// before the effect it records.
const byDate = (lo, hi) => wide.filter((t) => (t.date ?? '') >= lo && (t.date ?? '') <= hi)
const monthStart = dayShift(today, -29)
function storiesFor(rows, end) {
  const start = dayShift(end, -1)
  return groupLeagueWide(rows, ctx)
    .filter((d) => d.date >= start && d.date <= end)
    .flatMap((d) => d.stories)
}

console.log('== Q6  fetch width, backtested (unbounded-back reference vs an N-day fetch) ==')
console.log('width  windows  identical  missing stories  worst window')
for (const width of [2, 3, 4, 5, 7, 10, 14]) {
  let identical = 0
  let windows = 0
  let missing = 0
  let worst = null
  for (let k = 0; k < 22; k += 1) {
    const end = dayShift(today, -k)
    if (dayShift(end, -(width - 1)) < monthStart) break
    windows += 1
    const reference = new Set(storiesFor(byDate(monthStart, end), end).map((s) => s.id))
    const narrow = new Set(storiesFor(byDate(dayShift(end, -(width - 1)), end), end).map((s) => s.id))
    const lost = [...reference].filter((id) => !narrow.has(id))
    if (lost.length === 0) identical += 1
    else {
      missing += lost.length
      if (!worst || lost.length > worst.n) worst = { end, n: lost.length }
    }
  }
  console.log(
    `${String(width).padStart(5)}  ${String(windows).padStart(7)}  ${String(identical).padStart(9)}  ` +
    `${String(missing).padStart(16)}  ${worst ? `${worst.end} (-${worst.n})` : '-'}`,
  )
}

// What exactly does each width miss? Name them.
for (const width of [2, 3, 4]) {
  console.log(`\nstories a ${width}-day fetch misses, named:`)
  let any = false
  for (let k = 0; k < 22; k += 1) {
    const end = dayShift(today, -k)
    if (dayShift(end, -(width - 1)) < monthStart) break
    const reference = storiesFor(byDate(monthStart, end), end)
    const narrow = new Set(storiesFor(byDate(dayShift(end, -(width - 1)), end), end).map((s) => s.id))
    for (const s of reference) {
      if (!narrow.has(s.id)) {
        any = true
        const text = (s.cutline ?? []).map((seg) => seg.text).join('')
        console.log(`  ${end}  ${s.id}  ${text.slice(0, 88)}`)
      }
    }
  }
  if (!any) console.log('  (none)')
}

// ---------------------------------------------------------------------------
// Q7 - two-pass /people equivalence
// ---------------------------------------------------------------------------
console.log('\n== Q7  two-pass /people equivalence ==')
const orgSet = new Set(mlbTeamIds)
const naive = [...new Set(
  wide
    .filter((t) => [t.fromTeam?.id, t.toTeam?.id].filter((id) => id != null)
      .some((id) => orgSet.has(id) || affilToOrg.has(id)))
    .map((t) => t.person?.id).filter(Boolean),
)]
const two = candidateIds(wide)
console.log(`naive ${naive.length} ids vs two-pass ${two.length} ids (${(two.length / naive.length * 100).toFixed(0)}%)`)
const naivePeople = await peopleCached(naive, 'naive')
const a = JSON.stringify(groupLeagueWide(wide, { mlbTeamIds, affilToOrg, ...naivePeople }))
const b = JSON.stringify(groupLeagueWide(wide, ctx))
console.log(`stories byte-identical: ${a === b ? 'YES' : 'NO'}`)
if (a !== b) {
  const A = groupLeagueWide(wide, { mlbTeamIds, affilToOrg, ...naivePeople })
  const B = groupLeagueWide(wide, ctx)
  for (let i = 0; i < Math.max(A.length, B.length); i += 1) {
    if (JSON.stringify(A[i]) !== JSON.stringify(B[i])) {
      console.log(`  first difference on ${A[i]?.date ?? B[i]?.date}`)
      break
    }
  }
}

// ---------------------------------------------------------------------------
// Q8 - the shape the card has to lay out
// ---------------------------------------------------------------------------
console.log('\n== Q8  the shape of a 48-hour card ==')
const days = groupLeagueWide(wide, ctx)
const window48 = days.filter((d) => d.date >= dayShift(today, -1))
const stories = window48.flatMap((d) => d.stories.map((s) => ({ ...s, date: d.date })))
console.log(`${today} + ${dayShift(today, -1)}: ${stories.length} stories, ${new Set(stories.map((s) => s.teamId)).size} clubs`)

const tally = (list, key) => {
  const m = new Map()
  for (const x of list) m.set(key(x), (m.get(key(x)) ?? 0) + 1)
  return [...m.entries()].sort((p, q) => q[1] - p[1])
}
console.log('\nby type:', tally(stories, (s) => s.type).map(([k, v]) => `${k} ${v}`).join(', '))
console.log('rail size:', tally(stories, (s) => s.rail.length).sort((p, q) => p[0] - q[0]).map(([k, v]) => `${k} shots x${v}`).join(', '))
const lens = stories.map((s) => (s.cutline ?? []).map((seg) => seg.text).join('').length).sort((p, q) => p - q)
console.log(`cutline length: min ${lens[0]}, median ${lens[Math.floor(lens.length / 2)]}, p90 ${lens[Math.floor(lens.length * 0.9)]}, max ${lens[lens.length - 1]}`)
console.log('\nstories per club, this window:')
console.log(tally(stories, (s) => s.teamId).map(([k, v]) => `${k}:${v}`).join('  '))

// The worst 48 hours of the whole month - what the layout must survive.
let worstWindow = { end: null, n: 0 }
for (const [i, d] of days.entries()) {
  const prev = days[i + 1]
  const n = d.stories.length + (prev && dayShift(d.date, -1) === prev.date ? prev.stories.length : 0)
  if (n > worstWindow.n) worstWindow = { end: d.date, n }
}
console.log(`\nworst 48 hours in the month: ${worstWindow.end} = ${worstWindow.n} stories`)

console.log('\nfirst 12 stories of the current window, as the card would read them:')
for (const s of stories.slice(0, 12)) {
  const text = (s.cutline ?? []).map((seg) => seg.text).join('')
  const club = MLB_COLORS[s.teamId]?.name ?? s.teamId
  console.log(`  [${s.date}] ${club} - ${s.typeLabel} (${s.rail.length} shots)`)
  console.log(`      ${text}`)
}
