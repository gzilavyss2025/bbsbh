import { useMemo, useState } from 'react'
import { useAsync } from '../../../../hooks/useAsync.js'
import { useViewOnce } from '../../../../hooks/motion/useViewOnce.js'
import { useRouteLink } from '../../../../lib/nav.js'
import { fetchWorkload, staffGridFor } from '../../../../api/workload.js'
import { AsyncStatus } from '../../../../components/ui/AsyncGate.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { Door } from '../../../../components/ui/control/Door.jsx'
import { Segmented } from '../../../../components/ui/control/Segmented.jsx'
import { Stack } from '../../../../components/ui/layout/Stack.jsx'
import { Grid } from '../../../../components/ui/layout/Grid.jsx'
import { StatStrip, StatCell } from '../../../../components/ui/frame/StatStrip.jsx'
import { DefenseDiamond } from '../../../../components/scoring/DefenseDiamond.jsx'
import { resolveBallparkLayout } from '../../../../lib/ballpark/layout/resolveLayout.js'
import { StaffGrid } from '../../../../components/workload/StaffGrid.jsx'
import { splitDisplayName } from '../../../../api/person.js'
import { loadRoster } from '../../data/loadRoster.js'
import { lineupDefenseFrom } from '../../data/shared.js'
import { RosterList } from '../../modules/RosterList.jsx'
import { SHARED } from '../once.js'
import { useBandData } from '../useBandData.js'
import { rosterCount, transactionsDoor } from './rosterData.js'
import { CoachingStaff } from './CoachingStaff.jsx'
import { RosterBox } from './RosterBox.jsx'
import { benchRows, lineupRows, metaById, penRows, penWeekFigures, rotationRows, warSum } from './boxRows.js'
import '../../../../styles/team-next/roster.css'

// Roster band (#1107, row 6c): the old Roster tab's data (loadRoster, through SHARED, so no new
// request) on stamped cards with a name tab. Open surface (ADR-0034): nothing here is sealed.
// Lineup and its bench are one card; the whole staff (starters, bullpen, the seven-day pen grid)
// is one card; then the 40-man and the injured list, and a door to the transactions ledger.
// The Lineup and Pitching staff cards are the scorecard's roster box (RosterBox.jsx, direction D
// of the 2026-10 restyle): one ruled table each, so they do not read as the 40-man list under
// them. At wide the lineup table sits beside the diamond, and the staff table beside the pen
// week; on a phone each stacks. Grid `fit` lets a lone table (a farm club has no pen week) take
// the full width, so no half of a card stands empty.
const DASH = '—'
const Sub = ({ title, children }) => (
  <section className="roster-sub">
    <h4 className="roster-sub__title">{title}</h4>
    {children}
  </section>
)

// The pen's seven days, off the nightly file the old Bullpen health card read (same request).
// MLB only and self-hiding: a farm club is absent from the file.
// The strip under it reads StaffGrid's own rows: who pitched yesterday, the week's pitches,
// and the arm with the most.
function PenWeek({ teamId }) {
  const { data } = useAsync(fetchWorkload, [])
  const grid = useMemo(() => (data?.asOf ? staffGridFor(data, Number(teamId), data.asOf) : null), [data, teamId])
  const fig = penWeekFigures(grid)
  if (!fig) return null
  return (
    <Stack gap="base" className="rosterbox-week">
      <Sub title="Bullpen, last seven days"><StaffGrid rows={grid} /></Sub>
      <StatStrip>
        <StatCell lead label="Yesterday" value={fig.pitched} note={`of ${fig.arms} pitched`} />
        <StatCell label="Seven days" value={fig.total} note="pitches" />
        <StatCell label="Most work" value={fig.busiest ? fig.busiest.last7dayPitches : '—'} note={fig.busiest ? splitDisplayName(fig.busiest.name).last : ''} />
      </StatStrip>
    </Stack>
  )
}

export default function Roster({ team, asOf, sportId: hint, onReady, onCount }) {
  const sportId = team.sport?.id ?? hint ?? 1 // the club's own league; the route hint may be unset
  const roster = useBandData(() => loadRoster(team.id, asOf, SHARED), [team.id, asOf], { onReady, onCount, count: rosterCount })
  const linkProps = useRouteLink()
  // Motion plays once per page visit; a return shows the cards at rest.
  const still = useViewOnce(team.id, 'team-roster')
  const [seasonFor, setSeasonFor] = useState(null) // the club whose Season view was picked

  const d = roster.data
  const door = transactionsDoor(team.id, asOf, sportId)
  const injuredIds = useMemo(() => new Set((d?.injured ?? []).map((p) => p.id)), [d])
  // The lineup stands on the club's own park, as it stood on the page's day (`?d=`) or today.
  // A venue with no layout on file falls back to the plain diamond.
  const venueId = team.venue?.id
  const venueName = team.venue?.name
  const park = useMemo(
    () => (venueId || venueName ? resolveBallparkLayout({ venueId, venueName, gameDate: asOf ?? undefined }) : null),
    [venueId, venueName, asOf],
  )
  let delay = 0
  const card = () => ({ stampIn: true, style: { '--stamp-delay': `${(delay += 55)}ms` } })

  const body = d && (() => {
    const hasRecent = d.recentPreferredLineup.length + d.recentSubstitutes.length + d.recentStartingPitchers.length + d.recentBullpen.length > 0
    const recent = hasRecent && seasonFor !== team.id
    const lineup = lineupDefenseFrom(recent ? d.recentPreferredLineup : d.preferredLineup, injuredIds)
    const subs = recent ? d.recentSubstitutes : d.substitutes
    const sp = recent ? d.recentStartingPitchers : d.startingPitchers
    const pen = recent ? d.recentBullpen : d.bullpen
    const meta = metaById(d)
    const showWar = d.sportId === 1
    const nine = lineupRows(lineup, meta)
    const bench = benchRows(subs, meta, injuredIds)
    const rotation = rotationRows(sp, injuredIds)
    const bullpen = penRows(pen, injuredIds, d.pitchers)
    const toggle = hasRecent && (
      <Segmented
        label="Roster projection basis"
        value={recent ? 'current' : 'season'}
        onChange={(v) => setSeasonFor(v === 'season' ? team.id : null)}
        options={[{ value: 'current', label: 'Current' }, { value: 'season', label: 'Season' }]}
        className="tnext__roster-toggle"
      />
    )
    return (
      <>
        {(lineup.length > 0 || subs.length > 0) && (
          <Card frame="stamped" label="Lineup" labelAs="h3" count={recent ? 'current' : 'season'} {...card()}>
            <Stack gap="section">
              {toggle}
              <Grid min="20rem" gap="loose" fit className="rosterbox-pair">
                {lineup.length > 0 && (
                  <div className="rosterbox-pair__diamond">
                    <DefenseDiamond defense={lineup} layout={park} label={`${venueName ?? 'Ballpark'} with the lineup`} />
                    {park?.accuracyNote && <p className="rosterbox-pair__note">{park.accuracyNote}</p>}
                  </div>
                )}
                <RosterBox
                  label="Lineup and top substitutes"
                  lead="Pos"
                  season={d.season}
                  showWar={showWar}
                  showProspect={d.isMilb}
                  groups={[{ rows: nine }, { title: 'Top substitutes', rows: bench }]}
                  foot={`Lineup ${warSum(nine).toFixed(1)} · bench ${warSum(bench).toFixed(1)}`}
                />
              </Grid>
            </Stack>
          </Card>
        )}
        {(sp.length > 0 || pen.length > 0) && (
          <Card frame="stamped" label="Pitching staff" labelAs="h3" count={`${sp.length + pen.length} arms`} {...card()}>
            <Grid min="20rem" gap="loose" fit className="rosterbox-pair">
              <RosterBox
                label="Rotation and bullpen"
                lead="Role"
                season={d.season}
                showWar={showWar}
                showProspect={d.isMilb}
                groups={[{ title: 'Rotation', rows: rotation }, { title: 'Bullpen', role: true, rows: bullpen }]}
                foot={`Rotation ${warSum(rotation).toFixed(1)} · bullpen ${warSum(bullpen).toFixed(1)}`}
              />
              <PenWeek teamId={team.id} />
            </Grid>
          </Card>
        )}
        {/* Keyed so a new club or day starts a fresh card; it arrives on its own read, so it takes no stagger step. */}
        <CoachingStaff key={`${team.id}|${asOf ?? ''}|${sportId}`} team={team} asOf={asOf} sportId={sportId} />
        {rosterCount(d) > 0 && (
          <Card frame="stamped" label="40-man roster" labelAs="h3" count={`${rosterCount(d)} players`} {...card()}>
            <div className="roster-cols">
              {d.position.length > 0 && (
                <Sub title={`Position players${sportId === 1 ? ' · season WAR' : ''}`}>
                  <RosterList season={d.season} showProspect={d.isMilb} rows={d.position.map((p) => ({ ...p, badge: p.pos, badgeClass: 'thub-pos' }))} />
                </Sub>
              )}
              {d.pitchers.length > 0 && (
                <Sub title={`Pitchers · role inferred${sportId === 1 ? ' · season WAR' : ''}`}>
                  <RosterList
                    season={d.season}
                    showProspect={d.isMilb}
                    rows={d.pitchers.map((p) => ({ ...p, badge: p.role ?? DASH, badgeClass: `rolechip${p.role === 'RP' ? ' rolechip--rp' : p.role === 'CL' ? ' rolechip--cl' : ''}` }))}
                  />
                </Sub>
              )}
            </div>
          </Card>
        )}
        {d.injured.length > 0 && (
          <Card frame="stamped" label="Injured list" labelAs="h3" count={d.injured.length} {...card()}>
            <RosterList season={d.season} showProspect={false} rows={d.injured.map((p) => ({ ...p, badge: p.ilLabel, badgeClass: 'ilchip', war: undefined }))} />
          </Card>
        )}
        {door && <Door className="tnext__roster-door" {...linkProps(door)}>All transactions</Door>}
      </>
    )
  })()

  return (
    <div className="tnext__square">
      <h2 className="tnext__bandhead">Roster</h2>
      <AsyncStatus loading={roster.loading} error={roster.error} hasData={d != null} errorMessage="Couldn’t load the roster. Try again." />
      <Stack gap="section" className={`tnext__roster${still ? ' tnext__roster--still' : ''}`}>{body}</Stack>
    </div>
  )
}
