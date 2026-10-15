import { teamTransactionsPath } from '../../../../lib/route.js'

// The jump-bar number: players on the roster, as the old Roster band counted them.
export const rosterCount = (r) => r.position.length + r.pitchers.length

// The door to the club's roster-move ledger, carrying the page's `?d=` and `?s=`. MLB only:
// the transactions feed has no minor-league rows, so a farm club gets no door.
export const transactionsDoor = (teamId, asOf, sportId) =>
  sportId === 1 ? teamTransactionsPath(teamId, { d: asOf, s: sportId }) : null
