import { droughtsFor } from '../../../../api/scheduleShape.js'
import { teamRecordsFor } from '../../../../api/teamRecords.js'
import { divisionRecordFor } from '../../data/shared.js'
import { rankOf } from '../top/topData.js'

// The Standings band's pure shapes (#1107, row 5b): the team score card and the jump-bar count.
// Open surface (ADR-0034): season figures from the standings the page already fetched, nothing
// sealed. There is no season grade anywhere; the card is a rank and its four parts.

// The two MLB leagues, each the other's. The top fetches the same pair on a tap (TeamNextTop),
// so asking for it here is the one shared promise (next/once.js), never a second request.
export const OTHER_LEAGUE = { 103: 104, 104: 103 }

const num = (v) => (v == null || v === '' ? NaN : Number(v))
const signed = (d) => (d > 0 ? `+${d}` : `${d}`)
const pctOf = (t) => (Number.isFinite(num(t.leagueRecord?.pct)) ? num(t.leagueRecord.pct) : t.wins / (t.wins + t.losses || 1))
// "1" best: 1 + the clubs strictly ahead, so a tie shares its place.
const placeOf = (pool, mine, get, best) => {
  const v = get(mine)
  return Number.isFinite(v) ? 1 + pool.filter((t) => (best === 'high' ? get(t) > v : get(t) < v)).length : null
}

// [part, value text, getter, which end is best, "of" form (a rate) or an ordinal (a count)]
const PARTS = [
  ['Run diff', (t) => signed(t.runDifferential), (t) => num(t.runDifferential), 'high', true],
  ['Win pct', (t) => String(t.leagueRecord?.pct ?? pctOf(t).toFixed(3)).replace(/^0/, ''), pctOf, 'high', true],
  ['Runs allowed', (t) => String(t.runsAllowed), (t) => num(t.runsAllowed), 'low', false],
  ['Runs scored', (t) => String(t.runsScored), (t) => num(t.runsScored), 'high', false],
]

// The card for one club out of a fetchStandings response, or null with no row or no pool.
// MLB: the club among all 30 (`other` is the other league's standings; empty draws no part rank,
// never a wrong one). Any other club: among its division, or its league with no division.
export function scoreCard(standings, other, team) {
  const mlb = (team.sport?.id ?? 1) === 1
  const division = divisionRecordFor(standings, team)
  const mine = division?.teamRecords?.find((t) => t.team.id === team.id)
  if (!mine) return null
  const pool = mlb ? [...standings.flatMap((d) => d.teamRecords ?? []), ...(other ?? []).flatMap((d) => d.teamRecords ?? [])] : division.teamRecords
  const whole = mlb ? Boolean(other?.length) : pool.length > 1
  const place = rankOf(mine, team, pool.length)
  if (!place || (!mlb && pool.length < 2)) return null
  const of = mlb ? 30 : pool.length
  return {
    // A winter club has no division: its pool is the league.
    label: mlb ? 'MLB rank' : division.division?.id ? 'Division rank' : 'League rank',
    col: mlb ? 'MLB' : division.division?.id ? 'Div' : 'League',
    rank: { rank: place.rank, of },
    strip: { n: of, at: Math.min(place.rank, of) - 1 },
    rows: PARTS.map(([part, text, get, best, rate]) => {
      const rank = whole ? placeOf(pool, mine, get, best) : null
      return {
        part,
        value: Number.isFinite(get(mine)) ? text(mine) : '—',
        rank: rank == null ? null : rate ? { rank, of } : { rank },
        strip: rank == null ? null : { n: of, at: rank - 1 },
      }
    }),
  }
}

// Whether the Last time card has any chance to report; the card and the badge ask the same thing.
export const hasDroughts = (n, cutoff) => Boolean(n?.scheduleShape && droughtsFor(n.scheduleShape, { cutoff }).length)

// The Records card draws only when a game counted at the cutoff (the card hides itself, so the
// band must not draw its head or badge around nothing).
export const hasRecords = (data, cutoff) => teamRecordsFor(data, { cutoff }) != null

// The jump-bar badge: one per card the band draws. The score card needs a pool of two or more.
// One per card the band draws: the division table and Last time. Team score, Records, Day of week
// and Comeback wins draw in the Ranks band now (StandingsRankCards.jsx), so they count nowhere here.
export const standingsCount = (n, cutoff) =>
  (n.standings.length > 0) +
  hasDroughts(n, cutoff)

// Games back as the table prints it. A winter leader can arrive as "-1.0" (a one-game lead);
// a minus is never a games-back figure, so it reads "—" like the "-" the feed gives other leaders.
export const gbText = (gb) => (/^-\d/.test(String(gb)) ? '—' : gb)
