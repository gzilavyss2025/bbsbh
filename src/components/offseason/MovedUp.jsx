import { useMemo, useState } from 'react'
import { fetchMinorsLeaders, movedUpAt } from '../../api/minorsLeaders.js'
import { useAsync } from '../../hooks/useAsync.js'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { TeamLink } from '../team/TeamLink.jsx'
import { SPORT_LABEL } from '../../lib/teams.js'

// PLAYERS WHO MOVED UP — the minor levels' offseason page, issue #1077.
//
// The thing that is true of a level the day after its season ends: some of the
// people you watched are not there any more, and that is the good outcome. A
// promotion is the only result in the minor leagues that a scorer is meant to
// care about more than a score, and it is the one result the spoiler rule has
// no quarrel with — a season's level path is a fact about a CAREER, like the
// picked-game card's reason line, not a fact about a game.
//
// NO NEW FETCH. minors-leaders.json is on the wire once a day for the leader
// boards; every entry already carries `levels` (every level the player appeared
// at this season) and `displayTeamId` (his parent club). The derivation is
// movedUpAt in src/api/minorsLeaders.js.
//
// IT SAYS WHOSE LIST IT IS. The board is the top rows of thirty-nine
// categories, not a census, so the caption names the pool. That is not modesty:
// research.md's own warning is that a top-25 leaderboard is not a fair player
// pool, and a heading reading "players who moved up" over a leaderboard slice
// would be the page claiming a completeness it has not got.
//
// AND IT CHECKS THE YEAR. scripts/gen-minors-leaders.mjs writes the calendar
// year it runs in, so on January 1 a nightly run rolls the board to a season
// nobody has played yet. A board whose season is not the season this page is
// about renders nothing rather than an emptied table under a 2026 heading.
const LEAD_ROWS = 5

export function MovedUp({ sportId, season }) {
  const { data } = useAsync(() => fetchMinorsLeaders(), [])
  const [expanded, setExpanded] = useState(false)

  const rows = useMemo(
    () => (data?.season === season ? movedUpAt(data.leaders, sportId) : []),
    [data, season, sportId],
  )

  if (rows.length === 0) return null

  const shown = expanded ? rows : rows.slice(0, LEAD_ROWS)
  const hidden = rows.length - shown.length
  const label = SPORT_LABEL[sportId] ?? ''

  return (
    <section className="movedup" aria-label={`Players who moved up from ${label} in ${season}`}>
      <div className="oseason__head">
        {/* Mixed case in the markup, shouted by the CSS — the app's ALL-CAPS
            invariant is never a per-component .toUpperCase() (ADR-0017). */}
        <h3 className="oseason__title">Players who moved up</h3>
        <p className="oseason__note">
          {season} {label} leaders
        </p>
      </div>

      <table className="movedup__table">
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Finished at</th>
            <th scope="col">Org</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => (
            <tr key={row.id}>
              <th scope="row">
                <PlayerLink id={row.id} name={row.name}>
                  {row.name}
                </PlayerLink>
                {row.position && <span className="movedup__pos">{row.position}</span>}
              </th>
              {/* The two ends of the season, not the whole path: a player who
                  went A -> A+ -> AA -> AAA is read as "A to AAA", which is what
                  a reader means by how far he got. */}
              <td className="movedup__climb">
                {row.from.label} <span className="sr-only">to</span>
                <span aria-hidden="true"> → </span>
                <span className="movedup__to">{row.to.label}</span>
              </td>
              <td className="movedup__org">
                {row.orgId ? <TeamLink id={row.orgId}>{row.org}</TeamLink> : row.org}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {(hidden > 0 || expanded) && (
        <button
          type="button"
          className="oseason__door"
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? 'Show fewer' : `${hidden} more`}
        </button>
      )}

      {/* Natural case, because it is a sentence — the app shouts everything by
          default (01-base.css's ALL-CAPS INVARIANT) and a surface with real
          prose on it has to opt out. */}
      <p className="movedup__pool">
        From the {season} minor-league leader boards. Not every promotion at the
        level.
      </p>
    </section>
  )
}
