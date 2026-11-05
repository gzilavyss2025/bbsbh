import { Card } from '../../../../components/ui/frame/Card.jsx'
import { StatTile } from '../../../../components/ui/frame/StatTile.jsx'
import { useRouteLink } from '../../../../lib/nav.js'
import { managerPath } from '../../../../lib/route.js'
import { summaryView } from './summaryView.js'

// The franchise summary (#2784; wireframe approved by Gary 2026-11-05): four tiles (record,
// postseasons, pennants, titles), then the names, the postseason years and the winningest
// manager. First on a phone; the side column at the widest step (history/franchise.css).
export function FranchiseSummary({ summary }) {
  const link = useRouteLink()
  const v = summaryView(summary)
  if (!v) return null
  return (
    <Card frame="stamped" label="Franchise" count={`${v.seasons} ${v.seasons === 1 ? 'season' : 'seasons'}`} className="frsum">
      <div className="frsum__tiles">
        <StatTile tone="ink" label="Record" value={v.record} caption={`${v.pct} · ${v.span}`} className="frsum__lead" />
        <StatTile tone="tint" label="Postseasons" value={v.postseasons} caption={v.lastPostseason ? `Last ${v.lastPostseason}` : null} />
        <StatTile label="Pennants" value={v.pennants} caption={v.pennant.caption} />
        <StatTile label="World Series" value={v.titles} caption={v.title.caption} />
      </div>
      <dl className="frsum__facts">
        <dt className="t-label">Names</dt>
        <dd>
          {v.names.map((n) => (
            <span key={`${n.name}-${n.years}`} className="frsum__name">
              {n.name} {n.years}
            </span>
          ))}
        </dd>
        {v.pennant.runs && (
          <>
            <dt className="t-label">Pennants</dt>
            <dd>{v.pennant.runs}</dd>
          </>
        )}
        {v.title.runs && (
          <>
            <dt className="t-label">World Series</dt>
            <dd>{v.title.runs}</dd>
          </>
        )}
        {v.postseasonYears && (
          <>
            <dt className="t-label">Postseason</dt>
            <dd>{v.postseasonYears}</dd>
          </>
        )}
        {v.best && (
          <>
            <dt className="t-label">{v.since ? `Most wins since ${v.since}` : 'Most wins'}</dt>
            <dd>
              <a className="plink" {...link(managerPath(v.best.id, v.best.name))}>
                {v.best.name}
              </a>{' '}
              {v.best.wl} · {v.best.seasons} {v.best.seasons === 1 ? 'season' : 'seasons'}
            </dd>
          </>
        )}
      </dl>
    </Card>
  )
}
