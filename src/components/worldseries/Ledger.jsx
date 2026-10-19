import { teamClubNameShort } from '../../lib/teams.js'
import { Pips } from '../bracket/bracketParts.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { Button } from '../ui/control/Button.jsx'
import { Card } from '../ui/frame/Card.jsx'
import { Table } from '../ui/table/Table.jsx'

// The series ledger (wide only): a real table. Columns G1..G7 with an "Off"
// column where a day falls between games; rows are the two clubs; the last
// column is wins as pips. A past game shows each club's runs, today's game one
// seal cell spanning both rows, a future game nothing, an off day hatched. All
// values come from ledgerModel, which keeps today's runs out unless `live`.
function Cell({ cell, onRevealScores }) {
  if (cell.kind === 'runs') return <td className="ww-ledger__runs">{cell.value}</td>
  if (cell.kind === 'off') return <td className={`ww-ledger__off${cell.today ? ' ww-ledger__off--today' : ''}`} />
  if (cell.kind === 'seal') {
    if (!cell.lead) return null
    return (
      <td rowSpan={2} className="ww-ledger__seal">
        {onRevealScores ? (
          <Button size="control" onClick={onRevealScores} className="ww-ledger__sealbtn">
            Sealed
          </Button>
        ) : (
          <span className="ww-ledger__sealnote">Sealed</span>
        )}
      </td>
    )
  }
  return <td className="ww-ledger__empty" />
}

export function Ledger({ series, model, onRevealScores }) {
  const { columns, rows } = model
  return (
    <Card frame="stamped" label="Series" body="flush" className="ww-ledgercard">
      <Table frame="bare" density="keep" className="ww-ledger" label="World Series results by game">
        <thead>
          <tr>
            <th scope="col" className="ww-ledger__club">
              Club
            </th>
            {columns.map((c) =>
              c.kind === 'off' ? (
                <th key={`off-${c.afterGame}`} scope="col" className={`ww-ledger__off${c.today ? ' ww-ledger__off--today' : ''}`}>
                  Off
                </th>
              ) : (
                <th key={c.gameNumber} scope="col" className={c.ifNecessary ? 'ww-ledger__maybe' : undefined}>
                  G{c.gameNumber}
                </th>
              ),
            )}
            <th scope="col">W</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const slot = series.slots[i]
            return (
              <tr key={row.clubId}>
                <th scope="row" className="ww-ledger__club">
                  <TeamLogo teamId={row.clubId} name={slot.club.name} size={24} />
                  {teamClubNameShort(row.clubId) ?? slot.club.abbreviation}
                </th>
                {row.cells.map((cell, j) => (
                  <Cell key={j} cell={cell} onRevealScores={onRevealScores} />
                ))}
                <td className="ww-ledger__wins">
                  <Pips winsNeeded={series.winsNeeded} wins={slot.wins} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </Table>
    </Card>
  )
}
