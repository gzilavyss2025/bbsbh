// The narrow reads behind the tbd module's cards (#1896). Each is the one fetch (or two) its
// card needs, never a tab loader. The shapers are the live tabs' own: analytics.js,
// history.js and context.js.
import {
  fetchPersonStats,
} from '../../../../../api/person-fetch.js'
import { fetchCommandReceived, commandReceivedFor } from '../../../../../api/commandReceived.js'
import { photoGameRows } from '../../../../../lib/dates.js'

// bio.team carries `parentOrgId` only for a minor-league club (api/person/identity.js).
// ponytail: a big leaguer on a rehab stint reads as minor here; the live tab pins him to MLB.
export const inMajors = (bio) => !bio.team?.parentOrgId

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
