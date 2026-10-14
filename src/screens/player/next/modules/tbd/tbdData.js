// The narrow reads behind the tbd module's cards (#1896). Each is the one fetch (or two) its
// card needs, never a tab loader. The shapers are the live tabs' own: analytics.js,
// history.js and context.js.
import { fetchCommandReceived, commandReceivedFor } from '../../../../../api/commandReceived.js'

// bio.team carries `parentOrgId` only for a minor-league club (api/person/identity.js).
// ponytail: a big leaguer on a rehab stint reads as minor here; the live tab pins him to MLB.
export const inMajors = (bio) => !bio.team?.parentOrgId

export async function commandReceivedCardFor(id, season) {
  const data = await fetchCommandReceived()
  return commandReceivedFor(data, id, season) ? data : null
}
