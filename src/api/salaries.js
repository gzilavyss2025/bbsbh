import { staticJson, staticJsonBy } from './staticJson.js'

// The two salary files scripts/fever/gen-salaries.mjs writes: one ledger per
// club (/team/{id}/contracts) and one league rollup (/salaries).
//
// SPOILER-FREE, and the reason is the scope half of the rule rather than a
// carve-out. A salary is not a score — it is season-long identity context, the
// same class of fact as a stat line, a roster spot or a standings row, and
// ADR-0034 is explicit that gating those was the rule reaching past what it
// protects. Nothing here reads a linescore, a game feed or a reveal mark, and
// nothing on either page is sealed. ADR-0052 records that decision, together
// with the money rule the ledger runs on; e2e/salaries.spec.js holds both pages
// to it at runtime.
//
// Both readers fail SOFT: a club with no ledger yet, or a league file that has
// not been generated, renders an honest "not published yet" card rather than
// taking the page down. That matters more here than in most static readers,
// because these files come from an outside source (Cot's, via Fever Baseball)
// that Tally does not control.

const fetchLeague = staticJson('/data/salaries.json', { fallback: null })
const fetchClub = staticJsonBy((teamId) => `/data/team-contracts/${teamId}.json`, { fallback: null })

// A file that PARSED is not a file the page can draw. `staticJson`'s fallback
// only fires on a non-200 or a parse failure, so an empty object, a half-written
// file, or a generator that renames a field all arrive as a perfectly truthy
// value — and both pages gate on `data != null`, so it reaches `.owed.map` and
// white-screens the route. These two checks are the difference between "League
// salaries have not been published yet", which is true and calm, and a blank
// page with a console error, which tells the reader nothing.
//
// Deliberately shallow: presence and type of the fields the pages actually
// index, not a schema. A deep validator would reject files over a field nobody
// draws, which is its own way of taking a working page down.
export function usableLeague(data) {
  if (!data || typeof data !== 'object') return null
  const shaped =
    Array.isArray(data.owed) && Array.isArray(data.clubs) && Array.isArray(data.positions)
  return shaped && data.totals && typeof data.totals === 'object' ? data : null
}

export function usableLedger(data) {
  if (!data || typeof data !== 'object') return null
  return Array.isArray(data.groups) && Array.isArray(data.totals) ? data : null
}

export async function fetchLeagueSalaries() {
  return usableLeague(await fetchLeague())
}

export async function fetchTeamContracts(teamId) {
  if (teamId == null) return null
  return usableLedger(await fetchClub(teamId))
}

// ---------------------------------------------------------------- selectors
// Pure, and deliberately kept out of the components: the same arithmetic feeds a
// phone card and a wide table, and a number that appears twice must be computed
// once. Every one of these takes the already-fetched file, never a fetch.

// The tallest bar a year column is drawn against. Options are NOT committed
// money, so a column's bar has two parts and the scale has to clear both.
export function payrollScale(totals) {
  return Math.max(1, ...totals.map((entry) => entry.committed))
}

// The drop between the season on the books and the last year the source covers —
// the club's commitment cliff, which is the one number the whole grid is for.
export function commitmentCliff(totals) {
  if (totals.length < 2) return null
  const first = totals[0]
  const last = totals[totals.length - 1]
  return { from: first.year, to: last.year, drop: first.committed - last.committed }
}

// How a cell reads. One place, so the grid, the key and the phone card cannot
// disagree about what amber means.
export const CELL_LABELS = {
  salary: 'Salary',
  guaranteed: 'Guaranteed',
  arbitration: 'Arbitration',
  option: 'Option',
  free: 'Free agent',
  other: 'Other',
  none: '—',
}

// The league board, filtered. `team` is a teamId, `pos` a position abbreviation;
// either may be null, which is what the "MLB" and "All positions" resets pass.
export function salaryBoard(league, { team = null, pos = null, limit = 12 } = {}) {
  if (!league?.players) return []
  return league.players
    .filter((player) => (team == null || player.teamId === team) && (pos == null || player.pos === pos))
    .slice(0, limit)
}

// Every position the league file actually carries, biggest spend first, so the
// filter never offers a chip that would come back empty.
export function boardPositions(league) {
  return (league?.positions ?? []).map((entry) => entry.pos)
}

// A club's row in the league table, for the "you are here" line on a club page.
export function clubStanding(league, teamId) {
  return (league?.clubs ?? []).find((club) => club.teamId === teamId) ?? null
}
