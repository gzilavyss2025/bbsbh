import { totalsRows } from '../../lib/postseason/seriesTotals.js'
import { teamAbbr } from '../../lib/teams.js'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { Card } from '../ui/frame/Card.jsx'

// SERIES TOTALS: the sums a scorer would add at the foot of the sheet. One
// mirrored table, the first club's figure on the left, the stat code in the
// middle, the second club's on the right, batting then pitching. The leading
// figure of each pair is inked darker, and the table says which one in words
// for a screen reader, so the emphasis is not colour alone.
//
// Counted games only: the figures are summed from the box scores
// loadSeriesStats already fetches (lib/postseason/seriesTotals.js), which are
// the games that went Final before the cutoff. It adds no request.
//
//   totals   loadSeriesStats's `totals`, { [clubId]: { batting, pitching, games } }
//   clubs    [{ id }, { id }], the left club then the right club
export function SeriesTotals({ totals, clubs }) {
  const [left, right] = clubs
  const groups = totalsRows(totals, left?.id, right?.id)
  if (!groups.length) return null
  const games = totals[left.id]?.games ?? 0
  const name = (id) => teamAbbr({ id })
  return (
    <section className="psseries__totalssection">
      <SectionHead look="label" note={`${games} ${games === 1 ? 'game' : 'games'}`}>
        Series totals
      </SectionHead>
      <Card as="div" body="flush" className="psseries__totals">
        <table className="psseries__totalstable">
          <caption className="sr-only">
            Series totals, {games} {games === 1 ? 'game' : 'games'}, {name(left.id)} and {name(right.id)}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="psseries__totalsclub">
                <TeamLogo teamId={left.id} name={name(left.id)} size={22} />
                <span>{name(left.id)}</span>
              </th>
              <td />
              <th scope="col" className="psseries__totalsclub psseries__totalsclub--right">
                <span>{name(right.id)}</span>
                <TeamLogo teamId={right.id} name={name(right.id)} size={22} />
              </th>
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.group}>
              <tr className="psseries__totalsgroup">
                <th scope="colgroup" colSpan={3}>
                  {g.group}
                </th>
              </tr>
              {g.rows.map((r) => (
                <tr key={`${g.group}-${r.code}`} className="psseries__totalsrow">
                  <Value value={r.a} lead={r.better === 'a'} />
                  <th scope="row" className="psseries__totalskey">
                    <abbr title={r.label}>{r.code}</abbr>
                  </th>
                  <Value value={r.b} lead={r.better === 'b'} />
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </Card>
    </section>
  )
}

function Value({ value, lead }) {
  return (
    <td className={`psseries__totalsval${lead ? ' psseries__totalsval--lead' : ''}`}>
      {value}
      {lead && <span className="sr-only"> (leads)</span>}
    </td>
  )
}
