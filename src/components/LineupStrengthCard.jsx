import { useMemo } from 'react'
import { lineupStrengthFor } from '../api/lineupStrength.js'
import { TierPill } from './TierPill.jsx'

// The Lineup Strength card — tonight's posted batting order graded 0–10
// against the best lineup this roster could field (api/lineupStrength.js:
// WAR-rate values, position eligibility, Hungarian assignment; see
// .scratch/metric-engines/lineup-strength.md). Spoiler-free by construction:
// the starting nine + season aggregates, nothing from tonight's game.
//
// The receipt lines under the score are the point — every deduction is a
// legible sentence ("Yelich on the bench…"), never a mystery number. Renders
// nothing without data (MiLB, file missing) or before the lineup posts.
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
  const name = (id) => data.players?.[String(id)]?.name ?? data.players?.[id]?.name ?? '—'

  return (
    <section className="lstrength">
      <h3 className="section__title">Lineup strength</h3>
      <div className="lstrength__row">
        <span className="lstrength__score">{result.score.toFixed(1)}</span>
        <TierPill tier={result.tier} />
      </div>
      {result.items.length > 0 ? (
        <ul className="lstrength__receipt">
          {result.items.map((it, i) => (
            <li key={i} className="lstrength__item">
              <span className="lstrength__itemtext">
                {it.kind === 'bench'
                  ? `${name(it.inId)} on the bench — ${name(it.outId)} gets ${it.slot} tonight`
                  : `${name(it.id)} at ${it.slot}, off his usual spot`}
              </span>
              <span className="lstrength__delta">−{it.deltaRpg.toFixed(2)} r/g</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="lstrength__clean">Full-strength — this is the roster’s best nine.</p>
      )}
      <p className="lstrength__caveat">
        Graded against this roster’s ceiling on season numbers. Rest days, nagging
        injuries, and matchup plans the model can’t see all count against it.
      </p>
    </section>
  )
}
