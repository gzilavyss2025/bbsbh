import '../../styles/68-around-the-game.css'
import '../../styles/report/attendance.css'
import { useMemo, useState } from 'react'
import { fetchGate, gateBoard, GATE_SORTS, latestSeason, monthsIn, postseasonBoard, roadBoard } from '../../api/around-the-game/gate.js'
import { loadClubs, clubName, clubShort } from '../../api/around-the-game/clubs.js'
import { humanDate } from '../../lib/dates.js'
import { commas } from './abs/format.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { BroadcastSection } from '../../components/around-the-game/BroadcastMasthead.jsx'
import { Slab, SlabRow } from '../../components/around-the-game/StatSlab.jsx'
import { ClubCell } from '../../components/around-the-game/ClubCell.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { EmptyState } from '../../components/ui/state/EmptyState.jsx'
import { Table } from '../../components/ui/table/Table.jsx'
import { InfoPopover } from '../../components/ui/InfoPopover.jsx'
import { Segmented } from '../../components/ui/control/Segmented.jsx'
import { BarCell, DivergingBarCell, TrendStrip } from '../../components/around-the-game/BroadcastBar.jsx'

// THE GATE — who is actually going to the ballpark.
//
// The app has carried per-club attendance for a while (the Team hub's Ballpark
// card: average, high, low, league rank). This page exists because those four
// numbers, read one club at a time, cannot answer the only interesting
// question about a gate, which is comparative and is not about the raw count.
//
// THE ARGUMENT THE PAGE MAKES. A club's average attendance mostly measures how
// many seats it built. Ranking thirty clubs by raw heads puts the biggest
// parks on top and calls that support. The share of the park that FILLS says
// whether a town shows up, and it reorders the league — so fill rate leads,
// raw average sits beside it, and the reader can sort on either.
//
// Everything else on the page is about VARIANCE, because that is where the
// stories are: the swing between a club's best night and its worst, the month
// curve as a summer either arrives or does not, weekend against weekday, and
// which visiting club a park fills up for.
//
// A crowd count is not a score (api/around-the-game/gate.js).

const pct1 = (n) => (n == null ? '—' : `${n.toFixed(1)}%`)

// The board's numeric columns, in the order the table prints them. Held as
// data so the header row and the body cannot fall out of step.
const COLUMNS = [
  { key: 'fill', label: 'Fill', render: (r) => pct1(r.fill) },
  { key: 'avg', label: 'Average', render: (r) => commas(r.avg) },
  { key: 'total', label: 'Season', render: (r) => commas(r.total) },
  { key: 'best', label: 'Best', render: (r) => commas(r.best) },
  { key: 'swing', label: 'Range', render: (r) => commas(r.swing) },
]

export function AttendancePage() {
  useDocumentTitle('The Gate — Attendance')
  const [sortBy, setSortBy] = useState('fill')
  const { favoriteTeamId } = useFavoriteTeam()

  const { loading, error, data } = useAsync(() => fetchGate(), [])
  const { data: clubs } = useAsync(() => loadClubs(), [])

  const season = latestSeason(data)
  const board = useMemo(
    () => (data && season ? gateBoard(data, season, sortBy) : null),
    [data, season, sortBy],
  )

  // A separate block, read on its own: no postseason crowd reaches a season
  // rank, average or league line above. Null before October.
  const post = useMemo(() => (data && season ? postseasonBoard(data, season) : null), [data, season])

  const rows = board?.rows ?? []
  // Who draws on the road: each visitor's crowds against the hosts' own averages.
  const road = useMemo(() => (data && season ? roadBoard(data, season) : []), [data, season])
  // A signed figure around the usual house (0), so the bar runs from the middle out;
  // the half-width is the biggest swing either way.
  const liftSpan = Math.max(1, ...road.map((r) => Math.abs(r.lift)))
  const league = board?.league
  const months = useMemo(() => monthsIn(rows), [rows])

  // Every bar on the board is scaled across the LEAGUE's own range on the
  // sorted column, not from zero. Thirty clubs whose fill rates run 45% to
  // 99% draw as thirty near-identical bars off a zero floor; off the league
  // floor they draw as the spread they are. The caption says so.
  const sortKey = GATE_SORTS.find((s) => s.key === sortBy)?.key ?? 'fill'
  const values = rows.map((r) => r[sortKey]).filter((v) => v != null)
  const barMin = values.length ? Math.min(...values) * 0.92 : 0
  const barMax = values.length ? Math.max(...values) : 1

  // The month strip shares ONE scale across all thirty clubs, for the same
  // reason: a strip that rescaled per club would draw every club's own best
  // month at full height and say nothing.
  const monthValues = rows.flatMap((r) => Object.values(r.byMonth ?? {}).map((m) => m.avg))
  const monthMin = monthValues.length ? Math.min(...monthValues) * 0.9 : 0
  const monthMax = monthValues.length ? Math.max(...monthValues) : 1


  return (
    <div className="screen gate">
      <SiteHeader />

      {/* The title and one line, as Pressure Moments opens; the explanation is opt-in,
          behind the (i) (src/styles/CLAUDE.md). The season and its last day ride in the line. */}
      <header className="topbar gate__head">
        <h1 className="topbar__title">Attendance{season ? `, ${season}` : ''}</h1>
        <p className="hint infopop-row gate__dek">
          Every club’s home gate, ranked by how full the park gets
          {board?.through ? `, through ${humanDate(board.through)}` : ''}.{' '}
          <InfoPopover label="About attendance" className="infopop--paper infopop--down">
            A club’s average crowd mostly measures how many seats it built; the share of the park
            that fills measures a town, so fill rate leads. Fill rate is against the park’s listed
            capacity, so standing room can push a real crowd past 100%. Bars are scaled across the
            league’s own range, not from zero. Range is a club’s biggest night minus its smallest. On the road board, each visiting club’s
            crowds are measured against the host park’s own weekend or weekday average, so a club is not
            credited for the size of the parks it visits or for its share of Saturdays. A park that sells
            out most nights can’t show much of a visitor’s pull.
            {league?.attGames ? ` ${commas(league.attGames)} home dates so far.` : ''}
          </InfoPopover>
        </p>
      </header>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={rows.length > 0}
        errorMessage="Couldn’t load attendance. Try again."
        emptyMessage="No attendance on file for this season yet."
      />

      {rows.length > 0 && (
        <>
          {/* The board needs no heading: it is what the title names. */}
          <section className="gate__board" aria-label="Attendance board">
            <Segmented
              label="Sort the board"
              value={sortBy}
              onChange={setSortBy}
              options={GATE_SORTS.map((s) => ({ value: s.key, label: s.label }))}
              className="gate__sort"
            />

            <Table sticky label="Attendance board, every club ranked" className="rpt">
              <thead>
                <tr>
                  <th className="team">Club</th>
                  {COLUMNS.map((c) => (
                    <th key={c.key}>{c.label}</th>
                  ))}
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
                      note={r.venue ?? 'Park not on file'}
                    />
                    {COLUMNS.map((c) =>
                      c.key === sortKey ? (
                        <td key={c.key}>
                          <BarCell value={r[c.key]} min={barMin} max={barMax}>
                            {c.render(r)}
                          </BarCell>
                        </td>
                      ) : (
                        <td key={c.key}>{c.render(r)}</td>
                      ),
                    )}
                    <td>
                      <TrendStrip
                        months={months}
                        byMonth={r.byMonth}
                        min={monthMin}
                        max={monthMax}
                        label={`${clubName(clubs, r.teamId)} attendance by month`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </section>

          <BroadcastSection title="When the house fills">
            <Table sticky label="Weekend and weekday attendance by club" className="rpt">
              <thead>
                <tr>
                  <th className="team">Club</th>
                  <th>Weekend</th>
                  <th>Weekday</th>
                  <th>Gap</th>
                  <th>Day</th>
                  <th>Night</th>
                </tr>
              </thead>
              <tbody>
                {[...rows]
                  .filter((r) => r.weekend && r.weekday)
                  .sort((a, b) => b.weekend.avg - b.weekday.avg - (a.weekend.avg - a.weekday.avg))
                  .map((r) => (
                    <tr key={r.teamId} className={r.teamId === favoriteTeamId ? 'rpt__row--mine' : undefined}>
                      <ClubCell teamId={r.teamId} name={clubShort(clubs, r.teamId)} />
                      <td>{commas(r.weekend.avg)}</td>
                      <td>{commas(r.weekday.avg)}</td>
                      <td>{commas(r.weekend.avg - r.weekday.avg)}</td>
                      <td>{commas(r.day?.avg)}</td>
                      <td>{commas(r.night?.avg)}</td>
                    </tr>
                  ))}
              </tbody>
            </Table>
          </BroadcastSection>

          {road.length > 0 && (
            <BroadcastSection title="Who draws on the road">
              <Table sticky label="Visiting clubs ranked by the crowds they draw on the road" className="rpt">
                <thead>
                  <tr>
                    <th className="team">Visiting club</th>
                    <th>Vs. the usual house</th>
                    <th>Road average</th>
                  </tr>
                </thead>
                <tbody>
                  {road.map((r) => (
                    <tr key={r.teamId} className={r.teamId === favoriteTeamId ? 'rpt__row--mine' : undefined}>
                      <ClubCell teamId={r.teamId} name={clubShort(clubs, r.teamId)} rank={r.rank} />
                      <td>
                        <DivergingBarCell value={r.lift} center={0} span={liftSpan}>
                          {r.lift > 0 ? '+' : ''}{r.lift.toFixed(1)}%
                        </DivergingBarCell>
                      </td>
                      <td>{commas(r.avg)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </BroadcastSection>
          )}

          {post && (
            <BroadcastSection
              title="Postseason"
              note={`${commas(post.games)} home dates, through ${post.through ? humanDate(post.through) : '—'}; ranked only against other October clubs.`}
            >
              <SlabRow>
                <Slab value={commas(post.league?.attAvg)} label="Postseason average" />
                <Slab value={commas(post.league?.attTotal)} label="Postseason tickets" />
              </SlabRow>
              {post.rows.length > 0 ? (
                <Card as="div" frame="ledger" body="flush">
                  <Table sticky label="Postseason attendance by club" className="rpt">
                    <thead>
                      <tr>
                        <th className="team">Club</th>
                        <th>Games</th>
                        <th>Average</th>
                        <th>Total</th>
                        <th>Best</th>
                      </tr>
                    </thead>
                    <tbody>
                      {post.rows.map((r) => (
                        <tr key={r.teamId} className={r.teamId === favoriteTeamId ? 'rpt__row--mine' : undefined}>
                          <ClubCell
                            teamId={r.teamId}
                            name={clubShort(clubs, r.teamId)}
                            rank={r.rank}
                            tied={r.tied}
                            note={r.venue ?? 'Park not on file'}
                          />
                          <td>{commas(r.games)}</td>
                          <td>{commas(r.avg)}</td>
                          <td>{commas(r.total)}</td>
                          <td>
                            {commas(r.best)}
                            <span className="rpt__note">
                              {r.bestSeries ? `${r.bestSeries}${r.bestSeriesGame != null ? ` • G${r.bestSeriesGame}` : ''}` : r.bestDate ? humanDate(r.bestDate) : ''}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card>
              ) : (
                <EmptyState>No postseason home crowds on file yet.</EmptyState>
              )}
            </BroadcastSection>
          )}

        </>
      )}

      <ReportFooter />
    </div>
  )
}
