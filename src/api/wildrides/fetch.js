// WILD RIDES' data (scripts/gen-wild-rides.mjs writes the two static files):
//   fetchWildLists(season)  the four lists, each game's summary and headline (a few KB)
//   fetchWildShapes(season) every game as a row and a 24-character shape word, for Draw only
//   fetchRide(summary)      one game's full ride, read client-direct from statsapi
//                           (/winProbability) and built by lib/wildrides/ride.js
// Every game here is Final and shown with its result: Wild Rides is an open season page,
// not one of the four scoring surfaces (root CLAUDE.md, "The spoiler rule").
import { staticJsonBy } from '../staticJson.js'
import { getJson } from '../statsapi.js'
import { buildRide, RIDE_FIELDS } from '../../lib/wildrides/ride.js'

export const fetchWildLists = staticJsonBy((season) => `/data/wild-rides/${season}.json`, {
  shape: (d) => ({ season: Number(d?.season) || null, lists: d?.lists ?? {} }),
  fallback: null,
})

// Rows come packed as [gamePk, date, away, home, awayScore, homeScore, innings, shape, venue];
// the venue picks the ballpark drawing for a game reached through Draw.
export const fetchWildShapes = staticJsonBy((season) => `/data/wild-rides/${season}-shapes.json`, {
  shape: (d) =>
    (d?.games ?? []).map(([gamePk, date, away, home, a, h, innings, shape, venue]) => ({
      gamePk, date, away, home, score: [a, h], homeWon: h > a, innings, shape, venue: venue ?? null,
    })),
  fallback: [],
})

const rides = new Map()
export function fetchRide(summary) {
  const k = summary.gamePk
  if (!rides.has(k)) {
    rides.set(
      k,
      getJson(`/api/v1/game/${k}/winProbability?fields=${RIDE_FIELDS.join(',')}`)
        .then((feed) => buildRide(feed, summary))
        .catch(() => {
          rides.delete(k)
          return null
        }),
    )
  }
  return rides.get(k)
}
