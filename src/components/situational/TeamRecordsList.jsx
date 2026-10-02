import { useRouteLink } from '../../lib/nav.js'
import { Table } from '../ui/table/Table.jsx'

// One club's situational records, every split it has played, with the club's
// rank in each among the clubs that played it. The by-team half of the
// postseason page: the board for one split reads ACROSS clubs, this reads DOWN
// one club. `groups` is teamRankRows' answer; `pathFor(metricId)` spells the
// address of that split's full board. `renderRecord(row)` optionally dresses
// the W-L cell, as the board's does. `ranked` false is the combined list of
// every club: nothing to rank against, so the Rank column gives way to Games.

function RankText({ row }) {
  if (row.rank == null) return <span className="trrank__ranktext">—</span>
  return (
    <span className="trrank__ranktext">
      {row.tied ? 'T' : ''}
      {row.rank} of {row.of}
    </span>
  )
}

export function TeamRecordsList({ groups, pathFor, renderRecord, ranked = true }) {
  const linkProps = useRouteLink()
  return (
    <div className="trrank__teamlist">
      {groups.map((group) => (
        <section className="trrank__group" key={group.title}>
          <header className="trrank__grouphead">
            <span>
              <h2>{group.title}</h2>
            </span>
          </header>
          <Table label={`${group.title} records`} className="trrank">
            <thead>
              <tr>
                <th className="team">Situation</th>
                <th>W-L</th>
                <th>Win pct</th>
                <th>{ranked ? 'Rank' : 'Games'}</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row) => (
                <tr key={row.id}>
                  <td className="team">
                    <a className="trrank__splitlink" {...linkProps(pathFor(row.id))}>
                      {row.k}
                    </a>
                  </td>
                  <td className="trrank__num">{renderRecord ? renderRecord(row) : row.v}</td>
                  <td className="trrank__num trrank__pct">{row.pct}</td>
                  <td className="trrank__num">
                    {ranked ? <RankText row={row} /> : row.played}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      ))}
    </div>
  )
}
