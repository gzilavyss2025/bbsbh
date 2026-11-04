import { Suspense, useState } from 'react'
import { lazyNamed } from '../../lib/react/lazyNamed.js'
import { useAsync } from '../../hooks/useAsync.js'
import { atBatGamePath, clubAbbr, count, fetchLongAtBats } from '../../api/notebook.js'
import { useRouteLink } from '../../lib/nav.js'
import { monthDayName } from '../../lib/dates.js'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { Headshot } from '../player/Headshot.jsx'
import { Card } from '../ui/frame/Card.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { ClubStrip } from './ClubStrip.jsx'
import { teamAbbr, teamPrimaryColor } from '../../lib/teams.js'
import { InfoPopover } from '../ui/InfoPopover.jsx'

// The list's foot fades only while there is more below it.
// The picked at-bat's scorebug and zone load in their own chunk (LongAtBatDetail.jsx).
const Scorebug = lazyNamed(() => import('./LongAtBatDetail.jsx'), 'Scorebug')
const AtBatZone = lazyNamed(() => import('./LongAtBatDetail.jsx'), 'AtBatZone')

const markEnd = (el) => (el.dataset.end = String(el.scrollTop + el.clientHeight >= el.scrollHeight - 2))

// "1 in every 1,700": the rate as a reader says it, rounded to the hundred.
const oneIn = (total, n) => Math.round(total / n / 100) * 100 || Math.round(total / n)

// THE LONGEST AT-BATS OF THE SEASON (issue #1078, redesigned 2026-11-03). A
// census, not a leaderboard: every at-bat of ten or more pitches, out of every
// plate appearance played, and only when every game was read
// (scripts/gen-long-at-bats.mjs, `coverage.complete`). The census line sums the
// regular season and the postseason (Gary, 2026-11-03; a departure from
// ADR-0104 for this card). The picked at-bat shows Gameday's scorebug as it
// began, the zone, and how it ended: this page is an open surface (ADR-0034).
// Opening its date opens the game sealed (api/notebook.js).


export function LongAtBats({ season }) {
  const { data } = useAsync(() => fetchLongAtBats(season), [season])
  // How many rows are on screen, not a boolean — the door adds to it rather
  // than flipping it.
  // Which at-bat the scorebug, tiles and zone show: an index into the census.
  const [pick, setPick] = useState(0)
  // A club filter: an at-bat stays when the club is on either side of it.
  const [club, setClub] = useState(null)
  const linkProps = useRouteLink()

  const rows = data?.rows ?? []
  // A file for a season the page is not naming, a season still being played, or
  // one the sweep has not finished is not a census. The note is a count or it
  // is nothing.
  if (rows.length === 0 || data?.season !== season || !data?.coverage?.complete) return null

  // Its own census, shown only once the file has one and every postseason game on
  // it is read. A complete zero is still a count.
  const post = data.post?.coverage.complete ? data.post : null

  // The postseason's long at-bats join the list, each marked.
  // `key`: a row's own id. pk + batter + pitches is not unique at ten pitches
  // (one batter can see a pitcher twice for ten in a game), and a repeated React
  // key left a stale row standing at the head of a filtered list.
  const every = [...rows, ...(post?.rows ?? []).map((r) => ({ ...r, post: true }))]
    .sort((a, b) => b.pitches - a.pitches || (a.date < b.date ? -1 : 1))
    .map((r, i) => ({ ...r, key: i }))
  const clubs = [...new Set(every.flatMap((r) => [r.batter.teamId, r.pitcher.teamId]))]
    .filter(Boolean)
    .sort((a, b) => teamAbbr({ id: a }).localeCompare(teamAbbr({ id: b })))
  const all = club ? every.filter((r) => r.batter.teamId === club || r.pitcher.teamId === club) : every
  const top = all[pick] ?? all[0]
  const pickClub = (id) => {
    setClub(id)
    setPick(0)
  }
  // Gary asked for one number for the year (2026-11-03): the two seasons summed here.
  const plateAppearances = data.coverage.plateAppearances + (post?.coverage.plateAppearances ?? 0)
  // Every row, in a list that scrolls in its own box (five rows tall).
  const path = atBatGamePath(top)

  // ONE CARD, ONE UNIT: the longest at-bat drawn one square per pitch, the
  // next longest in the same squares beside it, and the census as one line under
  // both. A phone stacks the two halves.
  return (
    <section className="seasonnote seasonnote--stories" aria-label={`The longest at-bats of ${season}`}>
      {/* Mixed case in the markup, shouted by the CSS — the app's ALL-CAPS
          invariant is never a per-component .toUpperCase() (ADR-0017). */}
      <SectionHead as="h3" className="oseason__head">
        Longest at-bats of {season}
      </SectionHead>

      <Card frame="stamped" as="div" className="seasonnote__sheet">
        <ClubStrip clubs={clubs} value={club} onPick={pickClub} />
        <div className="seasonnote__row">
          <div className="seasonnote__longest">
            <p className="seasonnote__big">
              <span className="seasonnote__n">{top.pitches}</span>
              <span className="t-label t-label--bold">pitches</span>
              {path && (
                <a className="seasonnote__when" {...linkProps(path)}>
                  {monthDayName(top.date)}, {top.date.slice(0, 4)}
                  <span className="sr-only"> — open this game</span>
                  <span aria-hidden="true">›</span>
                </a>
              )}
            </p>
            <Suspense fallback={null}>
              <Scorebug row={top} />
            </Suspense>
            {/* Two stacked lines, as a broadcast matchup reads: who is up, who is throwing. */}
            <ul className="seasonnote__matchup">
              {[
                ['At bat', top.batter],
                ['Pitching', top.pitcher],
              ].map(([role, p]) => (
                <li
                  key={role}
                  className="seasonnote__side"
                  // A club may colour a card that identifies the club (ADR-0030's addendum).
                  style={{ '--side-club': teamPrimaryColor(p.teamId) || 'var(--surface-stamped-ink)' }}
                >
                  <TeamLogo teamId={p.teamId} size={120} variant="mono" className="seasonnote__sidemark" />
                  <div className="seasonnote__who">
                    <span className="seasonnote__role">{role}</span>
                    <PlayerLink id={p.id} name={p.name} className="seasonnote__name">
                      {p.name}
                    </PlayerLink>
                    <span className="seasonnote__club">{clubAbbr(top, p.teamId)}</span>
                  </div>
                  <Headshot personId={p.id} name={p.name} teamId={p.teamId} className="seasonnote__shot" />
                </li>
              ))}
            </ul>
            <div className="seasonnote__rest">
                <ol
              className="seasonnote__bars"
              // The foot fades only while there is more below; at the end, or a list
              // that fits, it sits flat.
              ref={(el) => el && markEnd(el)}
              onScroll={(e) => markEnd(e.currentTarget)}
            >
                  {all.map((row, i) => (
                    <li key={row.key}>
                      <button
                        type="button"
                        className="seasonnote__barrow"
                        aria-pressed={i === pick}
                        aria-label={`${row.batter.name} vs ${row.pitcher.name}, ${row.pitches} pitches, ${monthDayName(row.date)}`}
                        onClick={() => setPick(i)}
                      >
                        <span className="seasonnote__barn">{row.pitches}</span>
                    <span className="seasonnote__barwho">
                      <span className="seasonnote__barside">
                        <TeamLogo teamId={row.batter.teamId} size={18} />
                        <span className="seasonnote__barname">{row.batter.name}</span>
                      </span>
                      <span className="seasonnote__barside">
                        <TeamLogo teamId={row.pitcher.teamId} size={18} />
                        <span className="seasonnote__barname seasonnote__barname--p">{row.pitcher.name}</span>
                      </span>
                    </span>
                    <span className="seasonnote__barmeta">
                      <span>
                        {row.post && <span className="seasonnote__barpost">Postseason</span>}{row.post && ' · '}
                        {monthDayName(row.date)}
                      </span>
                      {row.event && <span className="seasonnote__barevent">{row.event}</span>}
                    </span>
                  </button>
                    </li>
                  ))}
                </ol>
              </div>
          </div>

          <Suspense fallback={null}>
            <AtBatZone key={`${top.pk}-${top.batter.id}-${top.pitches}`} row={top} />
          </Suspense>
        </div>


        <p className="seasonnote__census infopop-row">
          <span className="seasonnote__against">{every.length}</span> at-bats went {data.threshold}+ pitches in {season}, about 1 in every{' '}
          <span className="seasonnote__against">{count(oneIn(plateAppearances, every.length))}</span> plate appearances
          <InfoPopover label="How the at-bats are counted" className="infopop--paper">
            Regular season and postseason together: {count(plateAppearances)} plate appearances
            {post ? ` (${rows.length} of the long ones in the regular season, ${post.rows.length} in the postseason)` : ''}
            . A batter left mid-count by an inning-ending caught stealing starts a new
            at-bat next inning, and is counted as one. Each one opens its game, sealed.
          </InfoPopover>
        </p>
      </Card>
    </section>
  )
}
