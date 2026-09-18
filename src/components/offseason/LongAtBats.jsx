import { useState } from 'react'
import { useAsync } from '../../hooks/useAsync.js'
import { atBatGamePath, clubAbbr, count, fetchLongAtBats } from '../../api/notebook.js'
import { useRouteLink } from '../../lib/nav.js'
import { monthDayShort } from '../../lib/dates.js'
import { PlayerLink } from '../player/PlayerLink.jsx'

// THE NOTEBOOK, AT MLB — one note about the season that just finished (issue
// #1078, step 4 of #1038).
//
// The wire above this says what is happening to the rosters. This says what
// happened in the season a reader has just put their scorebook away on, and it
// is the note the design study picked for MLB because it is the one thing a
// SCORER notices that a highlight reel never shows: the at-bat that would not
// end. Twelve pitches is four lines of a scorebook cell.
//
// A CENSUS, NOT A LEADERBOARD. The number is how many there were in the whole
// season, out of every plate appearance played — which is only sayable because
// pitch coverage at MLB is complete and every game was read
// (scripts/gen-long-at-bats.mjs). When it is not complete the note says so
// instead of quietly presenting a sample as a count; `coverage.complete` is
// exactly that check, and it is the difference between "170 of 173,710" and a
// sentence that would be false.
//
// AND IT SPOILS NOTHING, which took deciding rather than assuming. A row names
// a batter, a pitcher, a date and a pitch count. It does NOT name the at-bat's
// result, its inning, or anything about the game around it — because a
// twelve-pitch at-bat is a LENGTH, and a length is true of the at-bat whoever
// won. The generator does not store the outcome, so there is nothing here to
// leak it. Opening a row opens that game at its first lineup page, sealed under
// the same `revealedThrough` mark the slate's own cards hand over
// (api/notebook.js). That is the same line the picked-game card walks at the
// minor levels (ADR-0080), and the reason #1078's own spoiler note only asks a
// report to declare itself when it is about a RESULT.
//
// Five rows up front, and the door opens the whole census — it is 170 rows in a
// full season, which is long, and it is also the entire answer. Trimming it to
// a round number would be the one thing research.md §7 forbids outright.
const LEAD_ROWS = 5

export function LongAtBats({ season }) {
  const { data } = useAsync(() => fetchLongAtBats(season), [season])
  const [expanded, setExpanded] = useState(false)
  const linkProps = useRouteLink()

  const rows = data?.rows ?? []
  // A file for a season the page is not naming, a season still being played, or
  // one the sweep has not finished is not a census. The note is a count or it
  // is nothing.
  if (rows.length === 0 || data?.season !== season || !data?.coverage?.complete) return null

  const shown = expanded ? rows : rows.slice(0, LEAD_ROWS)
  const hidden = rows.length - shown.length

  return (
    <section className="note" aria-label={`Twelve-pitch at-bats in the ${season} season`}>
      <div className="oseason__head">
        {/* Mixed case in the markup, shouted by the CSS — the app's ALL-CAPS
            invariant is never a per-component .toUpperCase() (ADR-0017). */}
        <h3 className="oseason__title">The notebook</h3>
        <p className="oseason__note">{season} season</p>
      </div>

      <div className="note__body">
        <div className="note__figure">
          <p className="note__n">{rows.length}</p>
          <p className="note__under">
            of <span className="note__against">{count(data.coverage.plateAppearances)}</span> plate
            appearances, in all{' '}
            <span className="note__against">{count(data.coverage.games)}</span> games
          </p>
        </div>

        <div className="note__main">
          <h4 className="note__title">The twelve-pitch at-bats</h4>
          <p className="note__lede">
            Every plate appearance of the season that took {data.threshold} pitches or more. Each
            one opens its game, sealed.
          </p>

          <table className="note__table">
            <thead>
              <tr>
                <th scope="col">At-bat</th>
                <th scope="col">Pitches</th>
                <th scope="col">Game</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => {
                const path = atBatGamePath(row)
                return (
                  <tr key={`${row.pk}-${row.batter.id}-${row.pitches}`}>
                    <th scope="row">
                      <PlayerLink id={row.batter.id} name={row.batter.name}>
                        {row.batter.name}
                      </PlayerLink>
                      <span className="note__org">
                        {/* The other man in the at-bat, named as such: without
                            the "vs" the line reads as one player and two clubs. */}
                        {clubAbbr(row, row.batter.teamId)} <span aria-hidden="true">·</span> vs{' '}
                        <PlayerLink id={row.pitcher.id} name={row.pitcher.name}>
                          {row.pitcher.name}
                        </PlayerLink>{' '}
                        {clubAbbr(row, row.pitcher.teamId)}
                      </span>
                    </th>
                    <td className="note__age">{row.pitches}</td>
                    <td className="note__gap">
                      {path ? (
                        <a {...linkProps(path)}>{monthDayShort(row.date)}</a>
                      ) : (
                        monthDayShort(row.date)
                      )}
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
              {expanded ? 'Show fewer' : `All ${rows.length}`}
            </button>
          )}

          {/* Natural case, because it is a sentence — the app shouts everything
              by default (01-base.css's ALL-CAPS INVARIANT) and a surface with
              real prose on it has to opt out. */}
          <p className="note__pool">
            Regular season only. A batter left mid-count by an inning-ending caught stealing
            starts a new at-bat next inning, and is counted as one.
          </p>
        </div>
      </div>
    </section>
  )
}
