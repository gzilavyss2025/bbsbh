import '../../styles/68-around-the-game.css'
import { useMemo, useState } from 'react'
import { fetchWorkload, bullpenBoard, leagueBullpen, BULLPEN_SORTS } from '../../api/around-the-game/bullpen.js'
import { staffGridFor } from '../../api/workload.js'
import { StaffGrid } from '../../components/workload/StaffGrid.jsx'
import { ThresholdBullets } from '../../components/workload/ThresholdBullets.jsx'
import { loadClubs, clubName, clubShort } from '../../api/around-the-game/clubs.js'
import { toApiDate, humanDate } from '../../lib/dates.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { PlayerLink } from '../../components/player/PlayerLink.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { BroadcastMasthead, BroadcastSection } from '../../components/around-the-game/BroadcastMasthead.jsx'
import { Slab, SlabRow } from '../../components/around-the-game/StatSlab.jsx'
import { ClubCell } from '../../components/around-the-game/ClubCell.jsx'
import { BoardScroller } from '../../components/around-the-game/BoardScroller.jsx'
import { BarCell, StatusMeter } from '../../components/around-the-game/BroadcastBar.jsx'

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

// THE RULE, DRAWN. The staff grid above draws cells and rails — what each arm
// threw and when — but never the thresholds those readings are judged against,
// so this page had to spell them out in prose ("25 or more pitches yesterday,
// 35 or more across three days…"). The bullets draw them instead, and the
// paragraph keeps only the part no mark carries: how the flags COMBINE.
//
// Read off the arm the grid sorts to the top, which compareArms makes the row
// this club's board most wants a reader to see (status first, then load) — not
// a synthetic example. `flags` is the row's own availabilityFor evaluation,
// i.e. the same single tiredFlagsFor call behind its status dot, so a bar short
// of its tick can never sit under a "likely down" row.
//
// Renders nothing without flags, which keeps the degrade convention: a club
// whose arms are missing from the file loses the mark, not the page.
function PenRule({ row }) {
  if (!row?.flags?.length) return null
  return (
    <figure className="penpage__rule">
      <figcaption className="penpage__rulehead">
        The rule, on{' '}
        <PlayerLink id={row.personId}>{row.name}</PlayerLink>{' '}
        — a tick is the published threshold, a bar past it is that flag tripped.
      </figcaption>
      <ThresholdBullets flags={row.flags} />
    </figure>
  )
}

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
  // The selected club's pen as grid rows — the same seven-day board the lineup
  // page draws, run here for whichever staff the chips have open.
  const grid = useMemo(
    () => (data && selected ? staffGridFor(data, selected.teamId, asOf) : null),
    [data, selected, asOf],
  )

  return (
    <div className="screen">
      <SiteHeader />

      <BroadcastMasthead
        eyebrow="The Pen"
        title="Bullpen Availability"
        dek="All thirty bullpens on one board, ranked on the share of each staff that is likely
             down rather than the count — four tired arms out of six is a different night than
             four out of eleven."
        meta={[
          // The DATA's own stamp, not today's date. This used to read
          // humanDate(asOf) — i.e. toApiDate(), today, computed in the browser —
          // which told the reader nothing: it said "today" whether workload.json
          // was written last night or last week. `asOf` still drives the
          // availability math below (a bullpen is down or not AS OF TODAY);
          // it just can no longer vouch for how fresh the file behind it is.
          { label: 'Data', value: data?.asOf ? humanDate(data.asOf) : '—' },
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

          <BroadcastSection
            title="The board"
            note="Each staff split three ways — available, limited, likely down."
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

            <BoardScroller label="Bullpen board, every club ranked">
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
            </BoardScroller>
          </BroadcastSection>

          <BroadcastSection
            title="Arm by arm"
            note="One club’s pen over its last seven days — a cell is what he threw, a rail joins
                  days worked back to back. Sorted on availability, then load."
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

            {grid && (
              <div className="penpage__grid">
                <h3 className="penpage__gridclub">{clubName(clubs, selected.teamId)}</h3>
                <StaffGrid rows={grid} />
                <PenRule row={grid[0]} />
              </div>
            )}
          </BroadcastSection>

          <section className="method">
            <h2>How availability is decided</h2>
            <p>
              <strong>Two flags, or three straight days on its own, files an arm as likely
              down.</strong> The bullets above draw each flag against the threshold that judges
              it, so the numbers are on the page rather than in this paragraph. They are public
              broadcast rules, not anything this site invented.
            </p>
            <p>
              <strong>Read it as workload, which is a fact, rather than availability, which is a
              decision.</strong> No club publishes who is unavailable, and a manager will differ
              from this board on any night. Starters are excluded — a rotation is not a bullpen.
              The file behind the page carries the arms that have pitched recently, roughly
              thirteen a club, and counts every appearance strictly before today.
            </p>
          </section>

        </>
      )}

      <ReportFooter />
    </div>
  )
}
