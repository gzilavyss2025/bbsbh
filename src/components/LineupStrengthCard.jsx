import { useMemo } from 'react'
import { lineupStrengthFor } from '../api/lineupStrength.js'
import { InfoPopover } from './InfoPopover.jsx'
import { SectionMasthead } from './SectionMasthead.jsx'

// The Lineup Strength card — tonight's posted batting order graded 0–10
// against the best lineup this roster could field (api/lineupStrength.js:
// WAR-rate values, position eligibility, Hungarian assignment; see
// .scratch/metric-engines/lineup-strength.md). Spoiler-free by construction:
// the starting nine + season aggregates, nothing from tonight's game.
//
// The hero score + tier pill lead; the deductions read as an
// Expected → Starting → cost table (each row a legible line-item, never a
// mystery number). Renders nothing without data (MiLB, file missing) or before
// the lineup posts.
export function LineupStrengthCard({ data, teamId, lineup }) {
  const result = useMemo(() => {
    if (!data || !teamId || (lineup?.length ?? 0) < 9) return null
    return lineupStrengthFor(
      data,
      teamId,
      lineup.map((p) => ({ personId: p.id, position: p.position })),
    )
  }, [data, teamId, lineup])

  if (!result) return null
  const { rows, strengthTier } = result

  return (
    <section className="metriccard lstrength">
      <SectionMasthead title="Lineup strength">
        <InfoPopover label="How lineup strength is graded">
          Graded against this roster’s best nine on season numbers. Rest days,
          nagging injuries, and matchup plans the model can’t see all count
          against it.
        </InfoPopover>
      </SectionMasthead>
      <div className="metriccard__body">
        <div className="lstrength__hero">
          <span className="lstrength__score">
            {result.score.toFixed(1)}
            <span className="lstrength__of"> / 10</span>
          </span>
          <span className={`lstrengthtier lstrengthtier--${strengthTier.colorTier}`}>
            {strengthTier.label}
          </span>
        </div>

        {rows.length > 0 ? (
          <table className="lstrength__table">
            <thead>
              <tr>
                <th className="lstrength__pos" scope="col">Pos</th>
                <th scope="col">Expected</th>
                <th scope="col">Starting</th>
                <th className="lstrength__rg" scope="col">R/G</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="lstrength__pos">{r.pos}</td>
                  <td className="lstrength__expected">
                    {r.expected ?? (
                      <span className="lstrength__oop" title="Out of position — no displaced starter">
                        —
                      </span>
                    )}
                  </td>
                  <td className="lstrength__starting">{r.starting ?? '—'}</td>
                  <td className="lstrength__rg">−{r.deltaRpg.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="lstrength__clean">Full-strength — this is the roster’s best nine.</p>
        )}
      </div>
    </section>
  )
}
