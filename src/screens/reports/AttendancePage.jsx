import '../../styles/68-broadcast-reports.css'
import { useMemo, useState } from 'react'
import { fetchGate, gateBoard, GATE_SORTS, latestSeason, monthsIn } from '../../api/reports/gate.js'
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
// SPOILER-FREE. A crowd count is not a score (api/reports/gate.js).

const commas = (n) => (n == null ? '—' : n.toLocaleString('en-US'))
const pct1 = (n) => (n == null ? '—' : `${n.toFixed(1)}%`)

// The board's numeric columns, in the order the table prints them. Held as
// data so the header row and the body cannot fall out of step.
const COLUMNS = [
  { key: 'fill', label: 'Fill', render: (r) => pct1(r.fill) },
  { key: 'avg', label: 'Average', render: (r) => commas(r.avg) },
  { key: 'total', label: 'Season', render: (r) => commas(r.total) },
  { key: 'best', label: 'Best', render: (r) => commas(r.best) },
  { key: 'swing', label: 'Swing', render: (r) => commas(r.swing) },
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

  const rows = board?.rows ?? []
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

  const fullest = [...rows].filter((r) => r.fill != null).sort((a, b) => b.fill - a.fill)[0]
  const biggestNight = [...rows].filter((r) => r.best != null).sort((a, b) => b.best - a.best)[0]
  const widestSwing = [...rows].filter((r) => r.swing != null).sort((a, b) => b.swing - a.swing)[0]

  return (
    <div className="screen">
      <SiteHeader />

      <ReportMasthead
        eyebrow="The Gate"
        title="Attendance"
        dek="Every club’s home gate, ranked by the share of the park that fills rather than by
             the number of seats it built. Average attendance mostly measures architecture;
             fill rate measures a town."
        meta={[
          { label: 'Season', value: season ?? '—' },
          { label: 'Through', value: board?.through ? humanDate(board.through) : '—' },
          { label: 'Games', value: commas(league?.attGames) },
        ]}
      />

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={rows.length > 0}
        errorMessage="Couldn’t load attendance. Try again."
        emptyMessage="No attendance on file for this season yet."
        emptyProse
      />

      {rows.length > 0 && (
        <>
          <SlabRow>
            <Slab
              tone="lead"
              value={commas(league?.attAvg)}
              label="League average"
              note={`Median ${commas(league?.attMedian)} — the gap between the two is the
                     handful of clubs drawing 45,000 a night.`}
            />
            <Slab
              value={commas(league?.attTotal)}
              label="Tickets, season to date"
              note={`Across ${commas(league?.attGames)} home dates.`}
            />
            <Slab
              value={fullest ? pct1(fullest.fill) : '—'}
              label="Fullest park"
              note={fullest ? clubName(clubs, fullest.teamId) : ''}
            />
            <Slab
              value={commas(biggestNight?.best)}
              label="Biggest single gate"
              note={
                biggestNight
                  ? `${clubName(clubs, biggestNight.teamId)}, ${humanDate(biggestNight.bestDate)}`
                  : ''
              }
            />
          </SlabRow>

          <ReportSection
            title="The board"
            note="Bars are scaled across the league’s own range on the sorted column, not from
                  zero — off a zero floor thirty clubs draw as thirty identical bars. Fill rate
                  is against the park’s listed capacity, so standing room and a sold-out club
                  level can push a real crowd past 100%; those are printed as they came in."
          >
            <div className="rpt-controls" role="group" aria-label="Sort the board">
              {GATE_SORTS.map((s) => (
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
                        sub={r.venue ?? 'Park not on file'}
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
              </table>
            </div>
          </ReportSection>

          <ReportSection
            title="When the house fills"
            note="Every club draws better on a Saturday than on a Tuesday. What separates them
                  is by how much — a club whose weekend and weekday lines nearly meet sells the
                  same house whoever is in town and whenever they come."
          >
            <div className="ledger-wrap">
              <table className="standings rpt">
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
              </table>
            </div>
          </ReportSection>

          <ReportSection
            title="Who fills the place"
            note="The three visiting clubs each park draws best for, by average gate. Three
                  dates is a small sample and a single sold-out weekend can carry one — read
                  it as who the town turns out for, not as a ranking."
          >
            <div className="ledger-wrap">
              <table className="standings rpt">
                <thead>
                  <tr>
                    <th className="team">Home club</th>
                    <th className="team">Best draws</th>
                    <th>Quietest night</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.teamId} className={r.teamId === favoriteTeamId ? 'rpt__row--mine' : undefined}>
                      <ClubCell teamId={r.teamId} name={clubShort(clubs, r.teamId)} />
                      <td className="team">
                        {r.topOpponents.map((o) => (
                          <span key={o.teamId} className="rpt__sub">
                            {clubShort(clubs, o.teamId)} — {commas(o.avg)}
                          </span>
                        ))}
                      </td>
                      <td>
                        {commas(r.worst)}
                        <span className="rpt__sub">
                          {r.worstDate ? humanDate(r.worstDate) : ''}
                          {r.worstOppId ? ` vs ${clubShort(clubs, r.worstOppId)}` : ''}
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
              <strong>The unit is people, per home game.</strong> Attendance is the figure each
              club reports to the league for a home date, read off the MLB schedule feed. It is
              tickets distributed, not a turnstile count — a rainy Wednesday with 30,000 sold and
              12,000 in the seats is filed here as 30,000. Every club counts it the same way, so
              the board compares fairly; it simply does not measure how full the place looked.
            </p>
            <p>
              <strong>Only the home club is counted.</strong> A gate is a fact about a club’s own
              ballpark, so a road game folds nothing into that club’s figures. The season total is
              every home date added together, which is why a club with a few more home dates
              played can lead that column without leading the average.
            </p>
            <p>
              <strong>Fill rate divides the average by the park’s listed capacity.</strong> That
              capacity is a published number rather than a physical limit, which is why the
              leaders sit above 100 per cent: standing room, club seats and a generous listing all
              push past it. Those are printed as they came in rather than trimmed back to 100,
              because trimming them would erase exactly the clubs the column exists to find. A
              club whose park is not on file shows no fill rate and still ranks on every other
              column.
            </p>
            <p>
              <strong>Swing is the distance between a club’s biggest night and its smallest.</strong>{' '}
              A wide swing means the crowd depends on the opponent and the day of the week; a
              narrow one means the club sells much the same house whoever is in town.
              {widestSwing
                ? ` The widest in the league belongs to ${clubName(clubs, widestSwing.teamId)}, at
                   ${commas(widestSwing.swing)} people.`
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
