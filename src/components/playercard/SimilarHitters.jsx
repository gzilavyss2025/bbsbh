import { Headshot } from '../player/Headshot.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { teamClubNameShort } from '../../lib/teams.js'
import { getJson } from '../../api/statsapi.js'
import { useAsync } from '../../hooks/useAsync.js'

// HITS LIKE — the three bats whose season Statcast skill profile most
// resembles this hitter's. The ranking is src/lib/hitterSimilarity.js (pure,
// unit-tested); the pool comes from api/savantPercentiles.js's
// similarHittersFor. This file is presentation only.
//
// It REUSES the .pitcheslike block wholesale rather than growing a parallel
// .hitslike one. The two cards are the same object — a ranked list of three
// faces with a match figure in a right-hand column — and the class name reads
// as the shared component it is, not as the pitching page's property. A second
// copy of that CSS would be two things to keep in sync for no visual gain.
//
// IT RESOLVES ITS OWN NAMES, which the pitching version doesn't have to:
// pitch-arsenal.json carries name/teamId per pitcher, savant-percentiles.json
// carries percentiles and nothing else (it's keyed by MLBAM id precisely so
// callers can join). So one batched people lookup covers the whole list.
// Verified against live calls — GET /api/v1/people?personIds=592885,660271,
// 605141&hydrate=currentTeam returns { copyright, people: [...] } with each
// entry carrying `id`, `fullName`, and `currentTeam: { id, name, link }`. The
// hydrate is REQUIRED and not decoration: the same request without it omits
// `currentTeam` entirely (checked on 592885), which would cost every row its
// club line and its headshot tint. A player with no club is the one shape that
// couldn't be provoked — even a retired one (405395) comes back with his last
// club — so the teamId read stays optional-chained and a row that ever lacks
// one simply loses its club line, the same degradation the rest of the app
// gives a missing field.
//
// Spoiler-free like the percentile radar above it (a completed-game season
// aggregate), so no SealBox.
//
// THE MATCH NUMBER IS SHOWN ON PURPOSE, same as on the pitching side: a bare
// "hits like X, Y, Z" is a confident-sounding claim the data doesn't always
// support, and a best match of 71 rather than 90 is the honest answer for a
// hitter with an unusual profile. It is a match score, never a probability —
// the copy beneath says so.
export function SimilarHitters({ similar }) {
  const ids = (similar ?? []).map((p) => p.personId).join(',')
  const { data } = useAsync(
    (signal) =>
      ids
        ? getJson(`/api/v1/people?personIds=${ids}&hydrate=currentTeam`, { signal })
        : Promise.resolve(null),
    [ids],
  )

  // Nothing renders until the identities are in hand — a list of bare match
  // numbers beside blank names is worse than no card, and this one is a
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
          }
        : null
    })
    .filter(Boolean)
  if (!rows.length) return null

  return (
    <div className="pitcheslike">
      <ul className="pitcheslike__list">
        {rows.map((p) => {
          const club = teamClubNameShort(p.teamId)
          return (
            <li className="pitcheslike__item" key={p.personId}>
              <PlayerLink id={p.personId} className="pitcheslike__link">
                <Headshot
                  personId={p.personId}
                  name={p.name}
                  teamId={p.teamId}
                  className="pitcheslike__shot"
                />
                <span className="pitcheslike__ident">
                  <span className="pitcheslike__name">{p.name}</span>
                  {club && <span className="pitcheslike__club">{club}</span>}
                </span>
                <span className="pitcheslike__match">
                  {p.match}
                  <span className="pitcheslike__matchunit">match</span>
                </span>
              </PlayerLink>
            </li>
          )
        })}
      </ul>
      {/* One line, same job as the arsenal card's note and for the same reason
          (the page's copy renders in scorebook caps and four lines of it
          shouts): what "similar" is measured on, and the honest limit — this
          compares the skills he SHOWS, not the line he puts up with them. No
          handedness clause, because unlike the pitching version there is no
          filter to explain. */}
      <p className="hint hint--prose pitcheslike__note">
        Closest contact, discipline and speed profile — how he hits, not how well.
      </p>
    </div>
  )
}
