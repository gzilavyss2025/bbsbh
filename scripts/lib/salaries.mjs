// The pure half of scripts/fever/gen-salaries.mjs: everything that turns a pile
// of contract records into a club ledger and a league rollup, with no fetching
// and no filesystem, so test/salaries.test.js can pin the arithmetic that the
// two pages put on screen.
//
// THE ONE RULE THE MONEY MATH RUNS ON: a dollar is committed only when the
// source states a dollar. Cot's writes an out-year either as a figure or as a
// CODE — A1..A4 for an arbitration year nobody has settled yet, FA for a year
// the club has no hold at all, OPT for an option nobody has exercised. A code
// is a status, never an amount, so it adds nothing to a total. That is what
// makes a club's later columns fall away, and the fall is the true shape of the
// book rather than a gap in the data.

// Out-year codes, exactly as Cot's writes them.
const ARBITRATION = /^A\d+$/i
const OPTION = /^(OPT|cond opt|club opt|player opt|mutual opt|vest opt)$/i
const FREE_AGENT = /^FA$/i

// A cell's kind decides its colour, its label, and whether it counts. Kept as
// one function so the ledger, the totals and the legend can never drift apart.
export function cellFor(year, value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { year, kind: 'guaranteed', value }
  }
  const code = typeof value === 'string' ? value.trim() : ''
  if (!code) return { year, kind: 'none' }
  if (ARBITRATION.test(code)) return { year, kind: 'arbitration', code: code.toUpperCase() }
  if (OPTION.test(code)) return { year, kind: 'option', code }
  if (FREE_AGENT.test(code)) return { year, kind: 'free', code: 'FA' }
  return { year, kind: 'other', code }
}

// Which band of the ledger a player sits in. The contract feed says only "P";
// the generator has already split that into SP/RP off the season line, so a
// bare "P" here is an arm with no appearances yet rather than an unknown.
export function positionGroup(pos) {
  if (pos === 'SP') return 'rotation'
  if (pos === 'RP' || pos === 'P') return 'bullpen'
  if (pos == null) return 'offRoster'
  return 'lineup'
}

export const GROUPS = [
  { key: 'lineup', label: 'Lineup' },
  { key: 'rotation', label: 'Rotation' },
  { key: 'bullpen', label: 'Bullpen' },
  { key: 'offRoster', label: 'Off roster' },
]

// A player's row: the current season's salary, then one cell per later year the
// source covers. `committed` is what this player alone puts on the club's book
// across every one of those years.
//
// `place` is his spot on the 40-man — position and age together, because they
// come from the same roster row and a ledger wants both: OOTP's own contract
// sheet puts age beside the name for a reason, since what a club owes a
// thirty-four-year-old in 2030 is a different fact from what it owes a
// twenty-two-year-old. Null for a player the club is still paying with no
// roster place at all.
export function playerRow(record, place, season, years) {
  const pos = place?.pos ?? null
  const outByYear = new Map((record.outYears ?? []).map((entry) => [entry.year, entry.cash ?? entry.cbt]))
  const cells = years.map((year) => {
    if (year === season) {
      const salary = record.salaryUsd
      return salary == null ? { year, kind: 'none' } : { year, kind: 'salary', value: salary }
    }
    return cellFor(year, outByYear.get(year))
  })
  const committed = cells.reduce((sum, cell) => sum + (cell.value ?? 0), 0)
  return {
    id: record.playerId,
    name: record.name,
    pos,
    age: place?.age ?? null,
    salary: record.salaryUsd ?? null,
    cbt: record.cbtUsd ?? null,
    regime: record.regime ?? null,
    estimated: record.estimated === true,
    terms: record.terms ?? null,
    total: record.contractTotalUsd ?? null,
    aav: record.aavUsd ?? null,
    service: record.service ?? null,
    options: record.options ?? null,
    cells,
    committed,
  }
}

// Every year the ledger has a column for: the season itself, plus every later
// year any contract in the set mentions. Read from the data rather than fixed,
// so the grid grows a column the day a club signs past the current horizon.
export function yearsCovered(players, season) {
  const years = new Set([season])
  for (const record of players) {
    for (const entry of record.outYears ?? []) {
      if (Number.isInteger(entry.year) && entry.year > season) years.add(entry.year)
    }
  }
  return [...years].sort((a, b) => a - b)
}

function sortRows(rows) {
  // Biggest commitment first inside its band — the reader is here to see who the
  // money is on, and alphabetical would bury that under whoever starts with A.
  return [...rows].sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0) || a.name.localeCompare(b.name))
}

function median(values) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// One club's ledger. `placeFor` answers with a 40-man place ({ pos, age }) or
// null; a null is not a hole in the data, it is a player the club is still
// paying who has no place on the roster, and he belongs on the page for exactly
// that reason.
export function clubLedger({ meta, team, records, placeFor, season, years }) {
  const rows = records.map((record) => playerRow(record, placeFor(record.playerId), season, years))
  const groups = GROUPS.map((group) => ({
    ...group,
    players: sortRows(rows.filter((row) => positionGroup(row.pos) === group.key)),
  })).filter((group) => group.players.length > 0)

  const totals = years.map((year) => {
    const cells = rows.map((row) => row.cells.find((cell) => cell.year === year))
    return {
      year,
      committed: cells.reduce((sum, cell) => sum + (cell?.value ?? 0), 0),
      players: cells.filter((cell) => cell?.value != null).length,
      options: cells.filter((cell) => cell?.kind === 'option').length,
      arbitration: cells.filter((cell) => cell?.kind === 'arbitration').length,
    }
  })

  const counts = { guaranteed: 0, arbitration: 0, option: 0, free: 0 }
  for (const row of rows) {
    for (const cell of row.cells) {
      if (cell.kind === 'guaranteed' || cell.kind === 'salary') counts.guaranteed += 1
      else if (cell.kind === 'arbitration') counts.arbitration += 1
      else if (cell.kind === 'option') counts.option += 1
      else if (cell.kind === 'free') counts.free += 1
    }
  }

  return {
    meta,
    teamId: team.id,
    abbrev: team.abbrev,
    name: team.name,
    season,
    years,
    groups,
    totals,
    counts,
    payroll: totals[0]?.committed ?? 0,
    committedAfter: totals.slice(1).reduce((sum, entry) => sum + entry.committed, 0),
  }
}

// The whole league, from the same records. Everything here is a sum of the club
// ledgers' own inputs, so a figure on /salaries and the same figure on a club's
// page come from one place.
export function leagueRollup({ meta, teams, byClub, placeFor, season, years }) {
  const clubs = teams
    .map((team) => {
      const records = byClub.get(team.abbrev) ?? []
      const payroll = records.reduce((sum, record) => sum + (record.salaryUsd ?? 0), 0)
      return { teamId: team.id, abbrev: team.abbrev, name: team.name, payroll, players: records.length }
    })
    .sort((a, b) => b.payroll - a.payroll)
    .map((club, index) => ({ ...club, rank: index + 1 }))

  const players = []
  const positionTotals = new Map()
  let covered = 0
  for (const team of teams) {
    for (const record of byClub.get(team.abbrev) ?? []) {
      const salary = record.salaryUsd
      if (salary == null) continue
      const pos = placeFor(record.playerId)?.pos ?? null
      players.push({ id: record.playerId, name: record.name, teamId: team.id, abbrev: team.abbrev, pos, salary })
      if (pos) {
        positionTotals.set(pos, (positionTotals.get(pos) ?? 0) + salary)
        covered += salary
      }
    }
  }
  players.sort((a, b) => b.salary - a.salary || a.name.localeCompare(b.name))

  const positions = [...positionTotals]
    .map(([pos, total]) => ({ pos, total, players: players.filter((p) => p.pos === pos).length }))
    .sort((a, b) => b.total - a.total)

  // "Still owed" is only ever the years the source actually covers, so the card
  // says so rather than implying a career total it cannot see.
  const owed = []
  for (const team of teams) {
    for (const record of byClub.get(team.abbrev) ?? []) {
      const row = playerRow(record, placeFor(record.playerId), season, years)
      if (row.committed > 0) {
        owed.push({ id: row.id, name: row.name, teamId: team.id, abbrev: team.abbrev, remaining: row.committed })
      }
    }
  }
  owed.sort((a, b) => b.remaining - a.remaining)

  const payrolls = clubs.map((club) => club.payroll)
  return {
    meta,
    season,
    years,
    throughYear: years[years.length - 1],
    clubs,
    players,
    positions,
    owed: owed.slice(0, 8),
    totals: {
      payroll: payrolls.reduce((sum, value) => sum + value, 0),
      median: median(payrolls),
      covered,
    },
  }
}

// The one entry point the generator calls: club ledgers plus the league file,
// built from a single pass over the same records so the two can never disagree.
export function rollUpSalaries({ meta, players, places, teams, season }) {
  const years = yearsCovered(players, season)
  const byClub = new Map()
  for (const record of players) {
    if (!record.clubAbbrev) continue
    if (!byClub.has(record.clubAbbrev)) byClub.set(record.clubAbbrev, [])
    byClub.get(record.clubAbbrev).push(record)
  }

  const clubs = teams.map((team) => {
    const roster = places.get(team.id) ?? new Map()
    return clubLedger({
      meta,
      team,
      records: byClub.get(team.abbrev) ?? [],
      placeFor: (id) => roster.get(id) ?? null,
      season,
      years,
    })
  })

  // A league-wide roster lookup: a club only knows its own 40-man, and the
  // league board needs every player's position regardless of who pays him.
  const everyPlace = new Map()
  for (const roster of places.values()) {
    for (const [id, place] of roster) everyPlace.set(id, place)
  }

  const league = leagueRollup({
    meta,
    teams,
    byClub,
    placeFor: (id) => everyPlace.get(id) ?? null,
    season,
    years,
  })

  return { clubs, league }
}
