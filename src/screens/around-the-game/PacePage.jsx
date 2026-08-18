import '../../styles/68-around-the-game.css'
import { useMemo, useState } from 'react'
import {
  fetchGate,
  paceBoard,
  PACE_SORTS,
  PACE_RANK_MIN_GAMES,
  latestSeason,
  monthsIn,
  asClock,
} from '../../api/around-the-game/gate.js'
import { loadClubs, clubName, clubShort } from '../../api/around-the-game/clubs.js'
import { humanDate } from '../../lib/dates.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { BroadcastMasthead, BroadcastSection } from '../../components/around-the-game/BroadcastMasthead.jsx'
import { Slab, SlabRow } from '../../components/around-the-game/StatSlab.jsx'
import { ClubCell } from '../../components/around-the-game/ClubCell.jsx'
import { BoardScroller } from '../../components/around-the-game/BoardScroller.jsx'
import { BarCell, TrendStrip } from '../../components/around-the-game/BroadcastBar.jsx'

// THE CLOCK — how long a club's games take.
//
// WHY THIS PAGE BELONGS IN AN APP FOR SCORING BY HAND. Nothing on the slate
// tells a reader how much of an evening a game will ask for, and that is a
// real planning question for someone who keeps score on paper next to a live
// broadcast: a club whose games run 2:35 and one whose games run 2:52 are
// seventeen minutes apart every single night, which is an hour and a half over
// a homestand. This is the only page in the app about the reader's time rather
// than about the baseball.
//
// COUNTED FOR BOTH CLUBS IN EVERY GAME, home and road. Game length is a joint
// production of the two rosters on the field — a club that works fast does not
// stop working fast in another park — so counting only home dates would halve
// the sample and quietly measure the ballpark instead of the club.
//
// THE BARS DO NOT START AT ZERO, and that is stated on the page rather than
// buried here. Every club in the league sits inside a twelve-minute band; a
// zero-based bar draws thirty identical bars and hides the only thing worth
// seeing. The floor is the league's own fastest club.
//
// SPOILER-FREE. A clock reading carries no result (api/around-the-game/gate.js).

const commas = (n) => (n == null ? '—' : n.toLocaleString('en-US'))

// EVERY DURATION ON THIS PAGE CARRIES ITS UNIT. A column of "2:49" is only
// obviously hours-and-minutes to someone who already knows what the page is
// about — it reads just as easily as a time of day, or as minutes and seconds,
// and a reader who guesses the last one is off by a factor of sixty. So the
// clock columns are captioned `h:mm`, the gap figures say "min" in the figure
// itself, and the delay totals spell out hours and minutes in words.
const HMM = 'h:mm'

// Month numbers as names, for the trend strip's text alternative.
const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// The strip's text alternative, built FROM THE DATA. A label reading only
// "Yankees game length by month" describes the picture's subject and conveys
// none of its content, which is a text alternative that does not serve the
// same purpose — and sighted readers have no axis or legend either, so this is
// the only place the strip's actual numbers exist.
function monthLabel(months, byMonth) {
  return months
    .map((m) => {
      const cell = byMonth?.[m]
      return cell?.avg == null ? null : `${MONTH_NAMES[Number(m)]} ${asClock(cell.avg)}`
    })
    .filter(Boolean)
    .join(', ')
}

// A club-month below this many games is left out of the trend strip's SCALE
// (it is still drawn). Ten is roughly a homestand — under it, one extra-inning
// night moves the month by two minutes.
const MONTH_MIN_GAMES = 10

// Minutes into a plain "3h 42m" reading, for durations too long to read as a
// clock — total time spent in weather delays, mostly.
function asHours(minutes) {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  return h ? `${h}h ${minutes % 60}m` : `${minutes} min`
}

export function PacePage() {
  useDocumentTitle('The Clock — Pace of Play')
  const [sortBy, setSortBy] = useState('avg')
  const { favoriteTeamId } = useFavoriteTeam()

  const { loading, error, data } = useAsync(() => fetchGate(), [])
  const { data: clubs } = useAsync(() => loadClubs(), [])

  const season = latestSeason(data)
  const board = useMemo(
    () => (data && season ? paceBoard(data, season, sortBy) : null),
    [data, season, sortBy],
  )

  const rows = board?.rows ?? []
  const league = board?.league
  const months = useMemo(() => monthsIn(rows), [rows])

  const avgs = rows.map((r) => r.avg).filter((v) => v != null)
  const barMin = avgs.length ? Math.min(...avgs) - 2 : 0
  const barMax = avgs.length ? Math.max(...avgs) : 1

  // The trend strip's scale ignores months a club barely played. A club-month
  // of four games swings twenty minutes on nothing, and the first version let
  // exactly two such cells — a five-game March and a four-game March — set the
  // floor and ceiling for all thirty strips.
  const monthValues = rows.flatMap((r) =>
    Object.values(r.byMonth ?? {})
      .filter((m) => m.g >= MONTH_MIN_GAMES && m.avg != null)
      .map((m) => m.avg),
  )
  const monthMin = monthValues.length ? Math.min(...monthValues) - 2 : 0
  const monthMax = monthValues.length ? Math.max(...monthValues) : 1

  const slowest = [...rows].sort((a, b) => b.avg - a.avg)[0]
  const quickest = [...rows].sort((a, b) => a.avg - b.avg)[0]
  const longestGame = [...rows].filter((r) => r.longest != null).sort((a, b) => b.longest - a.longest)[0]
  const shortestGame = [...rows]
    .filter((r) => r.shortest != null)
    .sort((a, b) => a.shortest - b.shortest)[0]
  // OFF THE LEAGUE LINE, not off the club column. Both clubs in a delayed game
  // carry that delay in their own row, so summing the rows doubles it — which
  // this slab did, printing 243h against a true 122h under a note claiming
  // each game was counted once.
  const delayMinutes = league?.delays?.minutes ?? null
  const delayGames = league?.delays?.games ?? null
  const spread = slowest && quickest ? Math.round((slowest.avg - quickest.avg) * 10) / 10 : null

  return (
    <div className="screen">
      <SiteHeader />

      <BroadcastMasthead
        eyebrow="The Clock"
        title="Pace of Play"
        dek="How long each club’s games actually take — home and road together, because game
             length is made by the two rosters on the field and not by the park. The only page
             here about your evening rather than about the baseball."
        meta={[
          { label: 'Season', value: season ?? '—' },
          { label: 'Through', value: board?.through ? humanDate(board.through) : '—' },
          { label: 'Games', value: commas(league?.paceGames) },
        ]}
      />

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={rows.length > 0}
        errorMessage="Couldn’t load game times. Try again."
        emptyMessage="No completed games on file for this season yet."
        emptyProse
      />

      {rows.length > 0 && (
        <>
          <SlabRow>
            <Slab
              tone="lead"
              value={asClock(league?.paceAvg)}
              label={`League average game (${HMM})`}
              note={`Median ${asClock(league?.paceMedian)}. ${commas(league?.over180)} games have
                     reached three hours.${
                       board?.margin
                         ? ` Any one club's average carries about ±${board.margin} min at this
                            point in the season.`
                         : ''
                     }`}
            />
            <Slab
              value={spread != null ? `${Math.round(spread)} min` : '—'}
              label="Longest club to quickest"
              note={
                slowest && quickest
                  ? `A ${clubShort(clubs, slowest.teamId)} game averages ${asClock(slowest.avg)}.
                     A ${clubShort(clubs, quickest.teamId)} game averages ${asClock(quickest.avg)}.`
                  : ''
              }
            />
            <Slab
              value={asClock(longestGame?.longest)}
              label={`Longest game (${HMM})`}
              note={
                longestGame
                  ? `${clubName(clubs, longestGame.teamId)}, ${humanDate(longestGame.longestDate)}`
                  : ''
              }
            />
            <Slab
              value={asHours(delayMinutes)}
              label="Spent waiting on weather"
              note={
                delayGames
                  ? `Across ${delayGames} delayed games. Counted once per game — and it is NOT
                     inside the game times above.`
                  : ''
              }
            />
          </SlabRow>

          <BroadcastSection
            title="The board"
            note={
              <>
                The bar shows how many minutes above the league’s quickest club a club sits — not
                how long its games are. It has to: {spread != null ? `the whole league fits inside
                ${Math.round(spread)} minutes` : 'the whole league fits inside a few minutes'}, and
                a bar drawn from zero would be thirty identical bars. Read the bars against each
                other and the clocks as the real figures.{' '}
                {board?.margin
                  ? `And read the order loosely: on ${board.medianGames} games apiece, each of
                     these averages carries about ±${board.margin} minutes, so most of this board
                     is a tie.`
                  : ''}
              </>
            }
          >
            <ul className="pillar-key">
              <li>
                <span className="pillar-key__swatch pillar-key__swatch--down" />
                <span>Above the league average of {asClock(league?.paceAvg)}</span>
              </li>
              <li>
                <span className="pillar-key__swatch pillar-key__swatch--fresh" />
                <span>Below it</span>
              </li>
            </ul>

            <div className="rpt-controls" role="group" aria-label="Sort the board">
              {PACE_SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`rpt-chip${s.key === sortBy ? ' is-on' : ''}`}
                  aria-pressed={s.key === sortBy}
                  onClick={() => setSortBy(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {months.length > 0 && (
              <p className="bcast-sec__note">
                The BY MONTH column runs {MONTH_NAMES[Number(months[0])]} to{' '}
                {MONTH_NAMES[Number(months[months.length - 1])]}, left to right, on one scale
                shared by all thirty clubs — a taller column is a longer month, and the scale runs
                from {asClock(monthMin)} to {asClock(monthMax)}. A month a club barely played is
                drawn but is left out of that scale.
              </p>
            )}

            {board && !board.rankable && (
              <p className="hint">
                Only {board.medianGames} games apiece so far. That is too few to tell these clubs
                apart — the gaps below are smaller than the margin on each figure — so the board
                is sorted but not ranked. Numbered places return around{' '}
                {PACE_RANK_MIN_GAMES} games.
              </p>
            )}

            <BoardScroller label="Game length board, every club ranked">
              <table className="standings rpt">
                <thead>
                  <tr>
                    {/* The rank glyph lives inside the club cell, and "1" means
                        slowest, quickest or rainiest depending on which chip is
                        pressed. Say which, here, rather than leave a reader to
                        remember a tap they made two scrolls ago. */}
                    <th className="team">
                      {board?.rankable ? `Club — ranked by ${board.sortLabel}` : 'Club'}
                    </th>
                    <th>Average ({HMM})</th>
                    <th>Median ({HMM})</th>
                    <th>Games 3:00+</th>
                    <th>Games 3:30+</th>
                    <th>By month ({HMM})</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.teamId} className={r.teamId === favoriteTeamId ? 'rpt__row--mine' : undefined}>
                      <ClubCell
                        teamId={r.teamId}
                        name={clubShort(clubs, r.teamId)}
                        rank={board.rankable ? r.rank : null}
                        tied={board.rankable ? r.tied : false}
                        sub={`${r.games} games`}
                      />
                      <td>
                        <BarCell
                          value={r.avg}
                          min={barMin}
                          max={barMax}
                          tone={r.avg > (league?.paceAvg ?? 0) ? 'hot' : 'cool'}
                        >
                          {asClock(r.avg)}
                        </BarCell>
                      </td>
                      <td>{asClock(r.median)}</td>
                      <td>
                        {r.over180Pct == null ? '—' : `${r.over180Pct.toFixed(1)}%`}
                        <span className="rpt__sub">{r.over180} games</span>
                      </td>
                      <td>{r.over210}</td>
                      <td>
                        <TrendStrip
                          months={months}
                          byMonth={r.byMonth}
                          min={monthMin}
                          max={monthMax}
                          label={`${clubName(clubs, r.teamId)} game length by month: ${monthLabel(
                            months,
                            r.byMonth,
                          )}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </BoardScroller>
          </BroadcastSection>

          <BroadcastSection
            title="The extremes"
            note="Each club’s longest and shortest game of the season. A four-hour game is
                  almost always extra innings; a two-hour game is almost always two starters
                  having a very good night at the same time. A game appears twice here, once
                  under each club that played it — the league’s longest night is one game, not
                  two."
          >
            <BoardScroller label="Longest and shortest game by club">
              <table className="standings rpt">
                <thead>
                  <tr>
                    <th className="team">Club</th>
                    <th>Longest ({HMM})</th>
                    <th>Shortest ({HMM})</th>
                    <th>Total delay</th>
                  </tr>
                </thead>
                <tbody>
                  {[...rows]
                    .sort((a, b) => (b.longest ?? 0) - (a.longest ?? 0))
                    .map((r) => (
                      <tr key={r.teamId} className={r.teamId === favoriteTeamId ? 'rpt__row--mine' : undefined}>
                        <ClubCell teamId={r.teamId} name={clubShort(clubs, r.teamId)} />
                        <td>
                          {asClock(r.longest)}
                          <span className="rpt__sub">
                            {r.longestDate ? humanDate(r.longestDate) : ''}
                            {r.longestOppId ? ` vs ${clubShort(clubs, r.longestOppId)}` : ''}
                          </span>
                        </td>
                        <td>
                          {asClock(r.shortest)}
                          <span className="rpt__sub">
                            {r.shortestDate ? humanDate(r.shortestDate) : ''}
                            {r.shortestOppId ? ` vs ${clubShort(clubs, r.shortestOppId)}` : ''}
                          </span>
                        </td>
                        <td>
                          {asHours(r.delayMinutes)}
                          <span className="rpt__sub">
                            {r.delayGames} game{r.delayGames === 1 ? '' : 's'}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </BoardScroller>
          </BroadcastSection>

          <section className="method">
            <h2>How this was counted</h2>
            <p>
              <strong>The unit is hours and minutes.</strong> Every figure written as{' '}
              <code>2:44</code> on this page means two hours and forty-four minutes. Game length
              is the elapsed-time figure the league publishes for each completed game, first pitch
              to final out. Weather delay is <em>not</em> inside it — the league keeps that clock
              separately, and it is the last column of the table below. A game this season was
              delayed 3:35 and still recorded as 3:24 long. So a club with a long average and a
              large delay column has not had its clock inflated by rain; those are two independent
              facts about its season.
            </p>
            <p>
              <strong>Both clubs are counted in every game.</strong> How long a game takes is made
              by the two rosters on the field, not by the ballpark, and a club that works quickly
              does not stop working quickly on the road. Counting only home dates would halve
              every sample and quietly measure the park instead of the club — which also means a
              single game appears once for each of the two clubs that played it, and never twice
              for either.
            </p>
            <p>
              <strong>Extra innings are included.</strong> They are a real part of how long a
              club’s games take, and stripping them out would flatter the clubs that happen to
              play close ones. In practice a single fourteen-inning night moves a club’s average
              by about half a minute; the extremes table below is where to find it.
            </p>
            <p>
              <strong>The bars do not start at zero.</strong> The whole league sits inside{' '}
              {spread != null ? `${Math.round(spread)} minutes` : 'a few minutes'}, and a bar drawn
              from zero would be thirty identical bars. They run from the league’s quickest club
              instead, which means bar length is the gap between clubs and not the length of a
              game — a club whose bar is twice another’s does not play games twice as long. The
              clock beside each bar is the real figure.
              {shortestGame
                ? ` The quickest game anyone has played this season is ${asClock(shortestGame.shortest)} —
                   ${clubName(clubs, shortestGame.teamId)}, ${humanDate(shortestGame.shortestDate)}.`
                : ''}
            </p>
          </section>
        </>
      )}

      <ReportFooter />
    </div>
  )
}
