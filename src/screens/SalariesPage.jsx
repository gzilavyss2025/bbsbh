import '../styles/71-salaries-league.css'
import { useMemo, useState } from 'react'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../hooks/preferences/useFavoriteTeam.js'
import { fetchLeagueSalaries, salaryBoard, boardPositions } from '../api/salaries.js'
import { SiteHeader } from '../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../components/chrome/ReportFooter.jsx'
import { AsyncStatus } from '../components/ui/AsyncGate.jsx'
import { TeamFilterStrip } from '../components/team/TeamFilterStrip.jsx'
import { TeamLink } from '../components/team/TeamLink.jsx'
import { TeamLogo } from '../components/logo/TeamLogo.jsx'
import { PlayerLink } from '../components/player/PlayerLink.jsx'
import { teamFullName } from '../lib/teams.js'
import { SalaryBoard } from '../components/salaries/SalaryBoard.jsx'
import { ClubPayrolls } from '../components/salaries/ClubPayrolls.jsx'
import { PositionSpend } from '../components/salaries/PositionSpend.jsx'
import { SourceLine } from '../components/salaries/SourceLine.jsx'
import { moneyLabel, Money } from '../components/salaries/Money.jsx'

// The thirty-club money page, beside Standings rather than inside any one club:
// who is paid the most, who spends the most, who is still owed the most, and
// where the money actually goes.
//
// TWO FILTERS, ONE BOARD. The club rail across the top is the app's own
// TeamFilterStrip — the same control Leaders and All-Star Rosters wear — so
// picking a club here feels like picking one anywhere else. The position chips
// under the board's masthead are the second cut. Both narrow the SAME board;
// neither touches the club-payroll ranking below it, because filtering a
// thirty-row ranking down to one row destroys the only thing a ranking is for.
// The pick rings that club's row there instead.
//
// Nothing on this page is sealed: a salary is not a score (ADR-0034, and
// src/api/salaries.js's header).
const BOARD_ROWS = 12

export function SalariesPage() {
  useDocumentTitle('Salaries')
  const { favoriteTeamId } = useFavoriteTeam()
  const [team, setTeam] = useState(null)
  const [position, setPosition] = useState(null)
  const league = useAsync(() => fetchLeagueSalaries(), [])
  const data = league.data

  const players = useMemo(
    () => salaryBoard(data, { team, pos: position, limit: BOARD_ROWS }),
    [data, team, position],
  )
  const positions = useMemo(() => boardPositions(data), [data])

  // The bar scale is the FILTERED top, not the league's, so a club's own board
  // still fills its width instead of drawing eleven slivers next to Juan Soto.
  const top = players[0]?.salary ?? 1
  const context = [
    team ? teamFullName(team) : 'All 30 clubs',
    position ?? 'every position',
  ].join(' · ')

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Salaries</h1>
      </header>

      <AsyncStatus
        loading={league.loading}
        error={league.error}
        hasData={data != null}
        errorMessage="Couldn’t load league salaries. Try again."
      />

      {data == null && !league.loading && !league.error && (
        <p className="hint">League salaries have not been published yet.</p>
      )}

      {data && (
        <>
          <TeamFilterStrip
            selectedTeamId={team}
            onSelect={setTeam}
            ariaLabel="Filter by club"
            showArrows
            centerTeamId={favoriteTeamId}
          />

          <SalaryBoard
            players={players}
            positions={positions}
            position={position}
            onPosition={setPosition}
            context={context}
            top={top}
          />

          <section className="payowed" aria-labelledby="payowed-title">
            <div className="metricbar">
              <span className="metricbar__title" id="payowed-title">
                Most still owed
              </span>
              <span className="payboard__context">
                {data.season}–{data.throughYear}
              </span>
            </div>
            {data.owed.map((player) => (
              <div key={player.id} className="payowed__row">
                <span className="payclubs__mark">
                  <TeamLink id={player.teamId} tab="contracts" ariaLabel={player.abbrev}>
                    <TeamLogo teamId={player.teamId} name={player.abbrev} size={22} />
                  </TeamLink>
                </span>
                <span className="payowed__name">
                  <PlayerLink id={player.id}>{player.name}</PlayerLink>
                </span>
                <span className="payowed__value">
                  <Money value={player.remaining} />
                </span>
              </div>
            ))}
          </section>

          <ClubPayrolls
            clubs={data.clubs}
            pickedTeamId={team}
            max={data.clubs[0]?.payroll ?? 1}
          />

          <PositionSpend
            positions={data.positions}
            note={`Covers ${moneyLabel(data.totals.covered)} of the league's ${moneyLabel(
              data.totals.payroll,
            )} — the rest is money owed to players with no place on a 40-man roster.`}
          />

          <SourceLine meta={data.meta} note="Pre-arbitration figures are estimates." />
        </>
      )}

      <ReportFooter />
    </div>
  )
}
