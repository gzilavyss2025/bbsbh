import '../../styles/68-broadcast-reports.css'
import { useMemo, useState } from 'react'
import { fetchGate, paceBoard, PACE_SORTS, latestSeason, monthsIn, asClock } from '../../api/reports/gate.js'
import { loadClubs, clubName, clubShort } from '../../api/reports/clubs.js'
import { humanDate } from '../../lib/dates.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { ReportMasthead, ReportSection } from '../../components/reports/ReportMasthead.jsx'
import { Slab, SlabRow } from '../../components/reports/StatSlab.jsx'
import { ClubCell } from '../../components/reports/ClubCell.jsx'
import { BarCell, TrendStrip } from '../../components/reports/ReportBar.jsx'

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
// SPOILER-FREE. A clock reading carries no result (api/reports/gate.js).

const commas = (n) => (n == null ? '—' : n.toLocaleString('en-US'))

// Minutes into a plain "3h 42m" reading, for durations too long to read as a
// clock — total time spent in weather delays, mostly.
function asHours(minutes) {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  return h ? `${h}h ${minutes % 60}m` : `${minutes}m`
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

  const monthValues = rows.flatMap((r) => Object.values(r.byMonth ?? {}).map((m) => m.avg))
  const monthMin = monthValues.length ? Math.min(...monthValues) - 2 : 0
  const monthMax = monthValues.length ? Math.max(...monthValues) : 1

  const slowest = [...rows].sort((a, b) => b.avg - a.avg)[0]
  const quickest = [...rows].sort((a, b) => a.avg - b.avg)[0]
  const longestGame = [...rows].filter((r) => r.longest != null).sort((a, b) => b.longest - a.longest)[0]
  const shortestGame = [...rows]
    .filter((r) => r.shortest != null)
    .sort((a, b) => a.shortest - b.shortest)[0]
  const delayMinutes = rows.reduce((s, r) => s + r.delayMinutes, 0)
  const spread = slowest && quickest ? Math.round((slowest.avg - quickest.avg) * 10) / 10 : null

  return (
    <div className="screen">
      <SiteHeader />

      <ReportMasthead
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
              label="League average game"
              note={`Median ${asClock(league?.paceMedian)}. ${commas(league?.over180)} games have
                     run past three hours.`}
            />
            <Slab
              value={spread != null ? `${spread}m` : '—'}
              label="Slowest to quickest"
              note={
                slowest && quickest
                  ? `${clubName(clubs, slowest.teamId)} to ${clubName(clubs, quickest.teamId)}, every night.`
                  : ''
              }
            />
            <Slab
              value={asClock(longestGame?.longest)}
              label="Longest game"
              note={
                longestGame
                  ? `${clubName(clubs, longestGame.teamId)}, ${humanDate(longestGame.longestDate)}`
                  : ''
              }
            />
            <Slab
              value={asHours(delayMinutes)}
              label="Spent waiting on weather"
              note="Total delay across the league this season, both clubs counted once each."
            />
          </SlabRow>

          <ReportSection
            title="The board"
            note="Bars run from the league’s quickest club, not from zero — every club sits
                  inside a twelve-minute band, and a zero-based bar would draw thirty identical
                  bars. The three-hour column is the share of that club’s own games, so a club
                  that has played more of them is not penalised for it."
          >
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

            <div className="ledger-wrap">
              <table className="standings rpt">
                <thead>
                  <tr>
                    <th className="team">Club</th>
                    <th>Average</th>
                    <th>Median</th>
                    <th>3:00+</th>
                    <th>3:30+</th>
                    <th>By month</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.teamId} className={r.teamId === favoriteTeamId ? 'rpt__row--mine' : undefined}>
                      <ClubCell
                        teamId={r.teamId}
                        name={clubShort(clubs, r.teamId)}
                        rank={r.rank}
                        tied={r.tied}
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
                        {r.over180}
                        <span className="rpt__sub">{r.over180Pct}%</span>
                      </td>
                      <td>{r.over210}</td>
                      <td>
                        <TrendStrip
                          months={months}
                          byMonth={r.byMonth}
                          min={monthMin}
                          max={monthMax}
                          label={`${clubName(clubs, r.teamId)} game length by month`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ReportSection>

          <ReportSection
            title="The extremes"
            note="Each club’s longest and shortest game of the season. A four-hour game is
                  almost always extra innings; a two-hour game is almost always two starters
                  having a very good night at the same time."
          >
            <div className="ledger-wrap">
              <table className="standings rpt">
                <thead>
                  <tr>
                    <th className="team">Club</th>
                    <th>Longest</th>
                    <th>Shortest</th>
                    <th>Delays</th>
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
            </div>
          </ReportSection>

          <section className="method">
            <h2>How this was counted</h2>
            <p>
              Game length is the elapsed-time figure the league publishes for each completed
              game — first pitch to final out, INCLUDING any weather delay inside it. The delay
              column is the same feed’s separate delay total, so a club with a long average and
              a large delay column has had its clock inflated by rain rather than by baseball.
            </p>
            <p>
              Extra innings are in. They are a real part of how long a club’s games take, and
              stripping them would flatter clubs that happen to play close games. What that
              means in practice: a single fourteen-inning night moves a club’s average by
              roughly half a minute, and the extremes table is where to look for it.
            </p>
            <p>
              {shortestGame
                ? `The quickest game anyone has played this season is ${asClock(shortestGame.shortest)},
                   by ${clubName(clubs, shortestGame.teamId)} on ${humanDate(shortestGame.shortestDate)}.`
                : ''}{' '}
              Regular season only, and only games already final.
            </p>
          </section>
        </>
      )}

      <ReportFooter />
    </div>
  )
}
