import { useState } from 'react'
import { useAsync } from '../../hooks/useAsync.js'
import { atBatGamePath, clubAbbr, count, fetchLongAtBats } from '../../api/notebook.js'
import { useRouteLink } from '../../lib/nav.js'
import { monthDayShort } from '../../lib/dates.js'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { Headshot } from '../player/Headshot.jsx'
import { Card } from '../ui/frame/Card.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { InfoPopover } from '../ui/InfoPopover.jsx'

const lastName = (name) => name.split(' ').slice(1).join(' ') || name

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
// regular season, out of every plate appearance played — which is only sayable because
// pitch coverage at MLB is complete and every game was read
// (scripts/gen-long-at-bats.mjs). When it is not complete the note says so
// instead of quietly presenting a sample as a count; `coverage.complete` is
// exactly that check, and it is the difference between "170 of 173,710" and a
// sentence that would be false.
//
// AND IT NAMES NO RESULT, which took deciding rather than assuming. A row names
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
const LEAD_ROWS = 4
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

  // Its own census, shown only once the file has one and every postseason game on
  // it is read. A complete zero is still a count.
  const post = data.post?.coverage.complete ? data.post : null

  const [top, ...rest] = rows
  const shown = rest.slice(0, visible)
  const hidden = rest.length - shown.length
  // The last press of the door is a short one — a button saying "10 more"
  // that produced five would be a small lie about the file's own count.
  const next = Math.min(STEP, hidden)
  const path = atBatGamePath(top)

  // THREE STAMPED CARDS IN ONE ROW: the census figure, the longest at-bat
  // drawn one square per pitch, and the next longest as bars measured against
  // it. A phone stacks them.
  return (
    <section className="seasonnote seasonnote--stories" aria-label={`Twelve-pitch at-bats in the ${season} season`}>
      {/* Mixed case in the markup, shouted by the CSS — the app's ALL-CAPS
          invariant is never a per-component .toUpperCase() (ADR-0017). */}
      <SectionHead as="h3" className="oseason__head" note={<>{season} season</>}>
        The notebook
      </SectionHead>

      <div className="seasonnote__row">
        <Card frame="stamped" as="div" className="seasonnote__figure">
          <p className="seasonnote__n">{rows.length}</p>
          <p className="t-label t-label--bold seasonnote__what">
            At-bats of {data.threshold}+ pitches
          </p>
          <p className="seasonnote__under infopop-row">
            of <span className="seasonnote__against">{count(data.coverage.plateAppearances)}</span> in{' '}
            <span className="seasonnote__against">{count(data.coverage.games)}</span> games
            <InfoPopover label="How the at-bats are counted" className="infopop--paper">
              Regular season only; the postseason is never summed in
              {post
                ? ` (it had ${post.rows.length} of ${count(post.coverage.plateAppearances)} plate appearances, in ${count(post.coverage.games)} games)`
                : ''}
              . A batter left mid-count by an inning-ending caught stealing starts a new
              at-bat next inning, and is counted as one. Each one opens its game, sealed.
            </InfoPopover>
          </p>
        </Card>

        <Card frame="stamped" as="div" className="seasonnote__longest">
          <p className="t-label t-label--bold seasonnote__what">The longest at-bat</p>
          <div className="seasonnote__pair">
            <Headshot personId={top.batter.id} name={top.batter.name} teamId={top.batter.teamId} className="seasonnote__shot" />
            <div className="seasonnote__who">
              <PlayerLink id={top.batter.id} name={top.batter.name} className="seasonnote__name">
                {top.batter.name}
              </PlayerLink>
              <span className="seasonnote__club">{clubAbbr(top, top.batter.teamId)}</span>
            </div>
            <span className="seasonnote__vs" aria-hidden="true">vs</span>
            <div className="seasonnote__who seasonnote__who--pitcher">
              <PlayerLink id={top.pitcher.id} name={top.pitcher.name} className="seasonnote__name">
                {top.pitcher.name}
              </PlayerLink>
              <span className="seasonnote__club">{clubAbbr(top, top.pitcher.teamId)}</span>
            </div>
            <Headshot personId={top.pitcher.id} name={top.pitcher.name} teamId={top.pitcher.teamId} className="seasonnote__shot" />
          </div>
          {/* One square per pitch: the length IS the note, so it is drawn. */}
          <ol className="seasonnote__pips" aria-label={`${top.pitches} pitches`}>
            {Array.from({ length: top.pitches }, (_, i) => (
              <li key={i} className="seasonnote__pip" />
            ))}
          </ol>
          <div className="seasonnote__foot">
            <span className="seasonnote__count">{top.pitches} pitches</span>
            {path && (
              <a className="door door--boxed seasonnote__when" {...linkProps(path)}>
                {monthDayShort(top.date)}
                <span className="sr-only"> — open this game</span>
                <span aria-hidden="true">›</span>
              </a>
            )}
          </div>
        </Card>

        <Card frame="stamped" as="div" className="seasonnote__rest">
          <p className="t-label t-label--bold seasonnote__what">Next longest</p>
          <ol className="seasonnote__bars">
            {shown.map((row) => {
              const rowPath = atBatGamePath(row)
              const label = (
                <>
                  <span className="seasonnote__barname">
                    {lastName(row.batter.name)} v {lastName(row.pitcher.name)}
                  </span>
                  <span className="seasonnote__barn">{row.pitches}</span>
                  <span className="seasonnote__bar" aria-hidden="true">
                    <span style={{ width: `${(row.pitches / top.pitches) * 100}%` }} />
                  </span>
                </>
              )
              return (
                <li key={`${row.pk}-${row.batter.id}-${row.pitches}`}>
                  {rowPath ? (
                    <a
                      className="seasonnote__barrow"
                      {...linkProps(rowPath)}
                      aria-label={`${row.batter.name} vs ${row.pitcher.name}, ${row.pitches} pitches, ${monthDayShort(row.date)} — open this game`}
                    >
                      {label}
                    </a>
                  ) : (
                    <span className="seasonnote__barrow">{label}</span>
                  )}
                </li>
              )
            })}
          </ol>
          {(hidden > 0 || visible > LEAD_ROWS) && (
            <button
              type="button"
              className="door door--boxed oseason__door"
              aria-label={hidden > 0 ? `Show ${next} more at-bats` : 'Show fewer at-bats'}
              onClick={() => setVisible((n) => (hidden > 0 ? n + STEP : LEAD_ROWS))}
            >
              {hidden > 0 ? `${next} more` : 'Show fewer'}
            </button>
          )}
          <p className="sr-only" role="status">
            Showing {shown.length + 1} of {rows.length} at-bats.
          </p>
        </Card>
      </div>
    </section>
  )
}
