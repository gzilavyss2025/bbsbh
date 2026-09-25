import { useMemo, useState } from 'react'
import { useAsync } from '../../hooks/useAsync.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import {
  ageGap,
  defaultLeagueId,
  fetchYoungestRegulars,
  years,
} from '../../api/notebook.js'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { TeamLink } from '../team/TeamLink.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'

// THE NOTEBOOK, AT A FARM LEVEL — one note about the season that just finished
// (issue #1078, step 4 of #1038).
//
// The page above this says who left the level going up and offers a game to
// score. This asks the one question a reader who watched the level all summer
// cannot answer from either: how old were these people, against the men they
// were playing?
//
// WHY THIS NOTE AND NOT A BETTER ONE. The obvious note at a farm level is a
// rate board — the patient hitters, the fewest strikeouts, the best month. Every
// one of them needs a playing-time floor, and a floor at a SINGLE level selects
// for the players nobody promoted: the best hitter in this league in May is two
// levels up by August and short of the floor here. So the board would be headed
// "the league's best seasons" and be a list of who stayed. The trap is recorded
// in research.md §7 and is the reason #1078 names age instead.
//
// Age is measured against the league rather than selected by the floor, so the
// floor changes WHO IS ON THE PAGE without changing what the number means — and
// the note says the floor out loud underneath, because a reader is owed the
// population as well as the figure.
//
// ONE LEAGUE, NEVER THE LEVEL. Three leagues at a level play different
// schedules in different climates, and comparing an age to an average across
// all three would be comparing a Midwest League regular to the Northwest
// League's six clubs. The note picks one and says which; the picker is three
// buttons and no fetch, because the level's file carries all three.
//
// SPOILER-FREE without qualification: a date of birth and a season total. No
// game is named here at all.
const LEAD_ROWS = 3

export function YoungestRegulars({ sportId, season }) {
  const { data } = useAsync(() => fetchYoungestRegulars(sportId), [sportId])
  const { favoriteTeamId } = useFavoriteTeam()
  const [picked, setPicked] = useState(null)
  const [expanded, setExpanded] = useState(false)

  const leagues = data?.leagues ?? []
  // The reader's own club decides which league opens, so a Brewers reader on
  // the A+ tab lands on the league Wisconsin plays in. `picked` is their own
  // later choice and outranks it.
  const openId = useMemo(
    () => defaultLeagueId(leagues, favoriteTeamId),
    [leagues, favoriteTeamId],
  )
  const league = leagues.find((l) => l.leagueId === (picked ?? openId)) ?? null

  // A file from a different season than the page is naming is the wrong year,
  // not a near miss — a level's winter opens hours before the night's generator
  // run. Same check, and the same silence, as the picked-game card above.
  if (!league || data?.season !== season) return null

  const players = league.players ?? []
  const shown = expanded ? players : players.slice(0, LEAD_ROWS)
  const hidden = players.length - shown.length
  const youngest = players[0]

  return (
    <section className="note" aria-label={`The youngest regulars in the ${season} ${league.name}`}>
      {/* Mixed case in the markup, shouted by the CSS — the app's ALL-CAPS
          invariant is never a per-component .toUpperCase() (ADR-0017). */}
      <SectionHead as="h3" className="oseason__head" note={<>{season} {league.name}</>}>
        The notebook
      </SectionHead>

      {leagues.length > 1 && (
        <div className="note__leagues" role="group" aria-label="League">
          {leagues.map((l) => {
            const on = l.leagueId === league.leagueId
            return (
              <button
                key={l.leagueId}
                type="button"
                className={`note__league${on ? ' is-on' : ''}`}
                aria-pressed={on}
                onClick={() => {
                  setPicked(l.leagueId)
                  setExpanded(false)
                }}
              >
                {l.abbr || l.name}
              </button>
            )
          })}
        </div>
      )}

      <div className="note__body">
        <div className="note__figure">
          <p className="note__n">{years(youngest?.age)}</p>
          {/* The figure means nothing on its own — 21.1 is the youngest man in
              Triple-A and an ordinary High-A regular — so its own line carries
              the comparison the whole note is built on. */}
          <p className="note__under">
            years old, against{' '}
            <span className="note__against">{years(league.averageAge)}</span> across the
            league&rsquo;s <span className="note__against">{league.regulars}</span> regulars
          </p>
        </div>

        <div className="note__main">
          <h4 className="note__title">Youngest regulars</h4>
          <p className="note__lede">
            Age on June 30 of the {season} season, against the average for the same league.
            Hitters only.
          </p>

          <table className="note__table">
            <thead>
              <tr>
                <th scope="col">Hitter</th>
                <th scope="col">Age</th>
                <th scope="col">vs league</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const gap = ageGap(p.age, league.averageAge)
                return (
                  <tr key={p.id}>
                    <th scope="row">
                      <PlayerLink id={p.id} name={p.name}>
                        {p.name}
                      </PlayerLink>
                      {p.orgId && (
                        <span className="note__org">
                          <TeamLink id={p.orgId}>{p.orgName}</TeamLink>
                        </span>
                      )}
                    </th>
                    <td className="note__age">{years(p.age)}</td>
                    {/* Younger than the league is the interesting direction, so
                        it takes the ink — but the sign is in the text as well as
                        the colour, which is the app's no-colour-alone rule. */}
                    <td className={`note__gap${gap < 0 ? ' is-under' : ''}`}>
                      {gap === null ? '—' : gap > 0 ? `+${years(gap)}` : years(gap)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {(hidden > 0 || expanded) && (
            <button
              type="button"
              className="oseason__door"
              aria-expanded={expanded}
              onClick={() => setExpanded((open) => !open)}
            >
              {expanded ? 'Show fewer' : `All ${players.length}`}
            </button>
          )}

          {/* Natural case, because it is a sentence — the app shouts everything
              by default (01-base.css's ALL-CAPS INVARIANT) and a surface with
              real prose on it has to opt out.

              THE FLOOR IS SAID OUT LOUD, and this line is not boilerplate: a
              250-plate-appearance floor at one level quietly drops the players
              who were promoted out of it, which is most of the best young ones.
              A reader who knows that reads the note correctly. */}
          <p className="note__pool">
            A regular is {data.regularPa}+ plate appearances in the {league.name}, so a player
            promoted out of it mid-season is not here.
          </p>
        </div>
      </div>
    </section>
  )
}
