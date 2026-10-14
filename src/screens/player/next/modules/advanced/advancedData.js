import { fetchHittingAdvanced, fetchPitchingAdvanced } from '../../../../../api/person-fetch.js'
import { advancedHittingView, advancedPitchingView } from '../../../../../api/person/advanced.js'
import { leagueRates } from '../../../../../api/player/leagueAverages.js'
import { postseasonStarted } from '../../../../../api/postseason/started.js'
import { inMajors } from '../tbd/tbdData.js'

// Both scopes' facts and raw bundles, plus the league row for the captions. Null: not in the majors or no regular
// facts. Postseason waits for October and an undated page; a player with no October game gets `post: null`.
export async function loadAdvanced(bio, role, season, asOf) {
  if (!inMajors(bio)) return null
  const [fetchBundle, view] = role === 'pitching' ? [fetchPitchingAdvanced, advancedPitchingView] : [fetchHittingAdvanced, advancedHittingView]
  const [reg, post, rates] = await Promise.all([
    fetchBundle(bio.id, season),
    // Not an await inside the array: that would hold the league read until the season check returns.
    asOf ? null : postseasonStarted(season).then((on) => (on ? fetchBundle(bio.id, season, { gameType: 'P' }) : null)),
    leagueRates(season).catch(() => null),
  ])
  const regular = view(reg)
  if (!regular) return null
  const october = view(post, { post: true })
  return { rates, regular: { facts: regular.facts, bundle: reg }, post: october && { facts: october.facts, bundle: post } }
}
