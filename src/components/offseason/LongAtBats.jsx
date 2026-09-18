import { useState } from 'react'
import { useAsync } from '../../hooks/useAsync.js'
import { atBatGamePath, clubAbbr, count, fetchLongAtBats } from '../../api/notebook.js'
import { useRouteLink } from '../../lib/nav.js'
import { monthDayShort } from '../../lib/dates.js'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { Headshot } from '../player/Headshot.jsx'

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
// THE ROW IS THE /fouls PAGE'S, and that is a deliberate borrowing. "Most
// fouls in one plate appearance" draws the batter's face pinned left and the
// pitcher's pinned right, their names and clubs facing each other across the
// count — because a long at-bat is two men refusing to give in, and a table row
// cannot show that. This note is about the same event measured a different way,
// so it reads the same way.
//
// WHAT DID NOT COME WITH IT IS THE SCOREBUG. On /fouls the middle of the second
// line carries the score, the inning, the outs, the bases and what the at-bat
// finally did — a report page's ordinary right, and none of it this note's. The
// slot holds the DATE here instead, which is the one thing about the at-bat
// that opens its game without saying a word about it.
//
// FIVE UP FRONT, THEN TEN AT A TIME. The whole census is the answer — trimming
// it to a round number is the one thing research.md §7 forbids outright — but
// the whole census is 170 rows, and each one carries two faces now, so opening
// all of it in one press dropped a reader into eight thousand pixels of scroll
// with the rest of the page somewhere below it. The door pages instead. Every
// row is still reachable; none of them arrives uninvited.
const LEAD_ROWS = 5
const STEP = 10

export function LongAtBats({ season }) {
  const { data } = useAsync(() => fetchLongAtBats(season), [season])
  // How many rows are on screen, not a boolean — the door adds to it rather
  // than flipping it.
  const [visible, setVisible] = useState(LEAD_ROWS)
  const linkProps = useRouteLink()

  const rows = data?.rows ?? []
  // A file for a season the page is not naming, a season still being played, or
  // one the sweep has not finished is not a census. The note is a count or it
  // is nothing.
  if (rows.length === 0 || data?.season !== season || !data?.coverage?.complete) return null

  const shown = rows.slice(0, visible)
  const hidden = rows.length - shown.length
  // The last press of the door is a short one — 170 rows off a 5 + 10n ladder
  // ends on 5, and a button saying "10 more" that produced five would be a
  // small lie about the file's own count.
  const next = Math.min(STEP, hidden)

  return (
    <section className="note note--stories" aria-label={`Twelve-pitch at-bats in the ${season} season`}>
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

          <ol className="note__stories">
            {shown.map((row) => (
              <li className="note__story" key={`${row.pk}-${row.batter.id}-${row.pitches}`}>
                <Headshot
                  personId={row.batter.id}
                  name={row.batter.name}
                  teamId={row.batter.teamId}
                  className="note__shot note__shot--batter"
                />

                <div className="note__line">
                  <div className="note__who">
                    <div className="note__nameline">
                      <PlayerLink id={row.batter.id} name={row.batter.name} className="note__name">
                        {row.batter.name}
                      </PlayerLink>
                      <span className="note__club">{clubAbbr(row, row.batter.teamId)}</span>
                    </div>
                    {/* The phone's only copy of the pitcher's name — his own
                        block on the right drops at 600px, and his face alone
                        would not tell a reader who he is. */}
                    <div className="note__vs">
                      vs{' '}
                      <PlayerLink id={row.pitcher.id} name={row.pitcher.name}>
                        {row.pitcher.name}
                      </PlayerLink>
                    </div>
                  </div>

                  <span className="note__val">
                    <span className="note__valn">{row.pitches}</span>
                    <span className="note__vallabel">Pitches</span>
                  </span>

                  <div className="note__who note__who--pitcher">
                    <div className="note__nameline">
                      <PlayerLink id={row.pitcher.id} name={row.pitcher.name} className="note__name">
                        {row.pitcher.name}
                      </PlayerLink>
                      <span className="note__club">{clubAbbr(row, row.pitcher.teamId)}</span>
                    </div>
                  </div>
                </div>

                {/* The game, at its first lineup page — the same address the
                    slate's own cards build, so it arrives sealed. */}
                {atBatGamePath(row) && (
                  <a className="note__when" {...linkProps(atBatGamePath(row))}>
                    {monthDayShort(row.date)}
                    <span className="sr-only"> — open this game</span>
                    <span aria-hidden="true">›</span>
                  </a>
                )}

                <Headshot
                  personId={row.pitcher.id}
                  name={row.pitcher.name}
                  teamId={row.pitcher.teamId}
                  className="note__shot note__shot--pitcher"
                />
              </li>
            ))}
          </ol>

          {(hidden > 0 || visible > LEAD_ROWS) && (
            <button
              type="button"
              className="oseason__door"
              // The visible words are inside the accessible name, which is what
              // WCAG 2.5.3 asks of a control whose label says more than its
              // text does.
              aria-label={hidden > 0 ? `Show ${next} more at-bats` : 'Show fewer at-bats'}
              onClick={() =>
                setVisible((n) => (hidden > 0 ? n + STEP : LEAD_ROWS))
              }
            >
              {hidden > 0 ? `${next} more` : 'Show fewer'}
            </button>
          )}

          {/* Where the reader is in the census, for a reader who cannot see the
              list grow. Polite, so it never interrupts — research.md §8's
              acceptance criteria ask for exactly this when a requested change
              adds content below the control that asked for it. */}
          <p className="sr-only" role="status">
            Showing {shown.length} of {rows.length} at-bats.
          </p>

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
