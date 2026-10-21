// The classic card's facts (issue #1525, slice 2): the two clubs, the park and one
// reason line for a game the deck dealt. The deck's row holds only abbreviations, so
// the card makes ONE more call for the rest.
//
// SPOILER-FREE BY THE `fields=` LIST, as the deck is. A schedule row of a finished
// game carries `score`, `isWinner` and `leagueRecord`; CLASSIC_FIELDS names only
// ids, names, the venue and the starting lineups. `hydrate=lineups` is the
// starting nine a side (a substitution would be a result, so the feed's
// end-of-game batting order is never read). The reason line is a fact true
// before the first pitch and never a fact about the game (ADR-0080).
import { getJson } from '../statsapi.js'

export const CLASSIC_FIELDS =
  'dates,games,gamePk,teams,away,home,team,id,name,venue,lineups,homePlayers,awayPlayers,fullName'

export const classicFactsUrl = (pk) =>
  `/api/v1/schedule?sportId=1&gamePks=${pk}&hydrate=lineups&fields=${CLASSIC_FIELDS}`

// A schedule row -> { away, home, venue, reason }. `reason` is null when the record
// holds no lineup: the card then shows the game with no line rather than invent one.
export function classicFacts(g) {
  if (!g) return null
  const club = (side) => ({ id: g.teams?.[side]?.team?.id ?? null, name: g.teams?.[side]?.team?.name ?? '' })
  const away = club('away')
  const leadoff = g.lineups?.awayPlayers?.[0]?.fullName
  return {
    away,
    home: club('home'),
    venue: g.venue?.name ?? '',
    reason: leadoff && away.name ? `${leadoff} leads off for the ${away.name}.` : null,
  }
}

export async function fetchClassicFacts(pk, fetchJson = getJson) {
  const res = await fetchJson(classicFactsUrl(pk))
  return classicFacts(res?.dates?.[0]?.games?.[0])
}
