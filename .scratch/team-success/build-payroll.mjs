// Builds the club-payroll panel: attributed dollars for every team, every
// season 2000-2025 -- the one row in docs/team-success-research.md's factor
// catalog that reads "Blocked on a data source".
//
// THE PROBLEM. scripts/data/contracts/salaries.csv holds 27,349 player-season
// salary rows and NO CLUB COLUMN (docs/contracts-data-caveats.md, defect 4).
// A club payroll cannot be read out of that file. It has to be joined.
//
// THE JOIN. .scratch/team-success/roster-age-cache.json is the missing club
// column. It is keyed `{group}-{teamId}-{season}` and each key holds the
// per-player STINT rows for that club and season, with plate appearances as
// the weight for hitting and innings pitched for pitching. Because
// build-roster-age.mjs pulled it with a `teamId` filter, a player traded in
// mid-season appears once per club, each row carrying only that club's share
// of his playing time -- which is exactly what an attribution needs.
// public/data/contracts-history/identity/salaries.json is the row-for-row MLB
// id crosswalk that links the two (ADR-0066).
//
// THE RULE. Each salary row is attributed across the clubs the man played for
// that season, PRO RATA by his share of playing time at each. One club takes
// the whole salary. A traded man splits it.
//
// HOW PA AND IP COMBINE. They are different units, so they are made
// commensurate before they are added. Every plate appearance in a season is
// also a batter faced, so the league's own PA-per-inning ratio converts one
// unit into the other, and it is read out of this same cache per season
// rather than assumed. A player's weight at a club is therefore
// `PA + paPerInning * IP`. The choice can only move a number for a man who
// both hit and pitched AND changed clubs in the same season; the builder
// counts those rows and prints the count, because W1.2 tests the alternatives.
//
// WHICH ROWS COUNT. Four read-time rules from docs/contracts-data-caveats.md,
// in order. None of them deletes a row from the CSV -- a row's index IS its
// identity (ADR-0067), so every exclusion happens here, on a field.
//   1. Front office. `resolveRole()` drops the 23 genuine executives and KEEPS
//      the 27 rows where a man's later title was written over a season he was
//      still playing. Filtering on the position cell alone would delete
//      $74,756,667 of real player salary.
//   2. Repeated rows. The 27 verbatim duplicate pairs are one worksheet row
//      exported twice. One row of each pair is dropped.
//   3. Twinned obligation rows. A row with no position and no service time,
//      when another row for the same man and year carries a position, is a
//      second club's share of a salary the player's own row already states in
//      full. It is dropped, because the pro-rata split above is what divides
//      that salary between the two clubs. An ORPHAN obligation row -- no
//      positioned row anywhere for that man that year -- is kept.
//   4. Money. `parseMoneyCell()` decides. A non-numeric cell (2021 Robinson
//      Cano reads `forfeited`) is a status that carries no dollars.
// An `ambiguous` or `unresolved` identity row carries `mlbId: null` and cannot
// be joined at all. Those rows stay in the coverage denominator and never
// enter the numerator -- that is what makes the coverage figure honest.
//
// THE POPULATION REGIME. docs/contracts-data-caveats.md sets 2000-2005 and
// 2006-2026 as two regimes. The file lists fewer men than 30 clubs can field
// before 2006, and the men it omits are the cheap ones, so an early season
// reads richer than the league was. Every season row and every team row
// carries the flag and its own coverage figures, so the thinness is visible in
// the panel instead of silent inside it.
//
// Run: node .scratch/team-success/build-payroll.mjs
// Writes: payroll-panel.json, payroll-by-player.json, paid-no-appearance.json
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseCsv } from '../../scripts/lib/csv.mjs'
import { ALL_MLB_TEAM_IDS } from '../../src/lib/contracts/clubCodes.js'
import { parseMoneyCell } from '../../src/lib/contracts/parseMoney.js'
import { normalizePosition, resolveRole } from '../../src/lib/contracts/positions.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = join(__dirname, '..', '..')

const FIRST_SEASON = 2000
const LAST_SEASON = 2025 // the stint cache ends here; 2026 has no roster to join
const REGIME_BREAK = 2006 // docs/contracts-data-caveats.md, "the two population regimes"
const PITCHER_POSITIONS = new Set(['P', 'RHP', 'LHP', 'SP', 'RP'])

const read = (p) => readFileSync(join(REPO, p), 'utf8')
const readJson = (p) => JSON.parse(read(p))

// --------------------------------------------------------------- the inputs

const salaryRows = parseCsv(read('scripts/data/contracts/salaries.csv'))
const identity = readJson('public/data/contracts-history/identity/salaries.json')

if (identity.length !== salaryRows.length) {
  throw new Error(`identity holds ${identity.length} rows against ${salaryRows.length} salary rows`)
}
identity.forEach((entry, i) => {
  // The crosswalk is positional (ADR-0067). If it ever stops being positional,
  // every id below points at the wrong man and nothing else here would notice.
  if (entry.rowKey !== `salaries#${i}`) throw new Error(`row ${i} keys as ${entry.rowKey}`)
  if (entry.season !== Number(salaryRows[i].year)) throw new Error(`row ${i} season disagrees`)
})

// 2025 and 2026 mark 48 names with a trailing asterisk for deferred money. The
// same men appear unmarked elsewhere, so the mark comes off before any join.
const cleanName = (raw) => String(raw ?? '').replace(/\*+/g, '').trim()

const seasonPlayerNames = new Map()
for (let year = FIRST_SEASON; year <= LAST_SEASON; year++) {
  const pool = readJson(`public/data/contracts-history/season-players/${year}.json`)
  seasonPlayerNames.set(year, new Set(pool.map((p) => p.lastFirstName)))
}

// --------------------------------------------------- the stints, by player

const cache = readJson('.scratch/team-success/roster-age-cache.json')
// `${season}|${personId}` -> Map<teamId, { pa, ip }>
const stints = new Map()
const leaguePlayingTime = new Map() // season -> { pa, ip }
let cacheStintRows = 0
let cacheZeroWeightRows = 0

for (const [key, splits] of Object.entries(cache)) {
  const [group, teamIdRaw, seasonRaw] = key.split('-')
  const teamId = Number(teamIdRaw)
  const season = Number(seasonRaw)
  let league = leaguePlayingTime.get(season)
  if (!league) {
    league = { pa: 0, ip: 0 }
    leaguePlayingTime.set(season, league)
  }
  for (const split of splits) {
    if (!split.personId) continue
    cacheStintRows++
    const weight = Number.isFinite(split.weight) ? split.weight : 0
    if (weight <= 0) cacheZeroWeightRows++
    if (group === 'hitting') league.pa += weight
    else league.ip += weight
    const playerKey = `${season}|${split.personId}`
    let byTeam = stints.get(playerKey)
    if (!byTeam) {
      byTeam = new Map()
      stints.set(playerKey, byTeam)
    }
    const entry = byTeam.get(teamId) ?? { pa: 0, ip: 0 }
    if (group === 'hitting') entry.pa += weight
    else entry.ip += weight
    byTeam.set(teamId, entry)
  }
}

// Plate appearances per inning pitched, from the league's own totals for that
// season. Every plate appearance is a batter faced, so this converts an inning
// into the PA units the hitting weight already uses.
const paPerInning = new Map()
for (const [season, { pa, ip }] of leaguePlayingTime) {
  paPerInning.set(season, ip > 0 ? pa / ip : 0)
}

// ---------------------------------------------------- the read-time filters

// Rules 2 and 3 both need to know what else the file holds for the same man in
// the same year, so both run over a grouping of the rows.
//
// The rules run TWICE, over two different groupings, and the drops are unioned.
// The caveats doc groups on the NAME, and says so explicitly: 2010 holds both
// "Taveras, Willy" and "Tavares, Willy" for one man, those two rows do not
// group, and "88 is a floor on the duplicate count, not a ceiling". The name is
// a proxy for the man. The resolved `mlbId` IS the man, so a second pass keyed
// on the id catches what a spelling error hides. It finds one more twinned
// obligation row -- Willy Taveras' misspelt 2010 row, $4,000,000 that his own
// row already states in full.
function groupRows(keyOf) {
  const groups = new Map()
  salaryRows.forEach((row, i) => {
    const key = keyOf(row, i)
    if (key == null) return
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(i)
  })
  return groups
}

const isObligation = (row) => row.position === '' && row.mls === ''

const droppedRepeat = new Set()
const droppedTwinnedObligation = new Set()

function applyDuplicateRules(groups) {
  for (const [, indexes] of groups) {
    if (indexes.length < 2) continue
    const hasPositioned = indexes.some((i) => !isObligation(salaryRows[i]))
    const seen = new Set()
    for (const i of indexes) {
      const row = salaryRows[i]
      if (isObligation(row)) {
        // Rule 3. An orphan obligation row -- nothing positioned for this man
        // this year -- is real money nothing else records, so it stays.
        if (hasPositioned) droppedTwinnedObligation.add(i)
        continue
      }
      // Rule 2. Keep the first row of a verbatim pair, drop every later copy.
      const signature = `${row.position}|${row.mls}|${row.salary}`
      if (seen.has(signature)) droppedRepeat.add(i)
      else seen.add(signature)
    }
  }
}

applyDuplicateRules(groupRows((row) => `${row.year}|${cleanName(row.player)}`))
applyDuplicateRules(
  groupRows((row, i) => (identity[i].mlbId == null ? null : `${row.year}|${identity[i].mlbId}`)),
)

// ------------------------------------------------------------- the pipeline

const counts = {
  totalRows: salaryRows.length,
  outOfWindow: 0,
  frontOffice: 0,
  droppedRepeat: 0,
  droppedTwinnedObligation: 0,
  noDollars: 0,
  eligibleRows: 0,
  untrustedId: 0,
  noStint: 0,
  attributedRows: 0,
  splitRows: 0,
  bothGroupsAndSplit: 0,
  zeroWeightEqualSplit: 0,
  groupFromStints: 0,
  groupUnknown: 0,
}

const attributed = [] // file B
const paidNoAppearance = [] // file C
const perSeason = new Map()
// `${season}|${mlbId}` -> the salary rows that resolved to that one man. More
// than one row here is a DEFECT IN THE CROSSWALK, not in this join: two
// different men share one id. It is reported, never repaired here -- ADR-0067's
// admin workbench is where a wrong id gets corrected.
const rowsPerPlayerSeason = new Map()

function seasonBucket(season) {
  let bucket = perSeason.get(season)
  if (!bucket) {
    bucket = {
      eligibleRows: 0,
      eligibleDollars: 0,
      attributedRows: 0,
      attributedDollars: 0,
      teams: new Map(),
    }
    perSeason.set(season, bucket)
  }
  return bucket
}

salaryRows.forEach((row, i) => {
  const season = Number(row.year)
  if (season < FIRST_SEASON || season > LAST_SEASON) {
    counts.outOfWindow++
    return
  }
  const name = cleanName(row.player)
  const role = resolveRole({ position: row.position, player: name }, seasonPlayerNames.get(season))
  if (role === 'front-office') {
    counts.frontOffice++
    return
  }
  if (droppedRepeat.has(i)) {
    counts.droppedRepeat++
    return
  }
  if (droppedTwinnedObligation.has(i)) {
    counts.droppedTwinnedObligation++
    return
  }
  const money = parseMoneyCell(row.salary, 'salary')
  if (!Number.isFinite(money.amount)) {
    counts.noDollars++
    return
  }

  const bucket = seasonBucket(season)
  bucket.eligibleRows++
  bucket.eligibleDollars += money.amount
  counts.eligibleRows++

  const mlbId = identity[i].mlbId
  if (mlbId == null) {
    counts.untrustedId++
    return
  }

  const byTeam = stints.get(`${season}|${mlbId}`)
  if (!byTeam || byTeam.size === 0) {
    counts.noStint++
    paidNoAppearance.push({ season, mlbId, name, salary: money.amount })
    return
  }

  const ratio = paPerInning.get(season) ?? 0
  const weights = [...byTeam.entries()].map(([teamId, entry]) => ({
    teamId,
    weight: entry.pa + ratio * entry.ip,
    pa: entry.pa,
    ip: entry.ip,
  }))
  let total = weights.reduce((sum, w) => sum + w.weight, 0)
  if (total <= 0) {
    // He appeared, but recorded no plate appearance and no inning -- a pinch
    // runner or a defensive replacement. Split his salary equally over the
    // clubs he appeared for rather than dropping him.
    counts.zeroWeightEqualSplit++
    for (const w of weights) w.weight = 1
    total = weights.length
  }

  // W0.3's normalizer decides the group, so one salary row carries ONE group
  // and W2.2's hitter/pitcher split sums back to payroll. A man who both hit
  // and pitched still took one salary. When the position cell says nothing,
  // the larger PA-equivalent share across the season decides instead.
  const primary = normalizePosition(row.position).primary
  let group
  if (primary === 'unknown') {
    const pa = weights.reduce((sum, w) => sum + w.pa, 0)
    const ip = weights.reduce((sum, w) => sum + ratio * w.ip, 0)
    if (pa === 0 && ip === 0) {
      group = 'unknown'
      counts.groupUnknown++
    } else {
      group = ip > pa ? 'pitching' : 'hitting'
      counts.groupFromStints++
    }
  } else {
    group = PITCHER_POSITIONS.has(primary) ? 'pitching' : 'hitting'
  }

  const split = weights.length > 1
  counts.attributedRows++
  if (split) counts.splitRows++
  if (split && weights.some((w) => w.pa > 0) && weights.some((w) => w.ip > 0)) {
    counts.bothGroupsAndSplit++
  }
  bucket.attributedRows++
  bucket.attributedDollars += money.amount

  const playerSeasonKey = `${season}|${mlbId}`
  let sameId = rowsPerPlayerSeason.get(playerSeasonKey)
  if (!sameId) {
    sameId = []
    rowsPerPlayerSeason.set(playerSeasonKey, sameId)
  }
  sameId.push({ rowKey: `salaries#${i}`, name, position: row.position, salary: money.amount })

  for (const w of weights) {
    const share = w.weight / total
    const dollars = money.amount * share
    attributed.push({
      season,
      teamId: w.teamId,
      mlbId,
      name,
      attributedSalary: dollars,
      shareOfPlayerSeason: share,
      group,
    })
    let team = bucket.teams.get(w.teamId)
    if (!team) {
      team = { payroll: 0, players: new Set(), split: new Set() }
      bucket.teams.set(w.teamId, team)
    }
    team.payroll += dollars
    team.players.add(mlbId)
    if (split) team.split.add(mlbId)
  }
})

counts.paidNoAppearanceRows = paidNoAppearance.length
counts.attributedTeamRows = attributed.length

// One id, two men. Two shapes, both upstream of this builder: a homonym pair
// the crosswalk collapsed (anomaly 1, category 3 -- the doc says never merge
// them), and a wrong fuzzy match on a near name ("Hurt, Kyle" onto Kyle Hart).
// Every one of these rows is REAL money, so it stays in the payroll. What it
// buys is attributed to the wrong man's clubs. The panel names them so a reader
// can see the size of the defect instead of inheriting it in silence.
const identityCollisions = []
for (const [key, sameId] of rowsPerPlayerSeason) {
  if (sameId.length < 2) continue
  const [season, mlbId] = key.split('|').map(Number)
  identityCollisions.push({
    season,
    mlbId,
    rows: sameId,
    dollars: sameId.reduce((sum, r) => sum + r.salary, 0),
  })
}
identityCollisions.sort((a, b) => b.season - a.season || a.mlbId - b.mlbId)
counts.identityCollisions = identityCollisions.length
counts.identityCollisionDollars = identityCollisions.reduce((sum, c) => sum + c.dollars, 0)

// ---------------------------------------------------------------- the panel

const seasons = []
for (let year = FIRST_SEASON; year <= LAST_SEASON; year++) {
  const bucket = perSeason.get(year)
  if (!bucket) throw new Error(`no salary rows survived for ${year}`)
  const coverageRows = bucket.attributedRows / bucket.eligibleRows
  const coverageDollars = bucket.attributedDollars / bucket.eligibleDollars
  const meanPayroll = bucket.attributedDollars / ALL_MLB_TEAM_IDS.length
  const regime = year < REGIME_BREAK ? '2000-2005' : '2006-2026'
  const teams = {}
  for (const teamId of ALL_MLB_TEAM_IDS) {
    const team = bucket.teams.get(teamId) ?? { payroll: 0, players: new Set(), split: new Set() }
    teams[teamId] = {
      payroll: team.payroll,
      payrollIndex: meanPayroll > 0 ? team.payroll / meanPayroll : null,
      playerCount: team.players.size,
      splitPlayerCount: team.split.size,
      // NO coverage figure lives on a club row, and there is a reason it
      // cannot. A row that fails to attribute has no club -- having no club is
      // EXACTLY why it failed -- so a club-specific coverage rate is not a
      // number this join is able to produce. A season rate copied onto a club
      // row reads as that club's own rate, which is worse than no field at
      // all: 2025 Washington would carry 0.954 beside dollars that fall far
      // short of published. Coverage lives once, on the season. `regime` stays
      // here because a regime is a label, not a rate, so no reader can mistake
      // it for a club measurement.
      regime,
    }
  }
  seasons.push({
    year,
    regime,
    // 2000-2005 lists fewer men than 30 clubs can field, and the men it omits
    // are the cheap ones. A figure from this regime under-reports the league.
    regimeComplete: regime === '2006-2026',
    eligibleRows: bucket.eligibleRows,
    eligibleDollars: bucket.eligibleDollars,
    attributedRows: bucket.attributedRows,
    attributedDollars: bucket.attributedDollars,
    coverageRows,
    coverageDollars,
    meanPayroll,
    paPerInning: paPerInning.get(year),
    teams,
  })
}

const generatedAt = new Date().toISOString()
const panel = {
  generatedAt,
  source:
    'scripts/data/contracts/salaries.csv joined to .scratch/team-success/roster-age-cache.json ' +
    'through public/data/contracts-history/identity/salaries.json',
  method:
    'Each salary row is attributed across the clubs the player appeared for that season, pro rata ' +
    "by PA + (league PA per inning) * IP at each club. See this builder's header for the four " +
    'read-time exclusion rules and docs/contracts-data-caveats.md for the population regimes. ' +
    'coverageRows and coverageDollars are SEASON figures and sit on the season alone: an ' +
    'unattributed row has no club, so no club-specific coverage rate exists.',
  window: [FIRST_SEASON, LAST_SEASON],
  counts,
  identityCollisions,
  seasons,
}

writeFileSync(join(__dirname, 'payroll-panel.json'), `${JSON.stringify(panel, null, 1)}\n`)
writeFileSync(
  join(__dirname, 'payroll-by-player.json'),
  `${JSON.stringify({
    generatedAt,
    window: [FIRST_SEASON, LAST_SEASON],
    groupRule:
      'normalizePosition() decides the group from the salary row position cell; an unknown cell ' +
      'falls back to the larger PA-equivalent share of that season, and to "unknown" if both are zero',
    rows: attributed,
  })}\n`,
)
writeFileSync(
  join(__dirname, 'paid-no-appearance.json'),
  `${JSON.stringify({
    generatedAt,
    window: [FIRST_SEASON, LAST_SEASON],
    definition:
      'a salary row that survives the four read-time exclusion rules, carries a trustworthy mlbId ' +
      'and a parsed dollar amount, and has NO MLB stint in that season. Not payroll. W1.3 classifies these.',
    rows: paidNoAppearance,
  })}\n`,
)

// ----------------------------------------------------------------- the report

const totalEligible = seasons.reduce((sum, s) => sum + s.eligibleDollars, 0)
const totalAttributed = seasons.reduce((sum, s) => sum + s.attributedDollars, 0)
const usd = (n) => `$${(n / 1e9).toFixed(2)}B`
const pct = (n) => `${(n * 100).toFixed(1)}%`

console.log('stint cache: %d rows, %d of them zero weight', cacheStintRows, cacheZeroWeightRows)
console.log(counts)
console.log(
  'rows: %d eligible, %d attributed (%s)',
  counts.eligibleRows,
  counts.attributedRows,
  pct(counts.attributedRows / counts.eligibleRows),
)
console.log('dollars: %s of %s (%s)', usd(totalAttributed), usd(totalEligible), pct(totalAttributed / totalEligible))
console.log('split over more than one club: %s of joined rows', pct(counts.splitRows / counts.attributedRows))
console.log(
  'one id, two men: %d player-seasons, $%sM -- reported, never repaired here',
  counts.identityCollisions,
  (counts.identityCollisionDollars / 1e6).toFixed(1),
)

let worstRows = seasons[0]
let worstDollars = seasons[0]
for (const season of seasons) {
  if (season.coverageRows < worstRows.coverageRows) worstRows = season
  if (season.coverageDollars < worstDollars.coverageDollars) worstDollars = season
  console.log(
    '%d  %s  rows %s  dollars %s  attributed %s',
    season.year,
    season.regime,
    pct(season.coverageRows),
    pct(season.coverageDollars),
    usd(season.attributedDollars),
  )
}
console.log('thinnest row coverage: %d at %s', worstRows.year, pct(worstRows.coverageRows))
console.log('thinnest dollar coverage: %d at %s', worstDollars.year, pct(worstDollars.coverageDollars))

// ----------------------------------------------------------- the sanity check
// Three seasons whose top clubs are a matter of public record. If the
// attribution is wrong, it is wrong here first.
const rank = (year) =>
  Object.entries(seasons.find((s) => s.year === year).teams)
    .sort((a, b) => b[1].payroll - a[1].payroll)
    .map(([teamId]) => Number(teamId))

const EXPECTED = [
  [2025, [121, 119, 143, 147, 141]], // Mets, Dodgers, Phillies, Yankees, Blue Jays
  [2015, [119, 147]], // Dodgers, Yankees
  [2003, [147]], // Yankees
]
const failures = []
for (const [year, expected] of EXPECTED) {
  const actual = rank(year).slice(0, expected.length)
  console.log('%d top %d: %s', year, expected.length, actual.join(', '))
  if (actual.join(',') !== expected.join(',')) {
    failures.push(`${year}: expected ${expected.join(', ')}, got ${actual.join(', ')}`)
  }
}
if (failures.length > 0) {
  throw new Error(`attribution sanity check failed --\n  ${failures.join('\n  ')}`)
}
console.log('sanity: 2025, 2015 and 2003 all match')
