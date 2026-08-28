// W3.1 spike: does an arbitration settlement track service time, prior pay
// and performance — and do Baseball Prospectus WARP and MLB's own WAR agree
// about that performance in the first place?
//
// Builds ONE panel, one row per scripts/data/contracts/arbitration.csv row
// (2,420 cases, 2018-2026 — nine seasons, arbitration.csv's whole window,
// docs/contracts-data-caveats.md), joined to:
//   - the case's resolved mlbId, via public/data/contracts-history/identity/
//     arbitration.json (rowKey = `arbitration#<csv row index>`, same index
//     scripts/lib/csv.mjs's parseCsv produces — confirmed against
//     scripts/gen-contracts-identity.mjs, which reads the CSV with the same
//     parser before minting that key).
//   - MLB's own sabermetrics WAR for the PLATFORM season (season - 1) and
//     cumulative through it, from public/data/war-history/*.json.
//
// THE PLATFORM-YEAR TRAP (ADR-0066, and the generator's own comment):
// arbitration.csv's `season` column is the DECISION year, not the year
// played. `prior_warp`/`prior_salary`/`mls` all describe the season BEFORE
// it. gen-contracts-identity.mjs's own arbitration branch says this in code:
// `const lookupSeason = season - 1 // roster lookup at the season the "prior
// year" columns describe`. That is the platform year used here.
//
// THE IDENTITY FILE'S `matchedSeason` IS A DIFFERENT THING — do not confuse
// it with the platform year. It records which season's ROSTER the name
// resolver matched the row's claimed club against (search order season-1,
// season, season+1, season-2 — see gen-contracts-identity.mjs's
// SEASON_SEARCH_OFFSETS), purely to find the right mlbId. It answers "which
// team-season pool proved this is the right man," not "which season does
// prior_warp describe." A trade, or a season the player didn't appear at
// all (prior_warp = "-"/"dnp" on those very rows, checked below), pushes the
// match to a different season than season-1 without changing what
// prior_warp itself measures. Verified against real rows before writing this
// panel: every matchedSeason != season-1 case sampled either had a "-"/"dnp"
// prior_warp (no platform-year data to begin with) or mls >= 5 with a likely
// mid-off-season trade. season-1 is used unconditionally as the platform
// year; matchedSeason is carried into the panel for reference only.
//
// career_warp is BP's cumulative figure through the same platform year. It
// is compared here to a same-window cumulative sum of MLB WAR — bat + pit,
// per season, since a two-way player carries both (src/api/war.js).
//
// No network call: every input here is already checked into the repo.
// Run: node .scratch/contracts/build-arbitration-warp.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCsv } from '../../scripts/lib/csv.mjs'
import { parseMoneyCell } from '../../src/lib/contracts/parseMoney.js'
import { normalizePosition } from '../../src/lib/contracts/positions.js'
import { resolveClubCode } from '../../src/lib/contracts/clubCodes.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..', '..')
const OUT_FILE = join(__dirname, 'arbitration-warp-panel.json')

// ------------------------------------------------------------- load inputs
const csvText = readFileSync(join(REPO_ROOT, 'scripts', 'data', 'contracts', 'arbitration.csv'), 'utf8')
const rows = parseCsv(csvText)

const identity = JSON.parse(
  readFileSync(
    join(REPO_ROOT, 'public', 'data', 'contracts-history', 'identity', 'arbitration.json'),
    'utf8',
  ),
)
if (identity.length !== rows.length) {
  throw new Error(`identity file has ${identity.length} rows, csv has ${rows.length} — they must line up 1:1`)
}

// Every completed-season MLB WAR shard (personId % 100). Loaded whole:
// 100 files, ~1.8 MB total (scripts/gen-war-history.mjs's own header), and
// this panel needs a scattered ~2,400 lookups across the whole set, not a
// handful of shards.
const warHistoryDir = join(REPO_ROOT, 'public', 'data', 'war-history')
const warByShard = new Map() // shardKey -> { bat, pit }
for (const file of readdirSync(warHistoryDir)) {
  if (!file.endsWith('.json')) continue
  const key = file.replace('.json', '')
  warByShard.set(key, JSON.parse(readFileSync(join(warHistoryDir, file), 'utf8')))
}
function shardKey100(personId) {
  return String(Math.abs(Number(personId) || 0) % 100).padStart(2, '0')
}

// war(mlbId, group, season) -> number|undefined. group is 'bat' or 'pit'.
function warFor(mlbId, group, season) {
  const shard = warByShard.get(shardKey100(mlbId))
  const v = shard?.[group]?.[String(mlbId)]?.[String(season)]
  return typeof v === 'number' ? v : undefined
}

// Total MLB WAR for one season — bat + pit, since a two-way player (or a
// position player who logged a mop-up inning) can carry both
// (src/api/war.js's own header: "a two-way player has both"). Returns
// { value, components } where components says which group(s) contributed,
// or null if the player has NEITHER a bat nor a pit entry that season (no
// MLB WAR data at all, not a zero).
function totalWarForSeason(mlbId, season) {
  const b = warFor(mlbId, 'bat', season)
  const p = warFor(mlbId, 'pit', season)
  if (b === undefined && p === undefined) return null
  const components = [b !== undefined ? 'bat' : null, p !== undefined ? 'pit' : null].filter(Boolean)
  return { value: (b ?? 0) + (p ?? 0), components }
}

// Cumulative MLB WAR through and including a season — sums every season key
// present in EITHER group at or before it. A player with no MLB WAR entry
// at all up through that season (never debuted, or debuted after it) gets
// null, not 0 — matching totalWarForSeason's "no data" vs. "played to a 0.0"
// distinction.
function cumulativeWarThrough(mlbId, throughSeason) {
  const shard = warByShard.get(shardKey100(mlbId))
  if (!shard) return { value: null, seasonsCounted: 0 }
  const seasons = new Set()
  for (const group of ['bat', 'pit']) {
    const byYear = shard[group]?.[String(mlbId)]
    if (!byYear) continue
    for (const y of Object.keys(byYear)) {
      if (Number(y) <= throughSeason) seasons.add(Number(y))
    }
  }
  if (seasons.size === 0) return { value: null, seasonsCounted: 0 }
  let sum = 0
  for (const y of seasons) {
    sum += (warFor(mlbId, 'bat', y) ?? 0) + (warFor(mlbId, 'pit', y) ?? 0)
  }
  return { value: Math.round(sum * 100) / 100, seasonsCounted: seasons.size }
}

// ---------------------------------------------------- BP WARP cell parsing
// prior_warp/career_warp are plain numbers on almost every row, but a
// player who did not appear in the platform season reads "-" or "dnp"
// (checked 2026-08-28: 95 dashes + 2 "dnp" + 3 "n/a" + 1 blank = 101 of
// 2,420 prior_warp cells; career_warp is missing on only 3). Kept as `null`
// with the raw text preserved, exactly parseMoneyCell's own "a status is
// not a number" rule, applied here to a WARP cell instead of a dollar cell.
function parseWarpCell(raw) {
  const trimmed = String(raw ?? '').trim()
  if (trimmed === '' || /^-+$/.test(trimmed) || /^(dnp|n\/a)$/i.test(trimmed)) {
    return { value: null, raw: trimmed }
  }
  const n = Number(trimmed)
  return { value: Number.isFinite(n) ? n : null, raw: trimmed }
}

// ------------------------------------------------------------- build rows
const panel = []
const skippedNoId = []
let noteNumericCount = 0
const NUMERIC_TEXT = /^[0-9]+(\.[0-9]+)?$/

for (let i = 0; i < rows.length; i++) {
  const r = rows[i]
  const id = identity[i]
  if (id.rowKey !== `arbitration#${i}`) {
    throw new Error(`identity row ${i} carries rowKey ${id.rowKey}, expected arbitration#${i}`)
  }

  const season = Number(r.season)
  const platformSeason = season - 1

  const { primary: position, role, isPlayer } = normalizePosition(r.position)
  if (role !== 'player' || !isPlayer) {
    // Never seen in the real export (checked: all 2,420 rows classify
    // 'player'), but a future export could add a non-player row the way
    // salaries.csv has 23 of them — fail loudly rather than silently
    // pricing a front-office row as a settlement.
    throw new Error(`arbitration.csv row ${i} (${r.player}) does not classify as a player: role=${role}`)
  }
  const isPitcher = position === 'RHP' || position === 'LHP'

  const priorWarp = parseWarpCell(r.prior_warp)
  const careerWarp = parseWarpCell(r.career_warp)

  const priorSalary = parseMoneyCell(r.prior_salary, 'prior_salary', {})
  const playerRequest = parseMoneyCell(r.player_request, 'player_request', {})
  const clubOffer = parseMoneyCell(r.club_offer, 'club_offer', {})
  const settled = parseMoneyCell(r.settled_salary, 'settled_salary', {})

  const club = resolveClubCode(r.club, season)

  const noteRaw = (r.note ?? '').trim()
  const noteIsNumeric = noteRaw !== '' && NUMERIC_TEXT.test(noteRaw.replace(/[$,]/g, ''))
  if (noteIsNumeric) noteNumericCount++

  const mlbId = id.mlbId ?? null
  let mlbWarPlatform = null
  let mlbWarCareer = null
  if (mlbId != null) {
    const platform = totalWarForSeason(mlbId, platformSeason)
    mlbWarPlatform = platform ? { value: Math.round(platform.value * 100) / 100, components: platform.components } : null
    const career = cumulativeWarThrough(mlbId, platformSeason)
    mlbWarCareer = career.value != null ? { value: career.value, seasonsCounted: career.seasonsCounted } : null
  } else {
    skippedNoId.push({ rowKey: id.rowKey, player: r.player, season, confidence: id.confidence })
  }

  panel.push({
    rowKey: id.rowKey,
    season,
    platformSeason,
    matchedSeason: id.matchedSeason, // identity-resolution detail, NOT the platform year — see header
    player: r.player,
    club: r.club,
    teamId: club?.teamId ?? null,
    mlbId,
    confidence: id.confidence,
    positionRaw: r.position,
    position,
    isPitcher,
    mls: Number(r.mls),
    priorWarp: priorWarp.value,
    priorWarpRaw: priorWarp.raw,
    careerWarp: careerWarp.value,
    careerWarpRaw: careerWarp.raw,
    priorSalary,
    playerRequest,
    clubOffer,
    settled,
    noteRaw: noteRaw || null,
    noteIsNumeric,
    mlbWarPlatform,
    mlbWarCareer,
  })
}

const generatedAt = new Date().toISOString()
writeFileSync(
  OUT_FILE,
  JSON.stringify(
    {
      generatedAt,
      source: 'scripts/data/contracts/arbitration.csv (2,420 rows, 2018-2026)',
      n: panel.length,
      skippedNoId: skippedNoId.length,
      noteNumericCount,
      rows: panel,
    },
    null,
    0,
  ),
)

console.log(`wrote ${panel.length} rows to ${OUT_FILE}`)
console.log(`no mlbId at all: ${skippedNoId.length} of ${panel.length}`)
if (skippedNoId.length) console.log(skippedNoId)
console.log(
  `note column carries a bare number on ${noteNumericCount} of ${panel.length} rows — flagged for the write-up, not used in analysis (see docs/arbitration-warp-vs-war.md)`,
)

const withPlatformWar = panel.filter((p) => p.mlbWarPlatform != null).length
const withCareerWar = panel.filter((p) => p.mlbWarCareer != null).length
console.log(`platform-season MLB WAR resolved: ${withPlatformWar} of ${panel.length}`)
console.log(`career-through MLB WAR resolved: ${withCareerWar} of ${panel.length}`)
