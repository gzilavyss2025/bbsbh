// The simplest possible feed: the last two days of transactions that involve an
// MLB club, printed as the API worded them, with a best-faith de-duplication
// pass. Every rule is applied in a stated order and every row it removes is
// kept, so the page can show what was dropped and why.
//
// The same rules are replayed over a longer stretch as a backtest, because two
// days may contain no repeat at all — and a de-duplication rule that removed
// nothing on the day you looked has not been shown to work.
//
// Run: node .scratch/home-transactions/last48.mjs [windowDays] [backtestDays]
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getJson } from '../../src/api/statsapi.js'

const here = dirname(fileURLToPath(import.meta.url))
const DAYS = Number(process.argv[2]) || 2
const BACKTEST_DAYS = Number(process.argv[3]) || 21
const iso = (d) => d.toISOString().slice(0, 10)
const today = new Date()
const season = today.getUTCFullYear()

// The wire has no clock — a transaction carries dates, never a time. "The last
// 48 hours" can therefore only mean "today and yesterday". Fetch wider than the
// window and trim by effectiveDate, so a row filed today for an earlier day is
// caught and reported rather than silently missed.
const windowStart = iso(new Date(today.getTime() - (DAYS - 1) * 86400000))
const windowEnd = iso(today)
const backtestStart = iso(new Date(today.getTime() - (BACKTEST_DAYS - 1) * 86400000))
const fetchStart = iso(new Date(today.getTime() - (BACKTEST_DAYS + 5) * 86400000))

const orgTeams = (await getJson('/api/v1/teams?sportId=1')).teams ?? []
const orgIds = new Set(orgTeams.map((t) => t.id))
const orgById = new Map(orgTeams.map((t) => [t.id, t]))

const affil = await getJson(`/api/v1/teams/affiliates?teamIds=${[...orgIds].join(',')}&season=${season}`)
const teamById = new Map(orgTeams.map((t) => [t.id, t]))
const affilToOrg = new Map()
for (const t of affil.teams ?? []) {
  teamById.set(t.id, t)
  if (t.id != null && t.parentOrgId != null) affilToOrg.set(t.id, t.parentOrgId)
}

const fetched = (await getJson(`/api/v1/transactions?startDate=${fetchStart}&endDate=${windowEnd}`)).transactions ?? []
console.log(`fetched ${fetched.length} rows, ${fetchStart} .. ${windowEnd}\n`)

const dateOf = (t) => t.effectiveDate || t.date || ''
const touchesMlb = (t) => orgIds.has(t.fromTeam?.id) || orgIds.has(t.toTeam?.id)
const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().replace(/\.+$/, '').toLowerCase()
const fullness = (t) => (t.person ? 2 : 0) + (t.fromTeam && t.toTeam ? 1 : 0)

function clubOf(t) {
  for (const side of [t.toTeam, t.fromTeam]) {
    if (side && orgIds.has(side.id)) return orgById.get(side.id)
  }
  for (const side of [t.toTeam, t.fromTeam]) {
    const parent = affilToOrg.get(side?.id)
    if (parent) return orgById.get(parent)
  }
  return null
}

// Why a collapsed group was a repeat — reported from the rows, not assumed.
function repeatShape(keep, rest) {
  const all = [keep, ...rest]
  const ids = new Set(all.map((t) => t.id))
  const people = new Set(all.map((t) => t.person?.id ?? 'none'))
  if (keep.typeCode === 'TR') {
    return people.size > 1
      ? 'A trade, logged once per player. Every row carries the one sentence that already names the whole deal.'
      : 'A trade, logged more than once on a single sentence.'
  }
  if (ids.size === 1) return 'The same wire id, logged more than once.'
  if (people.size === 1) return 'The same move for the same player, filed twice under different ids.'
  return 'The same sentence on the same day, from separate rows.'
}

// ---------------------------------------------------------------------------
// The feed. Scope, then de-duplicate; each step keeps what it removed.
// ---------------------------------------------------------------------------
function buildFeed(start, end) {
  const steps = []
  const record = (rule, why, removed) => steps.push({ rule, why, count: removed.length, rows: removed.slice(0, 500) })

  const inWindow = fetched.filter((t) => dateOf(t) >= start && dateOf(t) <= end)
  const backdated = fetched.filter((t) => t.date >= start && dateOf(t) < start)
  const lateFiled = inWindow.filter((t) => t.date < start)

  const mlbRows = inWindow.filter(touchesMlb)
  record(
    'Scope — involves an MLB club',
    'Neither side of the move is a major-league club, so no major-league roster changed. This is most of the wire.',
    inWindow.filter((t) => !touchesMlb(t)),
  )

  const described = mlbRows.filter((t) => (t.description || '').trim())
  record(
    'Rule 1 — has a sentence to print',
    'The row carries no description at all, and this feed prints the wire’s own words.',
    mlbRows.filter((t) => !(t.description || '').trim()),
  )

  // Rule 2 is the whole de-duplication. Because the feed prints the wire's own
  // sentence, two rows carrying the SAME sentence on the SAME day would print
  // one line twice, whatever their ids say — and that is the shape every real
  // repeat takes: a trade logs one row per player, all carrying the single
  // sentence that already names everybody in the deal, plus a copy naming
  // nobody; and a move is occasionally filed twice under two ids. Normalising
  // whitespace, the trailing period and case keeps a re-filed row with cosmetic
  // differences from slipping through as a second line.
  // The clubs on the row, as an unordered set — the same deal logged from each
  // side has the same pair, so a trade still collapses, while two clubs that
  // happen to file the same sentence on the same day do not. That is not
  // hypothetical: on Jackie Robinson Day 2026 the Dodgers' Max Muncy and the
  // Athletics' Max Muncy — two different players, two different ids — both
  // "changed number to 42", and without this the feed would print one of them
  // and silently swallow the other.
  const clubKey = (t) => [...new Set([t.fromTeam?.id, t.toTeam?.id].filter((id) => id != null))].sort().join('+')

  const groups = new Map()
  for (const t of described) {
    const key = `${dateOf(t)}|${clubKey(t)}|${norm(t.description)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(t)
  }

  const feed = []
  const collapsed = []
  for (const [key, rows] of groups) {
    // Keep the fullest row as the survivor — the one naming a player and both
    // clubs — so the records we can join hang off the informative row. It never
    // changes the printed sentence, which is identical across the group by
    // construction.
    const sorted = rows.slice().sort((a, b) => fullness(b) - fullness(a) || (a.id ?? 0) - (b.id ?? 0))
    const [keep, ...rest] = sorted
    const shape = rest.length ? repeatShape(keep, rest) : null
    if (rest.length) collapsed.push({ key, keep, rest, shape })
    const club = clubOf(keep)
    feed.push({
      key,
      date: dateOf(keep),
      description: keep.description,
      typeCode: keep.typeCode,
      typeDesc: keep.typeDesc,
      club: club ? { id: club.id, name: club.name, abbr: club.abbreviation } : null,
      twoClubs: orgIds.has(keep.fromTeam?.id) && orgIds.has(keep.toTeam?.id),
      hasResolutionDate: Boolean(keep.resolutionDate),
      row: keep,
      duplicates: rest,
      shape,
    })
  }
  record(
    'Rule 2 — one line per sentence per day',
    'Another row on the same day carries the same sentence, so printing it would repeat a line word for word.',
    collapsed.flatMap((c) => c.rest),
  )

  feed.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || (a.row.id ?? 0) - (b.row.id ?? 0))

  const byCode = new Map()
  for (const f of feed) {
    if (!byCode.has(f.typeCode)) byCode.set(f.typeCode, { code: f.typeCode, desc: f.typeDesc, n: 0 })
    byCode.get(f.typeCode).n += 1
  }

  const shapes = new Map()
  for (const c of collapsed) shapes.set(c.shape, (shapes.get(c.shape) ?? 0) + 1)

  // What the obvious alternative would have done. De-duplicating on the wire's
  // own id is the first thing anyone reaches for, and it fails in both
  // directions here: it merges a trade's per-player rows (right, by accident)
  // while leaving every re-filed row to print its line a second time.
  const idSurvivors = []
  const seenIds = new Set()
  for (const t of described) {
    if (t.id != null && seenIds.has(t.id)) continue
    if (t.id != null) seenIds.add(t.id)
    idSurvivors.push(t)
  }
  const idResidual = new Map()
  for (const t of idSurvivors) {
    const k = `${dateOf(t)}|${norm(t.description)}`
    idResidual.set(k, (idResidual.get(k) ?? 0) + 1)
  }
  const idOnlyRepeatedLines = [...idResidual.values()].filter((v) => v > 1).reduce((n, v) => n + (v - 1), 0)

  // The safety question in the other direction: did Rule 2 ever merge rows about
  // DIFFERENT players outside a trade — that is, hide a real second event?
  //
  // A row carrying NO person is not a different player, it is the same move
  // logged without one (the wire does this on a trade's mirror copy and
  // occasionally elsewhere), so it can't count against the rule. Only rows that
  // NAME two different people can.
  const unsafe = collapsed.filter((c) => {
    if (c.keep.typeCode === 'TR') return false
    const named = [c.keep, ...c.rest].map((t) => t.person?.id).filter((id) => id != null)
    return new Set(named).size > 1
  })

  return {
    start,
    end,
    alternatives: {
      idOnlyPrinted: idSurvivors.length,
      idOnlyRepeatedLines,
      sentencePrinted: feed.length,
      sentenceRepeatedLines: 0,
    },
    safety: {
      groupsMergingDifferentPeopleOutsideATrade: unsafe.length,
      examples: unsafe.slice(0, 5).map((c) => ({ shape: c.shape, keep: c.keep, rest: c.rest })),
    },
    counts: {
      inWindow: inWindow.length,
      mlbRows: mlbRows.length,
      described: described.length,
      printed: feed.length,
      removedAsRepeats: collapsed.reduce((n, c) => n + c.rest.length, 0),
      collapsedGroups: collapsed.length,
      backdatedOutsideWindow: backdated.length,
      lateFiled: lateFiled.length,
    },
    steps,
    byCode: [...byCode.values()].sort((a, b) => b.n - a.n),
    shapes: [...shapes].map(([shape, n]) => ({ shape, n })).sort((a, b) => b.n - a.n),
    // Was resolutionDate any use here? Tested, not assumed: a field can only
    // help separate rows if it actually differs between the rows in question.
    resolutionDate: {
      printedWith: feed.filter((f) => f.hasResolutionDate).length,
      printedWithout: feed.filter((f) => !f.hasResolutionDate).length,
      groupsWhereItDiffers: collapsed.filter((c) => new Set([c.keep, ...c.rest].map((t) => t.resolutionDate ?? 'none')).size > 1).length,
      groupsTotal: collapsed.length,
      printedNamingTwoMlbClubs: feed.filter((f) => f.twoClubs).length,
      printedNamingTwoMlbClubsTwice: feed.filter((f) => f.twoClubs && f.duplicates.length).length,
    },
    feed,
    collapsed: collapsed.map((c) => ({ key: c.key, shape: c.shape, keep: c.keep, rest: c.rest })),
    backdated,
    lateFiled,
  }
}

const windowResult = buildFeed(windowStart, windowEnd)
const backtest = buildFeed(backtestStart, windowEnd)

writeFileSync(
  join(here, 'last48.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), fetchStart, windowDays: DAYS, backtestDays: BACKTEST_DAYS, window: windowResult, backtest }, null, 1),
)

for (const [label, r] of [['WINDOW', windowResult], ['BACKTEST', backtest]]) {
  console.log(`--- ${label}  ${r.start} .. ${r.end} ---`)
  console.log(`  rows in window          ${r.counts.inWindow}`)
  console.log(`  involving an MLB club   ${r.counts.mlbRows}`)
  console.log(`  PRINTED                 ${r.counts.printed}`)
  console.log(`  removed as repeats      ${r.counts.removedAsRepeats} (in ${r.counts.collapsedGroups} groups)`)
  for (const s of r.shapes) console.log(`     ${String(s.n).padStart(3)}  ${s.shape}`)
  console.log(`  printed lines naming two MLB clubs: ${r.resolutionDate.printedNamingTwoMlbClubs}, of which printed twice: ${r.resolutionDate.printedNamingTwoMlbClubsTwice}`)
  console.log(`  collapsed groups where resolutionDate differs: ${r.resolutionDate.groupsWhereItDiffers} of ${r.resolutionDate.groupsTotal}`)
  console.log(`  backdated outside the window ${r.counts.backdatedOutsideWindow}, filed late but inside it ${r.counts.lateFiled}\n`)
}
console.log('wrote last48.json')
