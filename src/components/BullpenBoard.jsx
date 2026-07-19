import { useMemo } from 'react'
import { availabilityFor, workloadFor } from '../api/workload.js'
import { PlayerLink } from './PlayerLink.jsx'

// The bullpen availability board — who's rested, who's limited, who's likely
// down tonight, from each reliever's recent completed appearances
// (api/workload.js: rule-based flags with published thresholds — 25+ pitches
// yesterday, 35+ over three days, back-to-back days, three straight days).
// Spoiler-free: everything is yesterday-and-earlier; nothing from tonight.
//
// Only rendered for a slate-current game (the workload file describes "now",
// so on an archival box score the flags would be about the wrong day) — the
// caller gates on the game date sitting within the file's freshness window.
const STATUS_LABEL = {
  fresh: 'Fresh',
  limited: 'Limited',
  down: 'Likely down',
}
const STATUS_ORDER = { down: 0, limited: 1, fresh: 2 }

export function BullpenBoard({ workload, bullpen, gameDate }) {
  const rows = useMemo(() => {
    if (!workload || !gameDate || (bullpen?.length ?? 0) === 0) return []
    return bullpen
      .map((p) => {
        const avail = availabilityFor(workload, p.id, gameDate)
        const load = workloadFor(workload, p.id, gameDate)
        if (!avail || !load || avail.status === 'sp') return null
        return {
          id: p.id,
          name: p.nameLastFirst,
          status: avail.status,
          reasons: avail.reasons,
          last3: load.last3?.pitches ?? 0,
          apps7: load.last7dayApps ?? 0,
        }
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3) || b.last3 - a.last3,
      )
  }, [workload, bullpen, gameDate])

  if (rows.length === 0) return null

  return (
    <section className="penboard">
      <h3 className="section__title">Bullpen tonight</h3>
      <ul className="penboard__list">
        {rows.map((r) => (
          <li key={r.id} className="penboard__row">
            <span className={`penboard__status penboard__status--${r.status}`}>
              {STATUS_LABEL[r.status] ?? r.status}
            </span>
            <span className="penboard__namewrap">
              <PlayerLink id={r.id} className="penboard__name">
                {r.name}
              </PlayerLink>
              <span className="penboard__detail">
                {r.reasons.length > 0
                  ? r.reasons.join(' · ')
                  : `${r.last3} pitches over 3 days · ${r.apps7} of last 7`}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="penboard__caveat">
        Rested vs. worked from recent appearances — managers overrule this nightly.
      </p>
    </section>
  )
}
