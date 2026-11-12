import { Card } from '../../../../components/ui/frame/Card.jsx'
import { Table } from '../../../../components/ui/table/Table.jsx'
import { InfoPopover } from '../../../../components/ui/InfoPopover.jsx'
import { useRouteLink } from '../../../../lib/nav.js'
import { managerPath } from '../../../../lib/route.js'
import { managersView } from './peopleView.js'

// Every manager on the ledger, newest first, with his seasons, W-L and pct (#2784). The winningest
// (the summary's pick) wears a tag. A season with no split on file (the live season, or a shared one
// not yet seeded) is left out of his W-L, marked † with one footnote. Manager data starts in 1969 (managersFrom).
export function Managers({ managers, best }) {
  const link = useRouteLink()
  const list = managersView(managers, best)
  if (!list.length) return null
  return (
    <Card frame="stamped" body="flush" label="Managers" labelAs="h3" count={String(list.length)} className="frmgr">
      <Table frame="bare" label="Managers, newest first" className="frl__grid frmgr__grid">
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
                {m.partial && (
                  <>
                    <span aria-hidden="true"> †</span>
                    <span className="sr-only"> (a season with no split on file)</span>
                  </>
                )}
                {m.best && <span className="frl__tag">Most wins</span>}
              </th>
              <td className="frl__left">{m.years}</td>
              <td>{m.wl}</td>
              <td>{m.pct}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      {list.some((m) => m.partial) && (
        <p className="hint frl__hint infopop-row">
          † a season with no split on file{' '}
          <InfoPopover label="About the dagger" className="infopop--paper">
            A season with no W-L split on file for him, such as the current one before the offseason
            ledger run, is left out of his W-L.
          </InfoPopover>
        </p>
      )}
    </Card>
  )
}
