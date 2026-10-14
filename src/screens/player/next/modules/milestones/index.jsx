import { useEffect, useMemo } from 'react'
import '../../../../../styles/player-next/gamelog/milestones.css'
import { loadMilestoneWatch, milestonesForPlayer } from '../../../../../api/milestones.js'
import { Notice } from '../../../../../components/ui/state/Notice.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { useMilestonesPaused } from '../../../../../hooks/useOffseason.js'
import { milestonesFor } from './milestonesData.js'
import { milestonesView } from './milestonesView.js'

const n = (v) => v.toLocaleString('en-US')

// Milestone watch (#2017): a countdown ledger to each round career mark in reach.
// Open surface (ADR-0034). With asOf set the counts stop the day before and there is no projection.
export default function MilestonesModule({ bio, role, asOf, season, onEmpty, onCount }) {
  const { data: rows, loading } = useAsync(() => milestonesFor(bio, role, season, asOf), [bio.id, role, season, asOf])
  const { data: watch } = useAsync(() => (asOf ? null : loadMilestoneWatch()), [asOf])
  const paused = useMilestonesPaused(!asOf && !!rows?.length)
  const view = useMemo(
    () =>
      milestonesView({
        rows,
        projections: watch ? milestonesForPlayer(watch, bio.id) : [],
        paused,
        asOf,
        twoWay: bio.twoWay,
        role,
      }),
    [rows, watch, paused, asOf, bio.id, bio.twoWay, role],
  )
  const empty = !loading && !view
  useEffect(() => {
    if (empty) onEmpty()
    else if (view) onCount?.(view.tag)
  }, [empty, view, onEmpty, onCount])
  if (loading) return <div className="milestones milestones--loading" aria-busy="true" />
  if (empty) return null
  return (
    <div className="milestones">
      {view.group && <p className="milestones__group">{view.group}</p>}
      <ul className="milestones__list">
        {view.rows.map((r) => (
          <li key={r.key} className={`milestones__row${r.inked ? ' milestones__row--ink' : ''}`}>
            <p className="milestones__line">
              <span className="milestones__now mono">
                {n(r.value)} <abbr title={r.label}>{r.label}</abbr>
              </span>
              <span className="milestones__shy">
                {n(r.remaining)} shy of {n(r.threshold)}
              </span>
            </p>
            <div className="milestones__bar" role="img" aria-label={`${n(r.value)} of ${n(r.threshold)} ${r.label}, ${r.fill}% of the way from ${n(r.from)}`}>
              <span className="milestones__fill" style={{ width: `${r.fill}%` }} />
            </div>
            <p className="milestones__ends mono">
              <span>{n(r.from)}</span>
              <span>{n(r.threshold)}</span>
            </p>
            <p className="milestones__proj">
              <span>Proj.</span> <b className="mono">{r.eta ?? '—'}</b>
            </p>
          </li>
        ))}
      </ul>
      {view.note && <Notice size="compact" role="note">{view.note}</Notice>}
    </div>
  )
}
