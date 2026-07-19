import { useNav } from '../lib/nav.js'
import { foulsPath } from '../lib/route.js'
import { fetchFouls, batterFoulLine, pitcherFoulLine } from '../api/fouls.js'
import { useAsync } from '../hooks/useAsync.js'

// The player page's foul-ball card — his season foul line from the nightly
// gen-fouls.mjs sweep, batter or pitcher flavored to match the stat block
// it sits in. Self-fetching like MilestoneWatchCard. Current-day only: the
// precompute can't be cut to a historical `asOf`, so a spoiler-scoped page
// (linked from a sealed game) hides it — same rule the Milestone Watch
// projection follows. Null data (MiLB, file missing, no line) → no card.
export function FoulCard({ playerId, group, asOf }) {
  const navigate = useNav()
  const skip = !!asOf
  const { data } = useAsync(
    () => (skip ? Promise.resolve(null) : fetchFouls()),
    [skip],
  )
  if (skip || !data) return null

  const line = group === 'pitching' ? pitcherFoulLine(data, playerId) : batterFoulLine(data, playerId)
  if (!line) return null

  const tiles =
    group === 'pitching'
      ? [
          { k: 'Fouled off', v: line.fouls },
          { k: 'Foul rate', v: pct(line.fouls / line.pitches) },
          { k: 'Per whiff', v: line.whiffs > 0 ? (line.fouls / line.whiffs).toFixed(1) : '—' },
        ]
      : [
          { k: 'Fouls', v: line.fouls },
          { k: 'Per game', v: (line.fouls / Math.max(1, line.g)).toFixed(1) },
          { k: 'At 2 strikes', v: line.twoStrikeFouls },
          { k: 'Game high', v: line.maxGameFouls ?? '—' },
        ]

  return (
    <div className="foulcard">
      <h3 className="section__title">
        <span>Foul balls</span>
        <em>this season</em>
      </h3>
      <dl className="factgrid">
        {tiles.map((t) => (
          <div className="fact" key={t.k}>
            <dt className="fact__label">{t.k}</dt>
            <dd className="fact__value">{t.v}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className="plink foulcard__more" onClick={() => navigate(foulsPath())}>
        League foul tracker ›
      </button>
    </div>
  )
}

const pct = (x) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : '—')
