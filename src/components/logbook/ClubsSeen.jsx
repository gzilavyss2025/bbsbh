import { useMemo } from 'react'
import {
  ALL_MLB_TEAM_IDS,
  teamClubName,
  teamClubNameShort,
  teamLocationName,
} from '../../lib/teams.js'
import { TeamLogo } from '../logo/TeamLogo.jsx'

// The league, laid out under the book: every current MLB club, with the ones
// that have turned up in a game you stamped drawn in their own colours and the
// rest left grey.
//
// IT IS NOT A CHECKLIST, and the copy here is the only thing keeping it from
// becoming one (docs/game-log.md §3 — the Game Log has no completion state and
// nothing to finish). So: no "n of 30", no bar filling up, no praise for
// reaching the end. It says how many clubs are in your book and shows you which
// — the same thing the retrospective says in words, said in marks.
//
// NO SPOILER SURFACE. A club's logo says you sat with that club, never how the
// game came out, so nothing here is gated: this reads the same stamps the page
// around it already draws, and takes only the two team ids off each one.
//
// `factsByPk` is the resolved game facts from api/logbook.js, which is where a
// stamp's two clubs live — the local stamp record itself deliberately holds no
// club (src/lib/stamps.js). A stamp whose facts haven't resolved (offline, or a
// failed batch) simply doesn't colour anything in, the same degrade the grid
// below this makes.

// Alphabetical by city, which is the order a league table is read in and the
// only order here that doesn't imply a ranking. Built once — the league does
// not change between renders.
const LEAGUE = ALL_MLB_TEAM_IDS.map((id) => ({
  id,
  location: teamLocationName(id) ?? '',
  club: teamClubName(id) ?? '',
  short: teamClubNameShort(id) ?? '',
})).sort((a, b) => a.location.localeCompare(b.location) || a.club.localeCompare(b.club))

export function ClubsSeen({ stamps = [], factsByPk = {} }) {
  const seen = useMemo(() => {
    const ids = new Set()
    for (const entry of stamps) {
      const game = factsByPk[entry.gamePk]
      if (!game) continue
      if (game.away?.id != null) ids.add(game.away.id)
      if (game.home?.id != null) ids.add(game.home.id)
    }
    return ids
  }, [stamps, factsByPk])

  const count = LEAGUE.filter((team) => seen.has(team.id)).length

  return (
    <section className="clubsseen" aria-labelledby="clubsseen-title">
      <h2 className="clubsseen__title" id="clubsseen-title">
        Clubs you’ve seen
      </h2>
      <p className="clubsseen__lede">
        {count === 0
          ? 'Every club in the league. The ones you stamp a game of come up in their own colours.'
          : `${count} ${count === 1 ? 'club has' : 'clubs have'} turned up in your book.`}
      </p>
      <ul className="clubsseen__grid">
        {LEAGUE.map((team) => {
          const isSeen = seen.has(team.id)
          return (
            <li
              key={team.id}
              className={`clubsseen__club${isSeen ? ' is-seen' : ''}`}
            >
              <TeamLogo teamId={team.id} name={team.club} size={40} bw={!isSeen} />
              <span className="clubsseen__name">{team.short}</span>
              {/* Colour is the whole visual signal, so the state is said in
                  words for anyone not reading it. */}
              <span className="sr-only">{isSeen ? 'in your book' : 'not in your book yet'}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
