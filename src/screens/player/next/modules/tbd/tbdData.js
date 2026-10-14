// The narrow reads behind the tbd module's cards (#1896). Each is the one fetch (or two) its
// card needs, never a tab loader. The shapers are the live tabs' own: analytics.js,
// history.js and context.js.
import {
  fetchPersonStats,
  fetchPlayerAwards,
  fetchTransactions,
} from '../../../../../api/person-fetch.js'
import { fetchCommandReceived, commandReceivedFor } from '../../../../../api/commandReceived.js'
import { fetchFoulsFor, foulCardView } from '../../../../../api/fouls.js'
import { buildCareerTimeline } from '../../../../../api/careerTimeline.js'
import { fetchRookieRecord } from '../../../../../api/rookies.js'
import { awardLedgerFor, transactionRowsFor } from '../../../../../api/player/history.js'
import { dayBefore, yearByYearFor } from '../../../../../api/player/context.js'
import { isoToday, photoGameRows } from '../../../../../lib/dates.js'

// bio.team carries `parentOrgId` only for a minor-league club (api/person/identity.js).
// ponytail: a big leaguer on a rehab stint reads as minor here; the live tab pins him to MLB.
export const inMajors = (bio) => !bio.team?.parentOrgId

const endDateOf = (asOf) => (asOf ? dayBefore(asOf) : isoToday())

export async function awardsFor(bio, asOf) {
  const ledger = await awardLedgerFor(await fetchPlayerAwards(bio.id), endDateOf(asOf))
  return ledger.categories.length ? ledger : null
}

// Team history, for a player who has debuted (a pre-debut path leads the live Overview).
export async function timelineFor(bio) {
  if (!bio.debut) return null
  const group = bio.isPitcher ? 'pitching' : 'hitting'
  const { mlbYbySplits, milbYbySplits } = await yearByYearFor({ id: bio.id, bio }, group)
  return buildCareerTimeline([...mlbYbySplits, ...milbYbySplits], group, Number(bio.debut.slice(0, 4)))
}

export async function transactionsFor(bio, asOf) {
  const endDate = endDateOf(asOf)
  const [txns, rookieInfo] = await Promise.all([fetchTransactions(bio.id, endDate), fetchRookieRecord(bio.id)])
  return transactionRowsFor(bio, txns, rookieInfo, endDate)
}

// His this-season MLB games, decided ones only (today's may show a still mid-game), oldest first:
// the Photos rail's walk-back list. PlayerPage.jsx's PlayerPhotosSection does the same read.
export async function photoGamesFor(bio, season) {
  const group = bio.isPitcher ? 'pitching' : 'hitting'
  return photoGameRows(await fetchPersonStats(bio.id, { type: 'gameLog', group, season, sportId: 1 }))
}

export async function commandReceivedCardFor(id, season) {
  const data = await fetchCommandReceived()
  return commandReceivedFor(data, id, season) ? data : null
}

// The Foul balls card's own read, to learn whether it has a line. Current-day only, like the card.
export async function foulsFor(bio, role, season, asOf) {
  if (asOf) return null
  const data = await fetchFoulsFor(bio.id, { seasonYear: season, strict: true })
  return foulCardView({ data, group: role, playerId: bio.id }).show ? data : null
}
