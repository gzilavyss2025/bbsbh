// Build the service-clock panel: one row per MLB debut, 2005-2025.
//
// Output: .scratch/service-clock/panel.json
//
// The cohort is EVERY MLB debut in the window, taken from /sports/1/players.
// No performance threshold and no salary-file membership decides who is in it.
// That matters: the kill check (k0-blank-rate.mjs) showed that both the
// service-time column's blankness and a man's presence in salaries.csv track
// the calendar, so a cohort drawn from that file would be selected by the very
// thing this spike measures.
import { writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { j, local, here, repo, readCsv, loadCalendar, dayDiff, parseMls } from './lib.mjs'

// The thirty MLB clubs. A wire row naming any other team id names a minor
// league affiliate, which is how a recall is told from a reassignment.
export const MLB_TEAM_IDS = new Set([
  108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 133, 134, 135, 136, 137,
  138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 158,
])
if (MLB_TEAM_IDS.size !== 30) throw new Error('club list is not thirty')

// Codes that PUT a man on a club's active major-league roster, and codes that
// TAKE him off it. A stint is bounded by these. `typeCode` alone is not a kind
// of move (docs/transactions-wire.md §3), so the status-change rows are read
// out of the description instead of the code.
const ADD_CODES = new Set(['SE', 'CU', 'CP', 'PUR', 'CLW', 'TR', 'SFA', 'SGN', 'ACQ', 'OBT', 'RTN'])
const REMOVE_CODES = new Set(['OPT', 'OUT', 'DES', 'REL', 'DFA', 'RET', 'SU'])

const RE_IL_PLACED = /placed .* on the (\d+)-day (injured|disabled) list/i
// The wire names the man's position inside the sentence — "placed RHP Foo Bar
// on the 10-day injured list" — so the roster-need control can be made
// position-aware without a second pull for every injured player.
const RE_IL_POS = /placed\s+(RHP|LHP|[123]B|SS|C|LF|CF|RF|DH|OF|IF|P)\s/i
const PITCHER_POS = new Set(['RHP', 'LHP', 'P'])

const calendar = await loadCalendar()
const debuts = await j(local('debuts'))
const txns = await j(local('transactions'))

// --- index the wire ----------------------------------------------------------
// Rows are already sorted by id from the pull. Sort again by (date, id) here so
// a stint walk sees a stable chronological sequence; the wire's own row order
// is not stable between queries and its `id` is not unique.
txns.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.id - b.id)

const byPerson = new Map()
for (const t of txns) {
  if (t.personId == null) continue
  if (!byPerson.has(t.personId)) byPerson.set(t.personId, [])
  byPerson.get(t.personId).push(t)
}

// IL placements, bucketed by club and day, for the roster-need control.
const ilByClubDay = new Map() // `${teamId}:${date}` -> [{personId, days}]
for (const t of txns) {
  if (t.typeCode !== 'SC') continue
  const m = RE_IL_PLACED.exec(t.description)
  if (!m) continue
  const teamId = t.toTeamId ?? t.fromTeamId
  if (!MLB_TEAM_IDS.has(teamId)) continue
  const key = `${teamId}:${t.date}`
  if (!ilByClubDay.has(key)) ilByClubDay.set(key, [])
  const pos = RE_IL_POS.exec(t.description)?.[1]?.toUpperCase() ?? null
  ilByClubDay.get(key).push({
    personId: t.personId,
    ilDays: Number(m[1]),
    pos,
    isPitcher: pos ? PITCHER_POS.has(pos) : null,
  })
}

// --- pedigree, borrowed rather than rebuilt ----------------------------------
// The 3,061-player prospect cohort already carries a corrected draft round, an
// age at debut and the minor-league record behind it. Re-deriving any of those
// would risk a second, slightly different answer to a question this repo has
// already settled. It covers debuts 2005-2023 only; a 2024 or 2025 debut simply
// carries nulls and drops out of the rank-matched cuts.
let pedigree = new Map()
let awardTier = new Map()
const bioPath = join(here, '..', 'prospect-traits', 'bio.json')
if (existsSync(bioPath)) {
  const { buildCohort } = await import('../prospect-traits/lib.mjs')
  const cohort = await buildCohort()
  for (const p of cohort) {
    pedigree.set(p.id, {
      draftRound: p.draftRound,
      draftTier: p.draftTier,
      ageAtDebut: p.ageAtDebut,
      seasonsToDebut: p.seasonsToDebut,
      group: p.group,
      // Production at the highest level he reached before the debut. OPS for a
      // hitter, ERA for a pitcher, straight off the reconstructed segments.
      topLevel: p.segs.length ? p.segs[p.segs.length - 1].level : null,
      topLevelPa: p.segs.length ? p.segs[p.segs.length - 1].pa : null,
      topLevelRaw: p.segs.length ? p.segs[p.segs.length - 1].raw : null,
    })
  }

  // Award pedigree, using the fix docs/prospect-traits.md question 4 had to
  // make: count only honours won in a STRICTLY EARLIER season. A Futures Game
  // selection is played in mid-July, so counting the debut season's own awards
  // makes the award forbid the very month the test is about.
  const awards = await j(join(here, '..', 'prospect-traits', 'awards.json'))
  const catalog = await j(join(here, '..', 'prospect-traits', 'award-catalog.json'))
  const sportOf = new Map(catalog.map((a) => [a.id, a.sport?.id ?? null]))
  const TIER_A = new Set(['NPOY', 'NPOTY', 'MILBGG', 'FUTURESMVP'])
  const TIER_B = new Set(['FUTURES', 'BAALLSTAR', 'TOPPSALLSTAR', 'AFLRS'])
  for (const [idStr, list] of Object.entries(awards)) {
    const id = Number(idStr)
    const p = pedigree.get(id)
    if (!p) continue
    const debutSeason = debuts.find((d) => d.id === id)?.debutSeason
    if (!debutSeason) continue
    let tier = 'none'
    for (const a of list) {
      if (Number(a.season) >= debutSeason) continue // the q4b fix
      const sport = sportOf.get(a.id)
      if (sport === 1) continue // an MLB award is not minor-league pedigree
      if (TIER_A.has(a.id)) tier = 'A'
      else if (TIER_B.has(a.id) && tier !== 'A') tier = 'B'
      else if (tier === 'none') tier = 'C'
    }
    awardTier.set(id, tier)
  }
}

// --- the service outcome -----------------------------------------------------
// `mls` on a year-Y row is the service a man had accrued through the END of
// season Y-1 (checked: Juan Soto's 2026 row reads 7.134, and he debuted
// 2018-05-20, which banks 135 days). So the row that says what a debut season
// bought is the row for the FOLLOWING season.
const salaries = await readCsv('scripts/data/contracts/salaries.csv')
const identity = await j(join(repo, 'public/data/contracts-history/identity/salaries.json'))
const idByRowKey = new Map()
for (const e of identity) if (e.mlbId != null) idByRowKey.set(e.rowKey, e.mlbId)

const mlsByPlayerSeason = new Map() // `${mlbId}:${year}` -> parsed mls
for (const r of salaries) {
  const mlbId = idByRowKey.get(`salaries#${r.__index}`)
  if (mlbId == null) continue
  const parsed = parseMls(r.mls)
  if (!parsed) continue
  const key = `${mlbId}:${Number(r.year)}`
  // A man can hold two rows in a season (anomaly 1). They agree on service in
  // the repeated-row case; keep the first and record that a second existed.
  if (!mlsByPlayerSeason.has(key)) mlsByPlayerSeason.set(key, parsed)
}

// --- assemble ----------------------------------------------------------------
function rosterAdd(personId, debutDate, debutSeason) {
  const rows = byPerson.get(personId) ?? []
  const seasonStart = calendar.get(debutSeason)?.regularSeasonStartDate
  if (!seasonStart) return null
  // Everything from six weeks before Opening Day up to the debut. A move filed
  // in that span is the one that put him on the roster.
  const from = debutDate
  const inWindow = rows.filter(
    (t) => t.date && t.date <= from && t.date >= `${debutSeason}-01-01`,
  )
  // Walk backwards to the most recent ADD that no REMOVE follows before the
  // debut. That is the start of the stint the debut sits inside, which is when
  // service began — not the debut itself.
  let addDate = null
  let addTeam = null
  let addCode = null
  for (let i = inWindow.length - 1; i >= 0; i--) {
    const t = inWindow[i]
    if (REMOVE_CODES.has(t.typeCode) && MLB_TEAM_IDS.has(t.fromTeamId)) break
    if (ADD_CODES.has(t.typeCode) && MLB_TEAM_IDS.has(t.toTeamId)) {
      addDate = t.date
      addTeam = t.toTeamId
      addCode = t.typeCode
      break
    }
  }
  return addDate ? { addDate, addTeam, addCode } : null
}

// Injuries the promoting club took in the days before the promotion. Counted
// three ways: every placement, placements at the arriving man's own side of the
// roster (a club that loses a pitcher needs a pitcher), and placements onto a
// long-term list, which is the injury that actually forces a promotion.
function rosterNeed(teamId, onDate, windowDays, wantPitcher) {
  if (teamId == null || !onDate) return null
  let any = 0
  let sameGroup = 0
  let longTerm = 0
  for (let k = 1; k <= windowDays; k++) {
    const d = new Date(Date.parse(onDate + 'T00:00:00Z') - k * 86400000).toISOString().slice(0, 10)
    for (const il of ilByClubDay.get(`${teamId}:${d}`) ?? []) {
      any++
      if (il.isPitcher != null && il.isPitcher === wantPitcher) sameGroup++
      if (il.ilDays >= 60) longTerm++
    }
  }
  return { any, sameGroup, longTerm }
}

const panel = []
let noWireAdd = 0
for (const d of debuts) {
  const cal = calendar.get(d.debutSeason)
  if (!cal) continue
  const relDay = dayDiff(d.debutDate, cal.cutoff)
  const seasonDay = dayDiff(d.debutDate, cal.leagueOpener)
  const add = rosterAdd(d.id, d.debutDate, d.debutSeason)
  if (!add) noWireAdd++
  const addRelDay = add ? dayDiff(add.addDate, cal.cutoff) : null
  const clubId = add?.addTeam ?? null
  const mlsNext = mlsByPlayerSeason.get(`${d.id}:${d.debutSeason + 1}`) ?? null
  const ped = pedigree.get(d.id) ?? null

  panel.push({
    id: d.id,
    name: d.name,
    debutDate: d.debutDate,
    debutSeason: d.debutSeason,
    posAbbr: d.posAbbr,
    posType: d.posType,
    isPitcher: d.posType === 'Pitcher',
    birthDate: d.birthDate,
    ageAtDebut:
      d.birthDate ? (Date.parse(d.debutDate) - Date.parse(d.birthDate)) / (365.2425 * 86400000) : null,

    seasonStart: cal.leagueOpener,
    firstGameDate: cal.firstGameDate,
    overseasGapDays: cal.overseasOpenerGapDays,
    seasonEnd: cal.regularSeasonEndDate,
    seasonLength: cal.lengthDays,
    cutoff: cal.cutoff,
    preLineDays: cal.preLineDays,
    excludedSeason: cal.excluded,

    // Two clocks. `relDay` is measured on the debut, which is what the earlier
    // pass had. `addRelDay` is measured on the day the wire says he joined the
    // active roster, which is when service actually starts — a man can sit on
    // the roster for days before he plays, and that smears the debut clock
    // rightward.
    relDay,
    seasonDay,
    rosterAddDate: add?.addDate ?? null,
    rosterAddCode: add?.addCode ?? null,
    addRelDay,
    addSeasonDay: add ? dayDiff(add.addDate, cal.leagueOpener) : null,
    clubId,

    mlsNextRaw: mlsNext?.raw ?? null,
    mlsNextYears: mlsNext?.years ?? null,
    mlsNextDays: mlsNext?.days ?? null,
    bankedFullYear: mlsNext ? mlsNext.years >= 1 : null,
    // A bare-integer `mls` cell is not a service figure. 2,926 of the 19,308
    // populated cells (15.2%) hold one, and they mix two different things: an
    // exactly-round figure that is right (Shohei Ohtani reads 8 in 2026, and an
    // Opening Day 2018 debut with no demotion really does bank 8.000) with a
    // rounded count of SEASONS that is wrong. Jonny Venters reads 1, 2, 3, 4, 5
    // in 2011-2015 and then 5.159 in 2019; he debuted 2010-04-17, so entering
    // 2011 he held about 0.168, not 1.000. Derek Law reads 1 in 2017 while his
    // own 2018 row (1.11) proves 2017 was 0.110. Nothing in the cell separates
    // the two, so a service test excludes the integers rather than trusting
    // them. See docs/service-time-debut-clock.md.
    mlsNextIsBareInteger: mlsNext ? Number.isInteger(Number(mlsNext.raw)) : null,

    ilAny21: rosterNeed(clubId, add?.addDate ?? d.debutDate, 21, d.posType === 'Pitcher')?.any ?? null,
    ilSameGroup21:
      rosterNeed(clubId, add?.addDate ?? d.debutDate, 21, d.posType === 'Pitcher')?.sameGroup ?? null,
    ilLongTerm21:
      rosterNeed(clubId, add?.addDate ?? d.debutDate, 21, d.posType === 'Pitcher')?.longTerm ?? null,
    ilSameGroup7:
      rosterNeed(clubId, add?.addDate ?? d.debutDate, 7, d.posType === 'Pitcher')?.sameGroup ?? null,

    draftRound: ped?.draftRound ?? null,
    draftTier: ped?.draftTier ?? null,
    seasonsToDebut: ped?.seasonsToDebut ?? null,
    topLevel: ped?.topLevel ?? null,
    awardTier: awardTier.get(d.id) ?? null,
    inProspectCohort: !!ped,
  })
}

const meta = {
  builtAt: new Date().toISOString(),
  debuts: panel.length,
  seasons: [...calendar.keys()].sort(),
  excludedSeasons: [...calendar.values()].filter((c) => c.excluded).map((c) => c.season),
  debutsWithNoWireRosterAdd: noWireAdd,
  debutsInProspectCohort: panel.filter((p) => p.inProspectCohort).length,
  note: 'relDay <= 0 means a full 172-day service year was still reachable; relDay >= 1 means it was not.',
}
// panel.json is a BARE ARRAY, one row per debut. The research-db loader's
// generic rule keeps a bare array's natural shape, so the view has real
// columns; wrapping it as { meta, rows } gives a view with two columns called
// meta and rows and nothing queryable underneath. The metadata goes beside it.
await writeFile(local('panel'), JSON.stringify(panel, null, 0))
await writeFile(local('panel-meta'), JSON.stringify(meta, null, 1))
process.stdout.write(JSON.stringify(meta, null, 1) + '\n')

// A quick coverage table so a silent hole is visible rather than assumed away.
const bySeason = new Map()
for (const p of panel) {
  if (!bySeason.has(p.debutSeason)) bySeason.set(p.debutSeason, { n: 0, wire: 0, mls: 0 })
  const s = bySeason.get(p.debutSeason)
  s.n++
  if (p.rosterAddDate) s.wire++
  if (p.mlsNextRaw) s.mls++
}
process.stdout.write('\nseason  debuts  wire-add  mls-next\n')
for (const [y, s] of [...bySeason.entries()].sort((a, b) => a[0] - b[0])) {
  process.stdout.write(
    `${y}    ${String(s.n).padStart(5)}   ${String(s.wire).padStart(6)} (${((100 * s.wire) / s.n).toFixed(0)}%)  ${String(s.mls).padStart(5)} (${((100 * s.mls) / s.n).toFixed(0)}%)\n`,
  )
}
