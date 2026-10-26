import { BaseState } from '../../../components/scoring/BaseState.jsx'

// The band: score, half, bases, outs, the pitcher and his count. It takes HeaderBug's props, so
// ScorebugMount's reveal clamp stays the only gate on the score. The count is not in the live
// snapshot yet: the hero slice (#2576) brings it.
export function GamedayBand({
  awayAbbr, homeAbbr, awayRuns = 0, homeRuns = 0, inning, half, final = false, pitcher, bases, outs = 0,
}) {
  const top = half === 'top'
  return (
    <div className="gdnext-band">
      <div className="gdnext-band__score" role="img" aria-label={`${awayAbbr} ${awayRuns}, ${homeAbbr} ${homeRuns}`}>
        <span><b>{awayAbbr}</b><em>{awayRuns}</em></span>
        <span><b>{homeAbbr}</b><em>{homeRuns}</em></span>
      </div>
      <div className="gdnext-band__half">{final ? 'Final' : `${top ? '▲' : '▼'} ${inning}`}</div>
      <div className="gdnext-band__state">
        <BaseState bases={bases} size={32} />
        <span className="gdnext-band__outs" role="img" aria-label={`${outs} out`}>
          {[0, 1, 2].map((i) => <i key={i} className={i < outs ? 'is-out' : ''} />)}
        </span>
        {pitcher && <span className="gdnext-band__pc">{pitcher.last}<br />P {pitcher.pitches}</span>}
      </div>
    </div>
  )
}
