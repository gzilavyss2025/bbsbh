import { useId } from 'react'
import { loadHotCold } from '../../api/hotcold/load.js'
import { useAsync } from '../../hooks/useAsync.js'
import { Door } from '../../components/ui/control/Door.jsx'
import { useRouteLink } from '../../lib/nav.js'
import { playerPath } from '../../lib/route.js'
import { HotColdCallout } from '../player/next/top/HotCold.jsx'
import { hotColdView } from '../player/next/top/hotColdView.js'
import { sampleOf, shownFlags, titleOf, valueOf } from './outliersView.js'

// An open row's body: the callout as the player page prints it (hotColdView over the same
// loadHotCold call, with the slider's cutoff), the other players flagged for the same
// callout type, and the way to his page. One game-log call, made when the row opens.
function Detail({ flag, group, cutoff, season, asOf, onPick }) {
  const link = useRouteLink()
  const { data, loading, error } = useAsync(
    () => loadHotCold({ id: flag.id, roles: [flag.role], season, sportId: 1, cutoff }),
    [flag.id, flag.role, season, cutoff],
  )
  const found = data?.flags.find((f) => f.key === flag.key && f.role === flag.role)
  const callout = found && hotColdView(found, { seasons: data.seasons, twoWay: false, name: flag.name, season })
  const others = group.flags.filter((f) => f.id !== flag.id)
  return (
    <div className="outl__detail">
      {loading && <p className="outl__note" role="status">Loading the callout…</p>}
      {!loading && (error || !callout) && <p className="outl__note">Could not load the callout.</p>}
      {callout && (
        <div className="pnext-hc">
          <HotColdCallout callout={callout} selfId={flag.id} />
        </div>
      )}
      {others.length > 0 && (
        <div className="outl__others">
          <p className="outl__note">{`Also flagged for this: ${others.length}`}</p>
          <ul className="outl__names">
            {others.map((o) => (
              <li key={o.id}>
                <button type="button" className="outl__name" onClick={() => onPick(o)}>{o.name}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Door {...link(playerPath(flag.id, { d: asOf, name: flag.name }))}>Open player page</Door>
    </div>
  )
}

// One callout type: its title, the top PREVIEW rows and "+ N more". A row is a real button
// (aria-expanded); one row is open at a time, held by the page.
export function OutlierGroup({ group, openId, onOpen, all, onAll, cutoff, season, asOf }) {
  const base = useId()
  const rowId = (flag) => `${group.id}:${flag.id}`
  const openIndex = group.flags.findIndex((f) => rowId(f) === openId)
  const shown = shownFlags(group.flags, { all, openIndex })
  const hidden = group.flags.length - shown.length
  return (
    <section className={`outl__group outl__group--${group.tone}`} aria-labelledby={`${base}-t`}>
      <h3 id={`${base}-t`} className="outl__title">
        {titleOf(group)}
        <span className="outl__count">{group.flags.length}</span>
      </h3>
      <ol className="outl__rows">
        {shown.map((flag) => {
          const open = rowId(flag) === openId
          return (
            <li key={flag.id} className="outl__row">
              <button
                type="button"
                className="outl__head"
                aria-expanded={open}
                aria-controls={open ? `${base}-${flag.id}` : undefined}
                onClick={() => onOpen(open ? null : rowId(flag))}
              >
                <span className="outl__who">{flag.name}</span>
                <span className="outl__weight">{flag.weight}</span>
                <span className="outl__sample">{sampleOf(flag)}</span>
                <span className="outl__value">{valueOf(flag)}</span>
              </button>
              {open && (
                <div id={`${base}-${flag.id}`}>
                  <Detail
                    flag={flag}
                    group={group}
                    cutoff={cutoff}
                    season={season}
                    asOf={asOf}
                    onPick={(o) => onOpen(rowId(o))}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ol>
      {hidden > 0 && (
        <Door layout="block" onClick={onAll}>{`+ ${hidden} more`}</Door>
      )}
    </section>
  )
}
