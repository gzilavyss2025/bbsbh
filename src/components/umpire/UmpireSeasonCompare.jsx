import { Card } from '../ui/frame/Card.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { Table } from '../ui/table/Table.jsx'
import { seasonDelta, seasonValue } from '../../lib/seasons/view.js'

// ONE UMPIRE, TWO SEASONS, STACKED (#1202): the umpire page's compare view.
// A board compares many men in a change column; one man's page puts his two
// seasons one above the other (#1199, question 3), the same figures in the
// same columns, and words the accuracy change with what it compares.
//
// `now` and `then` are loadUmpire's results for the shown season and the vs
// season. A season he did not work is a row of dashes, never zeros. A season
// before pitch calls were scored (the assignment backfill), or one the accuracy
// store does not have yet, has games and no accuracy: the row says so.
export function UmpireSeasonCompare({ now, then, year, vsYear }) {
  const rows = [
    [year, now],
    [vsYear, then],
  ]
  const change = seasonDelta(now?.accuracy?.season?.accuracy, then?.accuracy?.season?.accuracy, vsYear, 'pct')
  return (
    <Card body="flush" className="umpage__card">
      <SectionHead look="rule" as="h2" note={change ?? undefined}>
        {year} and {vsYear}
      </SectionHead>
      <Table frame="bare" label={`${year} and ${vsYear}, side by side`}>
        <thead>
          <tr>
            <th className="team">Season</th>
            <th>Games</th>
            <th>Plate</th>
            <th>Accuracy</th>
            <th>Rank</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([y, u]) => {
            const games = u?.games ?? null
            return (
              <tr key={y}>
                <th scope="row" className="team">{y}</th>
                <td>{games ? games.length : '—'}</td>
                <td>{games ? games.filter((g) => g.role === 'HP').length : '—'}</td>
                <td>{games && !u.accuracy ? 'no accuracy' : seasonValue(u?.accuracy?.season?.accuracy, 'pct')}</td>
                <td>{u?.rank ? `${u.rank.rank} of ${u.rank.total}` : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </Table>
    </Card>
  )
}
