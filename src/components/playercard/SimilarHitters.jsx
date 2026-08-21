import { SimilarPlayerGrid } from './SimilarPlayerGrid.jsx'
import { BATTER_METRICS } from '../../api/savantPercentiles.js'
import { PROFILE_KEYS } from '../../lib/hitterSimilarity.js'
import { getJson } from '../../api/statsapi.js'
import { useAsync } from '../../hooks/useAsync.js'

// HITS LIKE — the three bats whose season Statcast skill profile most
// resembles this hitter's. The ranking is src/lib/hitterSimilarity.js (pure,
// unit-tested); the pool comes from api/savantPercentiles.js's
// similarHittersFor. This file resolves identities and shapes rows;
// SimilarPlayerGrid.jsx draws them, and its header carries the reasoning for
// the three-across layout and for printing the match figure at all.
//
// IT RESOLVES ITS OWN NAMES, which the pitching version doesn't have to:
// pitch-arsenal.json carries name/teamId per pitcher, savant-percentiles.json
// carries percentiles and nothing else (it's keyed by MLBAM id precisely so
// callers can join). So one batched people lookup covers the whole list.
// Verified against live calls — GET /api/v1/people?personIds=592885,660271,
// 605141&hydrate=currentTeam returns { copyright, people: [...] } with each
// entry carrying `id`, `fullName`, `primaryPosition`, and `currentTeam:
// { id, name, link }`. The hydrate is REQUIRED and not decoration: the same
// request without it omits `currentTeam` entirely (checked on 592885), which
// would cost every row its club line and its headshot tint. `primaryPosition`
// rides along on the DEFAULT payload — it needs no hydrate of its own, so the
// position line under each face costs nothing beyond the call already made.
// A player with no club is the one shape that couldn't be provoked — even a
// retired one (405395) comes back with his last club — so the teamId read
// stays optional-chained and a row that ever lacks one simply loses its club
// line, the same degradation the rest of the app gives a missing field.
//
// Spoiler-free like the percentile radar above it (a completed-game season
// aggregate), so no SealBox.

// What the grid's "Measured on" band names — derived from the ranking model's
// OWN key list rather than retyped, so the band can never claim a metric the
// math doesn't use (or miss one it does). PROFILE_KEYS is the five-metric
// skill space hitterSimilarity.js compares on; BATTER_METRICS supplies the
// same display labels the Statcast cards above use for those keys. Note what
// is deliberately absent: xwOBA, which is in the file and on the radar but
// kept out of the space because it summarizes the contact metrics already
// here — see hitterSimilarity.js.
const MEASURE = PROFILE_KEYS.map(
  (key) => BATTER_METRICS.find((m) => m.key === key)?.label ?? key,
)

export function SimilarHitters({ similar }) {
  const ids = (similar ?? []).map((p) => p.personId).join(',')
  const { data } = useAsync(
    (signal) =>
      ids
        ? getJson(`/api/v1/people?personIds=${ids}&hydrate=currentTeam`, { signal })
        : Promise.resolve(null),
    [ids],
  )

  // Nothing renders until the identities are in hand — a grid of bare match
  // numbers over blank faces is worse than no card, and this one is a
  // supporting detail far down the page, so there's nothing for a skeleton to
  // hold a place in.
  if (!similar?.length || !data?.people?.length) return null

  const byId = new Map(data.people.map((p) => [String(p.id), p]))
  const rows = similar
    .map((p) => {
      const person = byId.get(String(p.personId))
      return person?.fullName
        ? {
            personId: p.personId,
            match: p.match,
            name: person.fullName,
            teamId: person.currentTeam?.id ?? null,
            pos: person.primaryPosition?.abbreviation ?? '',
          }
        : null
    })
    .filter(Boolean)
  if (!rows.length) return null

  return (
    <SimilarPlayerGrid
      rows={rows}
      measure={MEASURE}
      // The one thing the card has to disclaim: this compares the skills he
      // SHOWS, not the line he puts up with them. Same fragment-not-sentence
      // move as the pitching card's `excludes` — see SimilarPitchers.jsx.
      excludes="Production"
    />
  )
}
