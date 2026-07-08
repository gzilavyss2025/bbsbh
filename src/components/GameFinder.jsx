import { useState } from 'react'
import { fetchHeadToHead } from '../api/schedule.js'
import { useAsync } from '../hooks/useAsync.js'
import { useNav } from '../lib/nav.js'
import { gamePath } from '../lib/route.js'
import { TeamSearchBox } from './TeamSearchBox.jsx'
import { Loader } from './Loader.jsx'

const CURRENT_YEAR = new Date().getFullYear()
const SEASONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i)

// "Find a past matchup": pick two clubs and a season, then jump straight to
// any game they played each other that year, without knowing the date. The
// schedule API has no two-team filter, so this pulls team A's full-season
// schedule and keeps only games against team B (see fetchHeadToHead) — still
// spoiler-free, since it surfaces only dates, never a result. Selecting a
// final game opens its box score; a game not yet played opens the lineup
// staging page, same as picking it fresh off the slate.
export function GameFinder() {
  const [teamA, setTeamA] = useState(null)
  const [teamB, setTeamB] = useState(null)
  const [season, setSeason] = useState(CURRENT_YEAR)
  const navigate = useNav()

  const sameTeam = teamA && teamB && teamA.id === teamB.id
  const ready = teamA && teamB && !sameTeam

  const h2h = useAsync(
    () =>
      ready
        ? fetchHeadToHead(teamA.id, teamB.id, season, teamA.sportId)
        : Promise.resolve([]),
    [ready, teamA?.id, teamB?.id, season],
  )
  const games = h2h.data ?? []

  const openGame = (g) => {
    const away = g.awayId === teamA.id ? teamA : teamB
    const home = g.homeId === teamA.id ? teamA : teamB
    navigate(
      gamePath(
        g.apiDate,
        away.abbreviation,
        home.abbreviation,
        g.final ? 'boxscore' : 'lineup1',
        g.gameNumber,
      ),
    )
  }

  return (
    <div className="gamefinder">
      <div className="gamefinder__row">
        <TeamSearchBox placeholder="First team…" onPick={setTeamA} selected={teamA} />
        <span className="gamefinder__vs">vs</span>
        <TeamSearchBox placeholder="Second team…" onPick={setTeamB} selected={teamB} />
      </div>

      {sameTeam && <p className="hint">Pick two different teams.</p>}

      {teamA && teamB && !sameTeam && (
        <div className="gamefinder__season">
          <label htmlFor="gamefinder-season">Season</label>
          <select
            id="gamefinder-season"
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
          >
            {SEASONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      )}

      {ready && (
        <>
          {h2h.loading && <Loader size="inline" message="Looking up games…" />}
          {!h2h.loading && games.length === 0 && (
            <p className="hint">No {season} games between these two.</p>
          )}
          {games.length > 0 && (
            <ul className="gamefinder__results">
              {games.map((g) => (
                <li key={g.gamePk}>
                  <button
                    type="button"
                    className="gamefinder__result"
                    onClick={() => openGame(g)}
                  >
                    {monthDay(g.apiDate)}
                    {g.gameNumber > 1 ? ` · Gm ${g.gameNumber}` : ''}
                    <span className="gamefinder__arrow" aria-hidden="true">
                      ›
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function monthDay(iso) {
  if (!iso) return ''
  const dt = new Date(`${iso}T00:00:00Z`)
  return dt.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
