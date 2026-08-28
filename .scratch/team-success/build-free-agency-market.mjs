// Spike: does the free-agent market pay for what it gets?
//
// Builds one row per free_agency.csv signing (5,598 rows, 1991-2026), joined to:
//   - the ADR-0066 identity crosswalk (public/data/contracts-history/identity/
//     free_agency.json) for mlbId -- reused as-is, never re-derived (W0's own
//     rule: a second name-match join over this data would not agree with the
//     one every other contracts surface already trusts).
//   - public/data/war-history/{shard}.json for career WAR by season, keyed
//     mlbId % 100 (src/lib/shardKey.js's shardKey100 -- reused, not re-guessed).
//     This shard only carries COMPLETED seasons; 2025 is the newest one, so
//     2026 has no row here yet (src/api/war.js's own header explains why: the
//     live season lives in war.json instead and never gets folded into this
//     history file mid-season).
//
// MONEY: every guarantee/aav cell is read through parseMoneyCell(raw, column,
// context) from src/lib/contracts/parseMoney.js, THE THREE-ARGUMENT FORM.
// column matters (guarantee/aav are the only two columns where a bare "1" is
// the minor-league-deal sentinel, not one dollar) and so does context
// (years/details from the SAME row -- the sentinel classifier needs both to
// tell "minor-league deal" from the three rows that aren't). Skipping either
// argument silently re-creates the exact defect docs/contracts-data-caveats.md
// documents: guarantee=1 read as $1, which pulls every pre-2024 guarantee
// distribution toward zero. This file computes zero derived guarantee
// statistics from a raw cell -- every dollar in the output panel came out of
// parseMoneyCell.
//
// WHAT THIS FILE DOES NOT DO: decide whether the market over- or under-pays.
// That is analyze-free-agency-market.mjs, kept separate so the expensive
// join (war-history + identity, ~5,600 rows) runs once and the analysis can
// be re-run and revised freely against the same cached panel.
//
// Run: node .scratch/team-success/build-free-agency-market.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..', '..')
const importFrom = (relPath) => import(pathToFileURL(join(REPO_ROOT, relPath)).href)

const { parseCsv } = await importFrom('scripts/lib/csv.mjs')
const { parseMoneyCell } = await importFrom('src/lib/contracts/parseMoney.js')
const { normalizePosition } = await importFrom('src/lib/contracts/positions.js')
const { resolveClubCode } = await importFrom('src/lib/contracts/clubCodes.js')

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'))
}

// ------------------------------------------------------------- war-history
// shardKey100 reimplemented locally (src/lib/shardKey.js has no other
// imports, but this file already resolves everything else through file URLs
// above -- one more indirection buys nothing).
function shardKey100(personId) {
  return String(Math.abs(Number(personId) || 0) % 100).padStart(2, '0')
}

const warHistoryDir = join(REPO_ROOT, 'public/data/war-history')
const warShardCache = new Map()
function warShard(personId) {
  const key = shardKey100(personId)
  if (!warShardCache.has(key)) {
    warShardCache.set(key, readJson(join(warHistoryDir, `${key}.json`)))
  }
  return warShardCache.get(key)
}
// Total (bat + pit) WAR for one player in one season, 0 if the player has no
// row that season in either group (never null -- "did not play a season
// covered by this file" and "played and produced exactly 0 WAR" would need a
// different signal, and this spike does not need to tell them apart).
function warFor(personId, season) {
  const shard = warShard(personId)
  const bat = shard.bat?.[String(personId)]?.[String(season)]
  const pit = shard.pit?.[String(personId)]?.[String(season)]
  return (Number.isFinite(bat) ? bat : 0) + (Number.isFinite(pit) ? pit : 0)
}
const MAX_WAR_SEASON = Math.max(...readJson(join(warHistoryDir, '00.json')).seasons)

// ------------------------------------------------------------- identity
const identity = readJson(join(REPO_ROOT, 'public/data/contracts-history/identity/free_agency.json'))

// ------------------------------------------------------------- CSV
const csvText = readFileSync(join(REPO_ROOT, 'scripts/data/contracts/free_agency.csv'), 'utf8')
const rows = parseCsv(csvText)
if (rows.length !== identity.length) {
  throw new Error(`free_agency.csv has ${rows.length} rows but the identity crosswalk has ${identity.length} -- rowKey alignment is broken`)
}

// -------------------------------------------------- position -> broad group
// Six buckets a "does the market overpay by position" question can use.
// primary carries the fielding position OR the pitcher hand (RHP/LHP/P);
// secondary carries SP/RP only when the source cell tagged a role
// explicitly (see src/lib/contracts/positions.js's header) -- most pitcher
// rows do NOT carry that tag ("rhp" alone, no "-s"/"-c"), so posGroup for
// those stays 'P' (role unspecified) rather than being guessed at.
function posGroup(rawPosition) {
  const { primary, secondary, role } = normalizePosition(rawPosition)
  if (role !== 'player') return 'non-player'
  if (secondary.includes('SP')) return 'SP'
  if (secondary.includes('RP')) return 'RP'
  if (primary === 'SP') return 'SP'
  if (primary === 'RP') return 'RP'
  if (primary === 'RHP' || primary === 'LHP' || primary === 'P') return 'P'
  if (primary === 'C') return 'C'
  if (['1B', '2B', '3B', 'SS', 'INF'].includes(primary)) return 'IF'
  if (['LF', 'CF', 'RF', 'OF'].includes(primary)) return 'OF'
  if (primary === 'DH') return 'DH'
  return 'unknown'
}

// ---------------------------------------------------- qualifying_offer era
// Confirmed against the rows themselves (not assumed): the old Type A/B/C
// free-agent compensation regime's last year in this file is 2012 (Type A
// 1991-2012, Type B 1991-2012, Type C 1991-2007); the earliest 'rejected'
// row is 2013 and the earliest 'accepted' row is 2016. The boundary is
// therefore clean at 2012/2013 -- a labelling change and the rule change
// land in the same offseason here, which the dispatch warned might not
// always hold, so this was checked rather than assumed.
const QO_OLD_REGIME = new Set(['Type A', 'Type B', 'Type C'])
const QO_NEW_REGIME = new Set(['rejected', 'accepted'])
function qoEra(value) {
  const v = (value ?? '').trim()
  if (QO_OLD_REGIME.has(v)) return 'pre-2013-compensation'
  if (QO_NEW_REGIME.has(v)) return 'qualifying-offer'
  return null // blank, or the single '-' placeholder row
}

const PRIOR_WINDOW = 3 // trailing seasons summed for "what the market had seen"

let excludedUnscoreable = 0 // years=0/blank/signing year has no completed season yet
let excludedNoMlbId = 0

const players = []
for (let i = 0; i < rows.length; i++) {
  const r = rows[i]
  const idRow = identity[i]
  if (idRow.rowKey !== `free_agency#${i}`) {
    throw new Error(`identity row ${i} carries rowKey ${idRow.rowKey}, expected free_agency#${i}`)
  }

  const year = Number(r.year)
  const context = { years: r.years, details: r.details }
  const guarantee = parseMoneyCell(r.guarantee, 'guarantee', context)
  const aav = parseMoneyCell(r.aav, 'aav', context)
  const yearsNum = r.years === '' ? null : Number(r.years)
  const contractYears = Number.isFinite(yearsNum) && yearsNum > 0 ? yearsNum : null

  const oldClub = resolveClubCode(r.old_club)
  const newClub = resolveClubCode(r.new_club)

  const mlbId = idRow.mlbId ?? null
  if (!mlbId) excludedNoMlbId++

  // Contract-year WAR is only meaningful when the row has a real length AND
  // every one of its seasons is a COMPLETED season in war-history. A row
  // signed for 2026 (or any row whose last contract year runs past 2025)
  // cannot be scored yet -- excluded from every WAR-delivered stat below,
  // counted, never silently zero-filled.
  const contractEndYear = contractYears ? year + contractYears - 1 : null
  const fullyScoreable = Boolean(mlbId && contractYears && contractEndYear <= MAX_WAR_SEASON && year <= MAX_WAR_SEASON)
  if (!fullyScoreable) excludedUnscoreable++

  let priorWar3 = null
  let priorWar1 = null
  let contractYearWar = null // [war_year1, war_year2, ...], only when fullyScoreable
  let futureWarActual = null
  let futureWarPerYear = null
  if (mlbId) {
    priorWar3 = 0
    for (let back = 1; back <= PRIOR_WINDOW; back++) priorWar3 += warFor(mlbId, year - back)
    priorWar1 = warFor(mlbId, year - 1)
  }
  if (fullyScoreable) {
    contractYearWar = []
    for (let k = 0; k < contractYears; k++) contractYearWar.push(warFor(mlbId, year + k))
    futureWarActual = contractYearWar.reduce((a, b) => a + b, 0)
    futureWarPerYear = futureWarActual / contractYears
  }

  players.push({
    rowKey: `free_agency#${i}`,
    year,
    player: r.player,
    mlbId,
    posGroup: posGroup(r.position),
    rawPosition: r.position,
    age: r.age === '' ? null : Number(r.age),
    qualifyingOffer: r.qualifying_offer || null,
    qoEra: qoEra(r.qualifying_offer),
    oldClub: oldClub.blank ? null : (oldClub.teamId ?? null),
    oldClubUnrecognized: oldClub === null,
    newClub: newClub.blank ? null : (newClub.teamId ?? null),
    newClubDestination: newClub?.destination ?? null,
    newClubUnrecognized: newClub === null,
    movedClubs:
      oldClub && newClub && !oldClub.blank && !newClub.blank && oldClub.teamId != null && newClub.teamId != null
        ? oldClub.teamId !== newClub.teamId
        : null,
    contractYears,
    guaranteeAmount: guarantee.amount,
    guaranteeStatus: guarantee.status,
    guaranteeDetailsAmount: guarantee.detailsAmount,
    aavAmount: aav.amount,
    aavStatus: aav.status,
    aavDetailsAmount: aav.detailsAmount,
    agentRaw: r.agent && r.agent.trim() !== '-' ? r.agent.trim() : null,
    fullyScoreable,
    priorWar3,
    priorWar1,
    contractYearWar,
    futureWarActual,
    futureWarPerYear,
  })
}

const out = {
  generatedAt: new Date().toISOString(),
  source: 'scripts/data/contracts/free_agency.csv',
  rowCount: rows.length,
  maxWarSeason: MAX_WAR_SEASON,
  priorWindowSeasons: PRIOR_WINDOW,
  excludedNoMlbId,
  excludedUnscoreable,
  players,
}
writeFileSync(join(__dirname, 'free-agency-market.json'), JSON.stringify(out))

console.log('rows', rows.length)
console.log('no mlbId', excludedNoMlbId)
console.log('not fully scoreable (unplayed years, or no mlbId)', excludedUnscoreable)
console.log('fully scoreable', players.filter((p) => p.fullyScoreable).length)
console.log('minor-league-deal sentinel rows', players.filter((p) => p.guaranteeStatus === 'minor-league-deal').length)
console.log('usable guarantee rows', players.filter((p) => p.guaranteeAmount != null).length)
console.log('written to .scratch/team-success/free-agency-market.json')
