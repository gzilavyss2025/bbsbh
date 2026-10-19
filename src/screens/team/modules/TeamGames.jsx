import { useState, useMemo } from 'react'
import { extraInningsOf } from '../../../api/select.js'
import { gamePath } from '../../../lib/route.js'
import { useNav } from '../../../lib/nav.js'
import { TeamLogo } from '../../../components/logo/TeamLogo.jsx'
import { Door } from '../../../components/ui/control/Door.jsx'
import { DOW_LABELS, MONTH_LABELS } from './TeamStatsCard.jsx'
import { Grid } from '../../../components/ui/layout/Grid.jsx'

// The Games band's list of decided games: ticket-stub cards in a wrapping grid, newest first,
// capped until the user asks for more. The caller has already `won != null`-filtered the list
// (see loadGames.js — never re-derived from Final status here, which would bypass the
// fetchTeamSchedule cutoff and leak the very game a mid-scoring visitor opened this page from).
// The card CSS (`.last10__*`) keeps its old prefix rather than churn ~40 rules; see the block
// comment over `.last10` in index.css.

// Ticket-stub day/month/date parts for a game card. Same UTC-parse convention
// as dayOfWeekRecord/todayDowLabel in TeamStatsCard, so the weekday can't
// drift across a DST edge.
function gameDateParts(apiDate) {
  const d = new Date(`${apiDate}T00:00:00Z`)
  return { dow: DOW_LABELS[d.getUTCDay()], month: MONTH_LABELS[d.getUTCMonth()], day: d.getUTCDate() }
}

// One decided game as a torn ticket stub: a date leaf over a win/loss ink
// stamp carrying the opponent's mark, the score printed last. Routes to that
// game's box score — the one destination that already shows the score this
// card just displayed.
function GameStubCard({ game: g }) {
  const navigate = useNav()
  const { dow, month, day } = gameDateParts(g.apiDate)
  const hasScore = g.runs != null && g.oppRuns != null
  const winRuns = g.won ? g.runs : g.oppRuns
  const lossRuns = g.won ? g.oppRuns : g.runs
  const extraInnings = extraInningsOf(g.innings, g.scheduledInnings)
  const gmTag = [g.round, g.doubleHeader !== 'N' ? `Gm ${g.gameNumber}` : '']
    .filter(Boolean)
    .join(' \u00b7 ')
  const scoreWords = hasScore
    ? `${g.won ? 'won' : 'lost'} ${g.runs} to ${g.oppRuns}`
    : g.won
      ? 'won'
      : 'lost'
  const label = `${dow}, ${month} ${day}, ${g.isHome ? 'versus' : 'at'} ${g.opponent.name}, ${scoreWords}${extraInnings ? ` in ${g.innings} innings` : ''}`

  return (
    <button
      type="button"
      className={`last10__card${g.won ? ' last10__card--win' : ' last10__card--loss'}${g.isHome ? ' last10__card--home' : ''}`}
      onClick={() =>
        navigate(gamePath(g.apiDate, g.away.abbreviation, g.home.abbreviation, 'boxscore', g.gameNumber))
      }
      aria-label={label}
    >
      <div className="last10__stub">
        <div className="last10__cap">
          {dow} &middot; {month}
        </div>
        <div className="last10__daynum">{day}</div>
      </div>
      <div className="last10__band">
        <span className="last10__wl">{g.won ? 'W' : 'L'}</span>
        <TeamLogo
          teamId={g.opponent.id}
          name={g.opponent.name}
          size={30}
          variant="mono"
          className="last10__logo"
        />
        <span className="last10__oppcap">
          {g.isHome ? '' : '@ '}
          {g.opponent.abbreviation}
        </span>
      </div>
      <div className="last10__foot">
        {hasScore ? (
          <div className="last10__score">
            {winRuns}
            <span className="last10__sep">&ndash;</span>
            {lossRuns}
            {extraInnings && <span className="last10__meta last10__meta--inline">({extraInnings})</span>}
          </div>
        ) : (
          <div className="last10__score last10__score--final">Final</div>
        )}
        {gmTag && <div className="last10__meta">{gmTag}</div>}
      </div>
    </button>
  )
}

// How many cards the Games tab shows before asking, and how many each "Show
// more" adds. 24 divides evenly by every column count the grid can settle on
// (2, 3, 4, 6), so a page always ends on a complete row rather than a ragged
// one that reads as "that's all there is".
const GRID_PAGE = 24

// Every decided game this season, in a wrapping grid of the same ticket-stub
// cards — the Games tab's own list, where the Overview shows only the last
// ten. Newest first, so the games a scorer just charted sit at the top and
// paging runs backward through the season a screenful at a time; `games`
// already holds the whole season (fetchTeamSchedule's single per-page fetch),
// so showing more is a pure client-side slice, never a fresh request.
// Deliberately heading-less — the cards ARE the section, and the Schedule
// strip above it already names the season.
export function AllGames({ games }) {
  const [visibleCount, setVisibleCount] = useState(GRID_PAGE)
  const newestFirst = useMemo(() => [...games].reverse(), [games])
  const visible = newestFirst.slice(0, visibleCount)
  const remaining = newestFirst.length - visible.length

  return (
    <section className="gamesgrid" aria-label="Games played">
      <Grid min={100}>
        {visible.map((g) => (
          <GameStubCard key={g.gamePk} game={g} />
        ))}
      </Grid>
      {remaining > 0 && (
        <Door layout="block" onClick={() => setVisibleCount((c) => c + GRID_PAGE)}>
          Show {Math.min(GRID_PAGE, remaining)} more &middot; {remaining} left
        </Door>
      )}
    </section>
  )
}
