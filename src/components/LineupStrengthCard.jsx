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
    // Posted names, so a starter valued only from war.json (not in the values
    // file, where names live) still reads by name in the receipt.
    const names = Object.fromEntries(lineup.map((p) => [String(p.id), p.name]))
    return lineupStrengthFor(
      data,
      teamId,
      lineup.map((p) => ({ personId: p.id, position: p.position })),
      names,
    )
  }, [data, teamId, lineup])

  if (!result) return null
  const { rows, strengthTier, ungraded } = result
  // A starter with no value in either data file (a trade/call-up more recent than
  // the nightly build): his slot is left out of the grade, said plainly here so a
  // partial grade never masquerades as a complete one.
  const unvalued = ungraded ?? []
  // Two kinds of deduction, split into their own tables: a personnel swap (a
  // better bat sat) reads as Expected → Starting; an out-of-position start reads
  // as who's playing where vs. where he usually plays. Both priced in points off
  // the 10, not raw runs/game.
  const swaps = rows.filter((r) => r.kind === 'bench')
  const outOfPos = rows.filter((r) => r.kind === 'oop')

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

        {unvalued.length > 0 && (
          <p className="lstrength__partial">
            {unvalued.map((u) => u.name || u.slot).join(', ')} not yet in the season
            data — graded on the rest of the order.
          </p>
        )}

        {rows.length === 0 && (
          <p className="lstrength__clean">Full-strength — this is the roster’s best nine.</p>
        )}

        {swaps.length > 0 && (
          <table className="lstrength__table">
            <caption className="lstrength__caption">Stronger bats on the bench</caption>
            <thead>
              <tr>
                <th className="lstrength__pos" scope="col">Pos</th>
                <th scope="col">Expected</th>
                <th scope="col">Starting</th>
                <th className="lstrength__pts" scope="col">Impact</th>
              </tr>
            </thead>
            <tbody>
              {swaps.map((r, i) => (
                <tr key={i}>
                  <td className="lstrength__pos">{r.pos}</td>
                  <td className="lstrength__expected">{r.expected}</td>
                  <td className="lstrength__starting">{r.starting ?? '—'}</td>
                  <td className="lstrength__pts">−{r.scoreImpact.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {outOfPos.length > 0 && (
          <table className="lstrength__table lstrength__ooptable">
            <caption className="lstrength__caption">Playing out of position</caption>
            <thead>
              <tr>
                <th scope="col">Player</th>
                <th className="lstrength__pos" scope="col">Playing</th>
                <th className="lstrength__pos" scope="col">Usually</th>
                <th className="lstrength__pts" scope="col">Impact</th>
              </tr>
            </thead>
            <tbody>
              {outOfPos.map((r, i) => (
                <tr key={i}>
                  <td className="lstrength__starting">{r.starting ?? '—'}</td>
                  <td className="lstrength__pos">{r.pos}</td>
                  <td className="lstrength__pos">{r.usualPos ?? '—'}</td>
                  <td className="lstrength__pts">−{r.scoreImpact.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
