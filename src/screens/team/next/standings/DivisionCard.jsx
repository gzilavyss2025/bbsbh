import { useState } from 'react'
import { TeamLogo } from '../../../../components/logo/TeamLogo.jsx'
import { TeamLink } from '../../../../components/team/TeamLink.jsx'
import { PostseasonOddsModal } from '../../../../components/teamstats/PostseasonOddsModal.jsx'
import { Pill } from '../../../../components/ui/control/Pill.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { Table } from '../../../../components/ui/table/Table.jsx'
import { humanDate, isYearView } from '../../../../lib/dates.js'
import { gbText } from './standingsData.js'

// The division table on a stamped card (#1107, row 5b). Same rows as StandingsCard. At 390 the
// run differential was clipped by the sideways scroll, so Streak joins Home and Away in the wide
// columns (.standings__wide) and RD keeps its place; the top tile and the club's form line carry
// the streak. No club colour here (the hero's): the club's own row takes the table's default tint.
export function DivisionCard({ team, standings, asOf, odds, stampIn, style }) {
  const [showOdds, setShowOdds] = useState(false)
  const name = team.division?.name || 'Standings'
  const mlb = (team.sport?.id ?? 1) === 1
  return (
    <>
      <Card
        frame="stamped"
        body="flush"
        label={name}
        count={asOf && !isYearView(asOf) ? `entering ${humanDate(asOf)}` : `${standings.length} clubs`}
        stampIn={stampIn}
        className="stnd__card"
        style={style}
      >
        <Table frame="bare" label={`${name} standings`} className="clubtable">
          <thead>
            <tr>
              <th className="team">Team</th>
              <th>W</th>
              <th>L</th>
              <th>GB</th>
              <th className="standings__wide">Streak</th>
              <th>L10</th>
              <th className="standings__wide">Home</th>
              <th className="standings__wide">Away</th>
              <th>RD</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => (
              <tr key={s.id} className={s.isMe ? 'is-me' : ''}>
                <td className="team">
                  <TeamLink id={s.isMe ? null : s.id}>
                    <TeamLogo teamId={s.id} name={s.name} size={18} />
                    {s.name}
                  </TeamLink>
                </td>
                <td>{s.wins}</td>
                <td>{s.losses}</td>
                <td>{gbText(s.gb)}</td>
                <td className="standings__wide">{s.streak}</td>
                <td>{s.l10}</td>
                <td className="standings__wide">{s.home}</td>
                <td className="standings__wide">{s.away}</td>
                <td className={s.diffTone}>{s.diff}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        {(mlb || odds.length > 0) && (
          <div className="stnd__foot">
            {mlb && <p className="stnd__note">L10 counts the regular season. The Last 10 tile above counts October too.</p>}
            {odds.length > 0 && (
              <Pill role="control" fill="ink" onClick={() => setShowOdds(true)}>
                Postseason Odds
              </Pill>
            )}
          </div>
        )}
      </Card>
      {showOdds && <PostseasonOddsModal divisionName={name} rows={odds} onClose={() => setShowOdds(false)} />}
    </>
  )
}
