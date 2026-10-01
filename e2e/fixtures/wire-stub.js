// The league roster wire, stubbed for the dock and rail specs. The feed is a
// rolling window, so a captured response would be stale a day after it was taken
// and empty every winter. Rows are real shapes (typeCode CU) with the ids, names
// and dates rewritten per run.

// Real clubs, real names — the cutline is parsed out of the wire's own
// sentence, so the names have to be the ones the wire actually writes.
export const CLUBS = [
  [108, 'Los Angeles Angels'], [109, 'Arizona Diamondbacks'], [110, 'Baltimore Orioles'],
  [111, 'Boston Red Sox'], [112, 'Chicago Cubs'], [113, 'Cincinnati Reds'],
  [114, 'Cleveland Guardians'], [115, 'Colorado Rockies'], [116, 'Detroit Tigers'],
  [117, 'Houston Astros'], [118, 'Kansas City Royals'], [119, 'Los Angeles Dodgers'],
  [120, 'Washington Nationals'], [121, 'New York Mets'], [133, 'Athletics'],
  [134, 'Pittsburgh Pirates'],
]
const POSITIONS = ['RHP', 'LHP', 'C', '1B', 'SS', 'CF']

// A day back from an ISO date, by the same manual y/m/d parse the app uses —
// a raw Date subtraction can drift across a DST edge.
export function dayBefore(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d - 1)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// One recall per club per day: the CU shape owns cleanly (the sending club is a
// farm club naming no other major-league org), so it is one story per club.
export function wireFor(dates, clubs = CLUBS) {
  const rows = []
  for (const [dayIndex, date] of dates.entries()) {
    for (const [clubIndex, [id, name]] of clubs.entries()) {
      const personId = 900_000 + dayIndex * 100 + clubIndex
      const pos = POSITIONS[clubIndex % POSITIONS.length]
      const player = `Test Player${personId}`
      rows.push({
        id: 900_000 + rows.length,
        person: { id: personId, fullName: player },
        fromTeam: { id: 8000 + clubIndex, name: `${name} Affiliate` },
        toTeam: { id, name },
        date,
        effectiveDate: date,
        typeCode: 'CU',
        typeDesc: 'Recalled',
        description: `${name} recalled ${pos} ${player} from ${name} Affiliate.`,
      })
    }
  }
  return rows
}

export function peopleFor(ids) {
  return ids.map((id) => ({
    id: Number(id),
    primaryPosition: { abbreviation: POSITIONS[Number(id) % POSITIONS.length] },
    mlbDebutDate: '2024-04-01',
  }))
}

// Registered AFTER installMockApi so these win — Playwright runs the most
// recently added matching handler first. `rows` hands back a fixed wire (an empty
// one, say); `days` is the window length and `clubs` how many clubs recall per day.
export async function stubWire(page, { rows = null, days = 3, clubs = CLUBS.length } = {}) {
  await page.route('**/api/v1/transactions*', async (route) => {
    const dates = [new URL(route.request().url()).searchParams.get('endDate')]
    while (dates.length < days) dates.push(dayBefore(dates[dates.length - 1]))
    await route.fulfill({ json: { transactions: rows ?? wireFor(dates, CLUBS.slice(0, clubs)) } })
  })
  await page.route('**/api/v1/people*', async (route) => {
    const ids = (new URL(route.request().url()).searchParams.get('personIds') ?? '').split(',')
    await route.fulfill({ json: { people: peopleFor(ids.filter(Boolean)) } })
  })
}
