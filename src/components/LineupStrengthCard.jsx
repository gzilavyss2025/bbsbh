import { useMemo } from 'react'
import { lineupStrengthFor } from '../api/lineupStrength.js'
import { InfoPopover } from './InfoPopover.jsx'
import { SectionMasthead } from './SectionMasthead.jsx'

// The Lineup Strength card — tonight's posted batting order graded 0–10
// against the best lineup this roster could field (api/lineupStrength.js:
// wRC+ bats, fielding runs, position eligibility, Hungarian assignment; see
// docs/lineup-strength.md). Spoiler-free by construction: the starting nine +
// season aggregates, nothing from tonight's game.
//
// SCORE ONLY, DELIBERATELY. The card shows the grade, its tier word, and the
// partial-grade caveat — nothing else. The receipt that explains the grade is
// still computed and unit-tested (`lineupStrengthFor().rows`); it is simply not
// rendered yet, because HOW to explain a grade is an open design question and a
// half-settled answer is worse than none.
//
// The deductions table that used to live here was retired once the model was
// reworked (docs/lineup-strength.md): a table is scannable but reads badly for a
// "chain" — a change that shifts three or four players along, which is 43% of all
// findings. Prose handles those far better and single findings better still, but
// it walls up at the 24% of lineups with three or more, and it loses the aligned
// column you scan to find the biggest deduction. That trade is unresolved.
//
// Everything needed to resume is in place: `rows` carries kind, position, both
// names, the departing player's own position, and the men who shift between.
// See docs/lineup-strength.md "Explaining the grade" for the options and the
// measurements behind them. Renders nothing without data (MiLB, file missing) or
// before the lineup posts.
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
  const { strengthTier, ungraded } = result
  // A starter with no value in either data file (a trade/call-up more recent than
  // the nightly build): his slot is left out of the grade, said plainly here so a
  // partial grade never masquerades as a complete one.
  const unvalued = ungraded ?? []

  return (
    <section className="metriccard lstrength">
      <SectionMasthead title="Lineup strength">
        <InfoPopover label="How lineup strength is graded">
          Graded on season bats and gloves against the best nine this roster
          could field. Rest days, nagging injuries, and matchup plans the model
          can’t see all count against it.
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
      </div>
    </section>
  )
}
