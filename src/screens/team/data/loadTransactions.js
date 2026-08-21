import { fetchTeam } from '../../../api/team.js'
import { loadClubTransactionsPage } from '../../../api/transactions/clubFeed.js'

// The club Transactions page's own data: the club, and the first page of its
// roster moves — the nightly file's newest 45 days with today's live window
// laid over them (api/transactions/clubFeed.js), the same first page the
// Overview's preview and the Games tab's deck are handed.
//
// Nothing else. The page holds one thing, and a schedule or a roster it does
// not draw is a request a reader arriving from the wire pays for and never
// sees.
//
// MiLB degrades the way it does everywhere else here: transactions are an MLB
// org's, so a farm club resolves to an empty page rather than a failure.
export async function loadTransactions(id, asOf) {
  const team = await fetchTeam(id)
  if (!team) return null
  const sportId = team.sport?.id ?? 1
  const page =
    sportId === 1
      ? await loadClubTransactionsPage(id, asOf).catch(() => ({
          days: [],
          cursor: null,
          hasMore: false,
        }))
      : { days: [], cursor: null, hasMore: false }
  return { team, page }
}
