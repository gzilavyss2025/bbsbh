import { Card } from '../../../../components/ui/frame/Card.jsx'
import { Table } from '../../../../components/ui/table/Table.jsx'
import { useRouteLink } from '../../../../lib/nav.js'
import { managerPath } from '../../../../lib/route.js'
import { managersView } from './peopleView.js'

// Every manager on the ledger, newest first, with his seasons, W-L and pct (#2784). The winningest
// (the summary's pick) wears a tag. A season he shared with no split on file is left out of his
// W-L, marked † with one footnote. Manager data starts in 1969 (managersFrom).
export function Managers({ rows, best }) {
  const link = useRouteLink()
  const list = managersView(rows, best)
  if (!list.length) return null
  return (
    <Card frame="stamped" body="flush" label="Managers" count={String(list.length)} className="frmgr">
      <Table frame="bare" label="Managers, newest first" className="frmgr__grid">
        <thead>
          <tr>
            <th scope="col" className="frl__left">Manager</th>
            <th scope="col" className="frl__left">Years</th>
            <th scope="col">W-L</th>
            <th scope="col">Pct</th>
          </tr>
        </thead>
        <tbody>
          {list.map((m) => (
            <tr key={m.id}>
              <th scope="row" className="frl__left frmgr__name">
                <a className="plink" {...link(managerPath(m.id, m.name))}>
                  {m.name}
                </a>
                {m.partial && <span aria-label="a shared season has no split on file"> †</span>}
                {m.best && <span className="frl__tag">Most wins</span>}
              </th>
              <td className="frl__left">{m.years}</td>
              <td>{m.wl}</td>
              <td>{m.pct}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      {list.some((m) => m.partial) && <p className="frl__foot">† A season he shared has no split on file, so his W-L leaves it out.</p>}
    </Card>
  )
}
