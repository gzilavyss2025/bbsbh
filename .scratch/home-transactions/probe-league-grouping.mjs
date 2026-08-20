// Probe for issue #772 segment 2 — the league-wide grouping pass, measured
// against the live wire before any of it is written into src/.
//
// The study (findings.md) proved a home feed cannot be a MERGE of the thirty
// per-club story files: 24 of 193 cross-club duplicates shared no story key.
// This probe tests the alternative shape — assign every raw row to exactly ONE
// owning club, then group per (owner, day) with the machinery that already
// exists — and measures the two open defects (docs/transactions-wire.md §8)
// on both pipelines:
//
//   Q1  Ownership: how many orgs claim each row, and does a single-owner rule
//       leave anything unowned or ambiguous?
//   Q2  Trades: which side is "the acquiring club" (product decision 1), and
//       how often is that a tie needing a rule?
//   Q3  Duplicates: does single-owner assignment really print each event once?
//   Q4  Coverage: what does the league-wide pass LOSE against the 30-org merge?
//   Q5  Defect 2 — one player named twice in one story. How often, and why?
//   Q6  Defect 3 — story length. Distribution, and where a cap would bind.
//   Q7  Voice: does rowClause's CLW branch say the right thing with the owner
//       set to the CLAIMING club?
//
// The raw pull is cached in league-window.json so re-runs cost no fetches.
// Run: node .scratch/home-transactions/probe-league-grouping.mjs [days]
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getJson } from '../../src/api/statsapi.js'
import { txnDate } from '../../src/api/rehab-policy.js'
import {
  bucketToOrg,
  dedupeTransactions,
  filterStoryworthy,
  groupIntoStories,
} from '../../src/api/teamTransactions.js'
import { assignRowOwners, groupLeagueWide } from '../../src/api/transactions/league.js'

const here = dirname(fileURLToPath(import.meta.url))
const cachePath = join(here, 'league-window.json')
const DAYS = Number(process.argv[2] ?? 60)
const iso = (d) => d.toISOString().slice(0, 10)
const endDate = iso(new Date())
const startDate = iso(new Date(Date.now() - DAYS * 86400000))

// ---------------------------------------------------------------------------
// Pull (cached)
// ---------------------------------------------------------------------------
async function pull() {
  const season = Number(endDate.slice(0, 4))
  const orgTeams = (await getJson('/api/v1/teams?sportId=1')).teams ?? []
  const orgIds = orgTeams.map((t) => t.id)
  const affil = await getJson(`/api/v1/teams/affiliates?teamIds=${orgIds.join(',')}&season=${season}`)
  const affilPairs = (affil.teams ?? [])
    .filter((t) => t.id != null && t.parentOrgId != null)
    .map((t) => [t.id, t.parentOrgId])
  const raw = (await getJson(`/api/v1/transactions?startDate=${startDate}&endDate=${endDate}`)).transactions ?? []

  // /people for the rows that could plausibly become stories — the position
  // fallback and the mlbDebutDate set filterStoryworthy needs to suppress an
  // anonymous minor-league signing spree. Fetching all 16k would be 160 calls.
  const affilToOrgTmp = new Map(affilPairs)
  const orgSet = new Set(orgIds)
  const claims = (t) => [t.fromTeam?.id, t.toTeam?.id]
    .filter((id) => id != null)
    .some((id) => orgSet.has(id) || affilToOrgTmp.has(id))
  const ids = [...new Set(raw.filter(claims).map((t) => t.person?.id).filter(Boolean))]
  const positions = {}
  const debuted = []
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100)
    const data = await getJson(`/api/v1/people?personIds=${batch.join(',')}`)
    for (const p of data.people ?? []) {
      positions[p.id] = p.primaryPosition?.abbreviation || ''
      if (p.mlbDebutDate) debuted.push(p.id)
    }
    process.stderr.write(`  people ${Math.min(i + 100, ids.length)}/${ids.length}\r`)
  }
  process.stderr.write('\n')
  return { startDate, endDate, orgTeams, affilPairs, raw, positions, debuted }
}

let data
if (existsSync(cachePath)) {
  data = JSON.parse(readFileSync(cachePath, 'utf8'))
  if (data.startDate !== startDate || data.endDate !== endDate) data = null
}
if (!data) {
  data = await pull()
  writeFileSync(cachePath, JSON.stringify(data))
}

const { orgTeams, affilPairs, raw, positions } = data
const affilToOrg = new Map(affilPairs)
const orgIds = orgTeams.map((t) => t.id)
const mlbIds = new Set(orgIds)
const orgById = new Map(orgTeams.map((t) => [t.id, t]))
const debutedIds = new Set(data.debuted)

console.log(`window ${startDate} .. ${endDate} (${DAYS} days)`)
console.log(`raw rows ${raw.length}, MLB clubs ${mlbIds.size}, affiliates ${affilToOrg.size}, people resolved ${Object.keys(positions).length}\n`)

// ---------------------------------------------------------------------------
// Shared measurement helpers
// ---------------------------------------------------------------------------
const cutlineText = (story) => (story.cutline ?? []).map((s) => s.text).join('')
const railIds = (story) => (story.rail ?? []).map((s) => s.playerId).filter((id) => id != null)
const cutlineIds = (story) => (story.cutline ?? []).map((s) => s.playerId).filter((id) => id != null)
const hasDup = (list) => new Set(list).size !== list.length
const acquiringOrgFor = (t) => {
  const to = t.toTeam?.id
  if (to == null) return null
  return mlbIds.has(to) ? to : affilToOrg.get(to) ?? null
}

function measure(label, stories) {
  const lens = stories.map(cutlineText).map((t) => t.length).sort((a, b) => a - b)
  const at = (p) => lens[Math.min(lens.length - 1, Math.floor(lens.length * p))] ?? 0
  const overCap = (n) => lens.filter((l) => l > n).length
  const railDup = stories.filter((s) => hasDup(railIds(s)))
  const cutDup = stories.filter((s) => hasDup(cutlineIds(s)))
  console.log(`--- ${label} ---`)
  console.log(`  stories                 ${stories.length}`)
  console.log(`  cutline chars  p50 ${at(0.5)}  p90 ${at(0.9)}  p99 ${at(0.99)}  max ${lens[lens.length - 1] ?? 0}`)
  console.log(`  over 240 / 320 / 400    ${overCap(240)} / ${overCap(320)} / ${overCap(400)}`)
  console.log(`  rail names a player 2x  ${railDup.length}`)
  console.log(`  cutline names one 2x    ${cutDup.length}`)
  return { stories, lens, railDup, cutDup }
}

// ---------------------------------------------------------------------------
// Baseline: today's pipeline, run for all 30 orgs (what the study merged)
// ---------------------------------------------------------------------------
const baseline = []
for (const orgId of orgIds) {
  const bucketed = bucketToOrg(raw, orgId, affilToOrg)
  const kept = filterStoryworthy(dedupeTransactions(bucketed), { orgId, debutedIds })
  for (const day of groupIntoStories(kept, { positions, orgId, debutedIds })) {
    for (const story of day.stories) baseline.push({ orgId, date: day.date, ...story })
  }
}
console.log('=== BASELINE: the 30 per-club pipelines, merged ===')
const baseStats = measure('30-org merge', baseline)

// Cross-club duplicates: two clubs' stories covering the same event. Keyed on
// date + the sorted set of personIds the story names, which is what the study
// used and is independent of either club's own story id.
function eventKey(s) {
  const ids = [...new Set([...railIds(s), ...cutlineIds(s)])].sort((a, b) => a - b)
  return `${s.date}|${ids.join(',')}`
}
const byEvent = new Map()
for (const s of baseline) {
  const k = eventKey(s)
  if (!byEvent.has(k)) byEvent.set(k, [])
  byEvent.get(k).push(s)
}
const crossClub = [...byEvent.values()].filter(
  (g) => new Set(g.map((s) => s.orgId)).size > 1,
)
console.log(`  events told by 2+ clubs  ${crossClub.length} (covering ${crossClub.reduce((n, g) => n + g.length, 0)} stories)`)
const sharedId = crossClub.filter((g) => new Set(g.map((s) => s.id.replace(/^\d+-/, ''))).size === 1)
console.log(`     of which share a story key (a merge could catch): ${sharedId.length}`)
console.log(`     escaping a key-based merge:                       ${crossClub.length - sharedId.length}\n`)

// ---------------------------------------------------------------------------
// Q1 Ownership
// ---------------------------------------------------------------------------
function orgsClaiming(t) {
  const s = new Set()
  for (const id of [t.fromTeam?.id, t.toTeam?.id]) {
    if (id == null) continue
    if (mlbIds.has(id)) s.add(id)
    else if (affilToOrg.has(id)) s.add(affilToOrg.get(id))
  }
  return [...s]
}
console.log('=== Q1: how many orgs claim each raw row? ===')
const claimCount = new Map()
const twoOwnerByCode = new Map()
for (const t of raw) {
  const orgs = orgsClaiming(t)
  claimCount.set(orgs.length, (claimCount.get(orgs.length) ?? 0) + 1)
  if (orgs.length > 1) {
    if (!twoOwnerByCode.has(t.typeCode)) twoOwnerByCode.set(t.typeCode, [])
    twoOwnerByCode.get(t.typeCode).push(t)
  }
}
for (const [n, c] of [...claimCount].sort((a, b) => a[0] - b[0])) {
  console.log(`  ${n} org(s): ${c} rows`)
}
console.log('  codes on a 2-org row:')
for (const [code, rows] of [...twoOwnerByCode].sort((a, b) => b[1].length - a[1].length)) {
  const bothMlb = rows.filter((t) => mlbIds.has(t.fromTeam?.id) && mlbIds.has(t.toTeam?.id)).length
  console.log(`     ${code.padEnd(4)} ${String(rows.length).padStart(4)}  (both sides an MLB club directly: ${bothMlb})`)
}
console.log()

// ---------------------------------------------------------------------------
// Q2 Trades — which side acquires, and how often is it a tie?
// ---------------------------------------------------------------------------
console.log('=== Q2: trades — the acquiring side ===')
const clubPairKey = (t) => [String(t.fromTeam?.id ?? ''), String(t.toTeam?.id ?? '')].sort().join('|')
const tradeGroups = new Map()
for (const t of raw) {
  if (t.typeCode !== 'TR') continue
  const orgs = orgsClaiming(t)
  if (orgs.length !== 2) continue
  const key = `${txnDate(t)}|${clubPairKey(t)}`
  if (!tradeGroups.has(key)) tradeGroups.set(key, [])
  tradeGroups.get(key).push(t)
}
let ties = 0
let decidedByCount = 0
const tieExamples = []
for (const [key, rows] of tradeGroups) {
  const inCount = new Map()
  for (const t of rows) {
    if (!t.person?.id) continue
    const to = t.toTeam?.id
    const org = mlbIds.has(to) ? to : affilToOrg.get(to)
    if (org != null) inCount.set(org, (inCount.get(org) ?? 0) + 1)
  }
  const counts = [...inCount.values()].sort((a, b) => b - a)
  if (counts.length > 1 && counts[0] === counts[1]) {
    ties += 1
    if (tieExamples.length < 4) tieExamples.push({ key, rows })
  } else decidedByCount += 1
}
console.log(`  trade groups (date + club pair)  ${tradeGroups.size}`)
console.log(`  decided by "acquired more players" ${decidedByCount}`)
console.log(`  tie needing a second rule          ${ties}`)
for (const e of tieExamples) {
  console.log(`     ${e.key}`)
  for (const t of e.rows) console.log(`        [${t.person?.fullName ?? '(no person)'}] ${t.description}`)
}
// Does the wire's sentence name the acquiring club as its OBJECT reliably?
const allTr = [...tradeGroups.values()].flat()
const trWithLeadingClub = allTr.filter((t) => {
  const d = t.description || ''
  return d.startsWith(`${t.fromTeam?.name} `) || d.startsWith(`${t.toTeam?.name} `)
})
console.log(`  TR rows whose sentence leads with one of its two clubs: ${trWithLeadingClub.length} of ${allTr.length}\n`)

// ---------------------------------------------------------------------------
// The league-wide pass AS SHIPPED — src/api/transactions/league.js, imported
// rather than re-implemented, so re-running this measures the real code.
// ---------------------------------------------------------------------------
const leagueCtx = { mlbTeamIds: orgIds, affilToOrg, positions, debutedIds }
const owner = assignRowOwners(raw, leagueCtx)
const unowned = raw.filter((t) => !owner.has(t))
console.log('=== Q3: single-owner assignment ===')
console.log(`  rows owned    ${owner.size}`)
console.log(`  rows unowned  ${unowned.length} (no MLB org on either side)`)

const byOwner = new Map()
for (const [t, orgId] of owner) {
  if (!byOwner.has(orgId)) byOwner.set(orgId, [])
  byOwner.get(orgId).push(t)
}
const league = []
for (const day of groupLeagueWide(raw, leagueCtx)) {
  for (const story of day.stories) league.push({ orgId: story.teamId, date: day.date, ...story })
}
const leagueStats = measure('league-wide, single owner', league)

const leagueEvents = new Map()
for (const s of league) {
  const k = eventKey(s)
  if (!leagueEvents.has(k)) leagueEvents.set(k, [])
  leagueEvents.get(k).push(s)
}
const leagueDupes = [...leagueEvents.values()].filter((g) => g.length > 1)
console.log(`  events told more than once  ${leagueDupes.length}`)
for (const g of leagueDupes.slice(0, 5)) {
  console.log(`     ${g[0].date}`)
  for (const s of g) console.log(`        [${orgById.get(s.orgId)?.abbreviation}] ${cutlineText(s)}`)
}
console.log()

// ---------------------------------------------------------------------------
// Q4 Coverage — which rows reach a baseline story but no league-wide story?
// ---------------------------------------------------------------------------
console.log('=== Q4: coverage delta ===')
const personDatesIn = (stories) => {
  const s = new Set()
  for (const st of stories) for (const id of new Set([...railIds(st), ...cutlineIds(st)])) s.add(`${st.date}|${id}`)
  return s
}
const basePD = personDatesIn(baseline)
const leaguePD = personDatesIn(league)
const lost = [...basePD].filter((k) => !leaguePD.has(k))
const gained = [...leaguePD].filter((k) => !basePD.has(k))
console.log(`  player-days named by the 30-org merge : ${basePD.size}`)
console.log(`  player-days named league-wide         : ${leaguePD.size}`)
console.log(`  lost  ${lost.length}`)
console.log(`  gained ${gained.length}`)
for (const k of lost.slice(0, 12)) {
  const [d, pid] = k.split('|')
  const row = raw.find((t) => txnDate(t) === d && String(t.person?.id) === pid)
  console.log(`     ${d} ${pid} ${row ? `[${row.typeCode}] ${row.description}` : '(row not found)'}`)
}
console.log()

// ---------------------------------------------------------------------------
// Q5 Defect 2 — one player named twice in one story
// ---------------------------------------------------------------------------
console.log('=== Q5: one player named twice in one story ===')
for (const [label, stats] of [['baseline', baseStats], ['league-wide', leagueStats]]) {
  const bad = [...new Set([...stats.railDup, ...stats.cutDup])]
  console.log(`  ${label}: ${bad.length}`)
  const byType = new Map()
  for (const s of bad) byType.set(s.type, (byType.get(s.type) ?? 0) + 1)
  for (const [k, v] of byType) console.log(`     ${k}: ${v}`)
  for (const s of bad.slice(0, 8)) {
    console.log(`     [${orgById.get(s.orgId)?.abbreviation} ${s.date} ${s.type}] ${cutlineText(s)}`)
  }
}
console.log()

// ---------------------------------------------------------------------------
// Q6 Defect 3 — length, and where a cap binds
// ---------------------------------------------------------------------------
console.log('=== Q6: story length, and the shuffle that causes it ===')
for (const [label, stats] of [['baseline', baseStats], ['league-wide', leagueStats]]) {
  const long = stats.stories.filter((s) => cutlineText(s).length > 320).sort((a, b) => cutlineText(b).length - cutlineText(a).length)
  console.log(`  ${label}: ${long.length} over 320 chars`)
  for (const s of long.slice(0, 6)) {
    console.log(`     ${cutlineText(s).length}c  ${s.rail.length} faces  [${s.type}] ${cutlineText(s).slice(0, 150)}…`)
  }
}
const shuffles = league.filter((s) => s.type === 'shuffle')
const sizeHist = new Map()
for (const s of shuffles) sizeHist.set(s.rail.length, (sizeHist.get(s.rail.length) ?? 0) + 1)
console.log('  league-wide shuffle sizes (faces -> stories, max chars at that size):')
for (const [n, c] of [...sizeHist].sort((a, b) => a[0] - b[0])) {
  const max = Math.max(...shuffles.filter((s) => s.rail.length === n).map((s) => cutlineText(s).length))
  console.log(`     ${String(n).padStart(2)} faces  ${String(c).padStart(4)} stories   max ${max}c`)
}
console.log()

// ---------------------------------------------------------------------------
// Q7 Voice — the CLW sentence with the owner set to the claiming club
// ---------------------------------------------------------------------------
console.log('=== Q7: waiver-claim voice, league-wide ===')
const claims2 = league.filter((s) => /off waivers/i.test(cutlineText(s)))
console.log(`  claim stories ${claims2.length}`)
for (const s of claims2.slice(0, 8)) {
  console.log(`     [${orgById.get(s.orgId)?.abbreviation}] ${cutlineText(s)}`)
}
const backwards = league.filter((s) => {
  const txt = cutlineText(s)
  const m = txt.match(/off waivers from (.+?)\.?$/i)
  return m && m[1].trim() === orgById.get(s.orgId)?.name
})
console.log(`  stories claiming a player FROM their own club (the old bug): ${backwards.length}`)
console.log()

// ---------------------------------------------------------------------------
// The 48-hour surface itself
// ---------------------------------------------------------------------------
const days = [...new Set(league.map((s) => s.date))].sort().reverse()
console.log('=== the last few days, league-wide ===')
for (const d of days.slice(0, 6)) {
  const n = league.filter((s) => s.date === d).length
  console.log(`  ${d}: ${n} stories`)
}

// ---------------------------------------------------------------------------
// Q8 One player's rows on one club-day — the multiplicity behind defect 2
// ---------------------------------------------------------------------------
console.log()
console.log('=== Q8: one player, one club-day, how many KEPT rows? ===')
const keptByOwner = new Map()
for (const [orgId, rows] of byOwner) {
  keptByOwner.set(orgId, filterStoryworthy(dedupeTransactions(rows), { orgId, debutedIds }))
}
const personDay = new Map()
for (const [orgId, rows] of keptByOwner) {
  for (const t of rows) {
    const pid = t.person?.id
    if (pid == null) continue
    const k = `${orgId}|${txnDate(t)}|${pid}`
    if (!personDay.has(k)) personDay.set(k, [])
    personDay.get(k).push(t)
  }
}
const multHist = new Map()
for (const rows of personDay.values()) multHist.set(rows.length, (multHist.get(rows.length) ?? 0) + 1)
for (const [n, c] of [...multHist].sort((a, b) => a[0] - b[0])) console.log(`  ${n} row(s): ${c} player-days`)

const IN_CODES = new Set(['CU', 'SE', 'ACQ', 'OBT', 'PUR', 'CP', 'SFA', 'SGN', 'IFA'])
const OUT_CODES = new Set(['OPT', 'DES', 'OUT', 'REL', 'WA', 'RET', 'DFA'])
function dirOf(t, orgId) {
  if (t.typeCode === 'TR' || t.typeCode === 'CLW') return t.toTeam?.id === orgId ? 'in' : 'out'
  if (IN_CODES.has(t.typeCode)) return 'in'
  if (OUT_CODES.has(t.typeCode)) return 'out'
  if (t.typeCode === 'SC') return /activat/i.test(t.description || '') ? 'in' : /transferred/i.test(t.description || '') ? 'transfer' : 'out'
  return '?'
}
const comboHist = new Map()
for (const [k, rows] of personDay) {
  if (rows.length < 2) continue
  const orgId = Number(k.split('|')[0])
  const combo = rows.map((t) => `${t.typeCode}:${dirOf(t, orgId)}`).sort().join(' + ')
  if (!comboHist.has(combo)) comboHist.set(combo, [])
  comboHist.get(combo).push({ k, rows })
}
console.log('  code/direction combinations on a multi-row player-day:')
for (const [combo, list] of [...comboHist].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`     ${String(list.length).padStart(3)}  ${combo}`)
}
console.log('  same-direction pairs (what a general collapse would newly join):')
const sameDir = [...comboHist].filter(([combo]) => {
  const dirs = combo.split(' + ').map((s) => s.split(':')[1])
  return new Set(dirs).size === 1
})
let sameDirTotal = 0
for (const [combo, list] of sameDir) {
  sameDirTotal += list.length
  console.log(`     ${String(list.length).padStart(3)}  ${combo}`)
  for (const { rows } of list.slice(0, 2)) {
    for (const t of rows) console.log(`            ${txnDate(t)} [${t.typeCode}] ${t.description}`)
  }
}
console.log(`  total same-direction player-days: ${sameDirTotal}`)
console.log()

// ---------------------------------------------------------------------------
// Q9 Cap simulation — chunking a shuffle, and what it does to length
// ---------------------------------------------------------------------------
console.log('=== Q9: capping the shuffle ===')
// Order in-rows then out-rows (cutlineShuffle's own order) and deal round-robin
// into ceil(n / cap) chunks, so each chunk keeps both directions wherever the
// day's composition allows one.
function chunkRoundRobin(list, cap) {
  const n = Math.ceil(list.length / cap)
  const chunks = Array.from({ length: n }, () => [])
  list.forEach((item, i) => chunks[i % n].push(item))
  return chunks
}
const shuffleRows = league
  .filter((s) => s.type === 'shuffle')
  .map((s) => ({
    story: s,
    ins: s.rail.filter((r) => r.role === 'in').length,
    outs: s.rail.filter((r) => r.role === 'out').length,
    chars: cutlineText(s).length,
  }))
for (const cap of [3, 4, 5]) {
  let stories = 0
  let allOneWay = 0
  let worstChars = 0
  for (const s of shuffleRows) {
    const list = [...Array(s.ins).fill('in'), ...Array(s.outs).fill('out')]
    if (list.length <= cap) { stories += 1; worstChars = Math.max(worstChars, s.chars); continue }
    for (const c of chunkRoundRobin(list, cap)) {
      if (!(c.includes('in') && c.includes('out'))) allOneWay += 1
      stories += 1
      worstChars = Math.max(worstChars, Math.round((s.chars / list.length) * c.length))
    }
  }
  console.log(`  cap ${cap}: shuffle stories ${stories} (was ${shuffleRows.length}), chunks that lose their mix ${allOneWay}, worst estimated chars ${worstChars}`)
}
const over = shuffleRows.filter((s) => s.ins + s.outs > 4)
console.log(`  shuffles over 4 rows: ${over.length}`)
for (const s of over) console.log(`     ${s.ins} in / ${s.outs} out  ${s.chars}c`)
console.log()

// ---------------------------------------------------------------------------
// Q10 Trade voice — do the two candidate tie-breaks ever disagree?
// ---------------------------------------------------------------------------
console.log('=== Q10: trade owner — count rule vs. the wire sentence ===')
let agree = 0
let disagree = 0
const disagreements = []
for (const [key, rows] of tradeGroups) {
  const inCount = new Map()
  for (const t of rows) {
    if (!t.person?.id) continue
    const org = acquiringOrgFor(t)
    if (org != null) inCount.set(org, (inCount.get(org) ?? 0) + 1)
  }
  const ranked = [...inCount.entries()].sort((a, b) => b[1] - a[1])
  const byCount = ranked.length && !(ranked.length > 1 && ranked[0][1] === ranked[1][1]) ? ranked[0][0] : null
  const lead = rows.find((t) => (t.description || '').startsWith(`${t.fromTeam?.name} `) || (t.description || '').startsWith(`${t.toTeam?.name} `))
  const leadName = (lead?.description || '').startsWith(`${lead?.fromTeam?.name} `) ? lead?.fromTeam?.name : lead?.toTeam?.name
  const sender = orgTeams.find((o) => o.name === leadName)?.id
  const both = [...new Set(rows.flatMap((t) => orgsClaiming(t)))]
  const bySentence = both.find((id) => id !== sender) ?? null
  if (byCount == null || bySentence == null) continue
  if (byCount === bySentence) agree += 1
  else { disagree += 1; if (disagreements.length < 8) disagreements.push({ key, rows, byCount, bySentence }) }
}
console.log(`  groups where both rules decide: agree ${agree}, disagree ${disagree}`)
for (const d of disagreements) {
  console.log(`     ${d.key}  count->${orgById.get(d.byCount)?.abbreviation}  sentence->${orgById.get(d.bySentence)?.abbreviation}`)
  for (const t of d.rows) console.log(`        [${t.person?.fullName ?? '(none)'}] ${t.description}`)
}
console.log()

// ---------------------------------------------------------------------------
// Q11 The two stories about one player — dump the club-days behind them
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Q15 Is "the club the sentence leads with" the SENDER, every time?
// ---------------------------------------------------------------------------
console.log('=== Q15: the wire sentence names the sending club first ===')
let consistent = 0
let inconsistent = 0
let leadIsSender = 0
let leadNotSender = 0
const oddities = []
for (const [key, rows] of tradeGroups) {
  const leads = new Set()
  for (const t of rows) {
    const d = t.description || ''
    for (const name of [t.fromTeam?.name, t.toTeam?.name]) {
      if (name && d.startsWith(`${name} `)) leads.add(name)
    }
  }
  if (leads.size === 1) consistent += 1
  else { inconsistent += 1; oddities.push({ key, rows, leads: [...leads] }) }
  const lead = [...leads][0]
  // A named row whose player really left the leading club proves the lead is
  // the sender; a named row whose player ARRIVED at it would disprove it.
  const named = rows.filter((t) => t.person?.id)
  const sent = named.filter((t) => t.fromTeam?.name === lead).length
  const got = named.filter((t) => t.toTeam?.name === lead).length
  if (sent > 0) leadIsSender += 1
  if (sent === 0 && got > 0) { leadNotSender += 1; oddities.push({ key, rows, leads: [...leads], note: 'lead only receives' }) }
}
console.log(`  groups whose rows all lead with the same club: ${consistent}, mixed: ${inconsistent}`)
console.log(`  groups where the leading club sends at least one named player: ${leadIsSender}`)
console.log(`  groups where the leading club only RECEIVES: ${leadNotSender}`)
for (const o of oddities.slice(0, 4)) {
  console.log(`     ${o.key} leads=${JSON.stringify(o.leads)} ${o.note ?? ''}`)
  for (const t of o.rows) console.log(`        [${t.person?.fullName ?? '(none)'}] ${t.description}`)
}
console.log()

// ---------------------------------------------------------------------------
// Q12 What does a same-day claim-then-option actually PRINT?
// ---------------------------------------------------------------------------
console.log('=== Q12: the "double" story when the arrival is not an IL activation ===')
const doubles = league.filter((s) => s.type === 'roster-move' && s.rail.length === 1 && s.rail[0].banner === 'Down')
let shown = 0
for (const [k, rows] of personDay) {
  if (rows.length < 2) continue
  const orgId = Number(k.split('|')[0])
  const dirs = rows.map((t) => dirOf(t, orgId))
  const inRow = rows[dirs.indexOf('in')]
  if (!inRow || !dirs.includes('out')) continue
  if (inRow.typeCode === 'SC') continue // the IL-activation case the design intends
  if (inRow.typeCode === 'TR') continue // excluded from Step 1 by design
  const date = k.split('|')[1]
  const pid = Number(k.split('|')[2])
  const story = league.find((s) => s.orgId === orgId && s.date === date && [...railIds(s), ...cutlineIds(s)].includes(pid))
  if (shown++ >= 10) continue
  console.log(`  ${date} [${orgById.get(orgId)?.abbreviation}] rows: ${rows.map((t) => t.typeCode).join('+')}`)
  for (const t of rows) console.log(`        ${t.description}`)
  console.log(`     PRINTS: ${story ? cutlineText(story) : '(no story)'}`)
}
console.log(`  (roster-move stories with a single "Down" face: ${doubles.length})`)
console.log()

// ---------------------------------------------------------------------------
// Q13/Q14 What the live card would lose without the two extra fetches
// ---------------------------------------------------------------------------
console.log('=== Q13/Q14: cost of dropping the affiliate map / the debut set ===')
function runLeague({ useAffiliates, useDebuts }) {
  const claimsOrg = (t) => {
    const s = new Set()
    for (const id of [t.fromTeam?.id, t.toTeam?.id]) {
      if (id == null) continue
      if (mlbIds.has(id)) s.add(id)
      else if (useAffiliates && affilToOrg.has(id)) s.add(affilToOrg.get(id))
    }
    return [...s]
  }
  const own = new Map()
  for (const t of raw) {
    const orgs = claimsOrg(t)
    if (orgs.length === 0) continue
    own.set(t, orgs.length === 1 ? orgs[0] : (mlbIds.has(t.toTeam?.id) ? t.toTeam.id : orgs[0]))
  }
  const buckets = new Map()
  for (const [t, orgId] of own) {
    if (!buckets.has(orgId)) buckets.set(orgId, [])
    buckets.get(orgId).push(t)
  }
  const out = []
  for (const [orgId, rows] of buckets) {
    const kept = filterStoryworthy(dedupeTransactions(rows), { orgId, debutedIds: useDebuts ? debutedIds : undefined })
    for (const day of groupIntoStories(kept, { positions, orgId, debutedIds })) {
      for (const st of day.stories) out.push({ orgId, date: day.date, ...st })
    }
  }
  return out
}
for (const opts of [{ useAffiliates: true, useDebuts: true }, { useAffiliates: false, useDebuts: true }, { useAffiliates: true, useDebuts: false }]) {
  const out = runLeague(opts)
  console.log(`  affiliates=${opts.useAffiliates} debuts=${opts.useDebuts}: ${out.length} stories`)
}
console.log()

console.log('=== Q11: club-days where one player got two stories ===')
for (const g of leagueDupes) {
  const orgId = g[0].orgId
  const ids = new Set(g.flatMap((s) => [...railIds(s), ...cutlineIds(s)]))
  console.log(`  ${g[0].date} [${orgById.get(orgId)?.abbreviation}]`)
  for (const t of keptByOwner.get(orgId) ?? []) {
    if (txnDate(t) === g[0].date && ids.has(t.person?.id)) {
      console.log(`     id=${t.id} [${t.typeCode}] from=${t.fromTeam?.id ?? '-'} to=${t.toTeam?.id ?? '-'} ${t.description}`)
    }
  }
}
