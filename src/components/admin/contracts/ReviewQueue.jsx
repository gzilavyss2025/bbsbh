// Region 2 of the contract identity workbench: the queue. A fixed 240px rail
// that scrolls on its own, so the decision pane beside it never moves when the
// list does.
//
// Biggest group first, which is the whole reason the rail is grouped at all: a
// reviewer who works top down clears the most rows per decision, and the count
// pill is the honest advertisement of what each decision buys.
import { useEffect, useRef } from 'react'
import { isGroupResolved, openRows } from '../../../lib/admin/contractGroups.js'

const SOURCE_TAG = {
  extensions: 'EXT',
  arbitration: 'ARB',
  free_agency: 'FA',
  salaries: 'SAL',
}

function QueueItem({ group, selected, overrides, onSelect }) {
  const ref = useRef(null)

  useEffect(() => {
    // Arrow keys move the selection, so the selection has to be able to move
    // the scroll. `nearest` keeps a click from yanking the rail around.
    if (selected) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const done = isGroupResolved(group, overrides)
  const open = openRows(group, overrides).length
  const span =
    group.firstSeason == null
      ? ''
      : group.lastSeason === group.firstSeason
        ? `${group.firstSeason}`
        : `${group.firstSeason}–${group.lastSeason}`

  return (
    <li>
      <button
        ref={ref}
        type="button"
        className={`cwb__qitem${selected ? ' cwb__qitem--on' : ''}${done ? ' cwb__qitem--done' : ''}`}
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(group.key)}
      >
        <span className="cwb__qname caps-exempt">{group.rawName}</span>
        <span className="cwb__qsub caps-exempt">
          <span className="cwb__qtag">{SOURCE_TAG[group.sourceFile] ?? group.sourceFile}</span>
          {span && <span>{span}</span>}
          {done && <span className="cwb__qdone">done</span>}
          {!done && group.count > 1 && open < group.count && <span>{open} left</span>}
        </span>
        <span className="cwb__qcount caps-exempt">{group.count}</span>
      </button>
    </li>
  )
}

export function ReviewQueue({ groups, selectedKey, overrides, onSelect }) {
  return (
    <nav className="cwb__queue" aria-label="Review queue">
      {groups.length === 0 ? (
        <p className="cwb__hint caps-exempt">
          Nothing left in this tier. Switch tabs, or turn on reviewed rows to look back.
        </p>
      ) : (
        <ol className="cwb__qlist">
          {groups.map((group) => (
            <QueueItem
              key={group.key}
              group={group}
              selected={group.key === selectedKey}
              overrides={overrides}
              onSelect={onSelect}
            />
          ))}
        </ol>
      )}
    </nav>
  )
}
