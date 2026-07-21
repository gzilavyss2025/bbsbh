import { useMemo, useState } from 'react'
import { availabilityFor, bullpenStatusCounts, workloadFor } from '../api/workload.js'
import { InfoPopover } from './InfoPopover.jsx'
import { PlayerLink } from './PlayerLink.jsx'
import { SectionMasthead } from './SectionMasthead.jsx'

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
// Summary pills read best-to-worst (fresh → limited → down), the reverse of the
// board's down-first sort.
const PILL_ORDER = ['fresh', 'limited', 'down']

// 'Left' / 'Right' handedness -> pitcher shorthand.
function handAbbr(hand) {
  const h = (hand || '').toLowerCase() // caps-js-exempt: normalizing for comparison below, not display casing
  if (h.startsWith('l')) return 'LHP'
  if (h.startsWith('r')) return 'RHP'
  return ''
}

// The reason an arm sits where it does — the flag(s) that tripped, else a
// plain recent-workload summary. Kept off the board face (it was visual noise)
// and surfaced only as the row's hover title.
function detailFor(r) {
  if (r.reasons.length > 0) return r.reasons.join(' · ')
  if (r.last3apps > 0) {
    return `${r.last3} pitches over last ${r.last3apps} outing${r.last3apps === 1 ? '' : 's'} · ${r.apps7} app${r.apps7 === 1 ? '' : 's'} in 7 days`
  }
  return 'No recent appearances'
}

export function BullpenBoard({ workload, bullpen, gameDate }) {
  // The status a top summary pill is being hovered — matching board rows stay
  // lit, the rest dim. Pointer-only accent (nothing is hidden), so it needs no
  // keyboard/ARIA affordance.
  const [litStatus, setLitStatus] = useState(null)

  const rows = useMemo(() => {
    if (!workload || !gameDate || (bullpen?.length ?? 0) === 0) return []
    return bullpen
      .map((p) => {
        const avail = availabilityFor(workload, p.id, gameDate)
        const load = workloadFor(workload, p.id, gameDate)
        // Rotation arms parked in the boxscore's pregame bullpen list aren't
        // pen availability — this is a bullpen board, not a rotation one.
        if (!avail || !load || load.role === 'SP') return null
        return {
          id: p.id,
          name: p.nameLastFirst,
          jersey: p.jersey || '',
          hand: handAbbr(p.hand),
          status: avail.status,
          reasons: avail.reasons,
          last3: load.last3?.pitches ?? 0,
          // Count of appearances in the last-3-OUTINGS bucket (which can span
          // far more than 3 days) — words the workload summary accurately.
          last3apps: load.last3?.apps ?? 0,
          apps7: load.last7dayApps ?? 0,
        }
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3) || b.last3 - a.last3,
      )
  }, [workload, bullpen, gameDate])

  const counts = useMemo(() => bullpenStatusCounts(rows.map((r) => r.status)), [rows])

  if (rows.length === 0) return null

  return (
    <section className="metriccard penboard">
      <SectionMasthead title="Bullpen tonight">
        <InfoPopover label="How bullpen availability is judged">
          Rested vs. worked from recent appearances — a workload signal, not a
          talent grade. Managers overrule it nightly.
        </InfoPopover>
      </SectionMasthead>
      <div className="metriccard__body">
        <div className="penboard__pills">
          {PILL_ORDER.filter((s) => counts[s] > 0).map((s) => (
            <span
              key={s}
              className={`penboard__pill penboard__pill--${s}`}
              onMouseEnter={() => setLitStatus(s)}
              onMouseLeave={() => setLitStatus(null)}
            >
              <span className="penboard__pillnum">{counts[s]}</span> {STATUS_LABEL[s]}
            </span>
          ))}
        </div>
        <ul className="penboard__list">
          {rows.map((r) => (
            <li
              key={r.id}
              className={`penboard__row${litStatus && litStatus !== r.status ? ' penboard__row--dim' : ''}`}
            >
              <span
                className={`penboard__tag penboard__tag--${r.status}`}
                title={detailFor(r)}
              >
                {STATUS_LABEL[r.status] ?? r.status}
              </span>
              <PlayerLink id={r.id} className="penboard__name">
                {r.name}
              </PlayerLink>
              <span className="penboard__badges">
                {r.jersey && <span className="penboard__jersey">{r.jersey}</span>}
                {r.hand && <span className="penboard__hand">{r.hand}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
