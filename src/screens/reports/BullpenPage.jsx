import '../../styles/68-broadcast-reports.css'
import { useMemo, useState } from 'react'
import { fetchWorkload, bullpenBoard, leagueBullpen, BULLPEN_SORTS } from '../../api/reports/bullpen.js'
import { loadClubs, clubName, clubShort } from '../../api/reports/clubs.js'
import { toApiDate, humanDate } from '../../lib/dates.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { PlayerLink } from '../../components/player/PlayerLink.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { ReportMasthead, ReportSection } from '../../components/reports/ReportMasthead.jsx'
import { Slab, SlabRow } from '../../components/reports/StatSlab.jsx'
import { ClubCell } from '../../components/reports/ClubCell.jsx'
import { BarCell, StatusMeter } from '../../components/reports/ReportBar.jsx'

// THE PEN — all thirty bullpens on one board, tonight.
//
// The app has drawn a bullpen availability board for a while, but only for the
// two clubs in the game you happen to be scoring. The rules behind it
// (api/workload.js: 25+ pitches yesterday, 35+ over three days, back-to-back
// days, three straight days) are the same rules a broadcast uses, and they are
// far more interesting run across the whole league than down one club — because
// the question a second screen actually raises is not "is this reliever tired"
// but "whose pen is empty, and who is about to find out".
//
// RANKED ON A SHARE, NOT A COUNT. Clubs carry different numbers of relievers,
// and four available arms out of six is a healthier pen than five out of
// eleven. The count is on the row too; the order is the share.
//
// WHAT THE UNDERLYING FILE IS. workload.json carries the arms that have
// pitched recently — roughly thirteen per club, not every pitcher who has
// appeared this season. So this is a board about the CURRENT staff and says
// so; it is not a season ledger of relief innings and must not be read as one.
//
// SPOILER-FREE, inherited from workload.js: completed appearances only, and
// the as-of date excludes today, so no in-progress line can leak.

// The reader-facing words for each status, and the order the legend prints
// them in. Held here rather than inline so the meter, the legend and the arm
// list cannot name the same state three ways.
const STATUS = {
  fresh: { label: 'Available' },
  limited: { label: 'Limited' },
  down: { label: 'Likely down' },
}

export function BullpenPage() {
  useDocumentTitle('The Pen — Bullpen Availability')
  const [sortBy, setSortBy] = useState('downPct')
  const [openClub, setOpenClub] = useState(null)
  const { favoriteTeamId } = useFavoriteTeam()

  const asOf = toApiDate()
  const { loading, error, data } = useAsync(() => fetchWorkload(), [])
  const { data: clubs } = useAsync(() => loadClubs(), [])

  const teamIds = useMemo(() => (clubs ? [...clubs.keys()] : []), [clubs])
  const board = useMemo(
    () => (data && teamIds.length ? bullpenBoard(data, teamIds, asOf, sortBy) : null),
    [data, teamIds, asOf, sortBy],
  )
  const rows = board ?? []
  const league = useMemo(() => leagueBullpen(rows), [rows])

  const loads = rows.map((r) => r.perArm)
  const barMin = loads.length ? Math.min(...loads) * 0.85 : 0
  const barMax = loads.length ? Math.max(...loads) : 1

  const mostTaxed = [...rows].sort((a, b) => b.downPct - a.downPct)[0]
  const busiestArm = rows
    .map((r) => r.leader)
    .filter(Boolean)
    .sort((a, b) => b.last7dayPitches - a.last7dayPitches)[0]
  const selected = rows.find((r) => r.teamId === (openClub ?? favoriteTeamId)) ?? rows[0]

  return (
    <div className="screen">
      <SiteHeader />

      <ReportMasthead
        eyebrow="The Pen"
        title="Bullpen Availability"
        dek="All thirty bullpens on one board, run through the same workload rules a broadcast
             uses. Ranked on the share of each staff that is likely down rather than the count,
             because four tired arms out of six is a different night than four out of eleven."
        meta={[
          { label: 'As of', value: humanDate(asOf) },
          { label: 'Arms tracked', value: league.arms || '—' },
          { label: 'Clubs', value: league.clubs || '—' },
        ]}
      />

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={rows.length > 0}
        errorMessage="Couldn’t load pitcher workload. Try again."
        emptyMessage="No recent pitcher workload on file."
        emptyProse
      />

      {rows.length > 0 && (
        <>
          <SlabRow>
            <Slab
              tone="lead"
              value={String(league.down)}
              label="Arms likely down, league-wide"
              note={`Of ${league.arms} tracked. Another ${league.limited} are limited.`}
            />
            <Slab
              value={mostTaxed ? `${mostTaxed.downPct.toFixed(0)}%` : '—'}
              label="Most taxed pen"
              note={mostTaxed ? clubName(clubs, mostTaxed.teamId) : ''}
            />
            <Slab
              value={busiestArm ? String(busiestArm.last7dayPitches) : '—'}
              label="Most pitches, last 7 days"
              note={busiestArm ? `${busiestArm.name}, ${busiestArm.last7dayApps} appearances` : ''}
            />
            <Slab
              value={league.last7 ? league.last7.toLocaleString('en-US') : '—'}
              label="Relief pitches, last 7 days"
              note="Across every tracked arm in the league."
            />
          </SlabRow>

          <ReportSection
            title="The board"
            note="The meter is each staff split three ways — available, limited, likely down.
                  A pen reading mostly red has usually had a week of one-run games, extra
                  innings, or starters who did not get out of the fifth."
          >
            <div className="rpt-controls" role="group" aria-label="Sort the board">
              {BULLPEN_SORTS.map((s) => (
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

            <ul className="pillar-key">
              {Object.entries(STATUS).map(([key, s]) => (
                <li key={key}>
                  <span className={`pillar-key__swatch pillar-key__swatch--${key}`} />
                  <span>{s.label}</span>
                </li>
              ))}
            </ul>

            <div className="ledger-wrap">
              <table className="standings rpt">
                <thead>
                  <tr>
                    <th className="team">Club</th>
                    <th>Staff</th>
                    <th>Down</th>
                    <th>Load per arm</th>
                    <th>Most used</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.teamId} className={r.teamId === favoriteTeamId ? 'rpt__row--mine' : undefined}>
                      <ClubCell
                        teamId={r.teamId}
                        name={clubShort(clubs, r.teamId)}
                        rank={r.rank}
                        sub={`${r.total} arms tracked`}
                      />
                      <td>
                        <StatusMeter
                          fresh={r.counts.fresh}
                          limited={r.counts.limited}
                          down={r.counts.down}
                          label={`${clubName(clubs, r.teamId)} — ${r.counts.fresh} available, ${r.counts.limited} limited, ${r.counts.down} likely down`}
                        />
                      </td>
                      <td>
                        {r.counts.down}
                        <span className="rpt__sub">{r.downPct.toFixed(0)}%</span>
                      </td>
                      <td>
                        <BarCell value={r.perArm} min={barMin} max={barMax} tone="hot">
                          {r.perArm}
                        </BarCell>
                      </td>
                      <td className="team">
                        {r.leader ? (
                          <>
                            <PlayerLink id={r.leader.personId}>{r.leader.name}</PlayerLink>
                            <span className="rpt__sub">
                              {r.leader.last7dayPitches} pitches, {r.leader.last7dayApps} apps
                            </span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ReportSection>

          <ReportSection
            title="Arm by arm"
            note="One club’s pen in full, most-worked first, with the rule that flagged each
                  name. Pick from the ten most-taxed staffs above, or your own club is opened
                  by default."
          >
            <div className="rpt-controls" role="group" aria-label="Club">
              {rows.slice(0, 10).map((r) => (
                <button
                  key={r.teamId}
                  type="button"
                  className={`rpt-chip${r.teamId === selected?.teamId ? ' is-on' : ''}`}
                  aria-pressed={r.teamId === selected?.teamId}
                  onClick={() => setOpenClub(r.teamId)}
                >
                  {clubs?.get(r.teamId)?.abbr || clubName(clubs, r.teamId)}
                </button>
              ))}
            </div>

            {selected && (
              <div className="ledger-wrap">
                <table className="standings rpt">
                  <thead>
                    <tr>
                      <th className="team">{clubName(clubs, selected.teamId)}</th>
                      <th>Status</th>
                      <th>7 days</th>
                      <th>Last out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.arms.map((a) => (
                      <tr key={a.personId}>
                        <td className="team">
                          <PlayerLink id={a.personId}>{a.name}</PlayerLink>
                          {a.reasons.length > 0 && (
                            <span className="rpt__sub">{a.reasons.join(' · ')}</span>
                          )}
                        </td>
                        <td>{STATUS[a.status]?.label ?? a.status}</td>
                        <td>
                          {a.last7dayPitches}
                          <span className="rpt__sub">
                            {a.last7dayApps} app{a.last7dayApps === 1 ? '' : 's'}
                          </span>
                        </td>
                        <td>
                          {a.lastOuting ? humanDate(a.lastOuting) : '—'}
                          <span className="rpt__sub">
                            {a.lastOuting ? `${a.lastOutingPitches} pitches` : ''}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ReportSection>

          <section className="method">
            <h2>How availability is decided</h2>
            <p>
              <strong>Three flags, counted in pitches and days.</strong> They are public
              broadcast rules rather than anything this site invented: a reliever who threw 25 or
              more pitches yesterday, one who has thrown 35 or more across the last three days,
              and one who worked both of the previous two days. A pitcher carrying two of those,
              or who has worked three straight days, is filed as likely down. One flag is
              limited. None is available.
            </p>
            <p>
              <strong>These are rules, not information.</strong> No club publishes who is
              unavailable, and a manager’s own list will differ from this one on any given night —
              a pitcher may be held back for a matchup two days away, or sent out on a fourth
              straight day because the game demanded it. Read the board as workload, which is a
              fact, rather than as availability, which is a decision.
            </p>
            <p>
              <strong>Starters are excluded outright.</strong> A rotation is not a bullpen, and
              counting five starters as available would flatter every club by the same five
              names. The board is also ranked on the share of each staff rather than the count,
              because four tired arms out of six is a different night than four out of eleven.
            </p>
            <p>
              <strong>It is a board about the current staff, not the season.</strong> The file
              behind this page carries the arms that have pitched recently — roughly thirteen a
              club — so a reliever just up from Triple-A will not appear until he works. Every
              appearance is counted strictly before today, which is why nothing in progress
              reaches this page.
            </p>
          </section>
        </>
      )}

      <ReportFooter />
    </div>
  )
}
