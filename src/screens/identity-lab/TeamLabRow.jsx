import { useEffect, useState } from 'react'
import { fetchLastOpponent } from '../../api/schedule.js'
import { teamAnchorId } from './teamAnchorId.js'

// One club's collapsible row. `children` is a render function taking the row's
// resolved `lastOpponent`, so the tiles inside can hand it to WpaScenarios.
//
// The opponent is fetched once, lazily, and only while the row is EXPANDED:
// `undefined` means "haven't tried yet". A fresh visit starts every row
// collapsed (see the collapsed store's own default) specifically so a page load
// doesn't fire 30 — or, at the MiLB levels, 120 — schedule requests up front;
// unlike the one batched uniform-catalog fetch, there's no multi-team schedule
// endpoint to spread this over. It stays cached in this row's state once it
// resolves, so re-collapsing and re-expanding never re-fetches.
export function TeamLabRow({ teamId, name, sportId, badge, collapsed, onToggleCollapsed, children }) {
  const [lastOpponent, setLastOpponent] = useState(undefined)
  useEffect(() => {
    if (collapsed || lastOpponent !== undefined) return
    let cancelled = false
    fetchLastOpponent(teamId, new Date().getFullYear(), sportId).then((opp) => {
      if (!cancelled) setLastOpponent(opp ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [collapsed, teamId, sportId, lastOpponent])

  return (
    <section className="colorlab__row" id={teamAnchorId(teamId)}>
      <button
        type="button"
        className="colorlab__teamtoggle"
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
      >
        <span className="colorlab__teamname">{name}</span>
        {badge}
        <span className="colorlab__teamchevron" aria-hidden="true">
          {collapsed ? '▸' : '▾'}
        </span>
      </button>
      {!collapsed && <div className="colorlab__treatments">{children(lastOpponent)}</div>}
    </section>
  )
}
