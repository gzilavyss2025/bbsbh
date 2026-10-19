import { useInViewOnce } from '../../../hooks/scroll/useInViewOnce.js'
import { fmtValue } from '../../../lib/scout/metrics.js'
import { Card } from '../../../components/ui/frame/Card.jsx'
import { listOf } from './edge.js'

// WHAT PUSHES IT (#2319): each pitch's part of the gap, usage x (his rate minus
// the league's). The bars run from the league line toward the side that gains.
const lower = (s) => s.toLowerCase() // caps-js-exempt: a pitch name inside a sentence
const signed = (x) => `${x < 0 ? '−' : '+'}${fmtValue('xwoba', Math.abs(x))}`

export function Pushes({ v, names, crowd, once }) {
  const [ref, phase] = useInViewOnce(once)
  const unmapped = v.rows.filter((r) => !r.mapped)
  return (
    <>
    <Card frame="stamped" label="What pushes it" labelAs="h3" className="scout__pushes" ref={ref} data-motion={phase}>
      <p className="scout__pushnote">
        Each pitch’s usage × {names.hitter}’s gap to the league. They add up to {signed(v.gap)}.
      </p>
      <ul className="scout__pushlist">
        {v.rows.map((r, i) => (
          <li key={r.code} className="scout__push" style={{ '--i': i }}>
            <span className="scout__pushname">
              {r.name}
              <span className="scout__pushshare">{Math.round(r.share * 100)}% of pitches</span>
            </span>
            <span className="scout__pushbar" aria-hidden="true">
              <span
                className={`scout__pushfill scout__pushfill--${r.push < 0 ? 'pitcher' : 'hitter'}`}
                style={{ width: `${Math.min(50, (Math.abs(r.push) / 0.015) * 50)}%` }}
              />
            </span>
            <span className={`scout__pushval scout__pushval--${r.push < 0 ? 'pitcher' : 'hitter'}`}>{signed(r.push)}</span>
          </li>
        ))}
      </ul>
    </Card>
      <p className="scout__pushnote scout__edgenote">
        xwOBA (est.) counts every plate appearance, and a strikeout counts 0, so whiffs are already in this number.
        {unmapped.length > 0 &&
          ` ${names.hitter}’s whole-pitch rate stands in for the ${listOf(unmapped.map((r) => `${lower(r.name)} (${r.n})`))}: too few to ${crowd} for a map.`}
      </p>
    </>
  )
}
