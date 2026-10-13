// The narrow reads behind the tbd module's cards (#1896). Each is the one fetch (or two) its
// card needs, never a tab loader. The shapers are the live tabs' own: analytics.js,
// history.js and context.js.
import {
  fetchHittingAdvanced,
  fetchPersonStats,
  fetchPitchingAdvanced,
  fetchPlayerAwards,
  fetchTransactions,
} from '../../../../../api/person-fetch.js'
import { advancedHittingView, advancedPitchingView } from '../../../../../api/person/advanced.js'
import { buildCareerTimeline } from '../../../../../api/careerTimeline.js'
import { postseasonStarted } from '../../../../../api/postseason/started.js'
import { fetchRookieRecord } from '../../../../../api/rookies.js'
import {
  fetchSavantPercentiles,
  medianRatesFor,
  percentileRows,
  savantPercentilesFor,
  savantRawFor,
} from '../../../../../api/savantPercentiles.js'
import { awardLedgerFor, transactionRowsFor } from '../../../../../api/player/history.js'
import { dayBefore, yearByYearFor } from '../../../../../api/player/context.js'
import { isoToday } from '../../../../../lib/dates.js'

// bio.team carries `parentOrgId` only for a minor-league club (api/person/identity.js).
// ponytail: a big leaguer on a rehab stint reads as minor here; the live tab pins him to MLB.
export const inMajors = (bio) => !bio.team?.parentOrgId

const endDateOf = (asOf) => (asOf ? dayBefore(asOf) : isoToday())

export async function percentilesFor(id, group) {
  const data = await fetchSavantPercentiles()
  const savant = savantPercentilesFor(data, id, group)
  const raw = savantRawFor(data, id, group)
  const median = medianRatesFor(data, group)
  return percentileRows(savant, raw, group, median) ? { savant, raw, median } : null
}

// The Advanced card's two scopes. Postseason waits for October and for a live (undated) page.
export async function advancedFor(bio, role, season, asOf) {
  if (!inMajors(bio)) return null
  const [fetchBundle, view] =
    role === 'pitching' ? [fetchPitchingAdvanced, advancedPitchingView] : [fetchHittingAdvanced, advancedHittingView]
  const [reg, post] = await Promise.all([
    fetchBundle(bio.id, season),
    !asOf && (await postseasonStarted(season)) ? fetchBundle(bio.id, season, { gameType: 'P' }) : null,
  ])
  const adv = view(reg)
  return adv?.facts?.length ? { adv, post: view(post, { post: true }) } : null
}

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
  const today = isoToday()
  return (await fetchPersonStats(bio.id, { type: 'gameLog', group, season, sportId: 1 }))
    .filter((s) => s.game?.gamePk && s.date && s.date !== today)
    .map((s) => ({ gamePk: s.game.gamePk, apiDate: s.date }))
    .sort((a, b) => (a.apiDate < b.apiDate ? -1 : a.apiDate > b.apiDate ? 1 : 0))
}
