// Follow-up to analyze.mjs: resolve ACTUAL CALENDAR DATES for level
// transitions (not just PA/IP volume), then ask three things —
//   1. days-at-level distributions (does duration track a "fixed floor",
//      e.g. never less than a full season, or is it flexible?)
//   2. does days-at-level vary by organization?
//   3. does the CALENDAR TIMING of a promotion cluster around a milestone
//      (season open, All-Star break, deadline, season close)?
//
// Reuses the same cached season transaction dumps analyze.mjs's ordering
// validation already pulled (txn-cache.json), extended to cover every
// pre-debut season the cohort touches (2010-2023, no 2020 — no MiLB season).
//
// SCOPE NOTE: a transition's date is only resolvable from the wire when it
// has a matching ASG row; the very first level's ARRIVAL date isn't dated at
// all here (would need extended-spring-training reconstruction, out of
// scope) — so "days at level" is reported only for a player's 2nd level
// onward, where the transition INTO it is already dated. Promotion-timing
// (question 3) has no such gap: every transition's END date is real,
// including the very first level's.
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getJson } from '../../scripts/lib/statsapi.mjs'
import { mapConcurrent } from '../../scripts/lib/concurrency.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const raw = JSON.parse(await readFile(join(here, 'raw.json'), 'utf8'))
const cache = JSON.parse(await readFile(join(here, 'txn-cache.json'), 'utf8'))
let findings
try {
  findings = JSON.parse(await readFile(join(here, 'findings.json'), 'utf8'))
} catch {
  findings = { validation: { disagree: [] } }
}

const LEVEL_RANK = { 14: 1, 13: 2, 12: 3, 11: 4 }
const LEVEL_NAME = { 14: 'A', 13: 'High-A', 12: 'AA', 11: 'AAA' }
const disputedIds = new Set(findings.validation.disagree.map((d) => d.playerId))

const playersArr = Object.entries(raw.players)
  .map(([id, p]) => ({ id: Number(id), ...p }))
  .filter((p) => p.group === 'hitting' || p.group === 'pitching')
  .filter((p) => !disputedIds.has(p.id)) // reuse the confidence audit's clean subset — don't re-litigate order here

// Mexican League clubs statsapi mislabels sportId 11 in some seasons (same
// anomaly gen-milb-history.mjs's header documents) — drop the two affected
// rows rather than treat them as real Triple-A stints.
for (const p of playersArr) p.milb = p.milb.filter((r) => Number.isInteger(r.season))

// --- established level sequence, same rule as analyze.mjs's reconstruct() --
function levelSequence(player) {
  const debutYear = Number(player.debutDate.slice(0, 4))
  const seasonsBySport = new Map()
  for (const row of player.milb) {
    if (row.season > debutYear) continue
    if (!seasonsBySport.has(row.sportId)) seasonsBySport.set(row.sportId, [])
    seasonsBySport.get(row.sportId).push(row.season)
  }
  const segments = [...seasonsBySport.entries()].map(([sportId, seasons]) => ({
    sportId,
    firstSeason: Math.min(...seasons),
  }))
  segments.sort((a, b) => a.firstSeason !== b.firstSeason ? a.firstSeason - b.firstSeason : LEVEL_RANK[a.sportId] - LEVEL_RANK[b.sportId])
  const seq = []
  let currentRank = 0
  for (const seg of segments) {
    const rank = LEVEL_RANK[seg.sportId]
    if (rank <= currentRank) continue
    seq.push(seg.sportId)
    currentRank = rank
  }
  return seq
}

// --- transaction events for one player, across every cached season --------
function playerAsgEvents(player) {
  const teamToSport = new Map(player.milb.map((r) => [r.teamId, r.sportId]))
  const events = []
  for (const season of Object.keys(cache)) {
    for (const t of cache[season]) {
      if (t.person?.id !== player.id) continue
      if (t.typeCode !== 'ASG') continue
      const sportId = teamToSport.get(t.toTeam?.id)
      if (!sportId) continue
      const date = t.effectiveDate || t.date
      if (!date) continue
      events.push({ date, sportId })
    }
  }
  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const deduped = []
  for (const e of events) if (deduped[deduped.length - 1]?.sportId !== e.sportId) deduped.push(e)
  return deduped
}

// For each player, resolve a date for every transition in the established
// sequence: the FIRST event whose sportId equals the NEXT level in the
// sequence (i.e. the moment he arrives there), matched in order against the
// event stream. Falls back to null if the event stream doesn't contain a
// clean match (skipped, not guessed).
function resolveTransitionDates(player) {
  const seq = levelSequence(player)
  if (seq.length < 2) return []
  const events = playerAsgEvents(player)
  const transitions = []
  let cursor = 0
  for (let i = 1; i < seq.length; i++) {
    const target = seq[i]
    let found = null
    for (; cursor < events.length; cursor++) {
      if (events[cursor].sportId === target) {
        found = events[cursor].date
        cursor++
        break
      }
    }
    transitions.push({ fromSportId: seq[i - 1], toSportId: target, date: found })
  }
  // final transition into MLB: exact, no wire lookup needed
  transitions.push({ fromSportId: seq[seq.length - 1], toSportId: 1, date: player.debutDate })
  return transitions
}

function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000)
}

// --- run over the clean cohort ----------------------------------------------
const allDurations = [] // { level, days, playerId }
const allPromotionDates = [] // { toLevel, date, draftTier }
let resolved = 0, total = 0

function draftTier(ped) {
  if (!ped?.draftRound) return "No draft record"
  const r = String(ped.draftRound)
  if (r === '1' || r === '1C' || r === 'CB-A' || r === 'C-A') return 'Round 1'
  const n = Number(r)
  if (!Number.isFinite(n)) return 'Round 1'
  if (n <= 5 || r === '2C' || r === 'CB-B') return 'Rounds 2-5'
  if (n <= 10) return 'Rounds 6-10'
  return 'Round 11+'
}

for (const p of playersArr) {
  const transitions = resolveTransitionDates(p)
  for (let i = 0; i < transitions.length; i++) {
    const t = transitions[i]
    total++
    if (!t.date) continue
    resolved++
    allPromotionDates.push({ toLevel: LEVEL_NAME[t.toSportId] || 'MLB', date: t.date, draftTier: draftTier(p.ped), playerId: p.id })
    // duration = days between THIS transition's date and the PREVIOUS one
    // (i.e. how long he spent at fromSportId before this promotion) — only
    // meaningful when the previous transition is also dated (2nd level on)
    if (i > 0 && transitions[i - 1].date) {
      const days = daysBetween(transitions[i - 1].date, t.date)
      if (days > 0 && days < 900) allDurations.push({ level: LEVEL_NAME[t.fromSportId], days, playerId: p.id })
    }
  }
}
console.log(`clean cohort: ${playersArr.length} players; transitions resolved: ${resolved}/${total} (${(resolved / total * 100).toFixed(0)}%)`)
console.log(`dated durations (2nd level onward): ${allDurations.length}`)

function percentile(sorted, pct) {
  const idx = (sorted.length - 1) * pct
  const lo = Math.floor(idx), hi = Math.ceil(idx)
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}
function summarize(values) {
  const s = [...values].sort((a, b) => a - b)
  if (!s.length) return { n: 0 }
  return { n: s.length, p10: percentile(s, .1), p25: percentile(s, .25), median: percentile(s, .5), p75: percentile(s, .75), p90: percentile(s, .9) }
}

console.log('\n=== days-at-level (2nd level onward, calendar days) ===')
const byLevel = {}
for (const level of ['High-A', 'AA', 'AAA']) {
  const days = allDurations.filter((d) => d.level === level).map((d) => d.days)
  byLevel[level] = summarize(days)
  const s = byLevel[level]
  if (s.n) console.log(`${level}: n=${s.n}  p10=${s.p10.toFixed(0)}  p25=${s.p25.toFixed(0)}  median=${s.median.toFixed(0)}  p75=${s.p75.toFixed(0)}  p90=${s.p90.toFixed(0)}`)
}

// Fixed-duration check: what fraction of stints land within +/-10 days of a
// full season (~183 team-days, but "full year" for roster-control purposes
// is 365) — look for a spike right at 365, evidence of a "hold a full year"
// organizational norm rather than a smooth performance-driven distribution.
console.log('\n=== clustering near a calendar-year boundary (350-380 days) ===')
for (const level of ['High-A', 'AA', 'AAA']) {
  const days = allDurations.filter((d) => d.level === level).map((d) => d.days)
  const nearYear = days.filter((d) => d >= 350 && d <= 380).length
  console.log(`${level}: ${nearYear}/${days.length} (${days.length ? (nearYear / days.length * 100).toFixed(0) : 0}%) land within 350-380 days`)
}

await writeFile(join(here, 'dates.json'), JSON.stringify({ allDurations, allPromotionDates, byLevel }, null, 2))
console.log('\nwrote dates.json')
